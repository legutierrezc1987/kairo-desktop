/**
 * test_renderer_bridge_guard.mjs — NO-GO Stabilization: Bridge Guard Tests
 *
 * Validates that the renderer bridge guard (kairoApi.ts) is correctly wired,
 * all hooks/components use the guard helpers instead of direct window.kairoApi,
 * App.tsx has fallback UI, and main/index.ts has ELECTRON_RUN_AS_NODE guard.
 *
 * Run: node test_renderer_bridge_guard.mjs
 * Expected: All assertions PASS, exit 0
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(__dirname, '../src')

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

function readSrc(relativePath) {
  return readFileSync(resolve(SRC, relativePath), 'utf-8')
}

// ─── T01: kairoApi.ts bridge helper ─────────────────────────
console.log('\n=== NO-GO Stabilization — Bridge Guard Tests ===\n')
console.log('--- T01: kairoApi.ts bridge helper ---')
{
  const src = readSrc('renderer/src/lib/kairoApi.ts')
  assert(src.includes('export function hasKairoApi'), 'T01a: exports hasKairoApi')
  assert(src.includes('export function getKairoApiOrThrow'), 'T01b: exports getKairoApiOrThrow')
  assert(src.includes('window.kairoApi != null'), 'T01c: hasKairoApi checks null')
  assert(src.includes("typeof window !== 'undefined'"), 'T01d: hasKairoApi checks typeof window')
  assert(src.includes('throw new Error'), 'T01e: getKairoApiOrThrow throws on missing')
  assert(src.includes('return window.kairoApi'), 'T01f: getKairoApiOrThrow returns bridge')
}

// ─── T02: env.d.ts typing ───────────────────────────────────
console.log('\n--- T02: env.d.ts typing ---')
{
  const src = readSrc('renderer/src/env.d.ts')
  assert(src.includes('KairoApi'), 'T02a: declares KairoApi type')
  assert(src.includes('interface Window'), 'T02b: augments Window interface')
  assert(src.includes('kairoApi'), 'T02c: declares kairoApi on Window')
}

// ─── T03: App.tsx bridge guard + race-safe restore ──────────
console.log('\n--- T03: App.tsx bridge guard ---')
{
  const src = readSrc('renderer/src/App.tsx')
  assert(src.includes('hasKairoApi'), 'T03a: imports hasKairoApi')
  assert(src.includes('getKairoApiOrThrow'), 'T03b: imports getKairoApiOrThrow')
  assert(src.includes('if (!hasKairoApi())'), 'T03c: checks bridge before render')
  assert(src.includes('IPC Bridge Unavailable'), 'T03d: fallback UI present')
  assert(src.includes('electron-builder install-app-deps'), 'T03e: fallback mentions ABI fix')
  assert(src.includes('getState().activeProject === null'), 'T03f: race-safe restore guard')
  assert(!src.includes('window.kairoApi'), 'T03g: no direct window.kairoApi access')
}

// ─── T04: Hooks — no direct window.kairoApi ─────────────────
console.log('\n--- T04: Hooks use bridge guard ---')
{
  const hooks = [
    ['hooks/useMode.ts', 'useMode'],
    ['hooks/useProject.ts', 'useProject'],
    ['hooks/useSession.ts', 'useSession'],
    ['hooks/useChat.ts', 'useChat'],
    ['hooks/usePendingCommands.ts', 'usePendingCommands'],
    ['hooks/useTerminal.ts', 'useTerminal'],
  ]

  for (const [path, name] of hooks) {
    const src = readSrc(`renderer/src/${path}`)
    assert(!src.includes('window.kairoApi'), `T04-${name}: no direct window.kairoApi`)
    assert(
      src.includes('hasKairoApi') || src.includes('getKairoApiOrThrow'),
      `T04-${name}: uses bridge guard helper`
    )
  }
}

// ─── T05: Components — no direct window.kairoApi ────────────
console.log('\n--- T05: Components use bridge guard ---')
{
  const components = [
    ['components/Layout/KillSwitch.tsx', 'KillSwitch'],
    ['components/Terminal/TerminalPanel.tsx', 'TerminalPanel'],
    ['components/Chat/ContextMeter.tsx', 'ContextMeter'],
    ['components/Chat/RecallButton.tsx', 'RecallButton'],
    ['components/Settings/AccountManager.tsx', 'AccountManager'],
  ]

  for (const [path, name] of components) {
    const src = readSrc(`renderer/src/${path}`)
    assert(!src.includes('window.kairoApi'), `T05-${name}: no direct window.kairoApi`)
    assert(
      src.includes('hasKairoApi') || src.includes('getKairoApiOrThrow'),
      `T05-${name}: uses bridge guard helper`
    )
  }
}

// ─── T06: main/index.ts startup guard ───────────────────────
console.log('\n--- T06: main/index.ts startup guard ---')
{
  const src = readSrc('main/index.ts')
  assert(src.includes('ELECTRON_RUN_AS_NODE'), 'T06a: checks ELECTRON_RUN_AS_NODE')
  assert(src.includes('process.exit(1)'), 'T06b: exits on bad env')
  assert(src.includes("typeof app === 'undefined'"), 'T06c: validates app module available')
  // Guard must be BEFORE app.whenReady
  const guardIdx = src.indexOf('ELECTRON_RUN_AS_NODE')
  const readyIdx = src.indexOf('app.whenReady()')
  assert(guardIdx < readyIdx, 'T06d: guard appears before app.whenReady()')
}

// ─── T07: ConsolidateButton uses guard ──────────────────────
console.log('\n--- T07: ConsolidateButton ---')
{
  const src = readSrc('renderer/src/components/Chat/ConsolidateButton.tsx')
  assert(!src.includes('window.kairoApi'), 'T07a: no direct window.kairoApi')
}

// ─── T08: CommandApproval uses guard ────────────────────────
console.log('\n--- T08: CommandApproval ---')
{
  const src = readSrc('renderer/src/components/Terminal/CommandApproval.tsx')
  assert(!src.includes('window.kairoApi'), 'T08a: no direct window.kairoApi')
}

// ─── Summary ────────────────────────────────────────────────
console.log(`\n${'='.repeat(50)}`)
console.log(`Bridge Guard Tests: ${passed} passed, ${failed} failed`)
console.log(`${'='.repeat(50)}\n`)
process.exit(failed > 0 ? 1 : 0)
