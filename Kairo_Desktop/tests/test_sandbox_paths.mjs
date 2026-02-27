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
const YELLOW_FILE_COMMANDS = extractPatterns(zonesSource, 'YELLOW_FILE_COMMANDS')
const YELLOW_INTERPRETER_COMMANDS = extractPatterns(zonesSource, 'YELLOW_INTERPRETER_COMMANDS')
const NAVIGATION_COMMANDS = extractPatterns(zonesSource, 'NAVIGATION_COMMANDS')

const CLASSIFIER_PATH = resolve(__dirname, '../src/main/execution/command-classifier.ts')
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

  // File-mutation commands: validate ALL path arguments
  if (YELLOW_FILE_COMMANDS.includes(baseCmd)) {
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

  // Interpreter commands: validate FIRST path-like argument (script file)
  if (YELLOW_INTERPRETER_COMMANDS.includes(baseCmd)) {
    for (let i = 1; i < tokens.length; i++) {
      const token = tokens[i]
      if (token.startsWith('-')) continue
      if (!isLikelyPath(token)) continue
      const resolvedToken = resolve(workspacePath, token)
      if (!isInsideWorkspace(resolvedToken, workspacePath)) {
        return {
          valid: false,
          reason: `Script path "${token}" is outside workspace "${workspacePath}". DEC-025 interpreter sandbox violation.`,
          violatingPath: token,
        }
      }
      break
    }
    return { valid: true, reason: 'Interpreter script path is inside workspace.' }
  }

  // Navigation commands: validate first non-flag argument (any token, not just path-like)
  if (NAVIGATION_COMMANDS.includes(baseCmd)) {
    for (let i = 1; i < tokens.length; i++) {
      const token = tokens[i]
      if (token.startsWith('-')) continue
      const resolvedToken = resolve(workspacePath, token)
      if (!isInsideWorkspace(resolvedToken, workspacePath)) {
        return {
          valid: false,
          reason: `Navigation target "${token}" resolves outside workspace "${workspacePath}". DEC-025 sandbox violation.`,
          violatingPath: token,
        }
      }
      break
    }
    return { valid: true, reason: 'Navigation target is inside workspace.' }
  }

  // Universal fallback: validate ALL path-like arguments for ANY command
  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i]
    if (token.startsWith('-')) continue
    if (!isLikelyPath(token)) continue
    const resolvedToken = resolve(workspacePath, token)
    if (!isInsideWorkspace(resolvedToken, workspacePath)) {
      return {
        valid: false,
        reason: `Path "${token}" is outside workspace "${workspacePath}". DEC-025 universal sandbox check.`,
        violatingPath: token,
      }
    }
  }
  return { valid: true, reason: 'All path arguments are inside workspace.' }
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
  assert(r2.valid === true, 'T-SP-21: node ./app.js (inside workspace) → valid')

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
  // Broker replica with path validation — applies to GREEN + YELLOW (not RED)
  class TestBroker {
    constructor() { this.mode = 'auto' }

    evaluate(command, terminalId, workspacePath) {
      const classification = classifyCommand(command)
      let allowed, action, reason

      // Path validation BEFORE zone dispatch — applies to GREEN and YELLOW
      if (workspacePath && classification.zone !== 'red') {
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

// ─── YELLOW_INTERPRETER_COMMANDS extraction ─────────────────
console.log('\n--- YELLOW_INTERPRETER_COMMANDS ---')
{
  assert(YELLOW_INTERPRETER_COMMANDS.includes('python'), 'T-SP-41a: python in interpreter commands')
  assert(YELLOW_INTERPRETER_COMMANDS.includes('python3'), 'T-SP-41b: python3 in interpreter commands')
  assert(YELLOW_INTERPRETER_COMMANDS.includes('node'), 'T-SP-41c: node in interpreter commands')
  assert(YELLOW_INTERPRETER_COMMANDS.includes('ts-node'), 'T-SP-41d: ts-node in interpreter commands')
  assert(YELLOW_INTERPRETER_COMMANDS.includes('tsx'), 'T-SP-41e: tsx in interpreter commands')
  assert(YELLOW_INTERPRETER_COMMANDS.includes('deno'), 'T-SP-41f: deno in interpreter commands')
  assert(YELLOW_INTERPRETER_COMMANDS.includes('bun'), 'T-SP-41g: bun in interpreter commands')
}

// ─── Interpreter path validation (Sprint C.1) ──────────────
console.log('\n--- interpreter path validation ---')
{
  // python with inside-workspace script → valid
  const r1 = validateCommandPaths('python ./script.py', WORKSPACE)
  assert(r1.valid === true, 'T-SP-42a: python ./script.py inside workspace → valid')

  // python with outside-workspace script → INVALID
  const outsideScript = process.platform === 'win32'
    ? 'python C:\\evil\\malware.py'
    : 'python /tmp/evil.py'
  const r2 = validateCommandPaths(outsideScript, WORKSPACE)
  assert(r2.valid === false, 'T-SP-42b: python /tmp/evil.py → invalid')
  assert(r2.reason.includes('DEC-025'), 'T-SP-42c: reason mentions DEC-025')

  // node with traversal → INVALID
  const r3 = validateCommandPaths('node ../../../etc/exploit.js', WORKSPACE)
  assert(r3.valid === false, 'T-SP-42d: node ../../../etc/exploit.js → invalid')
  assert(r3.violatingPath === '../../../etc/exploit.js', 'T-SP-42e: violatingPath correct')

  // python -m pip (no path-like arg) → valid (module flag, not a path)
  const r4 = validateCommandPaths('python -m pip install flask', WORKSPACE)
  assert(r4.valid === true, 'T-SP-42f: python -m pip (no path) → valid')

  // python --version (flags only) → valid
  const r5 = validateCommandPaths('python --version', WORKSPACE)
  assert(r5.valid === true, 'T-SP-42g: python --version → valid')

  // node with no args → valid
  const r6 = validateCommandPaths('node', WORKSPACE)
  assert(r6.valid === true, 'T-SP-42h: bare node → valid')

  // ts-node with outside path → INVALID
  const r7 = validateCommandPaths('ts-node /opt/backdoor.ts', WORKSPACE)
  assert(r7.valid === false, 'T-SP-42i: ts-node /opt/backdoor.ts → invalid')

  // deno with inside workspace → valid
  const r8 = validateCommandPaths('deno run ./server.ts', WORKSPACE)
  assert(r8.valid === true, 'T-SP-42j: deno run ./server.ts → valid (run is not a path)')

  // bun with outside path → INVALID
  const outsideBun = process.platform === 'win32'
    ? 'bun C:\\Windows\\System32\\evil.js'
    : 'bun /usr/local/evil.js'
  const r9 = validateCommandPaths(outsideBun, WORKSPACE)
  assert(r9.valid === false, 'T-SP-42k: bun /outside/evil.js → invalid')

  // Interpreter + inside path with flags → valid
  const r10 = validateCommandPaths('python -u ./app.py', WORKSPACE)
  assert(r10.valid === true, 'T-SP-42l: python -u ./app.py → valid (flag skipped, script inside)')
}

// ─── Broker integration: interpreter path ────────────────────
console.log('\n--- broker integration: interpreter path ---')
{
  class TestBroker2 {
    constructor() { this.mode = 'auto' }

    evaluate(command, terminalId, workspacePath) {
      const classification = classifyCommand(command)
      let allowed, action, reason

      if (workspacePath && classification.zone !== 'red') {
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

  const broker = new TestBroker2()

  // python inside workspace → allowed
  const d1 = broker.evaluate('python ./train.py', 't1', WORKSPACE)
  assert(d1.allowed === true, 'T-SP-43a: broker: python ./train.py → allowed')

  // python outside workspace → blocked
  const outsideCmd = process.platform === 'win32'
    ? 'python C:\\evil\\payload.py'
    : 'python /tmp/payload.py'
  const d2 = broker.evaluate(outsideCmd, 't1', WORKSPACE)
  assert(d2.allowed === false, 'T-SP-43b: broker: python /outside/payload.py → blocked')
  assert(d2.action === 'blocked', 'T-SP-43c: broker: action is blocked')
  assert(d2.reason.includes('DEC-025'), 'T-SP-43d: broker: reason includes DEC-025')

  // node with traversal → blocked
  const d3 = broker.evaluate('node ../../evil.js', 't1', WORKSPACE)
  assert(d3.allowed === false, 'T-SP-43e: broker: node traversal → blocked')

  // npm install (non-interpreter YELLOW) → allowed (no path check)
  const d4 = broker.evaluate('npm install express', 't1', WORKSPACE)
  assert(d4.allowed === true, 'T-SP-43f: broker: npm install still allowed')
}

// ─── NAVIGATION_COMMANDS extraction ──────────────────────────
console.log('\n--- NAVIGATION_COMMANDS ---')
{
  assert(NAVIGATION_COMMANDS.includes('cd'), 'T-SP-50a: cd in navigation commands')
  assert(NAVIGATION_COMMANDS.includes('chdir'), 'T-SP-50b: chdir in navigation commands')
  assert(NAVIGATION_COMMANDS.includes('pushd'), 'T-SP-50c: pushd in navigation commands')
  assert(NAVIGATION_COMMANDS.includes('popd'), 'T-SP-50d: popd in navigation commands')
}

// ─── Navigation path validation (Sprint C.1 hardening) ─────
console.log('\n--- navigation path validation ---')
{
  // cd inside workspace → valid
  const r1 = validateCommandPaths('cd ./src', WORKSPACE)
  assert(r1.valid === true, 'T-SP-51a: cd ./src inside workspace → valid')

  // cd outside workspace → INVALID
  const outsideDir = process.platform === 'win32'
    ? 'cd C:\\Windows'
    : 'cd /tmp'
  const r2 = validateCommandPaths(outsideDir, WORKSPACE)
  assert(r2.valid === false, 'T-SP-51b: cd /tmp (or C:\\Windows) → invalid')
  assert(r2.reason.includes('DEC-025'), 'T-SP-51c: reason mentions DEC-025')

  // cd traversal → INVALID
  const r3 = validateCommandPaths('cd ../../', WORKSPACE)
  assert(r3.valid === false, 'T-SP-51d: cd ../../ → invalid (traversal)')

  // cd with bare directory name inside workspace → valid
  // "folder" is NOT a path by isLikelyPath, but NAVIGATION_COMMANDS checks
  // any non-flag token, not just path-like ones
  const r4 = validateCommandPaths('cd src', WORKSPACE)
  assert(r4.valid === true, 'T-SP-51e: cd src (bare name inside workspace) → valid')

  // pushd outside workspace → INVALID
  const r5 = validateCommandPaths('pushd /opt/evil', WORKSPACE)
  assert(r5.valid === false, 'T-SP-51f: pushd /opt/evil → invalid')

  // chdir inside → valid
  const r6 = validateCommandPaths('chdir ./build', WORKSPACE)
  assert(r6.valid === true, 'T-SP-51g: chdir ./build → valid')

  // cd no args → valid (bare cd = go to home, but no arg to validate)
  const r7 = validateCommandPaths('cd', WORKSPACE)
  assert(r7.valid === true, 'T-SP-51h: bare cd → valid (no argument)')
}

// ─── Universal fallback path validation ─────────────────────
console.log('\n--- universal fallback path validation ---')
{
  // Unknown command with outside-workspace path → INVALID
  const r1 = validateCommandPaths('cat /etc/passwd', WORKSPACE)
  assert(r1.valid === false, 'T-SP-52a: cat /etc/passwd → invalid (universal fallback)')
  assert(r1.reason.includes('DEC-025'), 'T-SP-52b: reason mentions DEC-025')

  // Unknown command with inside-workspace path → valid
  const r2 = validateCommandPaths('cat ./README.md', WORKSPACE)
  assert(r2.valid === true, 'T-SP-52c: cat ./README.md → valid (inside workspace)')

  // Unknown command with no path args → valid
  const r3 = validateCommandPaths('echo hello world', WORKSPACE)
  assert(r3.valid === true, 'T-SP-52d: echo hello world → valid (no path args)')

  // Unknown command with traversal → INVALID
  const r4 = validateCommandPaths('cat ../../../etc/shadow', WORKSPACE)
  assert(r4.valid === false, 'T-SP-52e: cat traversal → invalid')

  // curl with URL-like arg → valid (contains / but resolved against workspace)
  // Note: curl is YELLOW, this tests universal fallback for non-listed commands
  const r5 = validateCommandPaths('less ./local-file.txt', WORKSPACE)
  assert(r5.valid === true, 'T-SP-52f: less ./local-file.txt → valid (inside)')

  // head with outside path → INVALID
  const outsideHead = process.platform === 'win32'
    ? 'head C:\\Windows\\System32\\config\\SAM'
    : 'head /etc/shadow'
  const r6 = validateCommandPaths(outsideHead, WORKSPACE)
  assert(r6.valid === false, 'T-SP-52g: head /etc/shadow → invalid (universal fallback)')
}

// ─── Broker integration: GREEN + path validation ────────────
console.log('\n--- broker integration: GREEN + path validation ---')
{
  class TestBroker3 {
    constructor() { this.mode = 'auto' }

    evaluate(command, terminalId, workspacePath) {
      const classification = classifyCommand(command)
      let allowed, action, reason

      if (workspacePath && classification.zone !== 'red') {
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

  const broker = new TestBroker3()

  // cd outside workspace (GREEN classified but path blocked)
  const cdOutside = process.platform === 'win32'
    ? 'cd C:\\Windows'
    : 'cd /tmp'
  const d1 = broker.evaluate(cdOutside, 't1', WORKSPACE)
  assert(d1.allowed === false, 'T-SP-53a: broker: cd outside workspace → blocked')
  assert(d1.action === 'blocked', 'T-SP-53b: broker: cd action is blocked')
  assert(d1.classification.zone === 'green', 'T-SP-53c: broker: cd classified as GREEN')
  assert(d1.reason.includes('DEC-025'), 'T-SP-53d: broker: reason includes DEC-025')

  // cd inside workspace → allowed
  const d2 = broker.evaluate('cd ./src', 't1', WORKSPACE)
  assert(d2.allowed === true, 'T-SP-53e: broker: cd ./src → allowed')

  // cd traversal → blocked
  const d3 = broker.evaluate('cd ../../../', 't1', WORKSPACE)
  assert(d3.allowed === false, 'T-SP-53f: broker: cd traversal → blocked')

  // cat outside workspace → blocked (universal fallback via GREEN)
  const catOutside = process.platform === 'win32'
    ? 'cat C:\\Windows\\System32\\config\\SAM'
    : 'cat /etc/shadow'
  const d4 = broker.evaluate(catOutside, 't1', WORKSPACE)
  assert(d4.allowed === false, 'T-SP-53g: broker: cat /etc/shadow → blocked')
  assert(d4.classification.zone === 'green', 'T-SP-53h: broker: cat classified as GREEN but path blocked')

  // echo hello → allowed (no path args)
  const d5 = broker.evaluate('echo hello', 't1', WORKSPACE)
  assert(d5.allowed === true, 'T-SP-53i: broker: echo hello → allowed')

  // npm run build → allowed (no outside paths)
  const d6 = broker.evaluate('npm run build', 't1', WORKSPACE)
  assert(d6.allowed === true, 'T-SP-53j: broker: npm run build → allowed')
}

// ─── Source verification ────────────────────────────────────
console.log('\n--- source verification ---')
{
  const sandboxSource = readFileSync(
    resolve(__dirname, '../src/main/execution/workspace-sandbox.ts'),
    'utf-8'
  )

  assert(sandboxSource.includes('tokenizeCommand'), 'T-SP-60: workspace-sandbox has tokenizeCommand')
  assert(sandboxSource.includes('isLikelyPath'), 'T-SP-61: workspace-sandbox has isLikelyPath')
  assert(sandboxSource.includes('validateCommandPaths'), 'T-SP-62: workspace-sandbox has validateCommandPaths')
  assert(sandboxSource.includes('YELLOW_FILE_COMMANDS'), 'T-SP-63: workspace-sandbox imports YELLOW_FILE_COMMANDS')
  assert(sandboxSource.includes('YELLOW_INTERPRETER_COMMANDS'), 'T-SP-64: workspace-sandbox imports YELLOW_INTERPRETER_COMMANDS')
  assert(sandboxSource.includes('NAVIGATION_COMMANDS'), 'T-SP-65: workspace-sandbox imports NAVIGATION_COMMANDS')

  // command-zones has all constants
  const zonesSourceVerify = readFileSync(
    resolve(__dirname, '../src/main/config/command-zones.ts'),
    'utf-8'
  )
  assert(zonesSourceVerify.includes('YELLOW_INTERPRETER_COMMANDS'), 'T-SP-66: command-zones has YELLOW_INTERPRETER_COMMANDS')
  assert(zonesSourceVerify.includes('NAVIGATION_COMMANDS'), 'T-SP-67: command-zones has NAVIGATION_COMMANDS')

  // Terminal service uses workspacePath in evaluate
  const tsSource = readFileSync(
    resolve(__dirname, '../src/main/services/terminal.service.ts'),
    'utf-8'
  )
  assert(tsSource.includes('this.workspacePath'), 'T-SP-68: terminal service passes workspacePath')

  // executeApproved re-validates CWD
  const approvedBranch = tsSource.match(/executeApproved[\s\S]*?write\(command \+ '\\r'\)/)
  if (approvedBranch) {
    assert(approvedBranch[0].includes('validateWorkspaceCwd'), 'T-SP-69: executeApproved re-validates CWD')
  } else {
    failed++
    console.error('  FAIL  T-SP-69: could not find executeApproved branch')
  }

  // Broker applies path validation before zone dispatch (not only in YELLOW)
  const brokerSource = readFileSync(
    resolve(__dirname, '../src/main/execution/execution-broker.ts'),
    'utf-8'
  )
  assert(brokerSource.includes("classification.zone !== 'red'"), 'T-SP-70: broker validates paths for non-RED zones')
}

// ─── Summary ────────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)

if (failed > 0) {
  console.error('\nFAILED — Sandbox path enforcement tests have errors.')
} else {
  console.log('\nPASSED — All sandbox path enforcement tests pass.\n')
}

process.exit(failed > 0 ? 1 : 0)
