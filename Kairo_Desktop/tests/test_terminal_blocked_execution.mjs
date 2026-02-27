/**
 * test_terminal_blocked_execution.mjs — P0 PTY Integration Test
 *
 * Validates that blocked/pending commands are NOT executed in the shell.
 * Uses a REAL node-pty process to detect side-effects.
 *
 * Strategy:
 * - Spawn a real PTY shell.
 * - Type a command that creates a marker file (side-effect).
 * - Press Enter → broker classifies → if blocked, send Ctrl+C (not Enter).
 * - Check that marker file does NOT exist → command was NOT executed.
 *
 * Windows hygiene:
 * - Uses mkdtemp for unique temp dir per run (no stale collisions).
 * - Cleanup uses retry/backoff for ConPTY EBUSY/EPERM locks.
 *
 * Run: node test_terminal_blocked_execution.mjs
 * Expected: All assertions PASS, exit 0
 */

import * as pty from 'node-pty'
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Extract patterns (same as other tests) ─────────────────────────
const ZONES_PATH = resolve(__dirname, '../src/main/config/command-zones.ts')
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

const CLASSIFIER_PATH = resolve(__dirname, '../src/main/execution/command-classifier.ts')
const classifierSource = readFileSync(CLASSIFIER_PATH, 'utf-8')
const chainOpsMatch = classifierSource.match(/CHAIN_OPERATORS[\s\S]*?Object\.freeze\(\[([\s\S]*?)\]\)/)
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

// ─── Test sandbox directory (unique per run via mkdtemp) ─────────────

let TEST_DIR = ''

function setupTestDir() {
  // mkdtemp creates a unique directory — no collisions with stale runs
  TEST_DIR = mkdtempSync(join(tmpdir(), 'kairo-pty-test-'))
  console.log(`  (test dir: ${TEST_DIR})`)
}

/**
 * Retry/backoff cleanup for Windows ConPTY EBUSY/EPERM locks.
 * ConPTY agent holds a brief lock after proc.kill(). Retrying after short
 * delays resolves this without leaving temp dirs behind.
 */
async function cleanupTestDir() {
  const MAX_RETRIES = 5
  const BASE_DELAY_MS = 300

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (existsSync(TEST_DIR)) {
        rmSync(TEST_DIR, { recursive: true, force: true })
      }
      return // Success
    } catch (err) {
      const code = err?.code
      if ((code === 'EBUSY' || code === 'EPERM') && attempt < MAX_RETRIES - 1) {
        const delay = BASE_DELAY_MS * (attempt + 1)
        await new Promise(r => setTimeout(r, delay))
      } else {
        // Final attempt failed — log but don't crash (temp dir will be cleaned by OS)
        console.log(`  (cleanup: ${TEST_DIR} still locked after ${MAX_RETRIES} retries — OS will reclaim)`)
        return
      }
    }
  }
}

// ─── Verify source code has Ctrl+C fix ──────────────────────────────

console.log('\n=== P0 PTY Integration Tests ===\n')

console.log('--- Source verification: Ctrl+C fix present ---')
{
  const tsSource = readFileSync(
    resolve(__dirname, '../src/main/services/terminal.service.ts'),
    'utf-8'
  )

  // Verify \x03 is used (Ctrl+C)
  const hasCtrlC = tsSource.includes("'\\x03'")
  assert(hasCtrlC, 'terminal.service.ts uses \\x03 (Ctrl+C) for blocked commands')

  // Verify NO bare \r is sent for blocked commands
  const blockedBranch = tsSource.match(/if \(!decision\.allowed\)[\s\S]*?return \{ success: true \}/)
  if (blockedBranch) {
    const branchCode = blockedBranch[0]
    const hasBareEnter = branchCode.includes("write('\\r')") || branchCode.includes('write("\\r")')
    assert(!hasBareEnter, 'blocked branch does NOT send \\r (Enter) to PTY')
  } else {
    failed++
    console.error('  FAIL  Could not extract blocked branch from terminal.service.ts')
  }

  // Verify executeApproved DOES send \r (this is correct — approved commands should execute)
  const approvedBranch = tsSource.match(/executeApproved[\s\S]*?write\(command \+ '\\r'\)/)
  assert(approvedBranch != null, 'executeApproved correctly sends command + \\r')
}

// ─── Real PTY integration: blocked command does NOT execute ──────────

console.log('\n--- PTY integration: blocked command side-effect test ---')

/**
 * Spawns a real PTY, simulates the broker interception logic,
 * and verifies that blocked commands do NOT produce side-effects.
 */
async function testBlockedCommandNoSideEffect(testId, command, expectedZone, description) {
  const markerFile = resolve(TEST_DIR, `marker_${testId}.txt`)

  return new Promise((resolvePromise) => {
    const shell = process.platform === 'win32'
      ? (process.env['COMSPEC'] ?? 'cmd.exe')
      : (process.env['SHELL'] ?? '/bin/bash')

    const proc = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 120,
      rows: 24,
      cwd: TEST_DIR,
      env: { ...process.env },
    })

    proc.onData(() => {}) // Drain output

    // Wait for shell prompt to be ready
    setTimeout(() => {
      proc.write(command)
      const classification = classifyCommand(command)

      setTimeout(() => {
        if (classification.zone === 'green') {
          proc.write('\r')
        } else {
          // BLOCKED or PENDING: send Ctrl+C (abort line) — THIS IS THE FIX
          proc.write('\x03')
        }

        setTimeout(() => {
          proc.kill()

          const markerExists = existsSync(markerFile)

          if (expectedZone === 'green') {
            assert(markerExists, `${description} — GREEN: marker file CREATED (command executed)`)
          } else {
            assert(!markerExists, `${description} — ${expectedZone.toUpperCase()}: marker file NOT created (command blocked)`)
          }

          resolvePromise()
        }, 1500)
      }, 300)
    }, 1000)
  })
}

/**
 * Test that pending (YELLOW supervised) command does NOT execute until approved.
 */
async function testPendingCommandNoExecution(testId, command, description) {
  const markerFile = resolve(TEST_DIR, `marker_${testId}.txt`)

  return new Promise((resolvePromise) => {
    const shell = process.platform === 'win32'
      ? (process.env['COMSPEC'] ?? 'cmd.exe')
      : (process.env['SHELL'] ?? '/bin/bash')

    const proc = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 120,
      rows: 24,
      cwd: TEST_DIR,
      env: { ...process.env },
    })

    proc.onData(() => {}) // Drain output

    setTimeout(() => {
      proc.write(command)

      // Simulate supervised mode: YELLOW → send Ctrl+C (pending, not Enter)
      setTimeout(() => {
        proc.write('\x03')

        // Wait and verify no execution
        setTimeout(() => {
          const markerExistsBeforeApprove = existsSync(markerFile)
          assert(!markerExistsBeforeApprove, `${description} — pending: marker NOT created before approve`)

          // Now simulate approval: write command + Enter
          proc.write(command + '\r')

          // Wait for execution
          setTimeout(() => {
            const markerExistsAfterApprove = existsSync(markerFile)
            assert(markerExistsAfterApprove, `${description} — after approve: marker CREATED (executed)`)

            proc.kill()
            resolvePromise()
          }, 1500)
        }, 1000)
      }, 300)
    }, 1000)
  })
}

async function runPtyTests() {
  setupTestDir()

  const yellowCreateFile01 = `node -e "require('fs').writeFileSync('marker_pty01.txt','X')"`
  const yellowCreateFile03 = `node -e "require('fs').writeFileSync('marker_pty03.txt','X')"`

  // Chained RED command
  const chainRedCmd = `echo hi && node -e "require('fs').writeFileSync('marker_pty04.txt','X')"`

  // T-PTY-01: YELLOW in supervised mode — Ctrl+C should prevent execution
  await testBlockedCommandNoSideEffect(
    'pty01', yellowCreateFile01, 'yellow',
    'T-PTY-01: YELLOW command (node -e) blocked by Ctrl+C'
  )

  // T-PTY-02: Chain injection — RED, Ctrl+C prevents execution
  await testBlockedCommandNoSideEffect(
    'pty04', chainRedCmd, 'red',
    'T-PTY-02: chain injection command blocked by Ctrl+C'
  )

  // T-PTY-03: GREEN command DOES execute (control test)
  const greenCmd = `mkdir marker_pty05.txt`
  await testBlockedCommandNoSideEffect(
    'pty05', greenCmd, 'green',
    'T-PTY-03: GREEN command (mkdir) executes normally'
  )

  // T-PTY-04: Pending YELLOW — does not execute until "approved" (command re-sent)
  await testPendingCommandNoExecution(
    'pty03', yellowCreateFile03,
    'T-PTY-04: pending YELLOW command lifecycle'
  )

  // Print summary BEFORE cleanup (cleanup may need retries on Windows)
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)

  if (failed > 0) {
    console.error('\nFAILED — PTY blocked execution tests have errors.')
  } else {
    console.log('\nPASSED — All PTY blocked execution tests pass.\n')
  }

  await cleanupTestDir()
  return failed
}

const failures = await runPtyTests()
process.exit(failures > 0 ? 1 : 0)
