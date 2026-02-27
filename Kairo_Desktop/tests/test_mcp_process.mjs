/**
 * test_mcp_process.mjs — Phase 4 Sprint A
 *
 * Tests for McpProcessService:
 * 1. Constructor and initial state
 * 2. Start/stop lifecycle with fake JSON-RPC server
 * 3. sendRequest + JSON-RPC framing
 * 4. Crash detection and restart backoff
 * 5. Invalid server path handling
 * 6. Log sanitization
 * 7. Source cross-verification
 *
 * Run: node tests/test_mcp_process.mjs
 * Expected: All assertions PASS, exit 0
 */

import { buildSync } from 'esbuild'
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
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

// Compile McpProcessService
buildSync({
  entryPoints: [resolve(__dirname, '../src/main/memory/mcp-process.service.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'mcp-process.service.mjs'),
  external: ['node:child_process', 'node:crypto'],
  logLevel: 'silent',
})

const mcpServiceModule = await import(pathToFileURL(join(buildDir, 'mcp-process.service.mjs')).href)
const { McpProcessService } = mcpServiceModule

// ─── Create Fake MCP Server ──────────────────────────────────────────
// Strategy: Use node as executable, .mjs script as argument.
// This avoids .cmd/.sh wrappers and works cross-platform with shell:false.

const tmpDir = mkdtempSync(join(tmpdir(), 'kairo-mcp-test-'))
const fakeServerScript = join(tmpDir, 'fake-mcp-server.mjs')

writeFileSync(fakeServerScript, `
import { createInterface } from 'node:readline'

const rl = createInterface({ input: process.stdin })

// Signal readiness
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
        result: [{ content: 'test-result', source: 'test.md', relevance: 0.9 }]
      }) + '\\n')
    } else if (req.method === 'memory/index') {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0', id: req.id,
        result: { chunksIndexed: 3 }
      }) + '\\n')
    } else if (req.method === 'slow') {
      // Intentionally don't respond (for timeout tests)
    } else {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0', id: req.id,
        error: { code: -32601, message: 'Method not found' }
      }) + '\\n')
    }
  } catch {
    // Ignore non-JSON lines
  }
})
`)

// Use process.execPath (node) as executable, script as argument
const serverExecPath = process.execPath
const serverExecArgs = [fakeServerScript]

// ─── Tests ───────────────────────────────────────────────────────────

console.log('\n═══ T01: Constructor and initial state ═══')
{
  const svc = new McpProcessService(serverExecPath, serverExecArgs)
  assertEqual(svc.getState(), 'stopped', 'T01a: Initial state is stopped')
  assertEqual(svc.getServerPath(), serverExecPath, 'T01b: Server path stored')
  const health = await svc.healthCheck()
  assertEqual(health, false, 'T01c: Health check false when stopped')
}

console.log('\n═══ T02: Start with fake server ═══')
{
  const svc = new McpProcessService(serverExecPath, serverExecArgs)
  await svc.start()
  assertEqual(svc.getState(), 'running', 'T02a: State is running after start')
  const health = await svc.healthCheck()
  assertEqual(health, true, 'T02b: Health check passes')
  await svc.stop()
  assertEqual(svc.getState(), 'stopped', 'T02c: State is stopped after stop')
}

console.log('\n═══ T03: sendRequest ping ═══')
{
  const svc = new McpProcessService(serverExecPath, serverExecArgs)
  await svc.start()
  const response = await svc.sendRequest('ping', {})
  assert(response.result !== undefined, 'T03a: Ping response has result')
  assertEqual(response.result.status, 'ok', 'T03b: Ping result status is ok')
  assert(!response.error, 'T03c: No error in ping response')
  await svc.stop()
}

console.log('\n═══ T04: sendRequest memory/query ═══')
{
  const svc = new McpProcessService(serverExecPath, serverExecArgs)
  await svc.start()
  const response = await svc.sendRequest('memory/query', { query: 'test' })
  assert(Array.isArray(response.result), 'T04a: Query result is array')
  assertEqual(response.result[0].content, 'test-result', 'T04b: Query content matches')
  assertEqual(response.result[0].relevance, 0.9, 'T04c: Query relevance matches')
  await svc.stop()
}

console.log('\n═══ T05: sendRequest memory/index ═══')
{
  const svc = new McpProcessService(serverExecPath, serverExecArgs)
  await svc.start()
  const response = await svc.sendRequest('memory/index', { filePath: '/test.md' })
  assertEqual(response.result.chunksIndexed, 3, 'T05a: Index chunksIndexed matches')
  assert(!response.error, 'T05b: No error in index response')
  await svc.stop()
}

console.log('\n═══ T06: sendRequest with timeout ═══')
{
  const svc = new McpProcessService(serverExecPath, serverExecArgs)
  await svc.start()
  try {
    await svc.sendRequest('slow', {}, 500) // 500ms timeout, server won't respond
    assert(false, 'T06a: Should have thrown timeout error')
  } catch (err) {
    assert(err.message.includes('timeout'), 'T06a: Timeout error thrown')
  }
  // Service should still be running
  assertEqual(svc.getState(), 'running', 'T06b: State still running after timeout')
  // Regular request should still work
  const pingResponse = await svc.sendRequest('ping', {})
  assert(pingResponse.result !== undefined, 'T06c: Ping still works after timeout')
  await svc.stop()
}

console.log('\n═══ T07: Stop lifecycle cancels pending ═══')
{
  const svc = new McpProcessService(serverExecPath, serverExecArgs)
  await svc.start()

  // Start a slow request, then stop before it resolves
  const slowPromise = svc.sendRequest('slow', {}, 30000).catch(err => err)
  await new Promise(r => setTimeout(r, 100))
  await svc.stop()

  const result = await slowPromise
  assert(result instanceof Error, 'T07a: Pending request rejected on stop')
  assert(result.message.includes('stopping'), 'T07b: Error message mentions stopping')
  assertEqual(svc.getState(), 'stopped', 'T07c: State is stopped')
}

console.log('\n═══ T08: Invalid server path ═══')
{
  const svc = new McpProcessService('/nonexistent/path/to/server')
  try {
    await svc.start()
    assert(false, 'T08a: Should have thrown on invalid path')
  } catch (err) {
    assert(err instanceof Error, 'T08a: Error thrown for invalid path')
  }
  assertEqual(svc.getState(), 'failed', 'T08b: State is failed')
  const health = await svc.healthCheck()
  assertEqual(health, false, 'T08c: Health check false when failed')
}

console.log('\n═══ T09: sendRequest when not running ═══')
{
  const svc = new McpProcessService(serverExecPath, serverExecArgs)
  try {
    await svc.sendRequest('ping', {})
    assert(false, 'T09a: Should throw when not running')
  } catch (err) {
    assert(err.message.includes('not running'), 'T09a: Error mentions not running')
  }
}

console.log('\n═══ T10: Multiple sequential requests ═══')
{
  const svc = new McpProcessService(serverExecPath, serverExecArgs)
  await svc.start()
  const r1 = await svc.sendRequest('ping', {})
  const r2 = await svc.sendRequest('memory/query', { query: 'test' })
  const r3 = await svc.sendRequest('memory/index', { filePath: '/a.md' })
  assert(r1.result?.status === 'ok', 'T10a: First request OK')
  assert(Array.isArray(r2.result), 'T10b: Second request OK')
  assertEqual(r3.result?.chunksIndexed, 3, 'T10c: Third request OK')
  await svc.stop()
}

console.log('\n═══ T11: Crash detection ═══')
{
  const svc = new McpProcessService(serverExecPath, serverExecArgs)
  let crashFired = false
  let stateChanges = []
  svc.setOnCrash(() => { crashFired = true })
  svc.setOnStateChanged((s) => { stateChanges.push(s) })

  await svc.start()
  assertEqual(svc.getState(), 'running', 'T11a: Running before crash')

  // Force kill the process by sending shutdown (which exits the process)
  // but without going through svc.stop() — simulating a crash
  try {
    await svc.sendRequest('shutdown', {}, 1000)
  } catch { /* may timeout */ }

  // Wait for exit event to propagate
  await new Promise(r => setTimeout(r, 1500))
  assert(crashFired, 'T11b: onCrash callback fired')
  assert(stateChanges.includes('crashed'), 'T11c: State transitioned to crashed')

  // Clean up — stop to prevent background restart attempts
  svc.setOnCrash(() => {})
  svc.setOnStateChanged(() => {})
  await svc.stop()
}

console.log('\n═══ T12: Idempotent start ═══')
{
  const svc = new McpProcessService(serverExecPath, serverExecArgs)
  await svc.start()
  assertEqual(svc.getState(), 'running', 'T12a: Running after first start')
  await svc.start() // Should be no-op
  assertEqual(svc.getState(), 'running', 'T12b: Still running after second start')
  await svc.stop()
}

console.log('\n═══ T13: JSON-RPC error response ═══')
{
  const svc = new McpProcessService(serverExecPath, serverExecArgs)
  await svc.start()
  const response = await svc.sendRequest('unknown-method', {})
  assert(response.error !== undefined, 'T13a: Error present for unknown method')
  assertEqual(response.error.code, -32601, 'T13b: Error code is -32601 (method not found)')
  assert(response.error.message.includes('not found'), 'T13c: Error message mentions not found')
  await svc.stop()
}

console.log('\n═══ T14: Source cross-verification ═══')
{
  const source = readFileSync(
    resolve(__dirname, '../src/main/memory/mcp-process.service.ts'), 'utf-8'
  )
  assert(source.includes('shell: false'), 'T14a: shell:false present (security)')
  assert(source.includes("kill('SIGTERM')"), 'T14b: SIGTERM for graceful kill')
  assert(source.includes('sendRequest'), 'T14c: sendRequest method exists')
  assert(source.includes('sanitizeLogMessage'), 'T14d: Log sanitization present')
  assert(source.includes('MCP_MAX_RESTART_ATTEMPTS'), 'T14e: Max restart constant used')
  assert(source.includes('MCP_SPAWN_TIMEOUT_MS'), 'T14f: Spawn timeout constant used')
}

// ─── Cleanup ─────────────────────────────────────────────────────────

try {
  rmSync(tmpDir, { recursive: true, force: true })
} catch { /* best effort */ }

// ─── Summary ─────────────────────────────────────────────────────────

console.log(`\n═══ Summary: ${passed} passed, ${failed} failed ═══`)
process.exit(failed > 0 ? 1 : 0)
