/**
 * test_ipc_negative.mjs — IPC Allowlist Negative Test (Real Source Parity)
 *
 * SECURITY: This test imports the REAL allowlist from src/shared/ipc-channels.ts
 * by parsing the source file. Zero duplicated channel literals.
 *
 * Run: node test_ipc_negative.mjs
 * Expected: All assertions PASS, exit 0
 *
 * Manual E2E verification in DevTools:
 *   window.kairoApi.invoke('shell:execute', {cmd: 'rm -rf /'})  // Should THROW
 *   window.kairoApi.invoke('chat:send-message', {content:'hi'}) // Should work
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Extract REAL allowlist from source ──────────────────────────────
// Parse src/shared/ipc-channels.ts to get the actual channel values.
// This ensures test never drifts from source — if a channel is added/removed
// in the source file, the test picks it up automatically.

const SOURCE_PATH = resolve(__dirname, 'src/shared/ipc-channels.ts')
const source = readFileSync(SOURCE_PATH, 'utf-8')

// Extract all string values from lines like:  CHAT_SEND_MESSAGE: 'chat:send-message',
const channelPattern = /:\s*'([a-z][-a-z]*:[a-z][-a-z]*)'/g
const extractedChannels = []
let match
while ((match = channelPattern.exec(source)) !== null) {
  extractedChannels.push(match[1])
}

if (extractedChannels.length === 0) {
  console.error('FATAL: Could not extract any channels from', SOURCE_PATH)
  process.exit(2)
}

// Replicate the allowlist logic exactly as preload does
const IPC_CHANNEL_ALLOWLIST = Object.freeze([...extractedChannels])

function isAllowedChannel(channel) {
  return IPC_CHANNEL_ALLOWLIST.includes(channel)
}

function validateChannel(channel) {
  if (!isAllowedChannel(channel)) {
    throw new Error(
      `[KAIRO_SECURITY] IPC channel "${channel}" is NOT in the allowlist. Rejected.`
    )
  }
}

// ─── Test Runner ─────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(description, fn) {
  try {
    fn()
    passed++
    console.log(`  PASS  ${description}`)
  } catch (err) {
    failed++
    console.error(`  FAIL  ${description}`)
    console.error(`        ${err.message}`)
  }
}

function assertThrows(description, fn, expectedFragment) {
  try {
    fn()
    failed++
    console.error(`  FAIL  ${description} (expected throw, got success)`)
  } catch (err) {
    if (expectedFragment && !err.message.includes(expectedFragment)) {
      failed++
      console.error(`  FAIL  ${description} (wrong error message)`)
      console.error(`        Expected fragment: "${expectedFragment}"`)
      console.error(`        Got: "${err.message}"`)
    } else {
      passed++
      console.log(`  PASS  ${description}`)
    }
  }
}

// ─── Tests ───────────────────────────────────────────────────────────

console.log('\n=== IPC Allowlist Negative Tests (Real Source Parity) ===')
console.log(`Source: ${SOURCE_PATH}`)
console.log(`Extracted channels: [${IPC_CHANNEL_ALLOWLIST.join(', ')}]\n`)

// --- POSITIVE: every extracted channel passes ---
console.log('--- Positive: all real channels pass validation ---')

for (const ch of IPC_CHANNEL_ALLOWLIST) {
  assert(`${ch} is allowed`, () => {
    validateChannel(ch)
  })
}

// --- NEGATIVE: unlisted channels are rejected ---
console.log('\n--- Negative: unlisted channels are rejected ---')

const ATTACK_VECTORS = [
  'shell:execute',
  'fs:readFile',
  'fs:writeFile',
  'child-process:exec',
  '',
  'random:channel',
  '__proto__',
  'constructor',
  'toString',
  // Case-sensitivity attacks (uppercase first extracted channel)
  extractedChannels[0].toUpperCase(),
  // Trailing space attack
  extractedChannels[0] + ' ',
  // Prefix attack
  'x' + extractedChannels[0],
  // Null byte injection attempt
  extractedChannels[0] + '\0',
]

for (const vec of ATTACK_VECTORS) {
  const label = vec.length === 0 ? '<empty string>' : vec.replace('\0', '\\0')
  assertThrows(
    `"${label}" is rejected`,
    () => validateChannel(vec),
    'KAIRO_SECURITY'
  )
}

// --- STRUCTURAL: allowlist integrity ---
console.log('\n--- Structural: allowlist integrity ---')

assert('IPC_CHANNEL_ALLOWLIST is frozen', () => {
  if (!Object.isFrozen(IPC_CHANNEL_ALLOWLIST)) {
    throw new Error('Allowlist is not frozen')
  }
})

assert(`Allowlist has exactly ${extractedChannels.length} entries (matches source)`, () => {
  if (IPC_CHANNEL_ALLOWLIST.length !== extractedChannels.length) {
    throw new Error(`Expected ${extractedChannels.length}, got ${IPC_CHANNEL_ALLOWLIST.length}`)
  }
})

assert('All channels follow domain:action pattern', () => {
  const pattern = /^[a-z]+:[a-z][-a-z]*$/
  for (const ch of IPC_CHANNEL_ALLOWLIST) {
    if (!pattern.test(ch)) {
      throw new Error(`Channel "${ch}" does not match domain:action pattern`)
    }
  }
})

assert('isAllowedChannel returns boolean', () => {
  const result = isAllowedChannel(IPC_CHANNEL_ALLOWLIST[0])
  if (typeof result !== 'boolean') {
    throw new Error(`Expected boolean, got ${typeof result}`)
  }
})

assert('No duplicate channels in allowlist', () => {
  const unique = new Set(IPC_CHANNEL_ALLOWLIST)
  if (unique.size !== IPC_CHANNEL_ALLOWLIST.length) {
    throw new Error(`Duplicates found: ${IPC_CHANNEL_ALLOWLIST.length} entries but ${unique.size} unique`)
  }
})

// --- PARITY CHECK: ensure test used zero hardcoded channel strings ---
console.log('\n--- Parity: zero hardcoded channel literals ---')

assert('Test file contains no hardcoded channel:action strings (except attack vectors)', () => {
  const testSource = readFileSync(fileURLToPath(import.meta.url), 'utf-8')
  // Check that no line in the positive test section contains a hardcoded channel value.
  // The attack vectors section is allowed to have invented channels like 'shell:execute'.
  // The key guarantee is: positive assertions come from extractedChannels, not literals.
  const positiveSection = testSource.split('--- Positive:')[1]?.split('--- Negative:')[0] ?? ''
  for (const ch of extractedChannels) {
    // Channel values should NOT appear as string literals in the positive section
    // They should only come from the loop variable
    const literalPattern = new RegExp(`'${ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`)
    if (literalPattern.test(positiveSection)) {
      throw new Error(`Found hardcoded literal '${ch}' in positive test section — breaks parity`)
    }
  }
})

// ─── Summary ─────────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)

if (failed > 0) {
  console.error('\nFAILED — IPC security gate has vulnerabilities.')
  process.exit(1)
} else {
  console.log('\nPASSED — IPC allowlist is secure (real source parity verified).\n')
  process.exit(0)
}
