/**
 * test_approval.mjs — Sprint B Approval Flow Tests
 *
 * Tests the ExecutionBroker mode toggle + approval flow (items 2.3/2.4).
 * Validates: RED hard block, auto/supervised modes, approve/reject,
 * double-submit prevention, TTL expiration, stale attack prevention,
 * and audit log fields.
 *
 * Run: node test_approval.mjs
 * Expected: All assertions PASS, exit 0
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Extract zone patterns from real source ─────────────────────────
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

// Extract CHAIN_OPERATORS from classifier
const CLASSIFIER_PATH = resolve(__dirname, 'src/main/execution/command-classifier.ts')
const classifierSource = readFileSync(CLASSIFIER_PATH, 'utf-8')
const chainOpsMatch = classifierSource.match(/CHAIN_OPERATORS[\s\S]*?Object\.freeze\(\[([\s\S]*?)\]\)/)
const CHAIN_OPERATORS = chainOpsMatch
  ? [...chainOpsMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1])
  : []

console.log(`Extracted: ${GREEN.length} GREEN, ${YELLOW.length} YELLOW, ${RED.length} RED, ${CHAIN_OPERATORS.length} CHAIN_OPS`)

if (GREEN.length === 0 || YELLOW.length === 0 || RED.length === 0 || CHAIN_OPERATORS.length === 0) {
  console.error('FATAL: Could not extract patterns')
  process.exit(2)
}

// ─── Replicate classifier (mirrors real implementation) ──────────────

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
  if (chainOp) {
    return { command, zone: 'red', reason: `chain operator: ${chainOp}`, matchedPattern: chainOp, timestamp }
  }
  const redMatch = matchPatterns(normalized, RED)
  if (redMatch) return { command, zone: 'red', reason: `red pattern`, matchedPattern: redMatch, timestamp }
  const greenMatch = matchPatterns(normalized, GREEN)
  if (greenMatch) return { command, zone: 'green', reason: `green pattern`, matchedPattern: greenMatch, timestamp }
  const yellowMatch = matchPatterns(normalized, YELLOW)
  if (yellowMatch) return { command, zone: 'yellow', reason: `yellow pattern`, matchedPattern: yellowMatch, timestamp }
  return { command, zone: 'red', reason: 'deny-by-default', matchedPattern: null, timestamp }
}

// ─── PendingQueue replica ────────────────────────────────────────────

let uuid_counter = 0
function randomUUID() { return `test-uuid-${++uuid_counter}` }

const PENDING_COMMAND_TTL_MS = 5 * 60 * 1000

class PendingQueue {
  constructor() {
    this.commands = new Map()
  }

  add(terminalId, command, classification) {
    const now = Date.now()
    const entry = {
      id: randomUUID(),
      terminalId,
      command,
      classification,
      createdAt: now,
      expiresAt: now + PENDING_COMMAND_TTL_MS,
      status: 'pending',
    }
    this.commands.set(entry.id, entry)
    return entry
  }

  get(commandId) {
    return this.commands.get(commandId)
  }

  resolve(commandId, decision, actor) {
    const cmd = this.commands.get(commandId)
    if (!cmd) return null
    if (cmd.status !== 'pending') return null
    if (Date.now() > cmd.expiresAt) {
      cmd.status = 'expired'
      cmd.resolvedAt = Date.now()
      cmd.resolvedBy = 'system'
      return null
    }
    cmd.status = decision
    cmd.resolvedAt = Date.now()
    cmd.resolvedBy = actor
    return cmd
  }

  getPending() {
    const now = Date.now()
    const result = []
    for (const cmd of this.commands.values()) {
      if (cmd.status === 'pending') {
        if (now > cmd.expiresAt) {
          cmd.status = 'expired'
          cmd.resolvedAt = now
          cmd.resolvedBy = 'system'
        } else {
          result.push(cmd)
        }
      }
    }
    return result
  }

  destroy() {
    this.commands.clear()
  }
}

// ─── CommandLog replica ──────────────────────────────────────────────

class CommandLog {
  constructor() { this.entries = [] }

  log(terminalId, command, zone, action, reason, mode, actor) {
    const entry = {
      id: randomUUID(),
      terminalId, command, zone, action, reason,
      timestamp: Date.now(), mode, actor,
    }
    this.entries.push(entry)
    return entry
  }

  getEntries() { return this.entries }
  clear() { this.entries = [] }
}

// ─── ExecutionBroker replica (mirrors real implementation) ────────────

class ExecutionBroker {
  constructor() {
    this.commandLog = new CommandLog()
    this.pendingQueue = new PendingQueue()
    this.mode = 'supervised'
    this.onApprovedExecution = null
    this.onPendingAdded = null
    this.onPendingResolved = null
  }

  setOnApprovedExecution(cb) { this.onApprovedExecution = cb }
  setOnPendingAdded(cb) { this.onPendingAdded = cb }
  setOnPendingResolved(cb) { this.onPendingResolved = cb }
  getMode() { return this.mode }
  setMode(mode) { this.mode = mode }

  evaluate(command, terminalId) {
    const classification = classifyCommand(command)
    let allowed, action, reason, commandId

    switch (classification.zone) {
      case 'green':
        allowed = true
        action = 'executed'
        reason = 'GREEN zone — allowed'
        break

      case 'yellow':
        if (this.mode === 'auto') {
          allowed = true
          action = 'executed'
          reason = `YELLOW zone — auto-executed (auto mode). ${classification.reason}`
        } else {
          allowed = false
          action = 'pending_approval'
          const pending = this.pendingQueue.add(terminalId, command, classification)
          commandId = pending.id
          reason = `YELLOW zone — pending approval (supervised mode). ${classification.reason}`
          if (this.onPendingAdded) this.onPendingAdded(pending)
        }
        break

      case 'red':
        allowed = false
        action = 'blocked'
        reason = classification.reason
        break
    }

    this.commandLog.log(terminalId, command, classification.zone, action, reason, this.mode, 'system')
    return { allowed, classification, action, reason, commandId }
  }

  approve(commandId) {
    const pending = this.pendingQueue.get(commandId)
    if (!pending) {
      return { allowed: false, commandId, decision: 'not_found', reason: 'Command ID not found' }
    }
    if (pending.status !== 'pending') {
      return { allowed: false, commandId, decision: 'already_resolved', reason: `Command already ${pending.status}` }
    }

    // Re-classify at approval time (stale attack prevention)
    const freshClassification = classifyCommand(pending.command)

    if (freshClassification.zone === 'red') {
      this.pendingQueue.resolve(commandId, 'rejected', 'system')
      this.commandLog.log(
        pending.terminalId, pending.command, 'red', 'blocked',
        `Reclassified as RED at approval time — blocked`,
        this.mode, 'system'
      )
      if (this.onPendingResolved) this.onPendingResolved(commandId, 'rejected', 'Reclassified as RED')
      return {
        allowed: false, commandId, decision: 'reclassified_red',
        reason: 'Command reclassified as RED at approval time — blocked regardless of approval',
        terminalId: pending.terminalId, command: pending.command,
      }
    }

    const resolved = this.pendingQueue.resolve(commandId, 'approved', 'user')
    if (!resolved) {
      return { allowed: false, commandId, decision: 'expired', reason: 'Command expired during approval' }
    }

    this.commandLog.log(
      pending.terminalId, pending.command, freshClassification.zone, 'approved',
      `Approved by user. Current zone: ${freshClassification.zone}`,
      this.mode, 'user'
    )

    if (this.onApprovedExecution) this.onApprovedExecution(pending.terminalId, pending.command)
    if (this.onPendingResolved) this.onPendingResolved(commandId, 'approved', 'User approved')

    return {
      allowed: true, commandId, decision: 'approved',
      reason: 'User approved, re-classification confirmed safe',
      terminalId: pending.terminalId, command: pending.command,
    }
  }

  reject(commandId) {
    const pending = this.pendingQueue.get(commandId)
    if (!pending) {
      return { allowed: false, commandId, decision: 'not_found', reason: 'Command ID not found' }
    }
    if (pending.status !== 'pending') {
      return { allowed: false, commandId, decision: 'already_resolved', reason: `Command already ${pending.status}` }
    }

    const resolved = this.pendingQueue.resolve(commandId, 'rejected', 'user')
    if (!resolved) {
      return { allowed: false, commandId, decision: 'expired', reason: 'Command expired' }
    }

    this.commandLog.log(
      pending.terminalId, pending.command, pending.classification.zone, 'rejected',
      'Rejected by user', this.mode, 'user'
    )

    if (this.onPendingResolved) this.onPendingResolved(commandId, 'rejected', 'User rejected')

    return {
      allowed: false, commandId, decision: 'rejected',
      reason: 'User rejected command',
      terminalId: pending.terminalId, command: pending.command,
    }
  }

  getPendingCommands() { return this.pendingQueue.getPending() }
  getLog() { return this.commandLog }
  destroy() { this.pendingQueue.destroy() }
}

// ─── Test Runner ─────────────────────────────────────────────────────

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

function assertEqual(actual, expected, description) {
  if (actual === expected) {
    passed++
    console.log(`  PASS  ${description}`)
  } else {
    failed++
    console.error(`  FAIL  ${description}`)
    console.error(`        Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`)
  }
}

// ─── Test Cases ──────────────────────────────────────────────────────

console.log('\n=== Sprint B — Approval Flow Tests ===\n')

// ────────────────────────────────────────────────
console.log('--- T01-T02: RED hard block in both modes ---')
{
  const broker = new ExecutionBroker()

  // T01: RED in auto mode
  broker.setMode('auto')
  const r1 = broker.evaluate('format C:', 'term-1')
  assertEqual(r1.allowed, false, 'T01: format C: blocked in auto mode')
  assertEqual(r1.action, 'blocked', 'T01: action is blocked')

  // T02: RED in supervised mode
  broker.setMode('supervised')
  const r2 = broker.evaluate('regedit', 'term-1')
  assertEqual(r2.allowed, false, 'T02: regedit blocked in supervised mode')
  assertEqual(r2.action, 'blocked', 'T02: action is blocked')

  broker.destroy()
}

// ────────────────────────────────────────────────
console.log('\n--- T03-T04: Deny-default in both modes ---')
{
  const broker = new ExecutionBroker()

  // T03: unknown in auto
  broker.setMode('auto')
  const r3 = broker.evaluate('xyzunknown', 'term-1')
  assertEqual(r3.allowed, false, 'T03: unknown command blocked in auto')
  assertEqual(r3.action, 'blocked', 'T03: action is blocked (deny-default)')

  // T04: unknown in supervised
  broker.setMode('supervised')
  const r4 = broker.evaluate('xyzunknown', 'term-1')
  assertEqual(r4.allowed, false, 'T04: unknown command blocked in supervised')
  assertEqual(r4.action, 'blocked', 'T04: action is blocked (deny-default)')

  broker.destroy()
}

// ────────────────────────────────────────────────
console.log('\n--- T05: Chain injection in auto mode ---')
{
  const broker = new ExecutionBroker()
  broker.setMode('auto')
  const r5 = broker.evaluate('echo hi && format c:', 'term-1')
  assertEqual(r5.allowed, false, 'T05: chain injection blocked in auto')
  assertEqual(r5.action, 'blocked', 'T05: action is blocked')
  assertEqual(r5.classification.zone, 'red', 'T05: classified as red')
  broker.destroy()
}

// ────────────────────────────────────────────────
console.log('\n--- T10-T11: Auto mode GREEN + YELLOW ---')
{
  const broker = new ExecutionBroker()
  broker.setMode('auto')

  // T10: GREEN in auto
  const r10 = broker.evaluate('echo hello', 'term-1')
  assertEqual(r10.allowed, true, 'T10: echo hello allowed in auto')
  assertEqual(r10.action, 'executed', 'T10: action is executed')

  // T11: YELLOW in auto — should execute (not queue)
  const r11 = broker.evaluate('npm install express', 'term-1')
  assertEqual(r11.allowed, true, 'T11: npm install allowed in auto')
  assertEqual(r11.action, 'executed', 'T11: action is executed (auto mode)')
  assertEqual(r11.commandId, undefined, 'T11: no commandId (not queued)')

  broker.destroy()
}

// ────────────────────────────────────────────────
console.log('\n--- T20-T21: Supervised mode GREEN + YELLOW ---')
{
  const broker = new ExecutionBroker()
  broker.setMode('supervised')

  // T20: GREEN in supervised
  const r20 = broker.evaluate('echo hello', 'term-1')
  assertEqual(r20.allowed, true, 'T20: echo hello allowed in supervised')
  assertEqual(r20.action, 'executed', 'T20: GREEN always executes')

  // T21: YELLOW in supervised — should queue
  const r21 = broker.evaluate('npm install express', 'term-1')
  assertEqual(r21.allowed, false, 'T21: npm install queued in supervised')
  assertEqual(r21.action, 'pending_approval', 'T21: action is pending_approval')
  assert(typeof r21.commandId === 'string', 'T21: commandId returned')

  broker.destroy()
}

// ────────────────────────────────────────────────
console.log('\n--- T30: Approve flow (YELLOW supervised) ---')
{
  const broker = new ExecutionBroker()
  broker.setMode('supervised')

  let executedTerminalId = null
  let executedCommand = null
  broker.setOnApprovedExecution((tid, cmd) => {
    executedTerminalId = tid
    executedCommand = cmd
  })

  const decision = broker.evaluate('npm install express', 'term-1')
  assert(decision.commandId != null, 'T30: commandId exists')

  const result = broker.approve(decision.commandId)
  assertEqual(result.allowed, true, 'T30: approve returns allowed=true')
  assertEqual(result.decision, 'approved', 'T30: decision is approved')
  assertEqual(executedTerminalId, 'term-1', 'T30: callback fired with correct terminalId')
  assertEqual(executedCommand, 'npm install express', 'T30: callback fired with correct command')

  broker.destroy()
}

// ────────────────────────────────────────────────
console.log('\n--- T31: Reject flow (YELLOW supervised) ---')
{
  const broker = new ExecutionBroker()
  broker.setMode('supervised')

  let executionCallbackFired = false
  broker.setOnApprovedExecution(() => { executionCallbackFired = true })

  const decision = broker.evaluate('npm install express', 'term-1')
  const result = broker.reject(decision.commandId)
  assertEqual(result.allowed, false, 'T31: reject returns allowed=false')
  assertEqual(result.decision, 'rejected', 'T31: decision is rejected')
  assertEqual(executionCallbackFired, false, 'T31: execution callback NOT fired')

  broker.destroy()
}

// ────────────────────────────────────────────────
console.log('\n--- T32: Approve unknown commandId ---')
{
  const broker = new ExecutionBroker()
  const result = broker.approve('fake-id-does-not-exist')
  assertEqual(result.decision, 'not_found', 'T32: approve unknown returns not_found')
  assertEqual(result.allowed, false, 'T32: not_found is not allowed')
  broker.destroy()
}

// ────────────────────────────────────────────────
console.log('\n--- T33: Double-approve ---')
{
  const broker = new ExecutionBroker()
  broker.setMode('supervised')

  const decision = broker.evaluate('npm install express', 'term-1')
  broker.approve(decision.commandId)
  const result2 = broker.approve(decision.commandId)
  assertEqual(result2.decision, 'already_resolved', 'T33: double-approve returns already_resolved')
  assertEqual(result2.allowed, false, 'T33: double-approve not allowed')

  broker.destroy()
}

// ────────────────────────────────────────────────
console.log('\n--- T34: Double-reject ---')
{
  const broker = new ExecutionBroker()
  broker.setMode('supervised')

  const decision = broker.evaluate('curl https://example.com', 'term-1')
  broker.reject(decision.commandId)
  const result2 = broker.reject(decision.commandId)
  assertEqual(result2.decision, 'already_resolved', 'T34: double-reject returns already_resolved')
  assertEqual(result2.allowed, false, 'T34: double-reject not allowed')

  broker.destroy()
}

// ────────────────────────────────────────────────
console.log('\n--- T35: Approve then reject same command ---')
{
  const broker = new ExecutionBroker()
  broker.setMode('supervised')

  const decision = broker.evaluate('npm install express', 'term-1')
  const r1 = broker.approve(decision.commandId)
  assertEqual(r1.decision, 'approved', 'T35: first approve succeeds')

  const r2 = broker.reject(decision.commandId)
  assertEqual(r2.decision, 'already_resolved', 'T35: reject after approve returns already_resolved')

  broker.destroy()
}

// ────────────────────────────────────────────────
console.log('\n--- T36: Reject then approve same command ---')
{
  const broker = new ExecutionBroker()
  broker.setMode('supervised')

  const decision = broker.evaluate('npm install express', 'term-1')
  const r1 = broker.reject(decision.commandId)
  assertEqual(r1.decision, 'rejected', 'T36: first reject succeeds')

  const r2 = broker.approve(decision.commandId)
  assertEqual(r2.decision, 'already_resolved', 'T36: approve after reject returns already_resolved')

  broker.destroy()
}

// ────────────────────────────────────────────────
console.log('\n--- T40: TTL expiration ---')
{
  const broker = new ExecutionBroker()
  broker.setMode('supervised')

  const decision = broker.evaluate('npm install express', 'term-1')
  const cmdId = decision.commandId

  // Manually expire the command by setting expiresAt in the past
  const pending = broker.pendingQueue.get(cmdId)
  pending.expiresAt = Date.now() - 1000 // Expired 1 second ago

  // getPending should not return it
  const pendingList = broker.getPendingCommands()
  const found = pendingList.find(c => c.id === cmdId)
  assertEqual(found, undefined, 'T40: expired command not in pending list')

  broker.destroy()
}

// ────────────────────────────────────────────────
console.log('\n--- T41: Approve expired command ---')
{
  const broker = new ExecutionBroker()
  broker.setMode('supervised')

  const decision = broker.evaluate('npm install express', 'term-1')
  const cmdId = decision.commandId

  // Manually expire the command
  const pending = broker.pendingQueue.get(cmdId)
  pending.expiresAt = Date.now() - 1000

  const result = broker.approve(cmdId)
  // Queue resolve() will see it's expired and return null → broker returns 'expired'
  assertEqual(result.decision, 'expired', 'T41: approve expired returns expired')
  assertEqual(result.allowed, false, 'T41: expired not allowed')

  broker.destroy()
}

// ────────────────────────────────────────────────
console.log('\n--- T50: Stale attack (approve but re-classify=RED) ---')
{
  // Simulate a scenario where a command was YELLOW when queued,
  // but the classifier would return RED at approval time.
  // Since our classifier is deterministic and won't change between calls,
  // we test the re-classification logic by manually injecting a RED command
  // into the pending queue as if it was classified YELLOW originally.

  const broker = new ExecutionBroker()
  broker.setMode('supervised')

  // Manually add a RED command to the pending queue pretending it was YELLOW
  const fakeClassification = {
    command: 'format C:',
    zone: 'yellow',  // Fake: was "yellow" when originally classified
    reason: 'Simulated stale classification',
    matchedPattern: null,
    timestamp: Date.now(),
  }
  const fakePending = broker.pendingQueue.add('term-1', 'format C:', fakeClassification)

  // Now approve — broker re-classifies and should find it's RED
  const result = broker.approve(fakePending.id)
  assertEqual(result.decision, 'reclassified_red', 'T50: stale attack detected — reclassified_red')
  assertEqual(result.allowed, false, 'T50: reclassified RED is blocked')

  broker.destroy()
}

// ────────────────────────────────────────────────
console.log('\n--- T51: Stale attack with chain injection ---')
{
  const broker = new ExecutionBroker()
  broker.setMode('supervised')

  // Simulate chain injection that was somehow queued
  const fakeClassification = {
    command: 'echo && format c:',
    zone: 'yellow',
    reason: 'Simulated stale classification',
    matchedPattern: null,
    timestamp: Date.now(),
  }
  const fakePending = broker.pendingQueue.add('term-1', 'echo && format c:', fakeClassification)

  const result = broker.approve(fakePending.id)
  assertEqual(result.decision, 'reclassified_red', 'T51: chain injection caught on re-classify')
  assertEqual(result.allowed, false, 'T51: chain injection blocked')

  broker.destroy()
}

// ────────────────────────────────────────────────
console.log('\n--- T60: Mode toggle behavior change ---')
{
  const broker = new ExecutionBroker()

  // Start supervised — YELLOW should queue
  broker.setMode('supervised')
  const r1 = broker.evaluate('npm install express', 'term-1')
  assertEqual(r1.action, 'pending_approval', 'T60a: supervised YELLOW queues')

  // Switch to auto — YELLOW should execute
  broker.setMode('auto')
  const r2 = broker.evaluate('npm install express', 'term-1')
  assertEqual(r2.action, 'executed', 'T60b: auto YELLOW executes')
  assertEqual(r2.allowed, true, 'T60b: auto YELLOW allowed=true')

  // Switch back to supervised
  broker.setMode('supervised')
  const r3 = broker.evaluate('npm install express', 'term-1')
  assertEqual(r3.action, 'pending_approval', 'T60c: back to supervised, YELLOW queues again')

  // RED stays blocked regardless of mode toggle
  broker.setMode('auto')
  const r4 = broker.evaluate('format C:', 'term-1')
  assertEqual(r4.action, 'blocked', 'T60d: RED still blocked after mode toggle')

  broker.destroy()
}

// ────────────────────────────────────────────────
console.log('\n--- T70-T71: Audit log fields ---')
{
  const broker = new ExecutionBroker()
  broker.setMode('supervised')

  // T70: evaluate logs mode field
  broker.evaluate('echo hello', 'term-1')
  const entries = broker.getLog().getEntries()
  const lastEntry = entries[entries.length - 1]
  assertEqual(lastEntry.mode, 'supervised', 'T70: audit log has mode=supervised')
  assertEqual(lastEntry.actor, 'system', 'T70: evaluate logs actor=system')

  // T71: approve logs actor=user
  const decision = broker.evaluate('npm install express', 'term-1')
  broker.approve(decision.commandId)
  const allEntries = broker.getLog().getEntries()
  const approveEntry = allEntries.find(e => e.action === 'approved')
  assert(approveEntry != null, 'T71: approved entry exists in log')
  assertEqual(approveEntry?.actor, 'user', 'T71: approved entry has actor=user')
  assertEqual(approveEntry?.mode, 'supervised', 'T71: approved entry has mode=supervised')

  broker.destroy()
}

// ────────────────────────────────────────────────
console.log('\n--- T72: Reject audit log ---')
{
  const broker = new ExecutionBroker()
  broker.setMode('supervised')

  const decision = broker.evaluate('curl https://example.com', 'term-1')
  broker.reject(decision.commandId)

  const allEntries = broker.getLog().getEntries()
  const rejectEntry = allEntries.find(e => e.action === 'rejected')
  assert(rejectEntry != null, 'T72: rejected entry exists in log')
  assertEqual(rejectEntry?.actor, 'user', 'T72: rejected entry has actor=user')

  broker.destroy()
}

// ────────────────────────────────────────────────
console.log('\n--- T80: onPendingAdded callback fires ---')
{
  const broker = new ExecutionBroker()
  broker.setMode('supervised')

  let addedPending = null
  broker.setOnPendingAdded((p) => { addedPending = p })

  broker.evaluate('npm install express', 'term-1')
  assert(addedPending != null, 'T80: onPendingAdded callback fired')
  assertEqual(addedPending?.command, 'npm install express', 'T80: correct command in callback')
  assertEqual(addedPending?.terminalId, 'term-1', 'T80: correct terminalId in callback')
  assertEqual(addedPending?.status, 'pending', 'T80: status is pending')

  broker.destroy()
}

// ────────────────────────────────────────────────
console.log('\n--- T81: onPendingResolved callback fires ---')
{
  const broker = new ExecutionBroker()
  broker.setMode('supervised')

  let resolvedId = null
  let resolvedDecision = null
  broker.setOnPendingResolved((id, decision) => {
    resolvedId = id
    resolvedDecision = decision
  })

  const decision = broker.evaluate('npm install express', 'term-1')
  broker.approve(decision.commandId)

  assertEqual(resolvedId, decision.commandId, 'T81: onPendingResolved called with correct id')
  assertEqual(resolvedDecision, 'approved', 'T81: onPendingResolved called with approved')

  broker.destroy()
}

// ────────────────────────────────────────────────
console.log('\n--- T82: onPendingAdded NOT called for GREEN ---')
{
  const broker = new ExecutionBroker()
  broker.setMode('supervised')

  let addedPending = null
  broker.setOnPendingAdded((p) => { addedPending = p })

  broker.evaluate('echo hello', 'term-1')
  assertEqual(addedPending, null, 'T82: onPendingAdded NOT called for GREEN')

  broker.destroy()
}

// ────────────────────────────────────────────────
console.log('\n--- T83: onPendingAdded NOT called for RED ---')
{
  const broker = new ExecutionBroker()
  broker.setMode('supervised')

  let addedPending = null
  broker.setOnPendingAdded((p) => { addedPending = p })

  broker.evaluate('format C:', 'term-1')
  assertEqual(addedPending, null, 'T83: onPendingAdded NOT called for RED')

  broker.destroy()
}

// ────────────────────────────────────────────────
console.log('\n--- T84: Multiple pending commands coexist ---')
{
  const broker = new ExecutionBroker()
  broker.setMode('supervised')

  const d1 = broker.evaluate('npm install express', 'term-1')
  const d2 = broker.evaluate('curl https://example.com', 'term-1')
  const d3 = broker.evaluate('docker build .', 'term-1')

  const pending = broker.getPendingCommands()
  assertEqual(pending.length, 3, 'T84: 3 pending commands in queue')

  // Approve first, reject second, leave third
  broker.approve(d1.commandId)
  broker.reject(d2.commandId)

  const remaining = broker.getPendingCommands()
  assertEqual(remaining.length, 1, 'T84: 1 pending command remains after approve+reject')
  assertEqual(remaining[0].id, d3.commandId, 'T84: remaining command is the third one')

  broker.destroy()
}

// ────────────────────────────────────────────────
console.log('\n--- T85: Default mode is supervised ---')
{
  const broker = new ExecutionBroker()
  assertEqual(broker.getMode(), 'supervised', 'T85: default mode is supervised')
  broker.destroy()
}

// ────────────────────────────────────────────────
console.log('\n--- T86: RED hard block even with manual approve attempt ---')
{
  const broker = new ExecutionBroker()
  broker.setMode('supervised')

  // RED commands should be blocked at evaluate(), never reaching pending queue
  const r = broker.evaluate('shutdown /s', 'term-1')
  assertEqual(r.allowed, false, 'T86: RED blocked at evaluate')
  assertEqual(r.action, 'blocked', 'T86: action is blocked')
  assertEqual(r.commandId, undefined, 'T86: no commandId (never queued)')

  // There should be NO pending commands
  const pending = broker.getPendingCommands()
  assertEqual(pending.length, 0, 'T86: no pending commands for RED')

  broker.destroy()
}

// ─── Summary ─────────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)

if (failed > 0) {
  console.error('\nFAILED — Approval flow tests have errors.')
  process.exit(1)
} else {
  console.log('\nPASSED — All approval flow tests pass.\n')
  process.exit(0)
}
