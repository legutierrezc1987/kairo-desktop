/**
 * test_impact_analyzer_sprint_d.mjs — Phase 6 Sprint D: Impact Analyzer + Ephemeral Undo
 *
 * Tests:
 * 1. Shared layer: IPC channels (48 total), types, constants
 * 2. UndoManagerService: LIFO stack, collision guard, eviction, clear
 * 3. FileOperationsService: snapshot integration on writeFile
 * 4. IPC handler structure: FS_UNDO_PREVIEW, FS_UNDO_APPLY + type guards
 * 5. index.ts wiring: UndoManager instantiation + injection
 * 6. Renderer: editorStore undo state, useEditor undo hooks, CodeEditor DiffEditor
 *
 * Run: node tests/test_impact_analyzer_sprint_d.mjs
 * Expected: All assertions PASS, exit 0
 */

import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync, statSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { buildSync } from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(__dirname, '../src')
const BUILD_DIR = resolve(__dirname, '../.test-build')

// ─── Test Runner ─────────────────────────────────────────────

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

// ─── Build modules for testing ──────────────────────────────

mkdirSync(BUILD_DIR, { recursive: true })

// Build IPC channels
buildSync({
  entryPoints: [resolve(SRC, 'shared', 'ipc-channels.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(BUILD_DIR, 'ipc-channels-d.test.mjs'),
  logLevel: 'silent',
})

// Build constants
buildSync({
  entryPoints: [resolve(SRC, 'shared', 'constants.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(BUILD_DIR, 'constants-d.test.mjs'),
  logLevel: 'silent',
})

// Build UndoManagerService (source patching to remove electron imports if any)
const undoManagerSrc = readFileSync(resolve(SRC, 'main', 'services', 'undo-manager.service.ts'), 'utf-8')
buildSync({
  stdin: {
    contents: undoManagerSrc,
    resolveDir: resolve(SRC, 'main', 'services'),
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(BUILD_DIR, 'undo-manager.test.mjs'),
  logLevel: 'silent',
})

// Build FileOperationsService
const fileOpsSrc = readFileSync(resolve(SRC, 'main', 'services', 'file-operations.service.ts'), 'utf-8')
buildSync({
  stdin: {
    contents: fileOpsSrc,
    resolveDir: resolve(SRC, 'main', 'services'),
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(BUILD_DIR, 'file-ops-d.test.mjs'),
  logLevel: 'silent',
})

const ipcMod = await import(pathToFileURL(join(BUILD_DIR, 'ipc-channels-d.test.mjs')).href)
const constMod = await import(pathToFileURL(join(BUILD_DIR, 'constants-d.test.mjs')).href)
const undoMod = await import(pathToFileURL(join(BUILD_DIR, 'undo-manager.test.mjs')).href)
const fileOpsMod = await import(pathToFileURL(join(BUILD_DIR, 'file-ops-d.test.mjs')).href)

const { IPC_CHANNELS, IPC_CHANNEL_ALLOWLIST } = ipcMod
const { UNDO_STACK_MAX_ENTRIES, UNDO_MAX_FILE_BYTES } = constMod
const { UndoManagerService } = undoMod
const { FileOperationsService } = fileOpsMod

// ═══════════════════════════════════════════════════════════════
// T1: Shared Constants
// ═══════════════════════════════════════════════════════════════
console.log('\n=== T1: Shared Constants ===')

assert(UNDO_STACK_MAX_ENTRIES === 15, 'T1a: UNDO_STACK_MAX_ENTRIES = 15')
assert(UNDO_MAX_FILE_BYTES === 2_097_152, 'T1b: UNDO_MAX_FILE_BYTES = 2MB')

// ═══════════════════════════════════════════════════════════════
// T2: IPC Channels
// ═══════════════════════════════════════════════════════════════
console.log('\n=== T2: IPC Channels ===')

assert(IPC_CHANNELS.FS_UNDO_PREVIEW === 'fs:undo-preview', 'T2a: FS_UNDO_PREVIEW channel exists')
assert(IPC_CHANNELS.FS_UNDO_APPLY === 'fs:undo-apply', 'T2b: FS_UNDO_APPLY channel exists')
assert(IPC_CHANNEL_ALLOWLIST.length === 49, `T2c: 49 channels total (got ${IPC_CHANNEL_ALLOWLIST.length})`)
assert(IPC_CHANNEL_ALLOWLIST.includes('fs:undo-preview'), 'T2d: allowlist includes fs:undo-preview')
assert(IPC_CHANNEL_ALLOWLIST.includes('fs:undo-apply'), 'T2e: allowlist includes fs:undo-apply')

// ═══════════════════════════════════════════════════════════════
// T3: Shared Types
// ═══════════════════════════════════════════════════════════════
console.log('\n=== T3: Shared Types ===')

const typesSrc = readSrc('shared/types.ts')
assert(typesSrc.includes('interface UndoEntry'), 'T3a: UndoEntry interface exists')
assert(typesSrc.includes('id: string'), 'T3b: UndoEntry has id field')
assert(typesSrc.includes('filePath: string'), 'T3c: UndoEntry has filePath field')
assert(typesSrc.includes('oldContent: string'), 'T3d: UndoEntry has oldContent field')
assert(typesSrc.includes('newContent: string'), 'T3e: UndoEntry has newContent field')
assert(typesSrc.includes('expectedMtimeMs: number'), 'T3f: UndoEntry has expectedMtimeMs field')
assert(typesSrc.includes('interface UndoPreviewRequest'), 'T3g: UndoPreviewRequest exists')
assert(typesSrc.includes('interface UndoPreviewResponse'), 'T3h: UndoPreviewResponse exists')
assert(typesSrc.includes('interface UndoApplyRequest'), 'T3i: UndoApplyRequest exists')
assert(typesSrc.includes('interface UndoApplyResponse'), 'T3j: UndoApplyResponse exists')

// ═══════════════════════════════════════════════════════════════
// T4: UndoManagerService — constructor and basic shape
// ═══════════════════════════════════════════════════════════════
console.log('\n=== T4: UndoManagerService Shape ===')

const um = new UndoManagerService()
assert(typeof um.captureSnapshot === 'function', 'T4a: captureSnapshot is a function')
assert(typeof um.finalizeEntry === 'function', 'T4b: finalizeEntry is a function')
assert(typeof um.getPreview === 'function', 'T4c: getPreview is a function')
assert(typeof um.applyUndo === 'function', 'T4d: applyUndo is a function')
assert(typeof um.hasUndoForFile === 'function', 'T4e: hasUndoForFile is a function')
assert(typeof um.getUndoableFiles === 'function', 'T4f: getUndoableFiles is a function')
assert(typeof um.clear === 'function', 'T4g: clear is a function')
assert(um.size === 0, 'T4h: initial stack is empty')

// ═══════════════════════════════════════════════════════════════
// T5: UndoManagerService — captureSnapshot + hasUndoForFile
// ═══════════════════════════════════════════════════════════════
console.log('\n=== T5: UndoManager Capture + Query ===')

// Create a temp file for testing
const TEST_DIR = resolve(BUILD_DIR, 'undo-test-' + Date.now())
mkdirSync(TEST_DIR, { recursive: true })
const testFile = join(TEST_DIR, 'test.txt')
writeFileSync(testFile, 'original content', 'utf-8')

const um2 = new UndoManagerService()

// T5a: Capture snapshot
const entryId = await um2.captureSnapshot(testFile, 'new content')
assert(entryId !== null && entryId.startsWith('undo-'), 'T5a: captureSnapshot returns entry ID')
assert(um2.size === 1, 'T5b: stack has 1 entry after capture')
assert(um2.hasUndoForFile(testFile), 'T5c: hasUndoForFile returns true')

// T5d: Skip if content unchanged
const sameId = await um2.captureSnapshot(testFile, 'original content')
assert(sameId === null, 'T5d: captureSnapshot returns null when content unchanged')
assert(um2.size === 1, 'T5e: stack still has 1 entry (no duplicate)')

// T5f: Skip if file doesn't exist (new file scenario)
const newFile = join(TEST_DIR, 'nonexistent.txt')
const newFileId = await um2.captureSnapshot(newFile, 'some content')
assert(newFileId === null, 'T5f: captureSnapshot returns null for nonexistent file')

// ═══════════════════════════════════════════════════════════════
// T6: UndoManagerService — finalizeEntry
// ═══════════════════════════════════════════════════════════════
console.log('\n=== T6: UndoManager Finalize ===')

// Write the new content to make the file match
writeFileSync(testFile, 'new content', 'utf-8')

await um2.finalizeEntry(entryId, testFile)
// After finalization, the mtime should be recorded
// (We can't directly inspect, but we can verify via preview)
const preview1 = await um2.getPreview(testFile)
assert(preview1.success, 'T6a: preview succeeds after finalize')
assert(preview1.data?.entry.expectedMtimeMs > 0, 'T6b: expectedMtimeMs is positive after finalize')

// T6c: Finalize with nonexistent entry — should not throw
await um2.finalizeEntry('fake-id', testFile)
assert(true, 'T6c: finalizeEntry with bad ID does not throw')

// ═══════════════════════════════════════════════════════════════
// T7: UndoManagerService — getPreview
// ═══════════════════════════════════════════════════════════════
console.log('\n=== T7: UndoManager Preview ===')

const preview2 = await um2.getPreview(testFile)
assert(preview2.success, 'T7a: preview succeeds')
assert(preview2.data?.entry.oldContent === 'original content', 'T7b: oldContent is original')
assert(preview2.data?.currentContent === 'new content', 'T7c: currentContent is new')

// T7d: Preview for file with no undo history
const noHistoryFile = join(TEST_DIR, 'no-history.txt')
writeFileSync(noHistoryFile, 'nothing', 'utf-8')
const preview3 = await um2.getPreview(noHistoryFile)
assert(!preview3.success, 'T7d: preview fails for file with no history')
assert(preview3.error?.includes('No undo'), 'T7e: error message mentions no undo')

// ═══════════════════════════════════════════════════════════════
// T8: UndoManagerService — applyUndo + collision guard
// ═══════════════════════════════════════════════════════════════
console.log('\n=== T8: UndoManager Apply + Collision Guard ===')

// T8a: Happy path undo
const applyResult = await um2.applyUndo(entryId)
assert(applyResult.success, 'T8a: undo apply succeeds')
assert(applyResult.data?.restoredBytes > 0, 'T8b: restoredBytes > 0')

// Verify file was actually restored
const restored = readFileSync(testFile, 'utf-8')
assert(restored === 'original content', 'T8c: file content restored to original')
assert(um2.size === 0, 'T8d: stack is empty after undo (splice)')

// T8e: Apply with nonexistent entry
const badApply = await um2.applyUndo('fake-id')
assert(!badApply.success, 'T8e: undo fails for nonexistent entry')
assert(badApply.error?.includes('not found'), 'T8f: error mentions not found')

// T8g: Collision guard — modify file externally between capture and undo
writeFileSync(testFile, 'content A', 'utf-8')
const um3 = new UndoManagerService()
const collisionId = await um3.captureSnapshot(testFile, 'content B')
writeFileSync(testFile, 'content B', 'utf-8')
await um3.finalizeEntry(collisionId, testFile)

// Now modify file externally (simulate external editor)
// Wait a tiny bit to ensure different mtime
await new Promise(r => setTimeout(r, 50))
writeFileSync(testFile, 'content C from external editor', 'utf-8')

const collisionResult = await um3.applyUndo(collisionId)
assert(!collisionResult.success, 'T8g: undo blocked by collision guard')
assert(collisionResult.error?.includes('modified externally'), 'T8h: error mentions external modification')

// ═══════════════════════════════════════════════════════════════
// T9: UndoManagerService — eviction (LIFO bounded stack)
// ═══════════════════════════════════════════════════════════════
console.log('\n=== T9: UndoManager Eviction ===')

const um4 = new UndoManagerService()
for (let i = 0; i < UNDO_STACK_MAX_ENTRIES + 5; i++) {
  const f = join(TEST_DIR, `evict-${i}.txt`)
  writeFileSync(f, `old-${i}`, 'utf-8')
  await um4.captureSnapshot(f, `new-${i}`)
}
assert(um4.size === UNDO_STACK_MAX_ENTRIES, `T9a: stack capped at ${UNDO_STACK_MAX_ENTRIES} (got ${um4.size})`)

// T9b: Oldest entry (evict-0 through evict-4) should be evicted
const evictedFile = join(TEST_DIR, 'evict-0.txt')
assert(!um4.hasUndoForFile(evictedFile), 'T9b: oldest entry was evicted')

// T9c: Newest entry should still be present
const newestFile = join(TEST_DIR, `evict-${UNDO_STACK_MAX_ENTRIES + 4}.txt`)
assert(um4.hasUndoForFile(newestFile), 'T9c: newest entry is present')

// ═══════════════════════════════════════════════════════════════
// T10: UndoManagerService — clear
// ═══════════════════════════════════════════════════════════════
console.log('\n=== T10: UndoManager Clear ===')

um4.clear()
assert(um4.size === 0, 'T10a: stack empty after clear()')
assert(um4.getUndoableFiles().length === 0, 'T10b: no undoable files after clear()')

// ═══════════════════════════════════════════════════════════════
// T11: UndoManagerService — getUndoableFiles
// ═══════════════════════════════════════════════════════════════
console.log('\n=== T11: UndoManager UndoableFiles ===')

const um5 = new UndoManagerService()
const f1 = join(TEST_DIR, 'multi-a.txt')
const f2 = join(TEST_DIR, 'multi-b.txt')
writeFileSync(f1, 'a-old', 'utf-8')
writeFileSync(f2, 'b-old', 'utf-8')
await um5.captureSnapshot(f1, 'a-new')
await um5.captureSnapshot(f2, 'b-new')
await um5.captureSnapshot(f1, 'a-new2') // second capture for f1
const undoableFiles = um5.getUndoableFiles()
assert(undoableFiles.length === 2, `T11a: 2 unique files (got ${undoableFiles.length})`)

// ═══════════════════════════════════════════════════════════════
// T12: FileOperationsService — undoManager integration
// ═══════════════════════════════════════════════════════════════
console.log('\n=== T12: FileOperationsService Undo Integration ===')

const fileOpsSrcText = readSrc('main/services/file-operations.service.ts')
assert(fileOpsSrcText.includes("import type { UndoManagerService }"), 'T12a: imports UndoManagerService')
assert(fileOpsSrcText.includes('setUndoManager'), 'T12b: has setUndoManager method')
assert(fileOpsSrcText.includes('captureSnapshot'), 'T12c: calls captureSnapshot in writeFile')
assert(fileOpsSrcText.includes('finalizeEntry'), 'T12d: calls finalizeEntry after write')

// Functional test: FileOps wired with UndoManager
const fops = new FileOperationsService()
const undoMgr = new UndoManagerService()
fops.setUndoManager(undoMgr)
fops.setWorkspacePath(TEST_DIR)

const testFile2 = join(TEST_DIR, 'fops-test.txt')
writeFileSync(testFile2, 'fops original', 'utf-8')

const writeResult = await fops.writeFile(testFile2, 'fops modified')
assert(writeResult.success, 'T12e: writeFile succeeds')
assert(undoMgr.size === 1, 'T12f: undo stack has 1 entry after write')
assert(undoMgr.hasUndoForFile(testFile2), 'T12g: undo available for written file')

// Verify undo works through the manager
const undoResult = await undoMgr.applyUndo((await undoMgr.getPreview(testFile2)).data.entry.id)
assert(undoResult.success, 'T12h: undo apply succeeds via manager')
assert(readFileSync(testFile2, 'utf-8') === 'fops original', 'T12i: file restored via undo')

// ═══════════════════════════════════════════════════════════════
// T13: Editor IPC Handlers — structure
// ═══════════════════════════════════════════════════════════════
console.log('\n=== T13: Editor IPC Handlers ===')

const handlersSrc = readSrc('main/ipc/editor.handlers.ts')
assert(handlersSrc.includes('FS_UNDO_PREVIEW'), 'T13a: handler registers FS_UNDO_PREVIEW')
assert(handlersSrc.includes('FS_UNDO_APPLY'), 'T13b: handler registers FS_UNDO_APPLY')
assert(handlersSrc.includes('isValidUndoPreviewRequest'), 'T13c: has UndoPreview type guard')
assert(handlersSrc.includes('isValidUndoApplyRequest'), 'T13d: has UndoApply type guard')
assert(handlersSrc.includes('undoManager.getPreview'), 'T13e: calls undoManager.getPreview')
assert(handlersSrc.includes('undoManager.applyUndo'), 'T13f: calls undoManager.applyUndo')
assert(handlersSrc.includes('UndoManagerService'), 'T13g: imports UndoManagerService type')

// T13h: registerEditorHandlers accepts 2 params
assert(handlersSrc.includes('function registerEditorHandlers(fileOps: FileOperationsService, undoManager: UndoManagerService)'),
  'T13h: registerEditorHandlers takes fileOps + undoManager')

// T13i: Type guard validates filePath
assert(handlersSrc.includes("obj.filePath.includes('\\0')"), 'T13i: UndoPreview guard checks null bytes')

// T13j: Type guard validates entryId
assert(handlersSrc.includes("obj.entryId"), 'T13j: UndoApply guard checks entryId')

// ═══════════════════════════════════════════════════════════════
// T14: index.ts wiring
// ═══════════════════════════════════════════════════════════════
console.log('\n=== T14: index.ts Wiring ===')

const indexSrc = readSrc('main/index.ts')
assert(indexSrc.includes("import { UndoManagerService }"), 'T14a: imports UndoManagerService')
assert(indexSrc.includes('new UndoManagerService()'), 'T14b: instantiates UndoManagerService')
assert(indexSrc.includes('fileOps.setUndoManager(undoManager)'), 'T14c: injects undoManager into fileOps')
assert(indexSrc.includes('registerEditorHandlers(fileOps, undoManager)'), 'T14d: passes undoManager to registerEditorHandlers')
assert(indexSrc.includes('undoManager.clear()'), 'T14e: clears undo stack on project switch')

// ═══════════════════════════════════════════════════════════════
// T15: Renderer — editorStore undo state
// ═══════════════════════════════════════════════════════════════
console.log('\n=== T15: Renderer editorStore ===')

const storeSrc = readSrc('renderer/src/stores/editorStore.ts')
assert(storeSrc.includes('undoAvailable: boolean'), 'T15a: editorStore has undoAvailable')
assert(storeSrc.includes('undoEntry: UndoEntry | null'), 'T15b: editorStore has undoEntry')
assert(storeSrc.includes('undoCurrentContent: string | null'), 'T15c: editorStore has undoCurrentContent')
assert(storeSrc.includes('showDiff: boolean'), 'T15d: editorStore has showDiff')
assert(storeSrc.includes('isUndoing: boolean'), 'T15e: editorStore has isUndoing')
assert(storeSrc.includes('setUndoPreview'), 'T15f: editorStore has setUndoPreview action')
assert(storeSrc.includes('clearUndoPreview'), 'T15g: editorStore has clearUndoPreview action')
assert(storeSrc.includes('setShowDiff'), 'T15h: editorStore has setShowDiff action')
assert(storeSrc.includes('setUndoAvailable'), 'T15i: editorStore has setUndoAvailable action')
assert(storeSrc.includes('setIsUndoing'), 'T15j: editorStore has setIsUndoing action')

// ═══════════════════════════════════════════════════════════════
// T16: Renderer — useEditor hook undo functions
// ═══════════════════════════════════════════════════════════════
console.log('\n=== T16: Renderer useEditor Hook ===')

const hookSrc = readSrc('renderer/src/hooks/useEditor.ts')
assert(hookSrc.includes('requestUndoPreview'), 'T16a: useEditor exposes requestUndoPreview')
assert(hookSrc.includes('applyUndo'), 'T16b: useEditor exposes applyUndo')
assert(hookSrc.includes('closeDiff'), 'T16c: useEditor exposes closeDiff')
assert(hookSrc.includes('FS_UNDO_PREVIEW'), 'T16d: invokes FS_UNDO_PREVIEW channel')
assert(hookSrc.includes('FS_UNDO_APPLY'), 'T16e: invokes FS_UNDO_APPLY channel')
assert(hookSrc.includes('setUndoPreview'), 'T16f: calls setUndoPreview on success')
assert(hookSrc.includes('setIsUndoing(true)'), 'T16g: sets isUndoing true during undo')
assert(hookSrc.includes('setIsUndoing(false)'), 'T16h: sets isUndoing false in finally')
assert(hookSrc.includes('clearUndoPreview'), 'T16i: clears undo preview after apply')
assert(hookSrc.includes('UndoPreviewResponse'), 'T16j: imports UndoPreviewResponse')
assert(hookSrc.includes('UndoApplyResponse'), 'T16k: imports UndoApplyResponse')

// ═══════════════════════════════════════════════════════════════
// T17: Renderer — CodeEditor DiffEditor integration
// ═══════════════════════════════════════════════════════════════
console.log('\n=== T17: CodeEditor DiffEditor ===')

const ceSrc = readSrc('renderer/src/components/Editor/CodeEditor.tsx')
assert(ceSrc.includes('createDiffEditor'), 'T17a: uses monaco.editor.createDiffEditor')
assert(ceSrc.includes('diffContainerRef'), 'T17b: has diffContainerRef')
assert(ceSrc.includes('diffEditorRef'), 'T17c: has diffEditorRef')
assert(ceSrc.includes('requestUndoPreview'), 'T17d: calls requestUndoPreview')
assert(ceSrc.includes('applyUndo'), 'T17e: calls applyUndo')
assert(ceSrc.includes('closeDiff'), 'T17f: calls closeDiff')
assert(ceSrc.includes('Diff/Undo'), 'T17g: has Diff/Undo button label')
assert(ceSrc.includes('Revert to Previous'), 'T17h: has Revert button label')
assert(ceSrc.includes('undoAvailable'), 'T17i: checks undoAvailable for button visibility')
assert(ceSrc.includes('showDiff'), 'T17j: checks showDiff for panel visibility')
assert(ceSrc.includes('isUndoing'), 'T17k: checks isUndoing for button state')
assert(ceSrc.includes('Diff Preview'), 'T17l: shows Diff Preview label')
assert(ceSrc.includes('renderSideBySide: true'), 'T17m: DiffEditor uses side-by-side')
assert(ceSrc.includes("readOnly: true"), 'T17n: DiffEditor is readOnly')
assert(ceSrc.includes('original: originalModel'), 'T17o: sets original model')
assert(ceSrc.includes('modified: modifiedModel'), 'T17p: sets modified model')
assert(ceSrc.includes('height: \'250px\''), 'T17q: diff container has fixed height')

// ═══════════════════════════════════════════════════════════════
// T18: UndoManagerService — binary file skip
// ═══════════════════════════════════════════════════════════════
console.log('\n=== T18: UndoManager Binary Skip ===')

const binFile = join(TEST_DIR, 'binary.bin')
const binBuf = Buffer.alloc(100)
binBuf[50] = 0 // null byte
writeFileSync(binFile, binBuf)

const um6 = new UndoManagerService()
const binId = await um6.captureSnapshot(binFile, 'text')
assert(binId === null, 'T18a: captureSnapshot returns null for binary file')

// ═══════════════════════════════════════════════════════════════
// T19: UndoManagerService — large file skip
// ═══════════════════════════════════════════════════════════════
console.log('\n=== T19: UndoManager Large File Skip ===')

const largeSrc = readSrc('main/services/undo-manager.service.ts')
assert(largeSrc.includes('UNDO_MAX_FILE_BYTES'), 'T19a: checks UNDO_MAX_FILE_BYTES')
assert(largeSrc.includes('fileStat.size > UNDO_MAX_FILE_BYTES'), 'T19b: rejects files exceeding limit')

// ═══════════════════════════════════════════════════════════════
// Cleanup + Summary
// ═══════════════════════════════════════════════════════════════

// Cleanup temp files
try {
  const { rmSync } = await import('node:fs')
  rmSync(TEST_DIR, { recursive: true, force: true })
} catch {}

console.log(`\n─── Sprint D Results: ${passed} passed, ${failed} failed ───`)
if (failed > 0) {
  console.error('GATE FAILED')
  process.exit(1)
}
console.log('ALL GATES PASSED')
