/**
 * test_memory_provider.mjs — Phase 4 Sprint A
 *
 * Tests for:
 * 1. LocalMarkdownMemoryProvider — workspace scanning, query, index, health
 * 2. NotebookLmMemoryProvider — MCP delegation via fake server
 * 3. MemoryService — provider orchestration, fallback, health
 * 4. Source cross-verification
 *
 * Run: node tests/test_memory_provider.mjs
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

// Compile LocalMarkdownMemoryProvider
buildSync({
  entryPoints: [resolve(__dirname, '../src/main/memory/local-markdown.provider.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'local-markdown.provider.mjs'),
  external: ['node:fs', 'node:path'],
  logLevel: 'silent',
})

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

// Compile NotebookLmMemoryProvider
buildSync({
  entryPoints: [resolve(__dirname, '../src/main/memory/notebooklm.provider.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'notebooklm.provider.mjs'),
  external: ['node:child_process', 'node:crypto'],
  logLevel: 'silent',
})

// Compile MemoryService
buildSync({
  entryPoints: [resolve(__dirname, '../src/main/memory/memory.service.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'memory.service.mjs'),
  external: ['node:child_process', 'node:crypto', 'node:fs', 'node:path'],
  logLevel: 'silent',
})

const localModule = await import(pathToFileURL(join(buildDir, 'local-markdown.provider.mjs')).href)
const mcpModule = await import(pathToFileURL(join(buildDir, 'mcp-process.service.mjs')).href)
const notebookModule = await import(pathToFileURL(join(buildDir, 'notebooklm.provider.mjs')).href)
const memoryServiceModule = await import(pathToFileURL(join(buildDir, 'memory.service.mjs')).href)

const { LocalMarkdownMemoryProvider } = localModule
const { McpProcessService } = mcpModule
const { NotebookLmMemoryProvider } = notebookModule
const { MemoryService } = memoryServiceModule

// ─── Create Temp Workspace with Markdown Files ───────────────────────

const workspaceDir = mkdtempSync(join(tmpdir(), 'kairo-mem-test-'))
const subDir = join(workspaceDir, 'docs')
mkdirSync(subDir, { recursive: true })
const nodeModulesDir = join(workspaceDir, 'node_modules')
mkdirSync(nodeModulesDir, { recursive: true })

writeFileSync(join(workspaceDir, 'README.md'), `# Project README

This is the main readme file.

## Installation

Run npm install to get started.

## Usage

Import the module and call the main function.
`)

writeFileSync(join(subDir, 'architecture.md'), `# Architecture

The system uses a modular architecture.

## Components

There are three main components: gateway, broker, and orchestrator.

## Security

All inputs are validated at system boundaries. The broker enforces command classification.
`)

writeFileSync(join(subDir, 'notes.md'), `# Development Notes

## Token Budget

The token budget system allocates capacity across channels.

## Testing

All tests use the esbuild compilation pattern.
`)

// File inside node_modules (should be skipped)
writeFileSync(join(nodeModulesDir, 'should-skip.md'), `# This should be skipped
Some content that should not appear in results.
`)

// Non-markdown file (should be ignored)
writeFileSync(join(workspaceDir, 'data.txt'), 'This is not a markdown file.')

// ─── Create Fake MCP Server (for NotebookLm tests) ──────────────────
// Use node as executable, .mjs script as argument (cross-platform, shell:false safe)

const tmpMcpDir = mkdtempSync(join(tmpdir(), 'kairo-mcp-prov-test-'))
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

// ─── Tests ───────────────────────────────────────────────────────────

console.log('\n═══ T01: Interface source cross-verification ═══')
{
  const source = readFileSync(
    resolve(__dirname, '../src/main/memory/memory-provider.interface.ts'), 'utf-8'
  )
  assert(source.includes('query(query: string'), 'T01a: query method in interface')
  assert(source.includes('index(filePath: string'), 'T01b: index method in interface')
  assert(source.includes('health(): ProviderHealth'), 'T01c: health method in interface')
  assert(source.includes('initialize(): Promise<void>'), 'T01d: initialize method in interface')
  assert(source.includes('shutdown(): Promise<void>'), 'T01e: shutdown method in interface')
}

console.log('\n═══ T02: LocalMarkdown — initialize and health ═══')
{
  const provider = new LocalMarkdownMemoryProvider(workspaceDir)
  const healthBefore = provider.health()
  assertEqual(healthBefore.status, 'stopped', 'T02a: Health stopped before init')

  await provider.initialize()
  const healthAfter = provider.health()
  assertEqual(healthAfter.status, 'ready', 'T02b: Health ready after init')
  assertEqual(healthAfter.provider, 'local-markdown', 'T02c: Provider type correct')
  await provider.shutdown()
}

console.log('\n═══ T03: LocalMarkdown — query keyword matching ═══')
{
  const provider = new LocalMarkdownMemoryProvider(workspaceDir)
  await provider.initialize()

  // Exact keyword match
  const results1 = await provider.query('architecture')
  assert(results1.length > 0, 'T03a: Architecture query returns results')
  assert(results1[0].source.includes('architecture.md'), 'T03b: Best result from architecture.md')

  // Multi-term query
  const results2 = await provider.query('security broker')
  assert(results2.length > 0, 'T03c: Multi-term query returns results')

  // Empty/short query
  const results3 = await provider.query('a')
  assertEqual(results3.length, 0, 'T03d: Single-char terms filtered out')

  // maxResults respected
  const results4 = await provider.query('the', 1)
  assert(results4.length <= 1, 'T03e: maxResults=1 respected')

  await provider.shutdown()
}

console.log('\n═══ T04: LocalMarkdown — index single file ═══')
{
  const provider = new LocalMarkdownMemoryProvider(workspaceDir)
  await provider.initialize()

  // Index a new file
  const newFile = join(workspaceDir, 'new-doc.md')
  writeFileSync(newFile, '# New Document\n\nThis contains unique-keyword-xyz content.')

  const indexResult = await provider.index(newFile)
  assertEqual(indexResult.indexed, true, 'T04a: File indexed successfully')
  assert(indexResult.chunksIndexed > 0, 'T04b: Chunks created')

  // Query the newly indexed content
  const results = await provider.query('unique-keyword-xyz')
  assert(results.length > 0, 'T04c: Newly indexed content found')

  // Non-md file
  const txtResult = await provider.index(join(workspaceDir, 'data.txt'))
  assertEqual(txtResult.indexed, false, 'T04d: Non-md file rejected')
  assert(txtResult.error !== undefined, 'T04e: Error message for non-md')

  await provider.shutdown()

  // Cleanup
  try { rmSync(newFile) } catch { /* best effort */ }
}

console.log('\n═══ T05: LocalMarkdown — heading chunking ═══')
{
  const provider = new LocalMarkdownMemoryProvider(workspaceDir)
  await provider.initialize()

  // "Installation" is a heading in README.md, should score higher
  const results = await provider.query('installation')
  assert(results.length > 0, 'T05a: Installation query returns results')
  // The heading match should give this a high relevance
  assert(results[0].relevance > 0, 'T05b: Relevance > 0 for heading match')
  assert(results[0].source.includes('#'), 'T05c: Source includes heading reference')

  await provider.shutdown()
}

console.log('\n═══ T06: LocalMarkdown — directory traversal ═══')
{
  const provider = new LocalMarkdownMemoryProvider(workspaceDir)
  await provider.initialize()

  // Content from node_modules should NOT appear
  const results = await provider.query('should-skip')
  assertEqual(results.length, 0, 'T06a: node_modules content excluded')

  // Content from subdirectory should appear
  const subResults = await provider.query('token budget')
  assert(subResults.length > 0, 'T06b: Subdirectory docs/ content found')
  assert(subResults.some(r => r.source.includes('notes.md')), 'T06c: notes.md in results')

  await provider.shutdown()
}

console.log('\n═══ T07: NotebookLm — query via fake MCP ═══')
{
  const mcpService = new McpProcessService(serverExecPath, serverExecArgs)
  const provider = new NotebookLmMemoryProvider(mcpService)

  await provider.initialize()
  assertEqual(provider.health().status, 'ready', 'T07a: MCP provider ready')

  const results = await provider.query('test query')
  assert(results.length > 0, 'T07b: MCP query returns results')
  assertEqual(results[0].content, 'mcp-result', 'T07c: MCP result content matches')

  await provider.shutdown()
}

console.log('\n═══ T08: NotebookLm — index via fake MCP ═══')
{
  const mcpService = new McpProcessService(serverExecPath, serverExecArgs)
  const provider = new NotebookLmMemoryProvider(mcpService)

  await provider.initialize()
  const result = await provider.index('/test/file.md')
  assertEqual(result.indexed, true, 'T08a: Index succeeded')
  assertEqual(result.chunksIndexed, 5, 'T08b: chunksIndexed from MCP')

  await provider.shutdown()
}

console.log('\n═══ T09: NotebookLm — health maps state ═══')
{
  const mcpService = new McpProcessService(serverExecPath, serverExecArgs)
  const provider = new NotebookLmMemoryProvider(mcpService)

  // Before init
  assertEqual(provider.health().status, 'stopped', 'T09a: Status stopped before init')

  await provider.initialize()
  assertEqual(provider.health().status, 'ready', 'T09b: Status ready when running')

  await provider.shutdown()
  assertEqual(provider.health().status, 'stopped', 'T09c: Status stopped after shutdown')
}

console.log('\n═══ T10: MemoryService — no mcpServerPath ═══')
{
  const svc = new MemoryService({ workspacePath: workspaceDir })
  await svc.initialize()

  assertEqual(svc.getActiveProviderType(), 'local-markdown', 'T10a: Fallback provider active')
  const health = svc.getHealth()
  assertEqual(health.success, true, 'T10b: Health succeeds')
  assertEqual(health.data.activeProvider, 'local-markdown', 'T10c: Active provider is local')

  await svc.shutdown()
}

console.log('\n═══ T11: MemoryService — invalid mcpServerPath ═══')
{
  let providerChangedNotification = null
  const svc = new MemoryService({
    mcpServerPath: '/nonexistent/mcp/server',
    workspacePath: workspaceDir,
  })
  svc.setOnProviderChanged((n) => { providerChangedNotification = n })

  await svc.initialize()
  assertEqual(svc.getActiveProviderType(), 'local-markdown', 'T11a: Fell back to local-markdown')

  // Query should work via fallback
  const result = await svc.query('architecture')
  assertEqual(result.success, true, 'T11b: Query succeeds via fallback')
  assertEqual(result.data.provider, 'local-markdown', 'T11c: Provider is local-markdown')

  await svc.shutdown()
}

console.log('\n═══ T12: MemoryService — valid MCP ═══')
{
  const svc = new MemoryService({
    mcpServerPath: serverExecPath,
    mcpServerArgs: serverExecArgs,
    workspacePath: workspaceDir,
  })
  await svc.initialize()

  assertEqual(svc.getActiveProviderType(), 'mcp', 'T12a: MCP provider active')
  const queryResult = await svc.query('test')
  assertEqual(queryResult.success, true, 'T12b: MCP query succeeds')
  assertEqual(queryResult.data.provider, 'mcp', 'T12c: Provider is mcp')

  await svc.shutdown()
}

console.log('\n═══ T13: MemoryService — getHealth ═══')
{
  const svc = new MemoryService({ workspacePath: workspaceDir })
  await svc.initialize()

  const health = svc.getHealth()
  assertEqual(health.success, true, 'T13a: Health success')
  assertEqual(health.data.fallbackAvailable, true, 'T13b: Fallback available')
  assert(health.data.health.lastCheckAt > 0, 'T13c: lastCheckAt populated')

  await svc.shutdown()
}

console.log('\n═══ T14: MemoryService — index via local ═══')
{
  const svc = new MemoryService({ workspacePath: workspaceDir })
  await svc.initialize()

  const newFile = join(workspaceDir, 'indexed-test.md')
  writeFileSync(newFile, '# Indexed Test\n\nSpecial content for indexing.')

  const indexResult = await svc.index(newFile)
  assertEqual(indexResult.success, true, 'T14a: Index succeeds')
  assertEqual(indexResult.data.provider, 'local-markdown', 'T14b: Index via local provider')
  assert(indexResult.data.result.chunksIndexed > 0, 'T14c: Chunks indexed')

  await svc.shutdown()

  try { rmSync(newFile) } catch { /* best effort */ }
}

console.log('\n═══ T15: MemoryService — shutdown ═══')
{
  const svc = new MemoryService({ workspacePath: workspaceDir })
  await svc.initialize()
  await svc.shutdown()

  // After shutdown, health should still return (degraded but not crash)
  const health = svc.getHealth()
  assertEqual(health.success, true, 'T15a: Health still responds after shutdown')
  assertEqual(health.data.activeProvider, 'local-markdown', 'T15b: Default provider type')
}

console.log('\n═══ T16: MemoryService — not initialized ═══')
{
  const svc = new MemoryService({ workspacePath: workspaceDir })
  // Don't call initialize
  const queryResult = await svc.query('test')
  assertEqual(queryResult.success, false, 'T16a: Query fails when not initialized')
  assert(queryResult.error.includes('not initialized'), 'T16b: Error mentions not initialized')
}

console.log('\n═══ T17: Source cross-verification ═══')
{
  const localSrc = readFileSync(
    resolve(__dirname, '../src/main/memory/local-markdown.provider.ts'), 'utf-8'
  )
  assert(localSrc.includes('node_modules'), 'T17a: local-markdown skips node_modules')
  assert(localSrc.includes("startsWith('.')"), 'T17b: local-markdown skips hidden dirs')
  assert(localSrc.includes('depth > 5'), 'T17c: local-markdown depth limit')

  const memorySrc = readFileSync(
    resolve(__dirname, '../src/main/memory/memory.service.ts'), 'utf-8'
  )
  assert(memorySrc.includes('switchToFallback'), 'T17d: MemoryService has fallback logic')
  assert(memorySrc.includes('onProviderChanged'), 'T17e: MemoryService emits provider change')

  const handlersSrc = readFileSync(
    resolve(__dirname, '../src/main/ipc/memory.handlers.ts'), 'utf-8'
  )
  assert(handlersSrc.includes('validateSender'), 'T17f: Handlers validate sender')
  assert(handlersSrc.includes('MEMORY_QUERY'), 'T17g: MEMORY_QUERY channel used')
  assert(handlersSrc.includes('MEMORY_INDEX'), 'T17h: MEMORY_INDEX channel used')
  assert(handlersSrc.includes('MEMORY_HEALTH'), 'T17i: MEMORY_HEALTH channel used')
  assert(handlersSrc.includes('MEMORY_PROVIDER_CHANGED'), 'T17j: Push event channel used')
}

// ─── Cleanup ─────────────────────────────────────────────────────────

try {
  rmSync(workspaceDir, { recursive: true, force: true })
  rmSync(tmpMcpDir, { recursive: true, force: true })
} catch { /* best effort */ }

// ─── Summary ─────────────────────────────────────────────────────────

console.log(`\n═══ Summary: ${passed} passed, ${failed} failed ═══`)
process.exit(failed > 0 ? 1 : 0)
