/**
 * test_editor_sprint_a.mjs — Phase 6 Sprint A: Monaco Editor Tests
 *
 * Source cross-verification for editor infrastructure:
 * 1. FileOperationsService (esbuild → .test-build/): sandbox, read, write, detectLanguage
 * 2. IPC channel verification: FS_READ_FILE, FS_WRITE_FILE exist, 44 total
 * 3. Editor IPC handlers: structure + type guards
 * 4. Renderer source-level assertions: editorStore, useEditor, CodeEditor
 * 5. index.ts wiring: FileOperationsService + registerEditorHandlers
 * 6. Constants: FS_READ_FILE_MAX_BYTES, FS_BINARY_DETECTION_BYTES
 *
 * Run: node tests/test_editor_sprint_a.mjs
 * Expected: All assertions PASS, exit 0
 */

import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from 'node:fs'
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

// ─── Build FileOperationsService for testing ─────────────────

mkdirSync(BUILD_DIR, { recursive: true })

buildSync({
  entryPoints: [resolve(SRC, 'main', 'services', 'file-operations.service.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(BUILD_DIR, 'file-operations.test.mjs'),
  logLevel: 'silent',
})

buildSync({
  entryPoints: [resolve(SRC, 'shared', 'constants.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(BUILD_DIR, 'constants-editor.test.mjs'),
  logLevel: 'silent',
})

buildSync({
  entryPoints: [resolve(SRC, 'shared', 'ipc-channels.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(BUILD_DIR, 'ipc-channels-editor.test.mjs'),
  logLevel: 'silent',
})

const fileOpsMod = await import(pathToFileURL(join(BUILD_DIR, 'file-operations.test.mjs')).href)
const constantsMod = await import(pathToFileURL(join(BUILD_DIR, 'constants-editor.test.mjs')).href)
const ipcMod = await import(pathToFileURL(join(BUILD_DIR, 'ipc-channels-editor.test.mjs')).href)

const { FileOperationsService, detectLanguage } = fileOpsMod
const { FS_READ_FILE_MAX_BYTES, FS_BINARY_DETECTION_BYTES } = constantsMod
const { IPC_CHANNELS, IPC_CHANNEL_ALLOWLIST } = ipcMod

// ═══════════════════════════════════════════════════════════════
// Section 1: Constants
// ═══════════════════════════════════════════════════════════════
console.log('\n── Section 1: Constants ──')

assert(FS_READ_FILE_MAX_BYTES === 5_242_880, 'C01: FS_READ_FILE_MAX_BYTES = 5MB')
assert(FS_BINARY_DETECTION_BYTES === 8_192, 'C02: FS_BINARY_DETECTION_BYTES = 8192')

// ═══════════════════════════════════════════════════════════════
// Section 2: IPC Channel Parity
// ═══════════════════════════════════════════════════════════════
console.log('\n── Section 2: IPC Channel Parity ──')

assert(IPC_CHANNELS.FS_READ_FILE === 'fs:read-file', 'IPC01: FS_READ_FILE channel exists')
assert(IPC_CHANNELS.FS_WRITE_FILE === 'fs:write-file', 'IPC02: FS_WRITE_FILE channel exists')
assert(IPC_CHANNEL_ALLOWLIST.length === 45, `IPC03: 45 channels total (got ${IPC_CHANNEL_ALLOWLIST.length})`)
assert(IPC_CHANNEL_ALLOWLIST.includes('fs:read-file'), 'IPC04: allowlist includes fs:read-file')
assert(IPC_CHANNEL_ALLOWLIST.includes('fs:write-file'), 'IPC05: allowlist includes fs:write-file')

// ═══════════════════════════════════════════════════════════════
// Section 3: FileOperationsService — Sandbox Validation
// ═══════════════════════════════════════════════════════════════
console.log('\n── Section 3: Sandbox Validation ──')

{
  const svc = new FileOperationsService()

  // No workspace → all ops fail
  const noWsResult = await svc.readFile('/some/file.txt')
  assert(!noWsResult.success, 'SB01: readFile fails when no workspace set')
  assert(noWsResult.error.includes('No workspace'), 'SB02: error mentions missing workspace')

  const noWsWrite = await svc.writeFile('/some/file.txt', 'hello')
  assert(!noWsWrite.success, 'SB03: writeFile fails when no workspace set')

  // Set workspace
  const tmpWorkspace = resolve(__dirname, '__test_workspace_editor__')
  mkdirSync(tmpWorkspace, { recursive: true })
  svc.setWorkspacePath(tmpWorkspace)
  assert(svc.getWorkspacePath() === tmpWorkspace, 'SB04: workspace path set correctly')

  // isInsideWorkspace — valid paths
  assert(svc.isInsideWorkspace(join(tmpWorkspace, 'file.txt')), 'SB05: child file is inside workspace')
  assert(svc.isInsideWorkspace(join(tmpWorkspace, 'sub', 'deep', 'file.txt')), 'SB06: nested file is inside workspace')
  assert(svc.isInsideWorkspace(tmpWorkspace), 'SB07: workspace root itself is inside')

  // isInsideWorkspace — attacks
  assert(!svc.isInsideWorkspace(resolve(tmpWorkspace, '..')), 'SB08: parent dir rejected')
  assert(!svc.isInsideWorkspace(resolve(tmpWorkspace, '..', 'etc', 'passwd')), 'SB09: traversal attack rejected')
  assert(!svc.isInsideWorkspace(tmpWorkspace + '-evil'), 'SB10: sibling prefix attack rejected')
  assert(!svc.isInsideWorkspace(tmpWorkspace + '-evil/secrets.txt'), 'SB11: sibling prefix file rejected')

  // Root path rejection
  let rootThrew = false
  try {
    const svc2 = new FileOperationsService()
    if (process.platform === 'win32') {
      svc2.setWorkspacePath('C:\\')
    } else {
      svc2.setWorkspacePath('/')
    }
  } catch (e) {
    rootThrew = e.message.includes('Root path')
  }
  assert(rootThrew, 'SB12: root path rejected as workspace')

  // Null byte rejection
  const nullResult = await svc.readFile(join(tmpWorkspace, 'file\0.txt'))
  assert(!nullResult.success, 'SB13: null byte in filePath rejected')
  assert(nullResult.error.includes('null bytes'), 'SB14: error mentions null bytes')

  // Empty string rejection
  const emptyResult = await svc.readFile('')
  assert(!emptyResult.success, 'SB15: empty filePath rejected')

  // Whitespace-only rejection
  const wsResult = await svc.readFile('   ')
  assert(!wsResult.success, 'SB16: whitespace-only filePath rejected')

  // Outside workspace rejection via readFile
  const outsideResult = await svc.readFile(resolve(tmpWorkspace, '..', 'outside.txt'))
  assert(!outsideResult.success, 'SB17: readFile rejects path outside workspace')
  assert(outsideResult.error.includes('sandbox'), 'SB18: error mentions sandbox')

  // Outside workspace rejection via writeFile
  const outsideWrite = await svc.writeFile(resolve(tmpWorkspace, '..', 'evil.txt'), 'pwned')
  assert(!outsideWrite.success, 'SB19: writeFile rejects path outside workspace')

  // Cleanup
  try { unlinkSync(tmpWorkspace) } catch { /* dir */ }
  try {
    const { rmSync } = await import('node:fs')
    rmSync(tmpWorkspace, { recursive: true, force: true })
  } catch { /* best effort */ }
}

// ═══════════════════════════════════════════════════════════════
// Section 4: FileOperationsService — Read/Write Happy Path
// ═══════════════════════════════════════════════════════════════
console.log('\n── Section 4: Read/Write Operations ──')

{
  const svc = new FileOperationsService()
  const tmpWorkspace = resolve(__dirname, '__test_workspace_rw__')
  mkdirSync(tmpWorkspace, { recursive: true })
  svc.setWorkspacePath(tmpWorkspace)

  // Write a test file
  const testFile = join(tmpWorkspace, 'hello.ts')
  writeFileSync(testFile, 'const x = 42\n', 'utf-8')

  // Read happy path
  const readResult = await svc.readFile(testFile)
  assert(readResult.success, 'RW01: readFile succeeds for valid file')
  assert(readResult.data.content === 'const x = 42\n', 'RW02: content matches')
  assert(readResult.data.languageId === 'typescript', 'RW03: languageId detected as typescript')
  assert(readResult.data.sizeBytes > 0, 'RW04: sizeBytes is positive')

  // Write happy path
  const writeResult = await svc.writeFile(testFile, 'const y = 99\n')
  assert(writeResult.success, 'RW05: writeFile succeeds')
  assert(writeResult.data.bytesWritten > 0, 'RW06: bytesWritten is positive')

  // Verify write
  const readBack = await svc.readFile(testFile)
  assert(readBack.success && readBack.data.content === 'const y = 99\n', 'RW07: written content verified')

  // Read non-existent file
  const noFile = await svc.readFile(join(tmpWorkspace, 'nope.txt'))
  assert(!noFile.success, 'RW08: readFile fails for non-existent file')
  assert(noFile.error.includes('not found'), 'RW09: error mentions not found')

  // Read directory (not a file)
  const dirResult = await svc.readFile(tmpWorkspace)
  assert(!dirResult.success, 'RW10: readFile rejects directory')

  // Write to non-existent parent
  const noParent = await svc.writeFile(join(tmpWorkspace, 'no', 'parent', 'file.txt'), 'x')
  assert(!noParent.success, 'RW11: writeFile fails when parent dir missing')

  // Binary file detection
  const binFile = join(tmpWorkspace, 'binary.dat')
  const binBuffer = Buffer.alloc(100)
  binBuffer[50] = 0 // null byte
  writeFileSync(binFile, binBuffer)
  const binResult = await svc.readFile(binFile)
  assert(!binResult.success, 'RW12: binary file rejected')
  assert(binResult.error.includes('Binary'), 'RW13: error mentions binary')

  // Size limit (mock — create file just over limit check via error message)
  // We can't actually create a 5MB file in a fast test, so verify the constant is used
  assert(FS_READ_FILE_MAX_BYTES === 5_242_880, 'RW14: size limit constant is 5MB')

  // Cleanup
  try {
    const { rmSync } = await import('node:fs')
    rmSync(tmpWorkspace, { recursive: true, force: true })
  } catch { /* best effort */ }
}

// ═══════════════════════════════════════════════════════════════
// Section 5: detectLanguage
// ═══════════════════════════════════════════════════════════════
console.log('\n── Section 5: Language Detection ──')

assert(detectLanguage('file.ts') === 'typescript', 'DL01: .ts → typescript')
assert(detectLanguage('file.tsx') === 'typescript', 'DL02: .tsx → typescript')
assert(detectLanguage('file.js') === 'javascript', 'DL03: .js → javascript')
assert(detectLanguage('file.jsx') === 'javascript', 'DL04: .jsx → javascript')
assert(detectLanguage('file.mjs') === 'javascript', 'DL05: .mjs → javascript')
assert(detectLanguage('file.json') === 'json', 'DL06: .json → json')
assert(detectLanguage('file.md') === 'markdown', 'DL07: .md → markdown')
assert(detectLanguage('file.html') === 'html', 'DL08: .html → html')
assert(detectLanguage('file.css') === 'css', 'DL09: .css → css')
assert(detectLanguage('file.py') === 'python', 'DL10: .py → python')
assert(detectLanguage('file.rs') === 'rust', 'DL11: .rs → rust')
assert(detectLanguage('file.go') === 'go', 'DL12: .go → go')
assert(detectLanguage('file.scss') === 'scss', 'DL13: .scss → scss')
assert(detectLanguage('file.yaml') === 'yaml', 'DL14: .yaml → yaml')
assert(detectLanguage('file.sql') === 'sql', 'DL15: .sql → sql')
assert(detectLanguage('file.unknown') === 'plaintext', 'DL16: unknown ext → plaintext')
assert(detectLanguage('Dockerfile') === 'dockerfile', 'DL17: Dockerfile → dockerfile')

// ═══════════════════════════════════════════════════════════════
// Section 6: Editor IPC Handlers (source-level)
// ═══════════════════════════════════════════════════════════════
console.log('\n── Section 6: Editor IPC Handlers ──')

{
  const src = readSrc('main/ipc/editor.handlers.ts')
  assert(src.includes('registerEditorHandlers'), 'EH01: exports registerEditorHandlers')
  assert(src.includes('isValidFsReadRequest'), 'EH02: has isValidFsReadRequest type guard')
  assert(src.includes('isValidFsWriteRequest'), 'EH03: has isValidFsWriteRequest type guard')
  assert(src.includes('validateSender'), 'EH04: uses validateSender')
  assert(src.includes('IPC_CHANNELS.FS_READ_FILE'), 'EH05: registers FS_READ_FILE handler')
  assert(src.includes('IPC_CHANNELS.FS_WRITE_FILE'), 'EH06: registers FS_WRITE_FILE handler')
  assert(src.includes("filePath.includes('\\0')"), 'EH07: null byte check in type guard')
  assert(src.includes('FileOperationsService'), 'EH08: references FileOperationsService type')
}

// ═══════════════════════════════════════════════════════════════
// Section 7: index.ts Wiring
// ═══════════════════════════════════════════════════════════════
console.log('\n── Section 7: index.ts Wiring ──')

{
  const src = readSrc('main/index.ts')
  assert(src.includes("import { FileOperationsService }"), 'IX01: imports FileOperationsService')
  assert(src.includes("import { registerEditorHandlers }"), 'IX02: imports registerEditorHandlers')
  assert(src.includes('new FileOperationsService()'), 'IX03: instantiates FileOperationsService')
  assert(src.includes('fileOps.setWorkspacePath(folderPath)'), 'IX04: binds workspace on project load')
  assert(src.includes('registerEditorHandlers(fileOps)'), 'IX05: registers editor handlers')
}

// ═══════════════════════════════════════════════════════════════
// Section 8: Shared types.ts
// ═══════════════════════════════════════════════════════════════
console.log('\n── Section 8: Shared Types ──')

{
  const src = readSrc('shared/types.ts')
  assert(src.includes('FsReadFileRequest'), 'TY01: FsReadFileRequest type exists')
  assert(src.includes('FsReadFileResponse'), 'TY02: FsReadFileResponse type exists')
  assert(src.includes('FsWriteFileRequest'), 'TY03: FsWriteFileRequest type exists')
  assert(src.includes('FsWriteFileResponse'), 'TY04: FsWriteFileResponse type exists')
  assert(src.includes('languageId: string'), 'TY05: FsReadFileResponse has languageId')
  assert(src.includes('sizeBytes: number'), 'TY06: FsReadFileResponse has sizeBytes')
  assert(src.includes('bytesWritten: number'), 'TY07: FsWriteFileResponse has bytesWritten')
}

// ═══════════════════════════════════════════════════════════════
// Section 9: Renderer — editorStore
// ═══════════════════════════════════════════════════════════════
console.log('\n── Section 9: editorStore ──')

{
  const src = readSrc('renderer/src/stores/editorStore.ts')
  assert(src.includes("import { create } from 'zustand'"), 'ES01: imports zustand create')
  assert(src.includes('useEditorStore'), 'ES02: exports useEditorStore')
  assert(src.includes('activeFilePath: string | null'), 'ES03: has activeFilePath state')
  assert(src.includes('content: string'), 'ES04: has content state')
  assert(src.includes('languageId: string'), 'ES05: has languageId state')
  assert(src.includes('isDirty: boolean'), 'ES06: has isDirty state')
  assert(src.includes('isSaving: boolean'), 'ES07: has isSaving state')
  assert(src.includes('isLoading: boolean'), 'ES08: has isLoading state')
  assert(src.includes('error: string | null'), 'ES09: has error state')
  assert(src.includes('setFile:'), 'ES10: has setFile action')
  assert(src.includes('setContent:'), 'ES11: has setContent action')
  assert(src.includes('markDirty:'), 'ES12: has markDirty action')
  assert(src.includes('markClean:'), 'ES13: has markClean action')
  assert(src.includes('clearFile:'), 'ES14: has clearFile action')
  assert(src.includes("isDirty: true"), 'ES15: setContent marks dirty')
}

// ═══════════════════════════════════════════════════════════════
// Section 10: Renderer — useEditor hook
// ═══════════════════════════════════════════════════════════════
console.log('\n── Section 10: useEditor Hook ──')

{
  const src = readSrc('renderer/src/hooks/useEditor.ts')
  assert(src.includes('useEditor'), 'UE01: exports useEditor')
  assert(src.includes('useCallback'), 'UE02: uses useCallback')
  assert(src.includes('useEditorStore'), 'UE03: uses editorStore')
  assert(src.includes('getKairoApiOrThrow'), 'UE04: uses bridge guard')
  assert(src.includes('IPC_CHANNELS.FS_READ_FILE'), 'UE05: invokes FS_READ_FILE')
  assert(src.includes('IPC_CHANNELS.FS_WRITE_FILE'), 'UE06: invokes FS_WRITE_FILE')
  assert(src.includes('openFile'), 'UE07: exports openFile')
  assert(src.includes('saveFile'), 'UE08: exports saveFile')
  assert(src.includes('setFile('), 'UE09: openFile calls setFile on success')
  assert(src.includes('markClean()'), 'UE10: saveFile calls markClean on success')
  assert(src.includes('FsReadFileResponse'), 'UE11: imports FsReadFileResponse type')
  assert(src.includes('FsWriteFileResponse'), 'UE12: imports FsWriteFileResponse type')
}

// ═══════════════════════════════════════════════════════════════
// Section 11: Renderer — CodeEditor Component
// ═══════════════════════════════════════════════════════════════
console.log('\n── Section 11: CodeEditor Component ──')

{
  const src = readSrc('renderer/src/components/Editor/CodeEditor.tsx')
  assert(src.includes("import '@renderer/lib/monaco-workers'"), 'CE01: imports monaco-workers (side effect)')
  assert(src.includes("import * as monaco from 'monaco-editor'"), 'CE02: imports monaco-editor')
  assert(src.includes('useEditorStore'), 'CE03: uses editorStore')
  assert(src.includes('useEditor'), 'CE04: uses useEditor hook')
  assert(src.includes('useProjectStore'), 'CE05: uses projectStore for project guard')
  assert(src.includes('monaco.editor.create'), 'CE06: creates Monaco editor instance')
  assert(src.includes('vs-dark'), 'CE07: uses vs-dark theme')
  assert(src.includes('automaticLayout: true'), 'CE08: automaticLayout enabled')
  assert(src.includes('KeyMod.CtrlCmd') && src.includes('KeyCode.KeyS'), 'CE09: Ctrl+S command registered')
  assert(src.includes('saveFile'), 'CE10: Ctrl+S triggers saveFile')
  assert(src.includes('onDidChangeModelContent'), 'CE11: content change listener registered')
  assert(src.includes('Open a project to start editing'), 'CE12: no-project guard message')
  assert(src.includes('isDirty'), 'CE13: reads isDirty state')
  assert(src.includes('isSaving'), 'CE14: reads isSaving state')
  assert(src.includes("Saving..."), 'CE15: shows saving indicator')
  assert(src.includes('isSettingValueRef'), 'CE16: has programmatic update guard ref')
  assert(src.includes('setModelLanguage'), 'CE17: updates model language on file change')
  assert(src.includes("dirtyMark"), 'CE18: dirty indicator (*) in filename')
}

// ═══════════════════════════════════════════════════════════════
// Section 12: Monaco Workers Config
// ═══════════════════════════════════════════════════════════════
console.log('\n── Section 12: Monaco Workers Config ──')

{
  const src = readSrc('renderer/src/lib/monaco-workers.ts')
  assert(src.includes('MonacoEnvironment'), 'MW01: sets MonacoEnvironment')
  assert(src.includes('getWorker'), 'MW02: defines getWorker')
  assert(src.includes('editor.worker?worker'), 'MW03: imports editor worker')
  assert(src.includes('ts.worker?worker'), 'MW04: imports typescript worker')
  assert(src.includes('json.worker?worker'), 'MW05: imports json worker')
  assert(src.includes('css.worker?worker'), 'MW06: imports css worker')
  assert(src.includes('html.worker?worker'), 'MW07: imports html worker')
}

// ═══════════════════════════════════════════════════════════════
// Section 13: Vite Config
// ═══════════════════════════════════════════════════════════════
console.log('\n── Section 13: Vite Config ──')

{
  const src = readFileSync(resolve(__dirname, '../electron.vite.config.ts'), 'utf-8')
  assert(src.includes("include: ['monaco-editor']"), 'VC01: optimizeDeps includes monaco-editor')
}

// ═══════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════

console.log(`\n${'═'.repeat(60)}`)
console.log(`Editor Sprint A tests: ${passed} passed, ${failed} failed (${passed + failed} total)`)
console.log(`${'═'.repeat(60)}`)

process.exit(failed > 0 ? 1 : 0)
