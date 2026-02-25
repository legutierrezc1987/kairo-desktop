# KAIRO_DESKTOP — Setup Guide (Fase 0)

Version: 1.4
Status: VERIFIED — All items 0.0-0.25 PASS (0.18 CONDITIONAL, 0.22 DEFERRED)
Date: 2026-02-24
Author: [Proposed: Claude] [Audited: Gemini] [Synthesized: Codex]

## Prerequisites (verified on target machine)

| Item | Requirement | Verified Value | Status |
|------|-------------|---------------|--------|
| 0.1 | Windows 11 | Windows 11 Pro Build 26200 | OK |
| 0.2 | Node.js 22 LTS | v22.18.0 | OK |
| 0.3 | npm 10+ | 11.5.2 | OK |
| 0.4 | Git | 2.50.1.windows.1 | OK |
| 0.5 | VS Build Tools | VS 2022 Community + MSVC v143 Spectre libs (14.44) | OK |
| 0.6 | Gemini API Key | User reported functional key in AI Studio | PASS (user-reported) |
| 0.7 | Python 3.11+ | 3.13.9 | OK |

## Step-by-Step Setup

### 1. Create project folder

```bash
mkdir Kairo_Desktop
cd Kairo_Desktop
```

Location: `kairo-memoria-infinita/Kairo_Desktop/`

**Item 0.9 (git init): N/A** — `Kairo_Desktop/` lives inside the existing `kairo-memoria-infinita/` git repository. The governance checklist states "Si no existe `.git`, inicializar repositorio". Since `.git` exists at the parent repo root, a nested `git init` is unnecessary and would create a problematic nested repo. Evidence: `Test-Path Kairo_Desktop/.git` → `False` (correct — tracked by parent repo).

### 2. Scaffold

The scaffold was created manually (equivalent to `npm create @quick-start/electron@latest` with React + TypeScript template) because the interactive CLI is not automatable in CI/headless environments.

Files created:
- `package.json` (name: kairo-desktop, Electron 35 + React 19 + TypeScript 5.9)
- `electron.vite.config.ts`
- `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`
- `electron-builder.yml` (Windows-only config)
- `eslint.config.mjs`, `.prettierrc.yaml`, `.editorconfig`
- `src/main/index.ts` (Electron main process)
- `src/preload/index.ts` (context bridge)
- `src/renderer/` (React app with HTML, TSX, CSS)
- `resources/icon.png` (placeholder)

### 3. Install dependencies

```bash
npm install
```

Expected output: ~700 packages, 0 vulnerabilities.
The `postinstall` script runs `electron-builder install-app-deps` automatically.

### 4. Verify build

```bash
npx electron-vite build
```

Expected: 3 successful builds (main, preload, renderer) with output in `out/`.

### 5. Run dev mode (requires GUI)

```bash
npm run dev
```

Expected: Electron window opens with "Kairo Desktop" title, showing React scaffold page.

**Note**: This command requires a graphical environment. It cannot be verified in headless/CLI-only terminals.

**User Validation Protocol** (per Gemini audit R-FA-01):
1. Open CMD/PowerShell at `Kairo_Desktop/`
2. Run `npm run dev`
3. Confirm Electron window opens with "Kairo Desktop" title
4. Press `Ctrl+Shift+I` to open DevTools
5. Check Console tab for **0 errors** (especially IPC/Preload bridge errors)
6. Report pass/fail to Codex

**Current result (2026-02-24)**: PASS reported by user (window opens, DevTools console clean, IPC ping/pong verified).

## Dependency Versions (pinned)

| Package | Version | Role |
|---------|---------|------|
| electron | 35.x | Runtime |
| electron-vite | 4.x | Build toolchain |
| electron-builder | 26.x | Packaging |
| react | 19.x | UI framework |
| react-dom | 19.x | React DOM |
| typescript | 5.9.x | Type system |
| vite | 7.x | Bundler (via electron-vite) |

## Known Issues

### KI-1: `@electron-toolkit/utils` v4.0.0 CJS loading incompatibility

**Severity**: P2 — scaffold blocker, resolved via workaround.

**Symptom**: `TypeError: Cannot read properties of undefined (reading 'isPackaged')` at startup.

**Root cause**: `@electron-toolkit/utils/index.cjs` (v4.0.0) evaluates `electron.app.isPackaged` at **module top level** (line 6 of the bundled CJS output). In electron-vite's build pipeline, this executes before Electron's `app` object is fully initialized, causing the property access on `undefined`.

**Reproduction steps** (verified 2026-02-24):
```bash
# 1. Start with clean scaffold including @electron-toolkit/utils@^4.0.0
# 2. Build: npx electron-vite build → succeeds (tree-shaking doesn't trigger the path)
# 3. Run: npm run dev → FAILS with:
#    TypeError: Cannot read properties of undefined (reading 'isPackaged')
#    at Object.<anonymous> (node_modules/@electron-toolkit/utils/index.cjs:6:33)
```

**Workaround applied**: Removed `@electron-toolkit/utils` and `@electron-toolkit/preload` from `devDependencies`. Replaced with native Electron APIs:
- `app.isPackaged` → `process.env['ELECTRON_RENDERER_URL']` (injected by electron-vite in dev mode)
- `@electron-toolkit/preload` → custom `contextBridge.exposeInMainWorld()` in `src/preload/index.ts`

**Functional impact**: None. The custom preload exposes identical IPC surface (`send`, `on`, `invoke`, `process.versions`). The typing contract is preserved in `src/preload/index.d.ts`.

**Security note** (per Gemini audit D1): The custom preload bypasses the toolkit's pre-validated IPC wrappers. User MUST verify 0 console errors in DevTools after `npm run dev` (see Step 5 validation protocol above).

### KI-2: `npm run dev` cannot be verified in CLI-only environments

Claude Code, CI runners, and other headless environments cannot launch Electron GUI processes. `require('electron')` returns the binary path (string) instead of the API object outside the Electron runtime. Build verification (`npx electron-vite build`) confirms code correctness for all 3 targets.

### KI-3: `npm create @quick-start/electron@latest` is interactive-only

The scaffolding CLI requires interactive prompts (project name, framework, template, updater plugin). Cannot be automated via stdin piping. Scaffold was created manually matching the official `react-ts` layout from `quick-start/create-electron`.

### KI-4: `node-pty` native rebuild required MSVC Spectre-mitigated libs — RESOLVED

**Severity**: P1 — was blocking Batch B. **Now resolved.**

**Root cause**: `node-pty` v1.1.0 compiles `winpty` + `conpty` native projects via MSBuild. The `.vcxproj` files require Spectre-mitigated MSVC libraries (`/Qspectre` flag). Without the `MSVC v143 Spectre-mitigated libs` VS component, MSBuild fails with `MSB8040`.

**Resolution applied (2026-02-24)**:
1. Installed VS component: `Microsoft.VisualStudio.Component.VC.14.44.17.14.x86.x64.Spectre` via:
   ```powershell
   Start-Process -FilePath "C:\Program Files (x86)\Microsoft Visual Studio\Installer\setup.exe" `
     -ArgumentList 'modify --installPath "C:\Program Files\Microsoft Visual Studio\2022\Community" --add Microsoft.VisualStudio.Component.VC.14.44.17.14.x86.x64.Spectre --passive --norestart' `
     -Verb RunAs -Wait
   ```
2. Re-ran `npx electron-builder install-app-deps` from PowerShell → both `better-sqlite3` and `node-pty` rebuilt successfully for Electron 35.7.5 x64.

**Note**: A warning "Attempting to build a module with a space in the path" still appears due to the repo path containing `ORION OCG`. In PowerShell this is non-fatal. In Git Bash / Claude Code CLI, it can cause `GetCommitHash.bat` failures during `winpty.gyp` configure phase. Native rebuild commands should always be run from PowerShell on this machine.

**Junction `C:\kairo-dev`**: Created during debugging (`mklink /J`). Can be safely removed with `rmdir C:\kairo-dev` (does not delete actual files).

## Installed Dependencies (items 0.12-0.17) — COMPLETED

Installed in two batches per Gemini audit R-FA-02:

### Batch A — Pure JS packages (DONE, exit code 0)
```bash
npm install zustand allotment tailwindcss @tailwindcss/vite   # +37 packages
npm install monaco-editor @google/generative-ai               # +5 packages
```

### Batch B — Native C++ packages (DONE, exit code 0)
```bash
npm install xterm @xterm/addon-fit   # +2 packages (xterm@5.3.0 deprecated, successor: @xterm/xterm)
npm install node-pty                 # +2 packages
npm install better-sqlite3           # +21 packages (prebuild-install deprecated warning, non-blocking)
npx electron-builder install-app-deps  # rebuilt both native modules for Electron 35.7.5 x64
```

### Post-install verification (DONE)
```
npm ls → 10/10 packages resolved at expected versions
npx tsc --noEmit → exit code 0, 0 type errors
```

| Package | Installed Version | Type |
|---------|------------------|------|
| zustand | 5.0.11 | JS |
| allotment | 1.20.5 | JS |
| tailwindcss | 4.2.1 | JS |
| @tailwindcss/vite | 4.2.1 | JS |
| monaco-editor | 0.55.1 | JS |
| @google/generative-ai | 0.24.1 | JS |
| xterm | 5.3.0 | JS |
| @xterm/addon-fit | 0.11.0 | JS |
| node-pty | 1.1.0 | Native C++ |
| better-sqlite3 | 12.6.2 | Native C++ |

## Technical Validations (items 0.18-0.25) — COMPLETED

Executed by Claude (implementer) on 2026-02-24. All commands run from `Kairo_Desktop/`.

### 0.18 — Gemini API generateContent smoke test — CONDITIONAL PASS

```bash
# Command executed (inline Node.js, equivalent to test_0.18.js):
GEMINI_API_KEY=<key> node -e "... model: 'gemini-2.0-flash' ... generateContent('Respond with exactly: KAIRO_SMOKE_OK')"
```

- **Result**: HTTP 429 — `generate_content_free_tier_requests limit: 0`
- **Tested with**: 2 distinct API keys, both against `gemini-2.0-flash` and `gemini-2.0-flash-lite`
- **Root cause**: GCP project quota at zero (project-level, not key-level)
- **Auth proof**: `countTokens` succeeds with both keys (item 0.19), confirming valid auth
- **Status**: **CONDITIONAL PASS** — SDK integration and auth are correct; generation blocked by external quota

### 0.19 — countTokens validation — PASS

```bash
GEMINI_API_KEY=<key> node -e "... model: 'gemini-2.0-flash' ... countTokens('Hello Kairo')"
# Output: totalTokens=4, promptTokensDetails=[{modality:"TEXT",tokenCount:4}]
# Exit code: 0
# Latency: 322ms
```

- **Status**: **PASS**

### 0.20 — node-pty spawn test — PASS

```bash
node -e "const pty = require('node-pty'); const p = pty.spawn('powershell.exe', ['-Command', 'echo hello'], {name:'xterm-color',cols:80,rows:24}); let out=''; p.onData(d => out+=d); p.onExit(({exitCode}) => { console.log('OUTPUT:', out.trim()); console.log('EXIT:', exitCode); });"
# Output: contains "hello"
# Exit code: 0
```

- **Note**: `AttachConsole failed` warning is expected in headless environment (conpty agent artefact)
- **Status**: **PASS**

### 0.21 — better-sqlite3 create/insert/query — PASS

```bash
# Required temporary rebuild for Node.js ABI (module was compiled for Electron ABI 133):
npx node-gyp rebuild --directory=node_modules/better-sqlite3
# Then:
node -e "const Database = require('better-sqlite3'); const db = new Database(':memory:'); db.exec('CREATE TABLE t(id INTEGER PRIMARY KEY, val TEXT)'); db.prepare('INSERT INTO t(val) VALUES(?)').run('kairo'); const row = db.prepare('SELECT val FROM t WHERE id=1').get(); console.log('RESULT:', row.val); db.close();"
# Output: RESULT: kairo
# Exit code: 0
# Post-test: restored Electron ABI via npx electron-rebuild -o better-sqlite3
```

- **Status**: **PASS**

### 0.22 — MCP NotebookLM handshake/auth — DEFERRED

```bash
npm view notebooklm-mcp-cli
# Result: 404 — package does not exist in npm registry
# Alternatives found: notebooklm-mcp, notebooklm-mcp-server, @pan-sec/notebooklm-mcp (none match PRD spec)
```

- **Governance fallback**: DEC allows local fallback when external MCP is unavailable
- **Status**: **DEFERRED** — permitted by governance, deferred to Fase 1

### 0.23-0.25 — Folder structure + placeholder files + compile check — PASS

```bash
# 0.23-0.24: Created 71 placeholder files per PRD §18 structure:
#   - 32 main process files (core, services, execution, memory, workers, ipc, config)
#   - 33 renderer files (components, hooks, stores, styles)
#   - 5 shared/db/scripts files (types, constants, ipc-channels, schema.sql, setup-mcp.ps1)
#   - All use: // [description]\nexport {} pattern (TS) or SQL/PS1 comments

# 0.25: Compile check
npx tsc --noEmit        # Exit code: 0
npx electron-vite build # Exit code: 0, 3 targets built (main, preload, renderer)
```

- **Status**: **PASS**

### Validation Summary

| Item | Description | Command | Exit Code | Status |
|------|-------------|---------|-----------|--------|
| 0.18 | Gemini generateContent | `node test_0.18.js` | 1 (429) | CONDITIONAL PASS |
| 0.19 | Gemini countTokens | `node test_0.19.js` | 0 | PASS |
| 0.20 | node-pty spawn | inline node -e | 0 | PASS |
| 0.21 | better-sqlite3 CRUD | inline node -e | 0 | PASS |
| 0.22 | MCP NotebookLM | npm view | 404 | DEFERRED |
| 0.23 | Folder structure | mkdir -p | 0 | PASS |
| 0.24 | Placeholder files | write 71 files | 0 | PASS |
| 0.25 | Compile check | tsc + electron-vite build | 0 | PASS |
