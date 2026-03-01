/**
 * Phase 7 Hotfix J — Account Preflight / No-Project Guard / Error Discrimination
 *
 * Tests:
 * 1. is401() detection (positive cases)
 * 2. is401() rejects non-auth errors
 * 3. validateGateway() source verification
 * 4. No-project guard in orchestrator
 * 5. AccountManager badge source verification
 * 6. ChatPanel no-project guard
 * 7. IPC channel count = 48
 * 8. Types source verification
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSync } from 'esbuild'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(__dirname, '..')
const BUILD_DIR = join(__dirname, '.test-build', 'hotfix-j')

// ── Helpers ──────────────────────────────────────────────────

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    passed++
    console.log(`  PASS  ${name}`)
  } catch (err) {
    failed++
    console.error(`  FAIL  ${name}`)
    console.error(`        ${err.message}`)
  }
}

function readSrc(relPath) {
  return readFileSync(resolve(SRC, 'src', relPath), 'utf-8')
}

// ── Build rate-limit.service (bundles is401 + is429) ─────────

rmSync(BUILD_DIR, { recursive: true, force: true })
mkdirSync(BUILD_DIR, { recursive: true })

buildSync({
  entryPoints: [resolve(SRC, 'src', 'main', 'services', 'rate-limit.service.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(BUILD_DIR, 'rate-limit.test.mjs'),
  external: ['node:*'],
  logLevel: 'silent',
})

const rl = await import(pathToFileURL(join(BUILD_DIR, 'rate-limit.test.mjs')).href)

// ── Build IPC channels (bundles constants) ───────────────────

buildSync({
  entryPoints: [resolve(SRC, 'src', 'shared', 'ipc-channels.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(BUILD_DIR, 'ipc-channels.test.mjs'),
  logLevel: 'silent',
})

const ipcMod = await import(pathToFileURL(join(BUILD_DIR, 'ipc-channels.test.mjs')).href)

// ═══════════════════════════════════════════════════════════════
// T1: is401() detection — positive cases (8 assertions)
// ═══════════════════════════════════════════════════════════════

console.log('\n── T1: is401 positive ──')

test('HJ01: is401({ status: 401 }) → true', () => {
  assert.equal(rl.is401({ status: 401 }), true)
})

test('HJ02: is401({ status: 403 }) → true', () => {
  assert.equal(rl.is401({ status: 403 }), true)
})

test('HJ03: is401({ httpStatusCode: 401 }) → true', () => {
  assert.equal(rl.is401({ httpStatusCode: 401 }), true)
})

test('HJ04: is401({ message: "UNAUTHENTICATED" }) → true', () => {
  assert.equal(rl.is401({ message: 'UNAUTHENTICATED' }), true)
})

test('HJ05: is401({ message: "API key not valid" }) → true', () => {
  assert.equal(rl.is401({ message: 'API key not valid. Please pass a valid API key.' }), true)
})

test('HJ06: is401({ message: "PERMISSION_DENIED" }) → true', () => {
  assert.equal(rl.is401({ message: 'PERMISSION_DENIED' }), true)
})

test('HJ07: is401({ message: "Error 401: ..." }) → true', () => {
  assert.equal(rl.is401({ message: 'Error 401: Request failed' }), true)
})

test('HJ08: is401({ message: "Error 403: forbidden" }) → true', () => {
  assert.equal(rl.is401({ message: 'Error 403: forbidden' }), true)
})

// ═══════════════════════════════════════════════════════════════
// T2: is401() rejects non-auth errors (6 assertions)
// ═══════════════════════════════════════════════════════════════

console.log('\n── T2: is401 negative ──')

test('HJ09: is401(null) → false', () => {
  assert.equal(rl.is401(null), false)
})

test('HJ10: is401(undefined) → false', () => {
  assert.equal(rl.is401(undefined), false)
})

test('HJ11: is401({ status: 429 }) → false', () => {
  assert.equal(rl.is401({ status: 429 }), false)
})

test('HJ12: is401({ status: 500 }) → false', () => {
  assert.equal(rl.is401({ status: 500 }), false)
})

test('HJ13: is401({ message: "Resource exhausted" }) → false', () => {
  assert.equal(rl.is401({ message: 'Resource exhausted' }), false)
})

test('HJ14: is401({ message: "Generic network error" }) → false', () => {
  assert.equal(rl.is401({ message: 'Generic network error' }), false)
})

// ═══════════════════════════════════════════════════════════════
// T3: validateGateway() source verification (6 assertions)
// ═══════════════════════════════════════════════════════════════

console.log('\n── T3: validateGateway source ──')

const gatewaySrc = readSrc('main/services/gemini-gateway.ts')

test('HJ15: gateway exports validateGateway function', () => {
  assert.ok(gatewaySrc.includes('export async function validateGateway'))
})

test('HJ16: validateGateway uses countTokens for lightweight ping', () => {
  assert.ok(gatewaySrc.includes("model.countTokens('test')"))
})

test('HJ17: validateGateway checks is401', () => {
  assert.ok(gatewaySrc.includes('is401(error)'))
})

test('HJ18: validateGateway checks is429', () => {
  assert.ok(gatewaySrc.includes('is429(error)'))
})

test('HJ19: validateGateway returns valid on success', () => {
  assert.ok(gatewaySrc.includes("return 'valid'"))
})

test('HJ20: GatewayValidationResult type includes all states', () => {
  assert.ok(gatewaySrc.includes("'valid' | 'invalid' | 'quota' | 'unknown'"))
})

// ═══════════════════════════════════════════════════════════════
// T4: No-project guard in orchestrator (4 assertions)
// ═══════════════════════════════════════════════════════════════

console.log('\n── T4: orchestrator no-project guard ──')

const orchSrc = readSrc('main/core/orchestrator.ts')

test('HJ21: orchestrator has activeProjectId guard', () => {
  assert.ok(orchSrc.includes('if (!this.activeProjectId)'))
})

test('HJ22: guard returns success: false', () => {
  // Verify the guard is followed by a return with success: false
  const idx = orchSrc.indexOf('if (!this.activeProjectId)')
  const slice = orchSrc.slice(idx, idx + 200)
  assert.ok(slice.includes('success: false'))
})

test('HJ23: guard error message mentions proyecto', () => {
  const idx = orchSrc.indexOf('if (!this.activeProjectId)')
  const slice = orchSrc.slice(idx, idx + 200)
  assert.ok(slice.includes('proyecto'))
})

test('HJ24: guard is after isInitialized check', () => {
  const initIdx = orchSrc.indexOf('if (!isInitialized())')
  const projectIdx = orchSrc.indexOf('if (!this.activeProjectId)')
  assert.ok(initIdx > 0 && projectIdx > initIdx, 'activeProjectId guard must be after isInitialized check')
})

// ═══════════════════════════════════════════════════════════════
// T5: AccountManager badge source verification (6 assertions)
// ═══════════════════════════════════════════════════════════════

console.log('\n── T5: AccountManager badge ──')

const accountSrc = readSrc('renderer/src/components/Settings/AccountManager.tsx')

test('HJ25: AccountManager imports AccountPreflightEvent', () => {
  assert.ok(accountSrc.includes('AccountPreflightEvent'))
})

test('HJ26: AccountManager imports AccountGatewayStatus', () => {
  assert.ok(accountSrc.includes('AccountGatewayStatus'))
})

test('HJ27: AccountManager listens on ACCOUNT_PREFLIGHT_STATUS', () => {
  assert.ok(accountSrc.includes('ACCOUNT_PREFLIGHT_STATUS'))
})

test('HJ28: AccountManager renders valid badge', () => {
  assert.ok(accountSrc.includes("gatewayStatus === 'valid'"))
})

test('HJ29: AccountManager renders invalid badge', () => {
  assert.ok(accountSrc.includes("gatewayStatus === 'invalid'"))
})

test('HJ30: AccountManager renders quota badge', () => {
  assert.ok(accountSrc.includes("gatewayStatus === 'quota'"))
})

// ═══════════════════════════════════════════════════════════════
// T6: ChatPanel no-project guard (4 assertions)
// ═══════════════════════════════════════════════════════════════

console.log('\n── T6: ChatPanel no-project ──')

const chatPanelSrc = readSrc('renderer/src/components/Chat/ChatPanel.tsx')

test('HJ31: ChatPanel imports useProjectStore', () => {
  assert.ok(chatPanelSrc.includes('useProjectStore'))
})

test('HJ32: ChatPanel selects activeProject', () => {
  assert.ok(chatPanelSrc.includes('activeProject'))
})

test('HJ33: ChatPanel disables InputBar when no project', () => {
  assert.ok(chatPanelSrc.includes('!activeProject'))
})

test('HJ34: ChatPanel shows project hint text', () => {
  assert.ok(chatPanelSrc.includes('proyecto'))
})

// ═══════════════════════════════════════════════════════════════
// T7: IPC channel count = 48 (2 assertions)
// ═══════════════════════════════════════════════════════════════

console.log('\n── T7: IPC channels ──')

test('HJ35: IPC_CHANNEL_ALLOWLIST has 48 entries', () => {
  assert.equal(ipcMod.IPC_CHANNEL_ALLOWLIST.length, 48)
})

test('HJ36: ACCOUNT_PREFLIGHT_STATUS channel exists', () => {
  assert.ok(ipcMod.IPC_CHANNEL_ALLOWLIST.includes('account:preflight-status'))
})

// ═══════════════════════════════════════════════════════════════
// T8: Types source verification (4 assertions)
// ═══════════════════════════════════════════════════════════════

console.log('\n── T8: Types ──')

const typesSrc = readSrc('shared/types.ts')

test('HJ37: AccountGatewayStatus type exists', () => {
  assert.ok(typesSrc.includes('AccountGatewayStatus'))
})

test('HJ38: AccountGatewayStatus includes all status values', () => {
  assert.ok(typesSrc.includes("'validating' | 'valid' | 'invalid' | 'quota' | 'unknown'"))
})

test('HJ39: AccountPreflightEvent interface exists', () => {
  assert.ok(typesSrc.includes('AccountPreflightEvent'))
})

test('HJ40: AccountPreflightEvent has status field', () => {
  const idx = typesSrc.indexOf('AccountPreflightEvent')
  const slice = typesSrc.slice(idx, idx + 200)
  assert.ok(slice.includes('status: AccountGatewayStatus'))
})

// ═══════════════════════════════════════════════════════════════
// T9: is401 discrimination in orchestrator (2 assertions)
// ═══════════════════════════════════════════════════════════════

console.log('\n── T9: orchestrator is401 discrimination ──')

test('HJ41: orchestrator imports is401', () => {
  assert.ok(orchSrc.includes('is401'))
})

test('HJ42: orchestrator has deterministic auth error message', () => {
  assert.ok(orchSrc.includes('API key inválida o revocada'))
})

// ═══════════════════════════════════════════════════════════════
// T10: index.ts preflight wiring (3 assertions)
// ═══════════════════════════════════════════════════════════════

console.log('\n── T10: index.ts preflight ──')

const indexSrc = readSrc('main/index.ts')

test('HJ43: index.ts defines firePreflightCheck', () => {
  assert.ok(indexSrc.includes('function firePreflightCheck'))
})

test('HJ44: index.ts calls validateGateway in preflight', () => {
  assert.ok(indexSrc.includes('validateGateway()'))
})

test('HJ45: index.ts pushes ACCOUNT_PREFLIGHT_STATUS', () => {
  assert.ok(indexSrc.includes('ACCOUNT_PREFLIGHT_STATUS'))
})

// ═══════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════

console.log(`\n${'═'.repeat(60)}`)
console.log(`Hotfix J: ${passed} passed, ${failed} failed (${passed + failed} total)`)
console.log(`${'═'.repeat(60)}`)

if (failed > 0) process.exit(1)

// Cleanup
rmSync(BUILD_DIR, { recursive: true, force: true })
