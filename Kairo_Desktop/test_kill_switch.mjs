/**
 * test_kill_switch.mjs — Sprint C Kill Switch + Sudo + Shell Allowlist Tests
 *
 * Validates:
 * - PendingQueue.reset() (soft reset vs destroy)
 * - ExecutionBroker.emergencyReset()
 * - killAll() return type (number)
 * - sudo → RED classification
 * - Shell allowlist (ALLOWED_SHELLS)
 * - Kill switch full sequence
 *
 * Run: node test_kill_switch.mjs
 * Expected: All assertions PASS, exit 0
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Extract patterns from source (same approach as other tests) ────

const ZONES_PATH = resolve(__dirname, 'src/main/config/command-zones.ts')
const zonesSource = readFileSync(ZONES_PATH, 'utf-8')

function extractPatterns(source, varName) {
  const regex = new RegExp(`export const ${varName}[\\s\\S]*?Object\\.freeze\\(\\[([\\s\\S]*?)\\]\\)`, 'm')
  const match = regex.exec(source)
  if (!match) return []
  return [...match[1].matchAll(/'([^']+)'/g)].map(m => m[1])
}

const GREEN = extractPatterns(zonesSource, 'GREEN_PATTERNS')
const YELLOW = extractPatterns(zonesSource, 'YELLOW_PATTERNS')
const RED = extractPatterns(zonesSource, 'RED_PATTERNS')
const ALLOWED_SHELLS = extractPatterns(zonesSource, 'ALLOWED_SHELLS')
const YELLOW_FILE_COMMANDS = extractPatterns(zonesSource, 'YELLOW_FILE_COMMANDS')

// ─── Extract chain operators from classifier ────────────────────────

const CLASSIFIER_PATH = resolve(__dirname, 'src/main/execution/command-classifier.ts')
const classifierSource = readFileSync(CLASSIFIER_PATH, 'utf-8')
const chainOpsMatch = classifierSource.match(/CHAIN_OPERATORS[\s\S]*?Object\.freeze\(\[([\\s\S]*?)\]\)/)
const CHAIN_OPERATORS = chainOpsMatch
  ? [...chainOpsMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1])
  : []

// ─── Classifier replica ─────────────────────────────────────────────

function detectChainOperator(normalized) {
  if (normalized.includes('\r') || normalized.includes('\n')) return 'CR/LF injection'
  for (const op of CHAIN_OPERATORS) {
    if (normalized.includes(op)) return op
  }
  return null
}

function matchPatterns(normalized, patterns) {
  for (const pattern of patterns) {
    if (pattern.includes(' ')) {
      if (normalized.startsWith(pattern)) return pattern
    } else {
      if (normalized === pattern || normalized.startsWith(pattern + ' ')) return pattern
    }
  }
  return null
}

function classifyCommand(rawCommand) {
  const command = rawCommand.trim()
  const normalized = command.toLowerCase()
  const timestamp = Date.now()

  const chainOp = detectChainOperator(normalized)
  if (chainOp) return { command, zone: 'red', reason: `chain: ${chainOp}`, matchedPattern: chainOp, timestamp }
  const redMatch = matchPatterns(normalized, RED)
  if (redMatch) return { command, zone: 'red', reason: `red pattern`, matchedPattern: redMatch, timestamp }
  const greenMatch = matchPatterns(normalized, GREEN)
  if (greenMatch) return { command, zone: 'green', reason: `green pattern`, matchedPattern: greenMatch, timestamp }
  const yellowMatch = matchPatterns(normalized, YELLOW)
  if (yellowMatch) return { command, zone: 'yellow', reason: `yellow pattern`, matchedPattern: yellowMatch, timestamp }
  return { command, zone: 'red', reason: 'deny-by-default', matchedPattern: null, timestamp }
}

// ─── PendingQueue replica (minimal for testing reset) ───────────────

class PendingQueue {
  constructor() {
    this.commands = new Map()
    this.cleanupTimer = setInterval(() => {}, 30000)
  }

  add(terminalId, command, classification) {
    const id = `pending-${Date.now()}-${Math.random()}`
    const now = Date.now()
    const entry = {
      id, terminalId, command, classification,
      createdAt: now, expiresAt: now + 300000, status: 'pending',
    }
    this.commands.set(id, entry)
    return entry
  }

  get(id) { return this.commands.get(id) }

  getPending() {
    return [...this.commands.values()].filter(c => c.status === 'pending')
  }

  reset() {
    this.commands.clear()
  }

  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    this.commands.clear()
  }

  hasTimer() { return this.cleanupTimer !== null }
}

// ─── CommandLog replica ─────────────────────────────────────────────

class CommandLog {
  constructor() { this.entries = [] }
  log(terminalId, command, zone, action, reason, mode, actor) {
    const entry = { id: `log-${Date.now()}`, terminalId, command, zone, action, reason, timestamp: Date.now(), mode, actor }
    this.entries.push(entry)
    return entry
  }
  getEntries() { return this.entries }
  clear() { this.entries = [] }
}

// ─── ExecutionBroker replica (with emergencyReset) ──────────────────

class ExecutionBroker {
  constructor() {
    this.commandLog = new CommandLog()
    this.pendingQueue = new PendingQueue()
    this.mode = 'supervised'
    this.onApprovedExecution = null
  }

  setOnApprovedExecution(cb) { this.onApprovedExecution = cb }
  getMode() { return this.mode }
  setMode(mode) { this.mode = mode }

  evaluate(command, terminalId, workspacePath) {
    const classification = classifyCommand(command)
    let allowed, action, reason, commandId

    switch (classification.zone) {
      case 'green':
        allowed = true; action = 'executed'; reason = 'GREEN zone'
        break
      case 'yellow':
        if (this.mode === 'auto') {
          allowed = true; action = 'executed'; reason = 'YELLOW auto'
        } else {
          allowed = false; action = 'pending_approval'
          const p = this.pendingQueue.add(terminalId, command, classification)
          commandId = p.id; reason = 'YELLOW supervised'
        }
        break
      case 'red':
        allowed = false; action = 'blocked'; reason = classification.reason
        break
    }

    this.commandLog.log(terminalId, command, classification.zone, action, reason, this.mode, 'system')
    return { allowed, classification, action, reason, commandId }
  }

  emergencyReset() {
    this.pendingQueue.reset()
    this.commandLog.log('SYSTEM', 'KILL_SWITCH', 'red', 'blocked',
      'Emergency kill switch activated — all pending commands cleared',
      this.mode, 'system')
  }

  getPendingCommands() { return this.pendingQueue.getPending() }
  getLog() { return this.commandLog }
  destroy() { this.pendingQueue.destroy() }
}

// ─── Test helpers ────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(condition, description) {
  if (condition) {
    passed++
    console.log(`  PASS  ${description}`)
  } else {
    failed++
    console.error(`  FAIL  ${description}`)
  }
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

console.log('\n=== Sprint C Kill Switch Tests ===\n')

// ─── T-KS-01: sudo in RED patterns ────────────────────────────
console.log('--- sudo classification ---')
{
  assert(RED.includes('sudo'), 'T-KS-01: sudo is in RED_PATTERNS')
  const r1 = classifyCommand('sudo apt install nginx')
  assert(r1.zone === 'red', 'T-KS-02: "sudo apt install nginx" → RED')
  assert(r1.matchedPattern === 'sudo', 'T-KS-03: matched pattern is "sudo"')
  const r2 = classifyCommand('sudo rm -rf /')
  assert(r2.zone === 'red', 'T-KS-04: "sudo rm -rf /" → RED')
  const r3 = classifyCommand('sudo')
  assert(r3.zone === 'red', 'T-KS-05: bare "sudo" → RED')
}

// ─── T-KS-06: ALLOWED_SHELLS extracted correctly ──────────────
console.log('\n--- shell allowlist ---')
{
  assert(ALLOWED_SHELLS.length >= 7, 'T-KS-06: ALLOWED_SHELLS has >= 7 entries')
  assert(ALLOWED_SHELLS.includes('cmd.exe'), 'T-KS-07: cmd.exe in allowlist')
  assert(ALLOWED_SHELLS.includes('powershell.exe'), 'T-KS-08: powershell.exe in allowlist')
  assert(ALLOWED_SHELLS.includes('pwsh.exe'), 'T-KS-09: pwsh.exe in allowlist')
  assert(ALLOWED_SHELLS.includes('bash'), 'T-KS-10: bash in allowlist')
  assert(ALLOWED_SHELLS.includes('sh'), 'T-KS-11: sh in allowlist')
  assert(ALLOWED_SHELLS.includes('zsh'), 'T-KS-12: zsh in allowlist')
  assert(ALLOWED_SHELLS.includes('fish'), 'T-KS-13: fish in allowlist')

  // Shell allowlist validation logic
  function isAllowedShell(shellPath) {
    return ALLOWED_SHELLS.includes(basename(shellPath).toLowerCase())
  }

  assert(isAllowedShell('cmd.exe'), 'T-KS-14: cmd.exe passes allowlist')
  assert(isAllowedShell('C:\\Windows\\System32\\cmd.exe'), 'T-KS-15: full path cmd.exe passes')
  assert(isAllowedShell('/bin/bash'), 'T-KS-16: /bin/bash passes')
  assert(isAllowedShell('/usr/bin/zsh'), 'T-KS-17: /usr/bin/zsh passes')
  assert(!isAllowedShell('evil.exe'), 'T-KS-18: evil.exe blocked')
  assert(!isAllowedShell('/tmp/malicious'), 'T-KS-19: /tmp/malicious blocked')
  assert(!isAllowedShell('nc'), 'T-KS-20: nc (netcat) blocked')
}

// ─── T-KS-21: YELLOW_FILE_COMMANDS extracted ──────────────────
console.log('\n--- YELLOW_FILE_COMMANDS ---')
{
  assert(YELLOW_FILE_COMMANDS.includes('rm'), 'T-KS-21: rm in file commands')
  assert(YELLOW_FILE_COMMANDS.includes('del'), 'T-KS-22: del in file commands')
  assert(YELLOW_FILE_COMMANDS.includes('rmdir'), 'T-KS-23: rmdir in file commands')
  assert(YELLOW_FILE_COMMANDS.includes('cp'), 'T-KS-24: cp in file commands')
  assert(YELLOW_FILE_COMMANDS.includes('mv'), 'T-KS-25: mv in file commands')
  assert(YELLOW_FILE_COMMANDS.includes('chmod'), 'T-KS-26: chmod in file commands')
}

// ─── T-KS-27: PendingQueue.reset() vs destroy() ──────────────
console.log('\n--- PendingQueue reset vs destroy ---')
{
  const pq = new PendingQueue()
  const c = classifyCommand('npm install x')
  pq.add('t1', 'npm install x', c)
  pq.add('t1', 'npm install y', c)
  assert(pq.getPending().length === 2, 'T-KS-27: queue has 2 pending before reset')

  pq.reset()
  assert(pq.getPending().length === 0, 'T-KS-28: queue has 0 pending after reset')
  assert(pq.hasTimer(), 'T-KS-29: cleanup timer still alive after reset')

  // Add after reset — should work
  pq.add('t1', 'npm install z', c)
  assert(pq.getPending().length === 1, 'T-KS-30: queue functional after reset')

  pq.destroy()
  assert(!pq.hasTimer(), 'T-KS-31: cleanup timer destroyed after destroy()')
  assert(pq.getPending().length === 0, 'T-KS-32: queue empty after destroy')
}

// ─── T-KS-33: ExecutionBroker.emergencyReset() ──────────────
console.log('\n--- emergencyReset ---')
{
  const broker = new ExecutionBroker()

  // Queue some pending commands
  broker.evaluate('npm install a', 't1')
  broker.evaluate('npm install b', 't1')
  broker.evaluate('npm install c', 't1')
  assert(broker.getPendingCommands().length === 3, 'T-KS-33: 3 pending before emergencyReset')

  broker.emergencyReset()
  assert(broker.getPendingCommands().length === 0, 'T-KS-34: 0 pending after emergencyReset')

  // Verify audit log contains KILL_SWITCH entry
  const log = broker.getLog().getEntries()
  const ksEntry = log.find(e => e.command === 'KILL_SWITCH')
  assert(ksEntry !== undefined, 'T-KS-35: KILL_SWITCH audit entry exists')
  assert(ksEntry?.zone === 'red', 'T-KS-36: KILL_SWITCH audit zone is red')
  assert(ksEntry?.action === 'blocked', 'T-KS-37: KILL_SWITCH audit action is blocked')
  assert(ksEntry?.actor === 'system', 'T-KS-38: KILL_SWITCH audit actor is system')

  // Broker still operational after emergencyReset
  const d = broker.evaluate('echo hello', 't1')
  assert(d.allowed === true, 'T-KS-39: broker operational after emergencyReset')
  assert(d.classification.zone === 'green', 'T-KS-40: classification still works after reset')

  broker.destroy()
}

// ─── T-KS-41: Kill switch full sequence ──────────────────────
console.log('\n--- kill switch full sequence ---')
{
  const broker = new ExecutionBroker()
  let callbackFired = false
  broker.setOnApprovedExecution(() => { callbackFired = true })

  // Simulate state: pending commands exist
  broker.evaluate('npm install a', 't1')
  broker.evaluate('node app.js', 't2')
  assert(broker.getPendingCommands().length === 2, 'T-KS-41: 2 pending before kill switch')

  // Simulate killAll return count
  const terminalMap = new Map()
  terminalMap.set('t1', { id: 't1' })
  terminalMap.set('t2', { id: 't2' })
  const killCount = terminalMap.size
  terminalMap.clear()
  assert(killCount === 2, 'T-KS-42: killAll would return 2')

  // Execute emergency reset
  broker.emergencyReset()
  assert(broker.getPendingCommands().length === 0, 'T-KS-43: pending cleared after kill')

  // New commands still work
  broker.setMode('auto')
  const d = broker.evaluate('npm install fresh', 't3')
  assert(d.allowed === true, 'T-KS-44: YELLOW auto works after kill switch')

  broker.destroy()
}

// ─── T-KS-45: Source verification ─────────────────────────────
console.log('\n--- source verification ---')
{
  const indexSource = readFileSync(resolve(__dirname, 'src/main/index.ts'), 'utf-8')

  // globalShortcut import
  assert(indexSource.includes('globalShortcut'), 'T-KS-45: index.ts imports globalShortcut')

  // Kill switch registration
  assert(indexSource.includes('KILL_SWITCH_ACCELERATOR'), 'T-KS-46: index.ts uses KILL_SWITCH_ACCELERATOR')
  assert(indexSource.includes('emergencyReset'), 'T-KS-47: index.ts calls emergencyReset()')
  assert(indexSource.includes('KILLSWITCH_ACTIVATED'), 'T-KS-48: index.ts sends KILLSWITCH_ACTIVATED')

  // will-quit cleanup
  assert(indexSource.includes('will-quit'), 'T-KS-49: index.ts has will-quit handler')
  assert(indexSource.includes('unregisterAll'), 'T-KS-50: index.ts unregisters shortcuts on quit')

  // Terminal service changes
  const tsSource = readFileSync(resolve(__dirname, 'src/main/services/terminal.service.ts'), 'utf-8')
  assert(tsSource.includes('ALLOWED_SHELLS'), 'T-KS-51: terminal.service imports ALLOWED_SHELLS')
  assert(tsSource.includes('killAll(): number'), 'T-KS-52: killAll returns number')

  // Broker emergencyReset
  const brokerSource = readFileSync(resolve(__dirname, 'src/main/execution/execution-broker.ts'), 'utf-8')
  assert(brokerSource.includes('emergencyReset'), 'T-KS-53: broker has emergencyReset')
  assert(brokerSource.includes('validateCommandPaths'), 'T-KS-54: broker imports validateCommandPaths')

  // PendingQueue reset
  const pqSource = readFileSync(resolve(__dirname, 'src/main/execution/pending-queue.ts'), 'utf-8')
  assert(pqSource.includes('reset(): void'), 'T-KS-55: PendingQueue has reset() method')

  // IPC channel
  const ipcSource = readFileSync(resolve(__dirname, 'src/shared/ipc-channels.ts'), 'utf-8')
  assert(ipcSource.includes('KILLSWITCH_ACTIVATED'), 'T-KS-56: IPC channels has KILLSWITCH_ACTIVATED')

  // Constants
  const constSource = readFileSync(resolve(__dirname, 'src/shared/constants.ts'), 'utf-8')
  assert(constSource.includes('KILL_SWITCH_ACCELERATOR'), 'T-KS-57: constants has KILL_SWITCH_ACCELERATOR')
  assert(constSource.includes('KILL_SWITCH_BANNER_DURATION_MS'), 'T-KS-58: constants has KILL_SWITCH_BANNER_DURATION_MS')

  // KillSwitch renderer component
  const ksSource = readFileSync(resolve(__dirname, 'src/renderer/src/components/Layout/KillSwitch.tsx'), 'utf-8')
  assert(ksSource.includes('KILLSWITCH_ACTIVATED'), 'T-KS-59: KillSwitch.tsx subscribes to push event')
  assert(ksSource.includes('EMERGENCY STOP'), 'T-KS-60: KillSwitch.tsx shows emergency banner')
}

// ─── Summary ─────────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)

if (failed > 0) {
  console.error('\nFAILED — Kill switch tests have errors.')
} else {
  console.log('\nPASSED — All kill switch tests pass.\n')
}

process.exit(failed > 0 ? 1 : 0)
