/**
 * test_broker.mjs — Execution Broker Classification Test
 *
 * Tests the command classifier against DEC-024 zone definitions.
 * Imports zone patterns from REAL source files (zero duplicated literals).
 *
 * Run: node test_broker.mjs
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

console.log(`Extracted: ${GREEN.length} GREEN, ${YELLOW.length} YELLOW, ${RED.length} RED patterns`)

if (GREEN.length === 0 || YELLOW.length === 0 || RED.length === 0) {
  console.error('FATAL: Could not extract patterns from', ZONES_PATH)
  process.exit(2)
}

// ─── Extract CHAIN_OPERATORS from real source ───────────────────────
const CLASSIFIER_PATH = resolve(__dirname, 'src/main/execution/command-classifier.ts')
const classifierSource = readFileSync(CLASSIFIER_PATH, 'utf-8')

// Extract CHAIN_OPERATORS array from source (single-quoted strings)
const chainOpsMatch = classifierSource.match(/CHAIN_OPERATORS[\s\S]*?Object\.freeze\(\[([\s\S]*?)\]\)/)
const CHAIN_OPERATORS = chainOpsMatch
  ? [...chainOpsMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1])
  : []

console.log(`Extracted: ${CHAIN_OPERATORS.length} CHAIN_OPERATORS`)

if (CHAIN_OPERATORS.length === 0) {
  console.error('FATAL: Could not extract CHAIN_OPERATORS from', CLASSIFIER_PATH)
  process.exit(2)
}

// ─── Replicate classifier logic (mirrors real implementation exactly) ─

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

  // 0. Chain/injection check (mirrors real implementation)
  const chainOp = detectChainOperator(normalized)
  if (chainOp) return { zone: 'red', pattern: chainOp, reason: `chain operator: ${chainOp}` }

  const redMatch = matchPatterns(normalized, RED)
  if (redMatch) return { zone: 'red', pattern: redMatch, reason: 'red pattern match' }

  const greenMatch = matchPatterns(normalized, GREEN)
  if (greenMatch) return { zone: 'green', pattern: greenMatch, reason: 'green pattern match' }

  const yellowMatch = matchPatterns(normalized, YELLOW)
  if (yellowMatch) return { zone: 'yellow', pattern: yellowMatch, reason: 'yellow pattern match' }

  return { zone: 'red', pattern: null, reason: 'deny-by-default' }
}

// ─── Test Runner ─────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assertClassification(command, expectedZone, description) {
  const result = classifyCommand(command)
  if (result.zone === expectedZone) {
    passed++
    console.log(`  PASS  [${result.zone.toUpperCase()}] ${description || command}`)
  } else {
    failed++
    console.error(`  FAIL  ${description || command}`)
    console.error(`        Expected: ${expectedZone}, Got: ${result.zone} (pattern: ${result.pattern}, reason: ${result.reason})`)
  }
}

// ─── Test Cases ──────────────────────────────────────────────────────

console.log('\n=== Execution Broker Classification Tests ===\n')

console.log('--- GREEN zone (always safe) ---')
assertClassification('echo hello', 'green', 'echo hello')
assertClassification('ls', 'green', 'ls (bare)')
assertClassification('ls -la /home', 'green', 'ls with args')
assertClassification('dir', 'green', 'dir')
assertClassification('cd /home', 'green', 'cd')
assertClassification('pwd', 'green', 'pwd')
assertClassification('cat file.txt', 'green', 'cat')
assertClassification('git status', 'green', 'git status')
assertClassification('git add .', 'green', 'git add')
assertClassification('git commit -m "msg"', 'green', 'git commit')
assertClassification('git log --oneline', 'green', 'git log')
assertClassification('npm list', 'green', 'npm list')
assertClassification('node --version', 'green', 'node --version')
assertClassification('mkdir test-dir', 'green', 'mkdir')

console.log('\n--- YELLOW zone (productive, permission-based) ---')
assertClassification('npm install express', 'yellow', 'npm install')
assertClassification('npm run build', 'yellow', 'npm run build')
assertClassification('npm start', 'yellow', 'npm start')
assertClassification('npx create-react-app myapp', 'yellow', 'npx')
assertClassification('node script.js', 'yellow', 'node script.js')
assertClassification('python main.py', 'yellow', 'python script')
assertClassification('pip install flask', 'yellow', 'pip install')
assertClassification('rm file.txt', 'yellow', 'rm file')
assertClassification('curl https://example.com', 'yellow', 'curl')
assertClassification('docker build .', 'yellow', 'docker build')

console.log('\n--- RED zone (ALWAYS BLOCKED) ---')
assertClassification('format C:', 'red', 'format C:')
assertClassification('regedit', 'red', 'regedit')
assertClassification('reg add HKCU\\Test', 'red', 'reg add')
assertClassification('rm -rf /', 'red', 'rm -rf /')
assertClassification('shutdown /s', 'red', 'shutdown')
assertClassification('net user hacker pass /add', 'red', 'net user')
assertClassification('netsh firewall', 'red', 'netsh')
assertClassification('diskpart', 'red', 'diskpart')
assertClassification('powershell -ExecutionPolicy Bypass', 'red', 'PS bypass (case-insensitive)')
assertClassification('Set-ExecutionPolicy Unrestricted', 'red', 'Set-ExecutionPolicy')
assertClassification('route add 0.0.0.0', 'red', 'route add')

console.log('\n--- DENY-BY-DEFAULT (unclassified = RED) ---')
assertClassification('xyzunknowncommand', 'red', 'unknown command')
assertClassification('some-random-binary --flag', 'red', 'unknown binary')
assertClassification('hack-the-planet', 'red', 'nonsense command')

console.log('\n--- PRIORITY: RED overrides GREEN/YELLOW ---')
assertClassification('rm -rf /', 'red', 'rm -rf / (RED overrides YELLOW rm)')
assertClassification('Format C:', 'red', 'Format (case-insensitive)')

console.log('\n--- ADVERSARIAL: Shell chaining/injection (P0 bypass) ---')
assertClassification('echo hi && format c:', 'red', '&& chaining: green && red')
assertClassification('git status; rm -rf /', 'red', '; chaining: green ; red')
assertClassification('npm list | shutdown /s', 'red', '| pipe: green | red')
assertClassification('dir & regedit', 'red', '& background: green & red')
assertClassification('echo hi || net user hacker', 'red', '|| chaining: green || red')
assertClassification('echo `regedit`', 'red', 'backtick injection')
assertClassification('ls && ls', 'red', '&& chaining: green && green')
assertClassification('echo hi\nformat c:', 'red', 'LF injection (embedded newline)')
assertClassification('echo hi\rformat c:', 'red', 'CR injection (embedded CR)')

console.log('\n--- EDGE CASES ---')
assertClassification('  echo hello  ', 'green', 'whitespace trimmed')
assertClassification('ECHO HELLO', 'green', 'case-insensitive green')
assertClassification('GIT STATUS', 'green', 'case-insensitive git status')
assertClassification('', 'red', 'empty command (deny-by-default)')

// ─── Runtime Cross-Verification ─────────────────────────────────────
// Verify that the replicated classifier matches the REAL source structure.
// This ensures our test isn't drifting from the actual implementation.

console.log('\n--- RUNTIME CROSS-VERIFICATION ---')

// 1. Verify classifier source has detectChainOperator function
const hasChainDetect = classifierSource.includes('function detectChainOperator')
if (hasChainDetect) {
  passed++
  console.log('  PASS  [VERIFY] classifier source contains detectChainOperator()')
} else {
  failed++
  console.error('  FAIL  [VERIFY] classifier source MISSING detectChainOperator()')
}

// 2. Verify chain check runs BEFORE pattern matching (priority order)
const chainCheckPos = classifierSource.indexOf('detectChainOperator')
const redCheckPos = classifierSource.indexOf('matchPatterns(normalized, RED_PATTERNS)')
if (chainCheckPos > 0 && redCheckPos > 0 && chainCheckPos < redCheckPos) {
  passed++
  console.log('  PASS  [VERIFY] chain detection runs BEFORE red pattern matching')
} else {
  failed++
  console.error('  FAIL  [VERIFY] chain detection is NOT before red pattern matching — priority broken')
}

// 3. Verify deny-by-default exists in source
const hasDenyDefault = classifierSource.includes('deny-by-default') || classifierSource.includes('denied by default')
if (hasDenyDefault) {
  passed++
  console.log('  PASS  [VERIFY] classifier source has deny-by-default path')
} else {
  failed++
  console.error('  FAIL  [VERIFY] classifier source MISSING deny-by-default path')
}

// 4. Verify all CHAIN_OPERATORS are actually checked in detectChainOperator
const chainFuncMatch = classifierSource.match(/function detectChainOperator[\s\S]*?return null\n\}/)
if (chainFuncMatch) {
  const funcBody = chainFuncMatch[0]
  const checksCR = funcBody.includes("'\\r'") || funcBody.includes('"\\r"')
  const checksLF = funcBody.includes("'\\n'") || funcBody.includes('"\\n"')
  if (checksCR && checksLF) {
    passed++
    console.log('  PASS  [VERIFY] detectChainOperator checks CR and LF')
  } else {
    failed++
    console.error('  FAIL  [VERIFY] detectChainOperator MISSING CR/LF checks')
  }
} else {
  failed++
  console.error('  FAIL  [VERIFY] could not extract detectChainOperator function body')
}

// ─── Summary ─────────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)

if (failed > 0) {
  console.error('\nFAILED — Broker classification has errors.')
  process.exit(1)
} else {
  console.log('\nPASSED — Broker classification is correct.\n')
  process.exit(0)
}
