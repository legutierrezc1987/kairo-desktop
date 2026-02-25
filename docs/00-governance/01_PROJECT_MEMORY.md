# PROJECT MEMORY (Single Living Context)

Version: 3.4
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

- Active phase: Phase 2 (OS + Security) — Sprint B completed.
- Current objective: execute Fase 2 items 2.5-2.6 (kill switch + sandbox full-path enforcement).
- Active debates: none.
- Open RFCs: none.

## Completed This Session

- Fase 1 formally closed with 3 atomic commits:
  - `15425e5` — security hardening (IPC gate + main services).
  - `80ee298` — UI skeleton (items 1.1-1.4).
  - `36d61bb` — governance update (memory closure).
- Fase 2 Sprint A (2.1-2.2) implemented and hardened:
  - xterm.js + node-pty terminal path wired through secure IPC.
  - Execution Broker classifier implemented with deny-by-default.
  - P0 bypass closed: chaining/injection operators force RED.
  - YELLOW commands moved to `pending_approval` until supervised flow.
  - Terminal spawn validates workspace path via DEC-025 sandbox checks.
- Fase 2 Sprint B (2.3-2.4) implemented:
  - Mode toggle Auto/Supervised with default `supervised`.
  - Approval flow: YELLOW queues in supervised, auto-executes in auto.
  - RED hard block absolute in both modes — even on manual approve attempt.
  - Re-classification at approval time prevents stale attack.
  - Double-submit prevention via PendingQueue status check.
  - PendingQueue with 5-minute TTL and 30s sweep timer.
  - Audit log extended with `mode` and `actor` fields.
  - IPC channels: 14 → 21 (7 broker channels added).
  - Renderer: ModeToggle component, CommandApproval cards, Zustand broker store.
  - P0 PTY fix: blocked branch sends `\x03` (Ctrl+C), not `\r` (Enter).
  - PTY integration test validates blocked commands produce no side-effects.

## Validation Ledger (Latest)

| Check | Command | Result |
|-------|---------|--------|
| Broker adversarial test | `node test_broker.mjs` | 57/57 PASS |
| IPC parity test | `node test_ipc_negative.mjs` | 40/40 PASS |
| Approval flow test | `node test_approval.mjs` | 74/74 PASS |
| PTY blocked execution test | `node test_terminal_blocked_execution.mjs` | 8/8 PASS |
| TypeScript strict | `npx tsc --noEmit` | exit 0 |
| Electron-vite build | `npx electron-vite build` | PASS (main 78KB, preload 2KB, renderer 1039KB) |

## Pending (Priority Ordered)

1. Implement Fase 2 item 2.5: kill switch (`Ctrl+Shift+K`) with immediate PTY/process stop.
2. Implement Fase 2 item 2.6: workspace sandbox validation for remaining execution paths (not only spawn).
3. Resolve Gemini API quota for full live chat testing (billing/project action).
4. MCP provider package resolution checkpoint (deferred fallback still active).

## Known Risks

- Gemini generateContent quota remains at zero for current GCP project.
- Path-with-spaces remains a portability risk for native rebuilds outside validated PowerShell flow.
- MCP provider package remains unresolved in npm registry.
- ConPTY on Windows emits "AttachConsole failed" on proc.kill() — noise only, no functional impact.

## Mitigations

- Gemini quota: keep as CONDITIONAL for live generation until billing/project is enabled.
- Path-with-spaces: use PowerShell for native rebuilds; avoid Git Bash for node-gyp workflows.
- MCP: keep local fallback active; handle provider decision in dedicated Fase 2 checkpoint.
- ConPTY noise: stderr from ConPTY agent is benign; PTY integration tests tolerate it.

## Next Step (Exact)

Codex dispatches Fase 2 Sprint C packet to Claude for items 2.5 and 2.6.

## Next Owner

- Codex (orchestrator): dispatch Fase 2 Sprint C and acceptance criteria.
- Claude (implementer): execute items 2.5-2.6.
- Gemini (auditor): audit kill switch safety and sandbox enforcement.
- User (director): validate kill-switch UX and remaining security paths.
