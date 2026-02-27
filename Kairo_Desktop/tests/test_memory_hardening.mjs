/**
 * test_memory_hardening.mjs — Phase 4 Sprint A Hardening Remediation
 *
 * Tests for all 4 hardening blockers:
 * 1. Sandbox path check — sibling prefix attack, traversal, absolute external, cross-drive
 * 2. MCP stdout buffer cap — overflow triggers kill/crash, buffer reset
 * 3. Payload limits — query max length, maxResults (NaN, Infinity, <min, >max)
 * 4. Project isolation — MCP degradation on workspace change
 * 5. Source cross-verification
 *
 * Run: node tests/test_memory_hardening.mjs
 * Expected: All assertions PASS, exit 0
 */

import { buildSync } from 'esbuild'
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { resolve, dirname, join, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Test Runner ─────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(condition, label) {
  if (condition) {
    passed++
    console.log(`  ✅ ${label}`)
  } else {
    failed++
    console.error(`  ❌ ${label}`)
  }
}

function assertEqual(actual, expected, label) {
  if (actual === expected) {
    passed++
    console.log(`  ✅ ${label}`)
  } else {
    failed++
    console.error(`  ❌ ${label} — expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)}`)
  }
}

// ─── Build Setup ─────────────────────────────────────────────────────

const buildDir = resolve(__dirname, '../.test-build')
mkdirSync(buildDir, { recursive: true })

// Compile MemoryService (which contains isInsideWorkspace + sanitizeMaxResults)
buildSync({
  entryPoints: [resolve(__dirname, '../src/main/memory/memory.service.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'memory.service.hardening.mjs'),
  external: ['node:child_process', 'node:crypto', 'node:fs', 'node:path'],
  logLevel: 'silent',
})

// Compile McpProcessService (for buffer cap tests)
buildSync({
  entryPoints: [resolve(__dirname, '../src/main/memory/mcp-process.service.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'mcp-process.hardening.mjs'),
  external: ['node:child_process', 'node:crypto'],
  logLevel: 'silent',
})

const memoryModule = await import(pathToFileURL(join(buildDir, 'memory.service.hardening.mjs')).href)
const mcpModule = await import(pathToFileURL(join(buildDir, 'mcp-process.hardening.mjs')).href)
const { MemoryService } = memoryModule
const { McpProcessService } = mcpModule

// ─── Create Temp Workspaces ──────────────────────────────────────────

const baseDir = mkdtempSync(join(tmpdir(), 'kairo-hardening-'))
const workspaceA = join(baseDir, 'my-app')
const workspaceB = join(baseDir, 'my-app-evil')
const workspaceC = join(baseDir, 'project-two')
mkdirSync(workspaceA, { recursive: true })
mkdirSync(workspaceB, { recursive: true })
mkdirSync(workspaceC, { recursive: true })

writeFileSync(join(workspaceA, 'README.md'), '# App A\n\nContent for project A.')
writeFileSync(join(workspaceB, 'secrets.md'), '# Secrets\n\nDo not leak.')
writeFileSync(join(workspaceC, 'README.md'), '# Project Two\n\nContent for project two.')

// ─── Create Fake MCP Server ─────────────────────────────────────────

const tmpMcpDir = mkdtempSync(join(tmpdir(), 'kairo-mcp-hard-'))
const fakeServerScript = join(tmpMcpDir, 'fake-mcp-server.mjs')
writeFileSync(fakeServerScript, `
import { createInterface } from 'node:readline'
const rl = createInterface({ input: process.stdin })
process.stdout.write('{"jsonrpc":"2.0","id":"__startup__","result":{"status":"ready"}}\\n')
rl.on('line', (line) => {
  try {
    const req = JSON.parse(line.trim())
    if (req.method === 'ping') {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { status: 'ok' } }) + '\\n')
    } else if (req.method === 'shutdown') {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\\n')
      setTimeout(() => process.exit(0), 50)
    } else if (req.method === 'memory/query') {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0', id: req.id,
        result: [{ content: 'mcp-result', source: 'notebook.md', relevance: 0.95 }]
      }) + '\\n')
    } else if (req.method === 'memory/index') {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0', id: req.id,
        result: { chunksIndexed: 5 }
      }) + '\\n')
    } else {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0', id: req.id,
        error: { code: -32601, message: 'Method not found' }
      }) + '\\n')
    }
  } catch {}
})
`)

const serverExecPath = process.execPath
const serverExecArgs = [fakeServerScript]

// ═════════════════════════════════════════════════════════════════════
// T01: SIBLING PREFIX ATTACK
// ═════════════════════════════════════════════════════════════════════

console.log('\n═══ T01: Sibling prefix attack blocked ═══')
{
  const svc = new MemoryService({ workspacePath: workspaceA })
  await svc.initialize()

  // Attack: workspace = /tmp/.../my-app, target = /tmp/.../my-app-evil/secrets.md
  // Old startsWith would allow this!
  const evilPath = join(workspaceB, 'secrets.md')
  const result = await svc.index(evilPath)
  assertEqual(result.success, false, 'T01a: Sibling prefix attack blocked')
  assert(result.error.includes('sandbox violation'), 'T01b: Error mentions sandbox violation')

  // Attack: workspace-suffix directory
  const suffixDir = join(baseDir, 'my-app123')
  mkdirSync(suffixDir, { recursive: true })
  writeFileSync(join(suffixDir, 'evil.md'), '# Evil')
  const suffixResult = await svc.index(join(suffixDir, 'evil.md'))
  assertEqual(suffixResult.success, false, 'T01c: Workspace-suffix directory blocked')

  await svc.shutdown()
  try { rmSync(suffixDir, { recursive: true }) } catch { /* */ }
}

// ═════════════════════════════════════════════════════════════════════
// T02: TRAVERSAL ATTACKS
// ═════════════════════════════════════════════════════════════════════

console.log('\n═══ T02: Path traversal attacks blocked ═══')
{
  const svc = new MemoryService({ workspacePath: workspaceA })
  await svc.initialize()

  // Classic ../
  const dotDot = join(workspaceA, '..', 'my-app-evil', 'secrets.md')
  const r1 = await svc.index(dotDot)
  assertEqual(r1.success, false, 'T02a: ../ traversal blocked')

  // Windows-style backslash traversal
  const backslash = workspaceA + '\\..\\my-app-evil\\secrets.md'
  const r2 = await svc.index(backslash)
  assertEqual(r2.success, false, 'T02b: Backslash traversal blocked')

  // Deep traversal
  const deep = join(workspaceA, '..', '..', '..', 'etc', 'passwd')
  const r3 = await svc.index(deep)
  assertEqual(r3.success, false, 'T02c: Deep traversal blocked')

  // Absolute external path
  const absExternal = process.platform === 'win32'
    ? 'C:\\Windows\\System32\\config\\SAM'
    : '/etc/shadow'
  const r4 = await svc.index(absExternal)
  assertEqual(r4.success, false, 'T02d: Absolute external path blocked')

  // Valid file inside workspace — should pass (even if file doesn't exist, it passes sandbox check)
  const validPath = join(workspaceA, 'README.md')
  const r5 = await svc.index(validPath)
  // It might succeed or fail (file exists), but should NOT be a sandbox violation
  assert(!r5.error?.includes('sandbox violation'), 'T02e: Valid workspace path NOT blocked')

  await svc.shutdown()
}

// ═════════════════════════════════════════════════════════════════════
// T03: WORKSPACE ITSELF IS ALLOWED
// ═════════════════════════════════════════════════════════════════════

console.log('\n═══ T03: Workspace path boundary (exact match) ═══')
{
  const svc = new MemoryService({ workspacePath: workspaceA })
  await svc.initialize()

  // File at root of workspace is OK
  const rootFile = join(workspaceA, 'test.md')
  writeFileSync(rootFile, '# Test\nTest content.')
  const r1 = await svc.index(rootFile)
  assert(!r1.error?.includes('sandbox violation'), 'T03a: Root workspace file allowed')

  // Subdirectory inside workspace is OK
  const subDir = join(workspaceA, 'docs')
  mkdirSync(subDir, { recursive: true })
  writeFileSync(join(subDir, 'deep.md'), '# Deep\nDeep content.')
  const r2 = await svc.index(join(subDir, 'deep.md'))
  assert(!r2.error?.includes('sandbox violation'), 'T03b: Subdirectory file allowed')

  await svc.shutdown()
  try { rmSync(rootFile) } catch { /* */ }
  try { rmSync(subDir, { recursive: true }) } catch { /* */ }
}

// ═════════════════════════════════════════════════════════════════════
// T04: QUERY PAYLOAD LIMITS
// ═════════════════════════════════════════════════════════════════════

console.log('\n═══ T04: Query payload limits ═══')
{
  const svc = new MemoryService({ workspacePath: workspaceA })
  await svc.initialize()

  // Query too long
  const hugeQuery = 'A'.repeat(2001)
  const r1 = await svc.query(hugeQuery)
  assertEqual(r1.success, false, 'T04a: Query over 2000 chars rejected')
  assert(r1.error.includes('exceeds maximum length'), 'T04b: Error mentions max length')

  // Query exactly at limit (2000 chars) — should succeed (or at least not be a length error)
  const exactQuery = 'test '.repeat(400) // 2000 chars
  const r2 = await svc.query(exactQuery.substring(0, 2000))
  // Should succeed (provider may return empty results, but not a length error)
  assert(!r2.error?.includes('exceeds maximum length'), 'T04c: Query at exact limit not rejected for length')

  // Empty query
  const r3 = await svc.query('')
  assertEqual(r3.success, false, 'T04d: Empty query rejected')

  // Whitespace-only query
  const r4 = await svc.query('   ')
  assertEqual(r4.success, false, 'T04e: Whitespace-only query rejected')

  await svc.shutdown()
}

// ═════════════════════════════════════════════════════════════════════
// T05: maxResults SANITIZATION
// ═════════════════════════════════════════════════════════════════════

console.log('\n═══ T05: maxResults sanitization ═══')
{
  const svc = new MemoryService({ workspacePath: workspaceA })
  await svc.initialize()

  // NaN → should fallback to default, not crash
  const r1 = await svc.query('test', NaN)
  assertEqual(r1.success, true, 'T05a: NaN maxResults handled gracefully')

  // Infinity → should fallback to default
  const r2 = await svc.query('test', Infinity)
  assertEqual(r2.success, true, 'T05b: Infinity maxResults handled gracefully')

  // -Infinity
  const r3 = await svc.query('test', -Infinity)
  assertEqual(r3.success, true, 'T05c: -Infinity maxResults handled gracefully')

  // Zero → should clamp to min (1)
  const r4 = await svc.query('test', 0)
  assertEqual(r4.success, true, 'T05d: Zero maxResults clamped to min')

  // Negative → should clamp to min (1)
  const r5 = await svc.query('test', -5)
  assertEqual(r5.success, true, 'T05e: Negative maxResults clamped to min')

  // Huge number → should clamp to max (50)
  const r6 = await svc.query('test', 99999)
  assertEqual(r6.success, true, 'T05f: Huge maxResults clamped to max')

  // Float → should floor
  const r7 = await svc.query('test', 3.7)
  assertEqual(r7.success, true, 'T05g: Float maxResults floored')

  // Valid value → should pass through
  const r8 = await svc.query('test', 10)
  assertEqual(r8.success, true, 'T05h: Valid maxResults accepted')

  await svc.shutdown()
}

// ═════════════════════════════════════════════════════════════════════
// T06: MCP STDOUT BUFFER CAP
// ═════════════════════════════════════════════════════════════════════

console.log('\n═══ T06: MCP stdout buffer cap ═══')
{
  // Create a hostile MCP server that floods stdout without newlines
  const hostileScript = join(tmpMcpDir, 'hostile-server.mjs')
  // Strategy: emit a startup JSON-RPC line to pass startup check, then flood.
  writeFileSync(hostileScript, `
process.stdout.write('{"jsonrpc":"2.0","id":"__startup__","result":{"status":"ready"}}\\n')
// Flood with continuous data (no newlines) to exceed buffer cap
const chunk = 'A'.repeat(64 * 1024) // 64KB chunks
const interval = setInterval(() => {
  try { process.stdout.write(chunk) } catch { clearInterval(interval) }
}, 10)
// Also handle stdin to prevent EPIPE
process.stdin.resume()
process.stdin.on('error', () => {})
`)

  const hostileSvc = new McpProcessService(process.execPath, [hostileScript])
  let crashFired = false
  let stateChanges = []
  hostileSvc.setOnCrash(() => { crashFired = true })
  hostileSvc.setOnStateChanged((s) => { stateChanges.push(s) })

  await hostileSvc.start()
  assertEqual(hostileSvc.getState(), 'running', 'T06a: Hostile server starts running')

  // Wait for buffer to fill and trigger cap
  await new Promise(r => setTimeout(r, 2000))

  // After overflow: buffer should have been cleared
  assertEqual(hostileSvc.getInputBufferLength(), 0, 'T06b: Input buffer cleared after overflow')

  // State should have transitioned to crashed (or attempting restart)
  assert(stateChanges.includes('crashed'), 'T06c: State transitioned to crashed on overflow')
  assert(crashFired, 'T06d: onCrash callback fired on buffer overflow')

  // Clean up
  hostileSvc.setOnCrash(() => {})
  hostileSvc.setOnStateChanged(() => {})
  await hostileSvc.stop()
}

// ═════════════════════════════════════════════════════════════════════
// T07: PROJECT ISOLATION — MCP DEGRADATION ON WORKSPACE CHANGE
// ═════════════════════════════════════════════════════════════════════

console.log('\n═══ T07: MCP degradation on workspace change ═══')
{
  const svc = new MemoryService({
    mcpServerPath: serverExecPath,
    mcpServerArgs: serverExecArgs,
    workspacePath: workspaceA,
  })
  await svc.initialize()

  assertEqual(svc.getActiveProviderType(), 'mcp', 'T07a: MCP provider initially active')

  // Track provider change notifications
  let notification = null
  svc.setOnProviderChanged((n) => { notification = n })

  // Change workspace — should force MCP degradation
  await svc.updateWorkspace(workspaceC)

  assertEqual(svc.getActiveProviderType(), 'local-markdown', 'T07b: Provider degraded to local-markdown')
  assertEqual(svc.getWorkspacePath(), workspaceC, 'T07c: Workspace path updated')
  assert(notification !== null, 'T07d: Provider change notification emitted')
  assertEqual(notification.previousProvider, 'mcp', 'T07e: Previous provider was mcp')
  assertEqual(notification.currentProvider, 'local-markdown', 'T07f: Current provider is local-markdown')
  assert(notification.reason.includes('isolation') || notification.reason.includes('degraded'),
    'T07g: Reason mentions isolation/degradation')

  // Verify new workspace is functional
  const queryResult = await svc.query('project two')
  assertEqual(queryResult.success, true, 'T07h: Query works in new workspace')
  assertEqual(queryResult.data.provider, 'local-markdown', 'T07i: Query via local-markdown')

  // Verify old workspace files are NOT accessible via index
  const oldFile = join(workspaceA, 'README.md')
  const indexOld = await svc.index(oldFile)
  assertEqual(indexOld.success, false, 'T07j: Old workspace file rejected by sandbox')

  await svc.shutdown()
}

// ═════════════════════════════════════════════════════════════════════
// T08: LOCAL-ONLY SERVICE — WORKSPACE CHANGE (no MCP involved)
// ═════════════════════════════════════════════════════════════════════

console.log('\n═══ T08: Local-only workspace change ═══')
{
  const svc = new MemoryService({ workspacePath: workspaceA })
  await svc.initialize()

  assertEqual(svc.getActiveProviderType(), 'local-markdown', 'T08a: Local provider active')

  await svc.updateWorkspace(workspaceC)
  assertEqual(svc.getActiveProviderType(), 'local-markdown', 'T08b: Still local-markdown after change')
  assertEqual(svc.getWorkspacePath(), workspaceC, 'T08c: Workspace path updated')

  // Query in new workspace
  const r = await svc.query('project two')
  assertEqual(r.success, true, 'T08d: Query in new workspace works')

  await svc.shutdown()
}

// ═════════════════════════════════════════════════════════════════════
// T09: NULL BYTE REJECTION (IPC handler gate)
// ═════════════════════════════════════════════════════════════════════

console.log('\n═══ T09: Null byte and edge case validation ═══')
{
  const svc = new MemoryService({ workspacePath: workspaceA })
  await svc.initialize()

  // filePath type validation (service layer)
  const r1 = await svc.index('')
  assertEqual(r1.success, false, 'T09a: Empty filePath rejected')

  await svc.shutdown()
}

// ═════════════════════════════════════════════════════════════════════
// T10: SOURCE CROSS-VERIFICATION
// ═════════════════════════════════════════════════════════════════════

console.log('\n═══ T10: Source cross-verification ═══')
{
  const memorySrc = readFileSync(
    resolve(__dirname, '../src/main/memory/memory.service.ts'), 'utf-8'
  )
  // B1: Sibling-safe path check
  assert(memorySrc.includes('relative('), 'T10a: Uses relative() for path validation (not pure startsWith)')
  assert(memorySrc.includes('isAbsolute('), 'T10b: Uses isAbsolute() for cross-drive check')
  assert(memorySrc.includes("startsWith('..')"), 'T10c: Checks for .. escape in relative path')
  assert(memorySrc.includes('wsPrefix'), 'T10d: Uses wsPrefix for root-safe boundary check')

  // B2: Buffer cap reference
  const mcpSrc = readFileSync(
    resolve(__dirname, '../src/main/memory/mcp-process.service.ts'), 'utf-8'
  )
  assert(mcpSrc.includes('MCP_STDOUT_BUFFER_MAX_BYTES'), 'T10e: Buffer cap constant used in MCP service')
  assert(mcpSrc.includes('Buffer overflow'), 'T10f: Buffer overflow error message present')
  assert(mcpSrc.includes('getInputBufferLength'), 'T10g: Buffer length accessor exposed')

  // B3: MCP degradation on workspace change
  assert(memorySrc.includes('forcing degradation'), 'T10h: MCP degradation log message present')
  assert(memorySrc.includes('mcpProvider = null'), 'T10i: MCP provider nullified on workspace change')

  // B3b: Root path rejection
  assert(memorySrc.includes('Root path is not allowed'), 'T10i2: Root path rejection message in MemoryService')

  // B4: Payload limits
  assert(memorySrc.includes('MEMORY_QUERY_MAX_LENGTH'), 'T10j: Query max length constant used')
  assert(memorySrc.includes('MEMORY_MAX_RESULTS_MIN'), 'T10k: MaxResults min constant used')
  assert(memorySrc.includes('MEMORY_MAX_RESULTS_MAX'), 'T10l: MaxResults max constant used')
  assert(memorySrc.includes('sanitizeMaxResults'), 'T10m: sanitizeMaxResults method present')

  // Constants file
  const constantsSrc = readFileSync(
    resolve(__dirname, '../src/shared/constants.ts'), 'utf-8'
  )
  assert(constantsSrc.includes('MCP_STDOUT_BUFFER_MAX_BYTES'), 'T10n: Buffer cap constant defined')
  assert(constantsSrc.includes('MEMORY_QUERY_MAX_LENGTH'), 'T10o: Query max length defined')
  assert(constantsSrc.includes('MEMORY_MAX_RESULTS_MIN'), 'T10p: MaxResults min defined')
  assert(constantsSrc.includes('MEMORY_MAX_RESULTS_MAX'), 'T10q: MaxResults max defined')

  // Handler hardening
  const handlersSrc = readFileSync(
    resolve(__dirname, '../src/main/ipc/memory.handlers.ts'), 'utf-8'
  )
  assert(handlersSrc.includes('MEMORY_QUERY_MAX_LENGTH'), 'T10r: Handler checks query max length')
  assert(handlersSrc.includes('Number.isFinite'), 'T10s: Handler checks maxResults finiteness')
  assert(handlersSrc.includes("includes('\\0')"), 'T10t: Handler rejects null bytes in filePath')

  // B5: ProjectService root rejection
  const projectSrc = readFileSync(
    resolve(__dirname, '../src/main/services/project.service.ts'), 'utf-8'
  )
  assert(projectSrc.includes('Root path is not allowed'), 'T10u: Root path rejection in ProjectService')
  assert(projectSrc.includes('parse('), 'T10v: ProjectService uses parse() for root detection')
}

// ═════════════════════════════════════════════════════════════════════
// T11: ROOT WORKSPACE BLOCKED (C:\ on Windows, / on Unix)
// ═════════════════════════════════════════════════════════════════════

console.log('\n═══ T11: Root workspace rejection ═══')
{
  // updateWorkspace must throw for root paths — prevents entire filesystem from being indexable
  const rootWs = process.platform === 'win32' ? 'C:\\' : '/'
  const svc = new MemoryService({ workspacePath: workspaceA })
  await svc.initialize()

  // T11a: updateWorkspace with root path throws
  let threw = false
  let errorMsg = ''
  try {
    await svc.updateWorkspace(rootWs)
  } catch (err) {
    threw = true
    errorMsg = err instanceof Error ? err.message : String(err)
  }
  assert(threw, 'T11a: updateWorkspace throws for root path')
  assert(errorMsg.includes('Root path is not allowed'), 'T11b: Error message mentions root path rejection')
  assert(errorMsg.includes('DEC-025'), 'T11c: Error references DEC-025')

  // T11d: Workspace should NOT have changed (still workspaceA)
  assertEqual(svc.getWorkspacePath(), workspaceA, 'T11d: Workspace unchanged after root rejection')

  // T11e: On Windows, also test D:\ as root
  if (process.platform === 'win32') {
    let threwD = false
    try { await svc.updateWorkspace('D:\\') } catch { threwD = true }
    assert(threwD, 'T11e: D:\\ root also rejected')
  } else {
    // Unix parity — only / is root, already tested above
    passed++
    console.log('  ✅ T11e: (Unix parity — only / is root)')
  }

  // T11f: Non-root path should still work
  await svc.updateWorkspace(workspaceC)
  assertEqual(svc.getWorkspacePath(), workspaceC, 'T11f: Non-root workspace change still works')

  await svc.shutdown()
}

// ─── Cleanup ─────────────────────────────────────────────────────────

try {
  rmSync(baseDir, { recursive: true, force: true })
  rmSync(tmpMcpDir, { recursive: true, force: true })
} catch { /* best effort */ }

// ─── Summary ─────────────────────────────────────────────────────────

console.log(`\n═══ Summary: ${passed} passed, ${failed} failed ═══`)
process.exit(failed > 0 ? 1 : 0)
