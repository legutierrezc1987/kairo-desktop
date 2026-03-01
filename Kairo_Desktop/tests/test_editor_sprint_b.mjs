/**
 * test_editor_sprint_b.mjs — Phase 6 Sprint B: File Explorer Tests
 *
 * Source cross-verification for file explorer infrastructure:
 * 1. FileOperationsService.listDir() (esbuild → .test-build/): sandbox, lazy list, exclusions, depth limits
 * 2. IPC channel verification: FS_LIST_DIR exists, 45 total
 * 3. Editor IPC handlers: FS_LIST_DIR handler structure
 * 4. Renderer source-level assertions: useFileExplorer, FileExplorer component
 * 5. Shared types: FsListDirRequest, FsDirEntry, FsListDirResponse
 * 6. Constants: FS_LIST_DIR_MAX_DEPTH, FS_LIST_DIR_MAX_ENTRIES, FS_LIST_DIR_EXCLUDED
 *
 * Run: node tests/test_editor_sprint_b.mjs
 * Expected: All assertions PASS, exit 0
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
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

// ─── Build for testing ───────────────────────────────────────

mkdirSync(BUILD_DIR, { recursive: true })

buildSync({
  entryPoints: [resolve(SRC, 'main', 'services', 'file-operations.service.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(BUILD_DIR, 'file-operations-b.test.mjs'),
  logLevel: 'silent',
})

buildSync({
  entryPoints: [resolve(SRC, 'shared', 'constants.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(BUILD_DIR, 'constants-editor-b.test.mjs'),
  logLevel: 'silent',
})

buildSync({
  entryPoints: [resolve(SRC, 'shared', 'ipc-channels.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(BUILD_DIR, 'ipc-channels-editor-b.test.mjs'),
  logLevel: 'silent',
})

const fileOpsMod = await import(pathToFileURL(join(BUILD_DIR, 'file-operations-b.test.mjs')).href)
const constantsMod = await import(pathToFileURL(join(BUILD_DIR, 'constants-editor-b.test.mjs')).href)
const ipcMod = await import(pathToFileURL(join(BUILD_DIR, 'ipc-channels-editor-b.test.mjs')).href)

const { FileOperationsService } = fileOpsMod
const {
  FS_LIST_DIR_MAX_DEPTH,
  FS_LIST_DIR_MAX_ENTRIES,
  FS_LIST_DIR_EXCLUDED,
} = constantsMod
const { IPC_CHANNELS, IPC_CHANNEL_ALLOWLIST } = ipcMod

console.log('\n=== Phase 6 Sprint B — File Explorer Tests ===\n')

// ═══════════════════════════════════════════════════════════════
// Section 1: Constants
// ═══════════════════════════════════════════════════════════════
console.log('── Section 1: Constants ──')

assert(FS_LIST_DIR_MAX_DEPTH === 5, 'C01: FS_LIST_DIR_MAX_DEPTH = 5')
assert(FS_LIST_DIR_MAX_ENTRIES === 5_000, 'C02: FS_LIST_DIR_MAX_ENTRIES = 5000')
assert(Array.isArray(FS_LIST_DIR_EXCLUDED), 'C03: FS_LIST_DIR_EXCLUDED is array')
assert(FS_LIST_DIR_EXCLUDED.includes('.git'), 'C04: excludes .git')
assert(FS_LIST_DIR_EXCLUDED.includes('node_modules'), 'C05: excludes node_modules')
assert(FS_LIST_DIR_EXCLUDED.includes('__pycache__'), 'C06: excludes __pycache__')
assert(FS_LIST_DIR_EXCLUDED.includes('.kairo'), 'C07: excludes .kairo')
assert(Object.isFrozen(FS_LIST_DIR_EXCLUDED), 'C08: exclusion list is frozen')

// ═══════════════════════════════════════════════════════════════
// Section 2: IPC Channel Parity
// ═══════════════════════════════════════════════════════════════
console.log('\n── Section 2: IPC Channel Parity ──')

assert(IPC_CHANNELS.FS_LIST_DIR === 'fs:list-dir', 'IPC01: FS_LIST_DIR channel exists')
assert(IPC_CHANNEL_ALLOWLIST.includes('fs:list-dir'), 'IPC02: allowlist includes fs:list-dir')
assert(IPC_CHANNEL_ALLOWLIST.length === 45, `IPC03: 45 channels total (got ${IPC_CHANNEL_ALLOWLIST.length})`)

// ═══════════════════════════════════════════════════════════════
// Section 3: listDir — Sandbox Validation
// ═══════════════════════════════════════════════════════════════
console.log('\n── Section 3: listDir Sandbox Validation ──')

{
  const svc = new FileOperationsService()

  // No workspace
  const noWs = await svc.listDir('/some/dir')
  assert(!noWs.success, 'LD01: listDir fails when no workspace set')
  assert(noWs.error.includes('No workspace'), 'LD02: error mentions missing workspace')

  // Set workspace to test dir
  const tmpWorkspace = resolve(__dirname, '__test_workspace_explorer__')
  rmSync(tmpWorkspace, { recursive: true, force: true })
  mkdirSync(join(tmpWorkspace, 'src', 'components'), { recursive: true })
  mkdirSync(join(tmpWorkspace, 'node_modules', 'pkg'), { recursive: true })
  mkdirSync(join(tmpWorkspace, '.git', 'objects'), { recursive: true })
  mkdirSync(join(tmpWorkspace, '__pycache__'), { recursive: true })
  mkdirSync(join(tmpWorkspace, '.kairo'), { recursive: true })
  mkdirSync(join(tmpWorkspace, 'lib'), { recursive: true })
  writeFileSync(join(tmpWorkspace, 'index.ts'), 'export default 42')
  writeFileSync(join(tmpWorkspace, 'README.md'), '# Hello')
  writeFileSync(join(tmpWorkspace, 'src', 'main.ts'), 'console.log("hello")')
  writeFileSync(join(tmpWorkspace, 'src', 'components', 'App.tsx'), '<div/>')
  writeFileSync(join(tmpWorkspace, 'lib', 'utils.js'), '// utils')

  svc.setWorkspacePath(tmpWorkspace)

  // Sandbox: path outside workspace
  const outsideResult = await svc.listDir(resolve(__dirname, '..'))
  assert(!outsideResult.success, 'LD03: listDir rejects path outside workspace')
  assert(outsideResult.error.includes('DEC-025'), 'LD04: error references DEC-025')

  // Sandbox: null byte
  const nullResult = await svc.listDir(join(tmpWorkspace, 'src\0evil'))
  assert(!nullResult.success, 'LD05: listDir rejects null byte in path')

  // Sandbox: empty path
  const emptyResult = await svc.listDir('')
  assert(!emptyResult.success, 'LD06: listDir rejects empty path')

  // Sandbox: traversal
  const traversalResult = await svc.listDir(join(tmpWorkspace, '..', '..'))
  assert(!traversalResult.success, 'LD07: listDir rejects traversal path')

  // ═════════════════════════════════════════════════════════════
  // Section 4: listDir — Happy Path
  // ═════════════════════════════════════════════════════════════
  console.log('\n── Section 4: listDir Happy Path ──')

  // List root with depth 1
  const rootResult = await svc.listDir(tmpWorkspace, 1)
  assert(rootResult.success, 'LD08: listDir succeeds on workspace root')
  assert(Array.isArray(rootResult.data.entries), 'LD09: entries is array')
  assert(rootResult.data.dirPath === resolve(tmpWorkspace), 'LD10: dirPath is resolved')

  const rootNames = rootResult.data.entries.map(e => e.name)
  assert(rootNames.includes('src'), 'LD11: lists src/ directory')
  assert(rootNames.includes('lib'), 'LD12: lists lib/ directory')
  assert(rootNames.includes('index.ts'), 'LD13: lists index.ts file')
  assert(rootNames.includes('README.md'), 'LD14: lists README.md file')

  // ═════════════════════════════════════════════════════════════
  // Section 5: listDir — Exclusions
  // ═════════════════════════════════════════════════════════════
  console.log('\n── Section 5: listDir Exclusions ──')

  assert(!rootNames.includes('node_modules'), 'LD15: excludes node_modules')
  assert(!rootNames.includes('.git'), 'LD16: excludes .git')
  assert(!rootNames.includes('__pycache__'), 'LD17: excludes __pycache__')
  assert(!rootNames.includes('.kairo'), 'LD18: excludes .kairo')

  // ═════════════════════════════════════════════════════════════
  // Section 6: listDir — Entry Structure
  // ═════════════════════════════════════════════════════════════
  console.log('\n── Section 6: Entry Structure ──')

  const srcEntry = rootResult.data.entries.find(e => e.name === 'src')
  assert(srcEntry !== undefined, 'LD19: src entry found')
  assert(srcEntry.isDirectory === true, 'LD20: src.isDirectory = true')
  assert(typeof srcEntry.path === 'string', 'LD21: src.path is string')
  assert(srcEntry.path.endsWith('src'), 'LD22: src.path ends with src')

  const indexEntry = rootResult.data.entries.find(e => e.name === 'index.ts')
  assert(indexEntry !== undefined, 'LD23: index.ts entry found')
  assert(indexEntry.isDirectory === false, 'LD24: index.ts.isDirectory = false')
  assert(typeof indexEntry.sizeBytes === 'number', 'LD25: index.ts.sizeBytes is number')
  assert(indexEntry.sizeBytes > 0, 'LD26: index.ts.sizeBytes > 0')

  // ═════════════════════════════════════════════════════════════
  // Section 7: listDir — Sorting (dirs first, then alpha)
  // ═════════════════════════════════════════════════════════════
  console.log('\n── Section 7: Sorting ──')

  const dirEntries = rootResult.data.entries.filter(e => e.isDirectory)
  const fileEntries = rootResult.data.entries.filter(e => !e.isDirectory)
  const lastDirIndex = rootResult.data.entries.findIndex(e => e === dirEntries[dirEntries.length - 1])
  const firstFileIndex = rootResult.data.entries.findIndex(e => e === fileEntries[0])
  assert(lastDirIndex < firstFileIndex, 'LD27: directories sorted before files')

  // ═════════════════════════════════════════════════════════════
  // Section 8: listDir — Depth > 1 (recurse into subdirs)
  // ═════════════════════════════════════════════════════════════
  console.log('\n── Section 8: Depth Recursion ──')

  const deepResult = await svc.listDir(tmpWorkspace, 3)
  assert(deepResult.success, 'LD28: listDir depth=3 succeeds')
  const deepSrc = deepResult.data.entries.find(e => e.name === 'src')
  assert(deepSrc.children !== undefined, 'LD29: src has children at depth > 1')
  assert(Array.isArray(deepSrc.children), 'LD30: src.children is array')

  const componentsEntry = deepSrc.children.find(e => e.name === 'components')
  assert(componentsEntry !== undefined, 'LD31: src/components found in children')
  assert(componentsEntry.isDirectory, 'LD32: components is directory')
  assert(Array.isArray(componentsEntry.children), 'LD33: components has children at depth 3')

  const appEntry = componentsEntry.children.find(e => e.name === 'App.tsx')
  assert(appEntry !== undefined, 'LD34: src/components/App.tsx found')
  assert(!appEntry.isDirectory, 'LD35: App.tsx is file')

  // ═════════════════════════════════════════════════════════════
  // Section 9: listDir — Not a directory
  // ═════════════════════════════════════════════════════════════
  console.log('\n── Section 9: listDir Edge Cases ──')

  const fileAsDir = await svc.listDir(join(tmpWorkspace, 'index.ts'))
  assert(!fileAsDir.success, 'LD36: listDir rejects file path')
  assert(fileAsDir.error.includes('not a directory'), 'LD37: error says not a directory')

  // Non-existent path
  const nonExist = await svc.listDir(join(tmpWorkspace, 'nonexistent'))
  assert(!nonExist.success, 'LD38: listDir fails on nonexistent path')

  // Depth clamping (below minimum)
  const clampLow = await svc.listDir(tmpWorkspace, 0)
  assert(clampLow.success, 'LD39: depth=0 clamped to 1, succeeds')

  // Depth clamping (above maximum)
  const clampHigh = await svc.listDir(tmpWorkspace, 100)
  assert(clampHigh.success, 'LD40: depth=100 clamped to MAX_DEPTH, succeeds')

  // truncated field
  assert(rootResult.data.truncated === false, 'LD41: truncated=false for small dir')

  // Subdirectory listing
  const subResult = await svc.listDir(join(tmpWorkspace, 'src'))
  assert(subResult.success, 'LD42: listDir on subdirectory succeeds')
  const subNames = subResult.data.entries.map(e => e.name)
  assert(subNames.includes('components'), 'LD43: subdirectory lists components/')
  assert(subNames.includes('main.ts'), 'LD44: subdirectory lists main.ts')

  // Cleanup
  rmSync(tmpWorkspace, { recursive: true, force: true })
}

// ═══════════════════════════════════════════════════════════════
// Section 10: Editor Handlers — FS_LIST_DIR
// ═══════════════════════════════════════════════════════════════
console.log('\n── Section 10: Editor Handlers ──')

{
  const src = readSrc('main/ipc/editor.handlers.ts')
  assert(src.includes('FS_LIST_DIR'), 'EH01: handler references FS_LIST_DIR')
  assert(src.includes('isValidFsListDirRequest'), 'EH02: has listDir type guard')
  assert(src.includes('validateSender'), 'EH03: uses validateSender')
  assert(src.includes('fileOps.listDir'), 'EH04: calls fileOps.listDir')
  assert(src.includes('data.dirPath'), 'EH05: passes dirPath from data')
  assert(src.includes('data.depth'), 'EH06: passes depth from data')
  assert(src.includes("FsListDirRequest"), 'EH07: imports FsListDirRequest type')
}

// ═══════════════════════════════════════════════════════════════
// Section 11: Shared Types
// ═══════════════════════════════════════════════════════════════
console.log('\n── Section 11: Shared Types ──')

{
  const src = readSrc('shared/types.ts')
  assert(src.includes('interface FsListDirRequest'), 'TY01: FsListDirRequest defined')
  assert(src.includes('interface FsDirEntry'), 'TY02: FsDirEntry defined')
  assert(src.includes('interface FsListDirResponse'), 'TY03: FsListDirResponse defined')
  assert(src.includes('dirPath: string'), 'TY04: FsListDirRequest has dirPath')
  assert(src.includes('depth?: number'), 'TY05: FsListDirRequest has optional depth')
  assert(src.includes('isDirectory: boolean'), 'TY06: FsDirEntry has isDirectory')
  assert(src.includes("children?: FsDirEntry[]"), 'TY07: FsDirEntry has optional children')
  assert(src.includes('truncated: boolean'), 'TY08: FsListDirResponse has truncated')
  assert(src.includes("entries: FsDirEntry[]"), 'TY09: FsListDirResponse has entries')
}

// ═══════════════════════════════════════════════════════════════
// Section 12: index.ts Wiring
// ═══════════════════════════════════════════════════════════════
console.log('\n── Section 12: index.ts Wiring ──')

{
  const src = readSrc('main/index.ts')
  assert(src.includes('FileOperationsService'), 'IX01: imports FileOperationsService')
  assert(src.includes('registerEditorHandlers'), 'IX02: imports registerEditorHandlers')
  assert(src.includes('fileOps.setWorkspacePath'), 'IX03: binds workspace on project load')
  assert(src.includes('registerEditorHandlers(fileOps)'), 'IX04: registers editor handlers with fileOps')
}

// ═══════════════════════════════════════════════════════════════
// Section 13: useFileExplorer hook
// ═══════════════════════════════════════════════════════════════
console.log('\n── Section 13: useFileExplorer hook ──')

{
  const src = readSrc('renderer/src/hooks/useFileExplorer.ts')
  assert(src.includes('useFileExplorer'), 'FE01: exports useFileExplorer')
  assert(src.includes('FS_LIST_DIR'), 'FE02: invokes FS_LIST_DIR channel')
  assert(src.includes('getKairoApiOrThrow'), 'FE03: uses bridge guard')
  assert(src.includes('useProjectStore'), 'FE04: reads activeProject from store')
  assert(src.includes('toggleExpand'), 'FE05: exposes toggleExpand')
  assert(src.includes('refresh'), 'FE06: exposes refresh')
  assert(src.includes('expandedPaths'), 'FE07: tracks expandedPaths')
  assert(src.includes('projectIdRef'), 'FE08: anti-stale guard via projectIdRef')
  assert(src.includes('injectChildren'), 'FE09: immutable tree update via injectChildren')
  assert(src.includes('loadRoot'), 'FE10: loads root on project change')
  assert(src.includes('depth: 1'), 'FE11: lazy-loads with depth=1')
}

// ═══════════════════════════════════════════════════════════════
// Section 14: FileExplorer component
// ═══════════════════════════════════════════════════════════════
console.log('\n── Section 14: FileExplorer component ──')

{
  const src = readSrc('renderer/src/components/Sidebar/FileExplorer.tsx')
  assert(src.includes('useFileExplorer'), 'FC01: imports useFileExplorer')
  assert(src.includes('useEditor'), 'FC02: imports useEditor')
  assert(src.includes('openFile'), 'FC03: uses openFile from useEditor')
  assert(src.includes('toggleExpand'), 'FC04: uses toggleExpand')
  assert(src.includes('refresh'), 'FC05: uses refresh')
  assert(src.includes('TreeNode'), 'FC06: renders TreeNode sub-component')
  assert(src.includes('isDirectory'), 'FC07: checks isDirectory for branching')
  assert(src.includes('onFileClick'), 'FC08: passes onFileClick to TreeNode')
  assert(src.includes('expandedPaths'), 'FC09: passes expandedPaths to TreeNode')
  assert(src.includes('No project open'), 'FC10: shows placeholder when no project')
  assert(src.includes('Loading'), 'FC11: shows loading state')
  assert(src.includes('error'), 'FC12: shows error state')
  assert(src.includes('useProjectStore'), 'FC13: reads activeProject')
  assert(src.includes('depth'), 'FC14: TreeNode uses depth for indentation')
}

// ═══════════════════════════════════════════════════════════════
// Section 15: FileOperationsService — listDir method source
// ═══════════════════════════════════════════════════════════════
console.log('\n── Section 15: FileOperationsService Source ──')

{
  const src = readSrc('main/services/file-operations.service.ts')
  assert(src.includes('async listDir'), 'FO01: listDir is async method')
  assert(src.includes('FS_LIST_DIR_MAX_DEPTH'), 'FO02: uses MAX_DEPTH constant')
  assert(src.includes('FS_LIST_DIR_MAX_ENTRIES'), 'FO03: uses MAX_ENTRIES constant')
  assert(src.includes('FS_LIST_DIR_EXCLUDED'), 'FO04: uses exclusion list')
  assert(src.includes('readdir'), 'FO05: uses fs.readdir')
  assert(src.includes('withFileTypes'), 'FO06: readdir with withFileTypes')
  assert(src.includes('isInsideWorkspace'), 'FO07: validates via sandbox')
  assert(src.includes('validatePath'), 'FO08: uses validatePath')
  assert(src.includes('truncated'), 'FO09: tracks truncation')
  assert(src.includes('isDirectory'), 'FO10: checks dirent.isDirectory')
  assert(src.includes('.sort'), 'FO11: sorts entries')
}

// ═══════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)

if (failed > 0) {
  console.error('\nFAILED — Phase 6 Sprint B tests have errors.')
  process.exit(1)
} else {
  console.log('\nPASSED — All Phase 6 Sprint B tests pass.\n')
  process.exit(0)
}
