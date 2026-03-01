/**
 * test_terminal_e2e.mjs — Phase 7 Sprint C: Terminal E2E Tests
 *
 * Wires REAL esbuild-bundled TypeScript modules end-to-end:
 * ExecutionBroker + CommandClassifier + PendingQueue + CommandLog + WorkspaceSandbox
 *
 * Differentiator from test_broker.mjs / test_approval.mjs:
 * Those use JS replicas — this bundles the REAL TypeScript production code.
 *
 * Run: node tests/test_terminal_e2e.mjs
 * Expected: 35 assertions PASS, exit 0
 */

import { strict as assert } from 'node:assert'
import { buildSync } from 'esbuild'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(__dirname, '..', 'src')
const buildDir = resolve(__dirname, '../.test-build')
mkdirSync(buildDir, { recursive: true })

// ── Step 1: Create barrel entry ──────────────────────────────

const shimDir = join(buildDir, 'shim-terminal-e2e')
mkdirSync(shimDir, { recursive: true })

const mainDir = resolve(SRC, 'main').replace(/\\/g, '/')
const sharedDir = resolve(SRC, 'shared').replace(/\\/g, '/')

writeFileSync(join(shimDir, 'entry.ts'), `
export { ExecutionBroker } from '${mainDir}/execution/execution-broker'
export type { BrokerDecision, ApprovalResult } from '${mainDir}/execution/execution-broker'
export { classifyCommand } from '${mainDir}/execution/command-classifier'
export { PendingQueue } from '${mainDir}/execution/pending-queue'
export { CommandLog } from '${mainDir}/execution/command-log'
export { isInsideWorkspace, validateWorkspaceCwd, validateCommandPaths, tokenizeCommand, isLikelyPath } from '${mainDir}/execution/workspace-sandbox'
`)

// ── Step 2: esbuild bundle ───────────────────────────────────

buildSync({
  entryPoints: [join(shimDir, 'entry.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'execution.terminal-e2e.mjs'),
  external: ['node:*'],
  logLevel: 'silent',
})

const mod = await import(pathToFileURL(join(buildDir, 'execution.terminal-e2e.mjs')).href)
const { ExecutionBroker } = mod

// ── Helpers ──────────────────────────────────────────────────

let passed = 0
let failed = 0
const results = []

function test(id, description, fn) {
  try {
    fn()
    passed++
    results.push({ id, description, status: 'PASS' })
    console.log(`  PASS  ${id}: ${description}`)
  } catch (err) {
    failed++
    results.push({ id, description, status: 'FAIL', error: err.message })
    console.error(`  FAIL  ${id}: ${description}`)
    console.error(`        ${err.message}`)
  }
}

const WORKSPACE = process.platform === 'win32'
  ? 'C:\\projects\\myapp'
  : '/home/user/projects/myapp'

// ═════════════════════════════════════════════════════════════
// T1: Multi-Command Evaluation Sequence (8 assertions)
// ═════════════════════════════════════════════════════════════

console.log('\n── T1: Multi-Command Evaluation Sequence ──')

{
  const broker = new ExecutionBroker()

  test('TE01', 'GREEN command: ls → allowed, zone=green', () => {
    const r = broker.evaluate('ls', 't1')
    assert.strictEqual(r.allowed, true)
    assert.strictEqual(r.classification.zone, 'green')
  })

  test('TE02', 'YELLOW supervised: npm install foo → pending_approval', () => {
    const r = broker.evaluate('npm install foo', 't1')
    assert.strictEqual(r.allowed, false)
    assert.strictEqual(r.action, 'pending_approval')
  })

  test('TE03', 'getPendingCommands has 1 entry', () => {
    assert.strictEqual(broker.getPendingCommands().length, 1)
  })

  test('TE04', 'RED command: format c: → blocked, zone=red', () => {
    const r = broker.evaluate('format c:', 't1')
    assert.strictEqual(r.allowed, false)
    assert.strictEqual(r.classification.zone, 'red')
  })

  test('TE05', 'Audit log has 3 entries', () => {
    assert.strictEqual(broker.getLog().getEntries().length, 3)
  })

  test('TE06', 'Log entries have correct fields', () => {
    for (const e of broker.getLog().getEntries()) {
      assert.strictEqual(e.terminalId, 't1')
      assert.ok(['green', 'yellow', 'red'].includes(e.zone))
      assert.ok(['executed', 'pending_approval', 'blocked'].includes(e.action))
    }
  })

  test('TE07', 'Chain injection: echo hello && rm -rf / → zone=red', () => {
    const r = broker.evaluate('echo hello && rm -rf /', 't1')
    assert.strictEqual(r.classification.zone, 'red')
  })

  test('TE08', 'Deny-by-default: cryptominer → zone=red', () => {
    const r = broker.evaluate('cryptominer', 't1')
    assert.strictEqual(r.classification.zone, 'red')
  })

  broker.destroy()
}

// ═════════════════════════════════════════════════════════════
// T2: Approval Flow E2E (7 assertions)
// ═════════════════════════════════════════════════════════════

console.log('\n── T2: Approval Flow E2E ──')

{
  const broker = new ExecutionBroker()
  const approvedCalls = []

  broker.setOnApprovedExecution((tid, cmd) => approvedCalls.push({ tid, cmd }))

  const evalR = broker.evaluate('npm install express', 't2')
  const cmdId1 = evalR.commandId

  test('TE09', 'Evaluate YELLOW supervised → commandId returned', () => {
    assert.strictEqual(evalR.action, 'pending_approval')
    assert.ok(cmdId1)
  })

  test('TE10', 'approve: decision=approved, allowed=true', () => {
    const r = broker.approve(cmdId1)
    assert.strictEqual(r.decision, 'approved')
    assert.strictEqual(r.allowed, true)
  })

  test('TE11', 'onApprovedExecution fired with correct args', () => {
    assert.strictEqual(approvedCalls.length, 1)
    assert.strictEqual(approvedCalls[0].tid, 't2')
    assert.strictEqual(approvedCalls[0].cmd, 'npm install express')
  })

  test('TE12', 'Double approve: decision=already_resolved', () => {
    assert.strictEqual(broker.approve(cmdId1).decision, 'already_resolved')
  })

  const evalR2 = broker.evaluate('npm run build', 't2')
  const cmdId2 = evalR2.commandId

  test('TE13', 'reject: decision=rejected', () => {
    const r = broker.reject(cmdId2)
    assert.strictEqual(r.decision, 'rejected')
    assert.strictEqual(r.allowed, false)
  })

  test('TE14', 'onApprovedExecution NOT called for rejection', () => {
    assert.strictEqual(approvedCalls.length, 1)
  })

  test('TE15', 'Audit log has approve + reject entries', () => {
    const actions = broker.getLog().getEntries().map(e => e.action)
    assert.ok(actions.includes('approved'))
    assert.ok(actions.includes('rejected'))
  })

  broker.destroy()
}

// ═════════════════════════════════════════════════════════════
// T3: TTL Expiry (5 assertions)
// ═════════════════════════════════════════════════════════════

console.log('\n── T3: TTL Expiry ──')

{
  const broker = new ExecutionBroker()

  const evalR = broker.evaluate('npm install pkg', 't3')
  const cmdId = evalR.commandId

  test('TE16', 'Evaluate YELLOW → commandId obtained', () => {
    assert.ok(cmdId)
    assert.strictEqual(broker.getPendingCommands().length, 1)
  })

  // Manually expire the command
  broker.getPendingCommands()[0].expiresAt = Date.now() - 1000

  test('TE17', 'approve expired command: decision=expired', () => {
    const r = broker.approve(cmdId)
    assert.strictEqual(r.decision, 'expired')
    assert.strictEqual(r.allowed, false)
  })

  test('TE18', 'getPendingCommands returns empty (lazy sweep)', () => {
    assert.strictEqual(broker.getPendingCommands().length, 0)
  })

  test('TE19', 'New commands after expiry queue normally', () => {
    const r = broker.evaluate('npm test', 't3')
    assert.strictEqual(r.action, 'pending_approval')
    assert.strictEqual(broker.getPendingCommands().length, 1)
  })

  test('TE20', 'Audit log records post-expiry evaluation', () => {
    assert.ok(broker.getLog().getEntries().length >= 2)
  })

  broker.destroy()
}

// ═════════════════════════════════════════════════════════════
// T4: Mode Switch Mid-Flow (5 assertions)
// ═════════════════════════════════════════════════════════════

console.log('\n── T4: Mode Switch Mid-Flow ──')

{
  const broker = new ExecutionBroker()

  test('TE21', 'Supervised: YELLOW queues pending', () => {
    assert.strictEqual(broker.getMode(), 'supervised')
    const r = broker.evaluate('npm install abc', 't4')
    assert.strictEqual(r.action, 'pending_approval')
  })

  test('TE22', 'setMode(auto)', () => {
    broker.setMode('auto')
    assert.strictEqual(broker.getMode(), 'auto')
  })

  test('TE23', 'New YELLOW in auto: allowed=true, action=executed', () => {
    const r = broker.evaluate('npm install xyz', 't4')
    assert.strictEqual(r.allowed, true)
    assert.strictEqual(r.action, 'executed')
  })

  test('TE24', 'Previous pending still in queue', () => {
    const pending = broker.getPendingCommands()
    assert.strictEqual(pending.length, 1)
    assert.strictEqual(pending[0].command, 'npm install abc')
  })

  test('TE25', 'setMode(supervised), RED still blocked', () => {
    broker.setMode('supervised')
    const r = broker.evaluate('format c:', 't4')
    assert.strictEqual(r.allowed, false)
    assert.strictEqual(r.classification.zone, 'red')
  })

  broker.destroy()
}

// ═════════════════════════════════════════════════════════════
// T5: Workspace Sandbox Integration (5 assertions)
// ═════════════════════════════════════════════════════════════

console.log('\n── T5: Workspace Sandbox Integration ──')

{
  const broker = new ExecutionBroker()
  broker.setMode('auto')

  test('TE26', 'rm ./file.txt inside workspace: allowed', () => {
    const r = broker.evaluate('rm ./file.txt', 't5', WORKSPACE)
    assert.strictEqual(r.allowed, true)
  })

  const outsidePath = process.platform === 'win32' ? 'D:\\other\\secret.txt' : '/etc/passwd'

  test('TE27', 'rm outside workspace: blocked', () => {
    const r = broker.evaluate(`rm ${outsidePath}`, 't5', WORKSPACE)
    assert.strictEqual(r.allowed, false)
  })

  test('TE28', 'Sandbox violation reason contains DEC-025', () => {
    const r = broker.evaluate(`rm ${outsidePath}`, 't5', WORKSPACE)
    assert.ok(r.reason.includes('DEC-025'), `reason: ${r.reason}`)
  })

  test('TE29', 'cd .. from workspace root: blocked (navigates outside)', () => {
    const r = broker.evaluate('cd ..', 't5', WORKSPACE)
    assert.strictEqual(r.allowed, false)
  })

  test('TE30', 'GREEN ls with outside path: path check applied', () => {
    const outsideDir = process.platform === 'win32' ? 'D:\\other' : '/etc'
    const r = broker.evaluate(`ls ${outsideDir}`, 't5', WORKSPACE)
    assert.strictEqual(r.allowed, false)
  })

  broker.destroy()
}

// ═════════════════════════════════════════════════════════════
// T6: Emergency Reset E2E (5 assertions)
// ═════════════════════════════════════════════════════════════

console.log('\n── T6: Emergency Reset E2E ──')

{
  const broker = new ExecutionBroker()

  test('TE31', 'Queue 3 pending, emergencyReset clears all', () => {
    broker.evaluate('npm install a', 't6')
    broker.evaluate('npm install b', 't6')
    broker.evaluate('npm install c', 't6')
    assert.strictEqual(broker.getPendingCommands().length, 3)
    broker.emergencyReset()
  })

  test('TE32', 'getPendingCommands().length === 0', () => {
    assert.strictEqual(broker.getPendingCommands().length, 0)
  })

  test('TE33', 'Audit log has KILL_SWITCH entry', () => {
    const killEntry = broker.getLog().getEntries().find(e => e.command === 'KILL_SWITCH')
    assert.ok(killEntry, 'KILL_SWITCH entry must exist')
    assert.strictEqual(killEntry.terminalId, 'SYSTEM')
    assert.strictEqual(killEntry.zone, 'red')
  })

  test('TE34', 'After reset: new evaluate succeeds', () => {
    const r = broker.evaluate('echo hi', 't6')
    assert.strictEqual(r.allowed, true)
    assert.strictEqual(r.classification.zone, 'green')
  })

  test('TE35', 'After reset: new YELLOW queues normally', () => {
    const r = broker.evaluate('npm install d', 't6')
    assert.strictEqual(r.action, 'pending_approval')
    assert.strictEqual(broker.getPendingCommands().length, 1)
  })

  broker.destroy()
}

// ═════════════════════════════════════════════════════════════
// Summary
// ═════════════════════════════════════════════════════════════

console.log('\n════════════════════════════════════════════')
console.log(`Terminal E2E: ${passed} passed, ${failed} failed out of ${passed + failed}`)
console.log('════════════════════════════════════════════')

if (failed > 0) {
  console.error('\nFailed tests:')
  for (const r of results.filter(r => r.status === 'FAIL')) {
    console.error(`  ${r.id}: ${r.description} — ${r.error}`)
  }
  process.exit(1)
}

process.exit(0)
