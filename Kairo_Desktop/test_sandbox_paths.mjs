/**
 * test_sandbox_paths.mjs — Sprint C Sandbox Path Enforcement Tests
 *
 * Validates:
 * - tokenizeCommand() — basic split, quoted strings, edge cases
 * - isLikelyPath() — absolute, relative, Windows, UNC, non-paths
 * - validateCommandPaths() — file commands vs non-file, inside/outside workspace
 * - Broker integration — YELLOW + bad path → blocked
 *
 * Run: node test_sandbox_paths.mjs
 * Expected: All assertions PASS, exit 0
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Extract patterns from source ───────────────────────────────────

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
const YELLOW_FILE_COMMANDS = extractPatterns(zonesSource, 'YELLOW_FILE_COMMANDS')

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

// ─── Sandbox functions replica ──────────────────────────────────────

function isInsideWorkspace(targetPath, workspacePath) {
  const resolvedTarget = normalize(resolve(targetPath))
  const resolvedWorkspace = normalize(resolve(workspacePath))
  if (process.platform === 'win32') {
    return resolvedTarget.toLowerCase().startsWith(resolvedWorkspace.toLowerCase())
  }
  return resolvedTarget.startsWith(resolvedWorkspace)
}

function tokenizeCommand(input) {
  const tokens = []
  let current = ''
  let inQuote = null

  for (const ch of input) {
    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null
      } else {
        current += ch
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = ch
    } else if (ch === ' ' || ch === '\t') {
      if (current) {
        tokens.push(current)
        current = ''
      }
    } else {
      current += ch
    }
  }
  if (current) tokens.push(current)
  return tokens
}

function isLikelyPath(token) {
  if (token.startsWith('./') || token.startsWith('../') || token.startsWith('~')) return true
  if (token.startsWith('/')) return true
  if (/^[a-zA-Z]:[/\\]/.test(token)) return true
  if (token.startsWith('\\\\')) return true
  if (token.includes('/') || token.includes('\\')) return true
  return false
}

function validateCommandPaths(command, workspacePath) {
  const tokens = tokenizeCommand(command.trim())
  if (tokens.length < 2) return { valid: true, reason: 'No arguments to validate.' }

  const baseCmd = tokens[0].toLowerCase()
  if (!YELLOW_FILE_COMMANDS.includes(baseCmd)) {
    return { valid: true, reason: 'Command not in file-mutation list.' }
  }

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i]
    if (token.startsWith('-')) continue
    if (!isLikelyPath(token)) continue
    const resolvedToken = resolve(workspacePath, token)
    if (!isInsideWorkspace(resolvedToken, workspacePath)) {
      return {
        valid: false,
        reason: `Path "${token}" is outside workspace "${workspacePath}". DEC-025 sandbox violation.`,
        violatingPath: token,
      }
    }
  }
  return { valid: true, reason: 'All paths are inside workspace.' }
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

console.log('\n=== Sprint C Sandbox Path Enforcement Tests ===\n')

// ─── tokenizeCommand() ────────────────────────────────────────
console.log('--- tokenizeCommand ---')
{
  const t1 = tokenizeCommand('rm ./foo.txt')
  assert(t1.length === 2 && t1[0] === 'rm' && t1[1] === './foo.txt', 'T-SP-01: basic split')

  const t2 = tokenizeCommand('cp "my file.txt" ./dest/')
  assert(t2.length === 3 && t2[1] === 'my file.txt' && t2[2] === './dest/', 'T-SP-02: double-quoted string')

  const t3 = tokenizeCommand("rm 'path with spaces/file.txt'")
  assert(t3.length === 2 && t3[1] === 'path with spaces/file.txt', 'T-SP-03: single-quoted string')

  const t4 = tokenizeCommand('')
  assert(t4.length === 0, 'T-SP-04: empty input → empty array')

  const t5 = tokenizeCommand('rm')
  assert(t5.length === 1 && t5[0] === 'rm', 'T-SP-05: single token')

  const t6 = tokenizeCommand('rm   -rf   ./foo')
  assert(t6.length === 3, 'T-SP-06: multiple spaces collapsed')

  const t7 = tokenizeCommand('rm\t./foo\t./bar')
  assert(t7.length === 3, 'T-SP-07: tabs as separators')
}

// ─── isLikelyPath() ──────────────────────────────────────────
console.log('\n--- isLikelyPath ---')
{
  assert(isLikelyPath('./foo'), 'T-SP-08: relative ./ is path')
  assert(isLikelyPath('../foo'), 'T-SP-09: relative ../ is path')
  assert(isLikelyPath('~/foo'), 'T-SP-10: tilde is path')
  assert(isLikelyPath('/etc/passwd'), 'T-SP-11: unix absolute is path')
  assert(isLikelyPath('C:\\Windows'), 'T-SP-12: windows drive is path')
  assert(isLikelyPath('C:/Users'), 'T-SP-13: windows drive forward slash is path')
  assert(isLikelyPath('\\\\server\\share'), 'T-SP-14: UNC path is path')
  assert(isLikelyPath('subdir/file.txt'), 'T-SP-15: contains / is path')
  assert(isLikelyPath('subdir\\file.txt'), 'T-SP-16: contains \\ is path')
  assert(!isLikelyPath('hello'), 'T-SP-17: bare word is NOT path')
  assert(!isLikelyPath('-rf'), 'T-SP-18: flag is NOT path')
  assert(!isLikelyPath('package.json'), 'T-SP-19: filename without separator is NOT path')
}

// ─── validateCommandPaths() ──────────────────────────────────
console.log('\n--- validateCommandPaths ---')

// Use a workspace path that makes sense for testing
const WORKSPACE = process.platform === 'win32'
  ? 'C:\\projects\\myapp'
  : '/home/user/projects/myapp'

{
  // Non-file command → always valid (no path check)
  const r1 = validateCommandPaths('echo hello', WORKSPACE)
  assert(r1.valid === true, 'T-SP-20: echo (not file command) → valid')

  const r2 = validateCommandPaths('node ./app.js', WORKSPACE)
  assert(r2.valid === true, 'T-SP-21: node (not in YELLOW_FILE_COMMANDS) → valid')

  // No arguments → valid
  const r3 = validateCommandPaths('rm', WORKSPACE)
  assert(r3.valid === true, 'T-SP-22: rm with no args → valid')

  // rm with flags only → valid (flags skipped)
  const r4 = validateCommandPaths('rm -rf', WORKSPACE)
  assert(r4.valid === true, 'T-SP-23: rm -rf (flags only) → valid')

  // rm with inside-workspace path → valid
  const insidePath = process.platform === 'win32'
    ? '.\\node_modules'
    : './node_modules'
  const r5 = validateCommandPaths(`rm -rf ${insidePath}`, WORKSPACE)
  assert(r5.valid === true, 'T-SP-24: rm -rf ./node_modules → valid (inside workspace)')

  // rm with outside-workspace path → INVALID
  const outsidePath = process.platform === 'win32'
    ? 'C:\\Windows\\System32\\config'
    : '/etc/passwd'
  const r6 = validateCommandPaths(`rm ${outsidePath}`, WORKSPACE)
  assert(r6.valid === false, 'T-SP-25: rm /etc/passwd (or C:\\Windows) → invalid')
  assert(r6.violatingPath === outsidePath, 'T-SP-26: violatingPath returned')

  // Traversal attack
  const r7 = validateCommandPaths('rm ../../../etc/passwd', WORKSPACE)
  assert(r7.valid === false, 'T-SP-27: rm ../../../etc/passwd → invalid (traversal)')

  // cp with mixed inside/outside → invalid (first violation)
  const r8 = validateCommandPaths(`cp ${insidePath} ${outsidePath}`, WORKSPACE)
  assert(r8.valid === false, 'T-SP-28: cp inside outside → invalid')

  // mv inside workspace → valid
  const insideSrc = process.platform === 'win32' ? '.\\a.txt' : './a.txt'
  const insideDst = process.platform === 'win32' ? '.\\b.txt' : './b.txt'
  const r9 = validateCommandPaths(`mv ${insideSrc} ${insideDst}`, WORKSPACE)
  assert(r9.valid === true, 'T-SP-29: mv inside inside → valid')

  // chmod inside workspace → valid
  const r10 = validateCommandPaths(`chmod 755 ${insideSrc}`, WORKSPACE)
  assert(r10.valid === true, 'T-SP-30: chmod 755 inside → valid (755 is not a path)')

  // del outside workspace → invalid
  if (process.platform === 'win32') {
    const r11 = validateCommandPaths('del C:\\Windows\\notepad.exe', WORKSPACE)
    assert(r11.valid === false, 'T-SP-31: del C:\\Windows\\notepad.exe → invalid')
  } else {
    const r11 = validateCommandPaths('del /usr/bin/python3', WORKSPACE)
    assert(r11.valid === false, 'T-SP-31: del /usr/bin/python3 → invalid')
  }

  // rmdir outside → invalid
  const r12 = validateCommandPaths(`rmdir ${outsidePath}`, WORKSPACE)
  assert(r12.valid === false, 'T-SP-32: rmdir outside → invalid')
}

// ─── Broker integration: YELLOW + bad path → blocked ──────────
console.log('\n--- broker integration: path validation ---')
{
  // Minimal broker replica with path validation
  class TestBroker {
    constructor() { this.mode = 'auto' }

    evaluate(command, terminalId, workspacePath) {
      const classification = classifyCommand(command)
      let allowed, action, reason

      if (classification.zone === 'yellow' && workspacePath) {
        const pathCheck = validateCommandPaths(command, workspacePath)
        if (!pathCheck.valid) {
          return { allowed: false, classification, action: 'blocked', reason: `DEC-025: ${pathCheck.reason}` }
        }
      }

      switch (classification.zone) {
        case 'green': allowed = true; action = 'executed'; reason = 'GREEN'; break
        case 'yellow': allowed = true; action = 'executed'; reason = 'YELLOW auto'; break
        case 'red': allowed = false; action = 'blocked'; reason = classification.reason; break
      }

      return { allowed, classification, action, reason }
    }
  }

  const broker = new TestBroker()

  // YELLOW + good path → allowed
  const d1 = broker.evaluate(`rm ./temp.txt`, 't1', WORKSPACE)
  assert(d1.allowed === true, 'T-SP-33: broker: rm ./temp.txt inside workspace → allowed')

  // YELLOW + bad path → blocked
  const badPath = process.platform === 'win32'
    ? 'rm C:\\Windows\\System32\\evil.dll'
    : 'rm /etc/passwd'
  const d2 = broker.evaluate(badPath, 't1', WORKSPACE)
  assert(d2.allowed === false, 'T-SP-34: broker: rm outside workspace → blocked')
  assert(d2.action === 'blocked', 'T-SP-35: broker: action is "blocked"')
  assert(d2.reason.includes('DEC-025'), 'T-SP-36: broker: reason mentions DEC-025')

  // GREEN command → unaffected (no path check)
  const d3 = broker.evaluate('echo hello', 't1', WORKSPACE)
  assert(d3.allowed === true, 'T-SP-37: broker: GREEN unaffected by path validation')

  // RED command → still blocked
  const d4 = broker.evaluate('format C:', 't1', WORKSPACE)
  assert(d4.allowed === false, 'T-SP-38: broker: RED still blocked')

  // YELLOW non-file command → allowed (node, npm, etc.)
  const d5 = broker.evaluate('npm install express', 't1', WORKSPACE)
  assert(d5.allowed === true, 'T-SP-39: broker: YELLOW non-file command allowed')

  // Traversal attack through broker
  const d6 = broker.evaluate('rm ../../../etc/shadow', 't1', WORKSPACE)
  assert(d6.allowed === false, 'T-SP-40: broker: traversal attack blocked')
}

// ─── Source verification ────────────────────────────────────
console.log('\n--- source verification ---')
{
  const sandboxSource = readFileSync(
    resolve(__dirname, 'src/main/execution/workspace-sandbox.ts'),
    'utf-8'
  )

  assert(sandboxSource.includes('tokenizeCommand'), 'T-SP-41: workspace-sandbox has tokenizeCommand')
  assert(sandboxSource.includes('isLikelyPath'), 'T-SP-42: workspace-sandbox has isLikelyPath')
  assert(sandboxSource.includes('validateCommandPaths'), 'T-SP-43: workspace-sandbox has validateCommandPaths')
  assert(sandboxSource.includes('YELLOW_FILE_COMMANDS'), 'T-SP-44: workspace-sandbox imports YELLOW_FILE_COMMANDS')

  // Terminal service uses workspacePath in evaluate
  const tsSource = readFileSync(
    resolve(__dirname, 'src/main/services/terminal.service.ts'),
    'utf-8'
  )
  assert(tsSource.includes('this.workspacePath'), 'T-SP-45: terminal service passes workspacePath')

  // executeApproved re-validates CWD
  const approvedBranch = tsSource.match(/executeApproved[\s\S]*?write\(command \+ '\\r'\)/)
  if (approvedBranch) {
    assert(approvedBranch[0].includes('validateWorkspaceCwd'), 'T-SP-46: executeApproved re-validates CWD')
  } else {
    failed++
    console.error('  FAIL  T-SP-46: could not find executeApproved branch')
  }
}

// ─── Summary ────────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)

if (failed > 0) {
  console.error('\nFAILED — Sandbox path enforcement tests have errors.')
} else {
  console.log('\nPASSED — All sandbox path enforcement tests pass.\n')
}

process.exit(failed > 0 ? 1 : 0)
