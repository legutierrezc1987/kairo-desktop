# PROJECT MEMORY (Single Living Context)

Version: 3.1
Last Updated: 2026-02-25
Status: ACTIVE

## Editing Rule (MANDATORY)

THIS FILE IS A LIVE SNAPSHOT (Option B).
Overwrite current state. Remove resolved items. Do not append historical logs here.
Historical rationale belongs to DEB/RFC/governance docs and Git history.

## Scope Boundary

This file must contain only:
- current objective
- active debates/RFCs
- pending priority list
- active risks + mitigations
- exact next step + next owner

Do not duplicate full DEC or long rationale content.

## Current Snapshot

- Active phase: Phase 1 (Skeleton) — COMPLETED, pending commit closure.
- Current objective: atomic commit of Fase 1 deliverables + formal closure.
- Active debates: none.
- Open RFCs: none.

## Completed This Phase

- **Gate Zero (IPC Security)**: COMPLETED
  - Preload channel allowlist with frozen `IPC_CHANNEL_ALLOWLIST` (6 channels).
  - Handler-side sender/frame/origin validation (`validateSender()`).
  - BrowserWindow hardening: `sandbox:true`, `nodeIntegration:false`, `contextIsolation:true`.
  - Negative IPC test with real source parity (25/25 PASS).
  - `countTokens` integration with fallback heuristic for 429 quota.

- **Item 1.1 (3-panel layout)**: COMPLETED
  - Allotment-based resizable splits: sidebar 20% / editor+terminal 80%, top 70% / chat 30%.
  - Placeholder panels: FileExplorer, ProjectManager, CodeEditor, TerminalPanel.

- **Item 1.2 (Chat flow)**: COMPLETED
  - Full IPC path: renderer → preload → ipcMain.handle → Orchestrator → GeminiGateway.
  - ChatPanel, MessageBubble, InputBar components wired via useChat hook.
  - Zustand chatStore manages messages[], isLoading, error state.

- **Item 1.3 (Context meter)**: COMPLETED
  - ContextMeter polls `token:get-budget` every 5s via IPC.
  - TokenBudgeter records per-channel usage against DEC-021 allocations.
  - Color thresholds: blue < 60%, yellow 60-80%, red > 80%.

- **Item 1.4 (Model selector)**: COMPLETED
  - ModelSelector dropdown: gemini-2.0-flash, gemini-2.5-pro, gemini-2.0-flash-lite.
  - Bound to Zustand settingsStore. Model routing via DEC-019 policy.

## Validation Ledger (Fase 1)

| Check | Command | Result |
|-------|---------|--------|
| IPC negative test | `node test_ipc_negative.mjs` | 25/25 PASS, exit 0 |
| TypeScript strict | `npx tsc --noEmit` | exit 0 |
| Electron-vite build | `npx electron-vite build` | 3 targets (main 51KB, preload 1.6KB, renderer 618KB) |

## Pending (Priority Ordered)

1. Open Fase 2 backlog: terminal integration, file explorer, code editor, MCP bridge.
2. Resolve Gemini API quota for live chat testing (GCP billing activation).
3. MCP provider package resolution (deferred from Phase 0).

## Known Risks

- Gemini generateContent quota remains at zero for current GCP project.
- MCP provider package remains unresolved in npm registry.
- Path-with-spaces remains a portability risk for native rebuilds outside validated PowerShell flow.

## Mitigations

- Gemini quota: keep as CONDITIONAL. Execute on paid/billed project when available.
- MCP: keep local fallback active; defer provider selection to Fase 2 decision checkpoint.
- Path-with-spaces: use PowerShell for native rebuilds; avoid Git Bash for node-gyp workflows.

## Next Step (Exact)

Codex opens Fase 2 backlog after Gemini audit of Fase 1 commits.

## Next Owner

- Codex (orchestrator): open Fase 2 planning + dispatch.
- Gemini (auditor): audit Fase 1 commits for security + traceability.
- Claude (implementer): standby for Fase 2 implementation.
