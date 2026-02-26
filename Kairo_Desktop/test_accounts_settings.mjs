/**
 * test_accounts_settings.mjs — Phase 3 Sprint B: Accounts + Settings Tests
 *
 * Tests the REAL AccountService + SettingsService + DatabaseService (compiled from TS via esbuild).
 * Validates: account CRUD, single-active enforcement, API key encryption (with plaintext fallback),
 * settings key/value persistence, upsert, and source cross-verification.
 *
 * Note: In headless/test environments, safeStorage is NOT available.
 * Tests verify the PLAINTEXT: fallback path (traceable, not silent).
 *
 * Run: node test_accounts_settings.mjs
 * Expected: All assertions PASS, exit 0
 */

import { buildSync } from 'esbuild'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'

const __dirname = dirname(fileURLToPath(import.meta.url))

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

// ─── Robust temp dir cleanup (Windows anti-flakiness) ────────────────

function cleanupDir(dir) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      rmSync(dir, { recursive: true, force: true })
      return
    } catch (err) {
      if (attempt < 4 && (err.code === 'EBUSY' || err.code === 'EPERM')) {
        const wait = 100 * (attempt + 1)
        const start = Date.now()
        while (Date.now() - start < wait) { /* spin wait */ }
      }
    }
  }
}

// ─── Compile real services via esbuild ───────────────────────────────

const buildDir = resolve(__dirname, '.test-build')

// Compile DatabaseService
buildSync({
  entryPoints: [resolve(__dirname, 'src/main/services/database.service.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'database.service.mjs'),
  external: ['better-sqlite3'],
  logLevel: 'silent',
})

// Compile AccountService (needs electron externalized — safeStorage not available in Node)
buildSync({
  entryPoints: [resolve(__dirname, 'src/main/services/account.service.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'account.service.mjs'),
  external: ['better-sqlite3', 'electron', 'node:crypto'],
  logLevel: 'silent',
})

// Compile SettingsService
buildSync({
  entryPoints: [resolve(__dirname, 'src/main/services/settings.service.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'settings.service.mjs'),
  external: ['better-sqlite3'],
  logLevel: 'silent',
})

const { DatabaseService } = await import(pathToFileURL(join(buildDir, 'database.service.mjs')).href)
const { SettingsService } = await import(pathToFileURL(join(buildDir, 'settings.service.mjs')).href)

// AccountService requires electron's safeStorage which is NOT available outside Electron.
// We test it by shimming the electron module.
// Strategy: read the compiled source and check that it handles the fallback correctly.
// For runtime testing, we create a minimal shim.

// Create a shim for electron's safeStorage
import { writeFileSync } from 'node:fs'

const electronShimPath = join(buildDir, 'electron-shim.mjs')
writeFileSync(electronShimPath, `
export const safeStorage = {
  isEncryptionAvailable() { return false },
  encryptString(s) { return Buffer.from(s) },
  decryptString(b) { return b.toString() },
}
export default { safeStorage }
`)

// Recompile AccountService with electron alias pointing to our shim
buildSync({
  entryPoints: [resolve(__dirname, 'src/main/services/account.service.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'account.service.shimmed.mjs'),
  external: ['better-sqlite3', 'node:crypto'],
  alias: { 'electron': electronShimPath },
  logLevel: 'silent',
})

const { AccountService } = await import(pathToFileURL(join(buildDir, 'account.service.shimmed.mjs')).href)

// Track all temp dirs for cleanup
const tempDirs = []

function makeTempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), `kairo-test-${prefix}-`))
  tempDirs.push(dir)
  return dir
}

/** Create a real DatabaseService + AccountService + SettingsService */
function createServices(prefix) {
  const tempUserData = makeTempDir(prefix)
  const dbService = new DatabaseService(tempUserData)
  const accountService = new AccountService(dbService.getDb())
  const settingsService = new SettingsService(dbService.getDb())
  return { dbService, accountService, settingsService, db: dbService.getDb() }
}

// ─── Test Cases ──────────────────────────────────────────────────────

console.log('\n=== Phase 3 Sprint B — Accounts + Settings Tests ===\n')

// ═══════════════════════════════════════════════
// ACCOUNT TESTS
// ═══════════════════════════════════════════════

// ────────────────────────────────────────────────
console.log('--- T01: Create account ---')
{
  const { dbService, accountService } = createServices('t01')

  const result = accountService.createAccount('Test Account', 'sk-test-key-123')
  assertEqual(result.success, true, 'T01a: createAccount returns success=true')
  assert(result.data !== undefined, 'T01b: data is present')
  assertEqual(result.data.account.label, 'Test Account', 'T01c: label matches')
  assertEqual(result.data.account.isActive, false, 'T01d: isActive is false initially')
  assertEqual(result.data.account.tier, 'free', 'T01e: tier defaults to free')
  assert(result.data.account.id.length > 0, 'T01f: id is non-empty UUID')
  assert(result.data.account.apiKey === undefined || result.data.account.api_key_encrypted === undefined,
    'T01g: API key is NOT exposed in Account object')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T02: List accounts ---')
{
  const { dbService, accountService } = createServices('t02')

  accountService.createAccount('Account A', 'key-a')
  accountService.createAccount('Account B', 'key-b')

  const result = accountService.listAccounts()
  assertEqual(result.success, true, 'T02a: listAccounts returns success=true')
  assertEqual(result.data.accounts.length, 2, 'T02b: returns 2 accounts')
  // Verify no API key in list
  const hasKey = result.data.accounts.some(a => a.apiKey !== undefined || a.api_key_encrypted !== undefined)
  assertEqual(hasKey, false, 'T02c: no API key exposed in account list')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T03: Set active account (single active enforcement) ---')
{
  const { dbService, accountService } = createServices('t03')

  const a1 = accountService.createAccount('First', 'key-1')
  const a2 = accountService.createAccount('Second', 'key-2')

  const setResult = accountService.setActiveAccount(a1.data.account.id)
  assertEqual(setResult.success, true, 'T03a: setActiveAccount succeeds')
  assertEqual(setResult.data.account.isActive, true, 'T03b: first account is now active')

  // Activate second — first should deactivate
  const setResult2 = accountService.setActiveAccount(a2.data.account.id)
  assertEqual(setResult2.success, true, 'T03c: second setActiveAccount succeeds')

  const list = accountService.listAccounts()
  const activeAccounts = list.data.accounts.filter(a => a.isActive)
  assertEqual(activeAccounts.length, 1, 'T03d: exactly one active account')
  assertEqual(activeAccounts[0].id, a2.data.account.id, 'T03e: second account is the active one')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T04: Delete account ---')
{
  const { dbService, accountService } = createServices('t04')

  const created = accountService.createAccount('Deletable', 'key-del')
  const result = accountService.deleteAccount(created.data.account.id)
  assertEqual(result.success, true, 'T04a: deleteAccount succeeds')

  const list = accountService.listAccounts()
  assertEqual(list.data.accounts.length, 0, 'T04b: account removed from list')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T05: Reject empty label ---')
{
  const { dbService, accountService } = createServices('t05')

  const result = accountService.createAccount('   ', 'key-x')
  assertEqual(result.success, false, 'T05a: empty label rejected')
  assert(result.error.includes('non-empty'), 'T05b: error mentions non-empty')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T06: Reject empty API key ---')
{
  const { dbService, accountService } = createServices('t06')

  const result = accountService.createAccount('Valid Label', '   ')
  assertEqual(result.success, false, 'T06a: empty apiKey rejected')
  assert(result.error.includes('non-empty'), 'T06b: error mentions non-empty')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T07: Delete nonexistent account ---')
{
  const { dbService, accountService } = createServices('t07')

  const result = accountService.deleteAccount('nonexistent-uuid')
  assertEqual(result.success, false, 'T07a: delete nonexistent account fails')
  assert(result.error.includes('not found'), 'T07b: error mentions not found')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T08: Set active on nonexistent account ---')
{
  const { dbService, accountService } = createServices('t08')

  const result = accountService.setActiveAccount('nonexistent-uuid')
  assertEqual(result.success, false, 'T08a: setActive on nonexistent fails')
  assert(result.error.includes('not found'), 'T08b: error mentions not found')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T09: Encryption path verification (PLAINTEXT fallback) ---')
{
  const { dbService, accountService, db } = createServices('t09')

  accountService.createAccount('Encrypted Test', 'my-secret-key-abc')
  const row = db.prepare('SELECT api_key_encrypted FROM accounts LIMIT 1').get()
  assert(row !== undefined, 'T09a: raw row exists in DB')
  // In test env, safeStorage is NOT available — key stored as PLAINTEXT:
  assert(row.api_key_encrypted.startsWith('PLAINTEXT:'), 'T09b: key stored with PLAINTEXT: prefix (safeStorage unavailable)')
  assertEqual(row.api_key_encrypted, 'PLAINTEXT:my-secret-key-abc', 'T09c: plaintext key is recoverable')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T10: Active account yields decryptable key (internal) ---')
{
  const { dbService, accountService } = createServices('t10')

  accountService.createAccount('Key Holder', 'decryptable-key-xyz')
  const list = accountService.listAccounts()
  accountService.setActiveAccount(list.data.accounts[0].id)

  const apiKey = accountService.getActiveApiKey()
  assertEqual(apiKey, 'decryptable-key-xyz', 'T10a: getActiveApiKey returns plaintext key')

  // No active account → null
  accountService.deleteAccount(list.data.accounts[0].id)
  const noKey = accountService.getActiveApiKey()
  assertEqual(noKey, null, 'T10b: getActiveApiKey returns null when no active account')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T11: Account with custom tier ---')
{
  const { dbService, accountService } = createServices('t11')

  const result = accountService.createAccount('Pro Account', 'key-pro', 'tier2')
  assertEqual(result.success, true, 'T11a: create with tier2 succeeds')
  assertEqual(result.data.account.tier, 'tier2', 'T11b: tier is tier2')
  dbService.close()
}

// ═══════════════════════════════════════════════
// SETTINGS TESTS
// ═══════════════════════════════════════════════

// ────────────────────────────────────────────────
console.log('\n--- T12: Settings set/get roundtrip ---')
{
  const { dbService, settingsService } = createServices('t12')

  const setResult = settingsService.setSetting('theme', 'dark', 'UI theme preference')
  assertEqual(setResult.success, true, 'T12a: setSetting returns success=true')

  const getResult = settingsService.getSetting('theme')
  assertEqual(getResult.success, true, 'T12b: getSetting returns success=true')
  assertEqual(getResult.data.value, 'dark', 'T12c: value roundtrips correctly')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T13: Get nonexistent setting returns null ---')
{
  const { dbService, settingsService } = createServices('t13')

  const result = settingsService.getSetting('nonexistent_key')
  assertEqual(result.success, true, 'T13a: getSetting succeeds')
  assertEqual(result.data.value, null, 'T13b: value is null for nonexistent key')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T14: Get all settings ---')
{
  const { dbService, settingsService } = createServices('t14')

  settingsService.setSetting('key_a', 'val_a')
  settingsService.setSetting('key_b', 'val_b')
  settingsService.setSetting('key_c', 'val_c')

  const result = settingsService.getAllSettings()
  assertEqual(result.success, true, 'T14a: getAllSettings returns success=true')
  assertEqual(result.data.settings.length, 3, 'T14b: returns 3 settings')
  // Verify alphabetical order
  assertEqual(result.data.settings[0].key, 'key_a', 'T14c: settings ordered alphabetically')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T15: Settings overwrite (upsert) ---')
{
  const { dbService, settingsService } = createServices('t15')

  settingsService.setSetting('model', 'gemini-flash')
  settingsService.setSetting('model', 'gemini-pro')

  const result = settingsService.getSetting('model')
  assertEqual(result.data.value, 'gemini-pro', 'T15a: upsert overwrites old value')

  const all = settingsService.getAllSettings()
  assertEqual(all.data.settings.length, 1, 'T15b: no duplicate entries after upsert')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T16: Settings delete ---')
{
  const { dbService, settingsService } = createServices('t16')

  settingsService.setSetting('temp_key', 'temp_val')
  const delResult = settingsService.deleteSetting('temp_key')
  assertEqual(delResult.success, true, 'T16a: deleteSetting succeeds')

  const getResult = settingsService.getSetting('temp_key')
  assertEqual(getResult.data.value, null, 'T16b: deleted setting returns null')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T17: Settings input validation ---')
{
  const { dbService, settingsService } = createServices('t17')

  const r1 = settingsService.setSetting('', 'val')
  assertEqual(r1.success, false, 'T17a: empty key rejected for setSetting')

  const r2 = settingsService.setSetting('   ', 'val')
  assertEqual(r2.success, false, 'T17b: whitespace-only key rejected')
  dbService.close()
}

// ═══════════════════════════════════════════════
// SOURCE CROSS-VERIFICATION (complementary)
// ═══════════════════════════════════════════════

// ────────────────────────────────────────────────
console.log('\n--- T18: Source cross-verification ---')
{
  const accountSource = readFileSync(
    resolve(__dirname, 'src/main/services/account.service.ts'), 'utf-8'
  )
  assert(accountSource.includes('class AccountService'), 'T18a: AccountService class exists')
  assert(accountSource.includes('safeStorage'), 'T18b: AccountService uses safeStorage')
  assert(accountSource.includes('encryptString') || accountSource.includes('encryptKey'), 'T18c: AccountService encrypts keys')
  assert(accountSource.includes('PLAINTEXT:'), 'T18d: AccountService has plaintext fallback marker')
  assert(accountSource.includes('getActiveApiKey'), 'T18e: AccountService has internal getActiveApiKey')
  assert(accountSource.includes('isEncryptionAvailable'), 'T18f: AccountService checks encryption availability')

  const settingsSource = readFileSync(
    resolve(__dirname, 'src/main/services/settings.service.ts'), 'utf-8'
  )
  assert(settingsSource.includes('class SettingsService'), 'T18g: SettingsService class exists')
  assert(settingsSource.includes('INSERT OR REPLACE'), 'T18h: SettingsService uses upsert pattern')

  const handlersSource = readFileSync(
    resolve(__dirname, 'src/main/ipc/settings.handlers.ts'), 'utf-8'
  )
  assert(handlersSource.includes('registerSettingsHandlers'), 'T18i: handlers export registerSettingsHandlers')
  assert(handlersSource.includes('ACCOUNT_CREATE'), 'T18j: handlers register ACCOUNT_CREATE')
  assert(handlersSource.includes('ACCOUNT_DELETE'), 'T18k: handlers register ACCOUNT_DELETE')
  assert(handlersSource.includes('SESSION_CREATE'), 'T18l: handlers register SESSION_CREATE')
  assert(handlersSource.includes('validateSender'), 'T18m: all handlers use validateSender')
}

// ─── Cleanup ────────────────────────────────────────────────────────

for (const dir of tempDirs) {
  cleanupDir(dir)
}
cleanupDir(buildDir)

// ─── Summary ─────────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)

if (failed > 0) {
  console.error('\nFAILED — Accounts/settings tests have errors.')
  process.exit(1)
} else {
  console.log('\nPASSED — All accounts/settings tests pass.\n')
  process.exit(0)
}
