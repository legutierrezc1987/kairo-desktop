# Release Notes — v0.1.2

**Date**: 2026-03-02
**Type**: Hotfix (Terminal + Chat Stability)
**Tag**: `v0.1.2`

---

## Bug Fixes

### Bug A — Input Normalization (command-classifier.ts)

**Problem**: Benign commands (e.g. `dir`, `ls`) pasted from external sources could be blocked by the RED zone classifier when the clipboard included invisible ANSI escape sequences, zero-width Unicode characters, or bracketed paste markers (`\x1b[200~`/`\x1b[201~`).

**Fix**: Added `normalizeInput()` function that strips ANSI CSI/OSC sequences, zero-width Unicode (`U+200B/C/D`, BOM `U+FEFF`), and non-printable control characters before classification. Preserves `\r`/`\n` so CR/LF injection detection (DEC-024) remains intact. Deny-by-default behavior preserved.

### Bug B — Terminal Scrollback (useTerminal.ts)

**Problem**: Terminal scrollback limited to xterm default (1000 lines), insufficient for build/test output. Bare LF output caused "staircase" text rendering.

**Fix**: Added `scrollback: 5000` (~1MB per terminal) and `convertEol: true` to the xterm Terminal constructor.

### Bug C — Chat Stream Timeout (orchestrator.ts + constants.ts)

**Problem**: Chat streaming could hang indefinitely with no timeout, leaving the UI stuck in `isStreaming=true` state if the Gemini API connection stalled.

**Fix**: Added `CHAT_STREAM_TIMEOUT_MS = 120_000` (2 minutes) constant and wrapped `retryWithBackoff` with `Promise.race` timeout pattern (same pattern already used for recall queries). On timeout, `abortActiveStream()` cancels the HTTP connection to prevent leaked connections. The `finally` block ensures `_isStreaming = false` is always set.

---

## Files Modified

| File | Bug | Change |
|------|-----|--------|
| `src/main/execution/command-classifier.ts` | A | `normalizeInput()` + call before `trim()` |
| `src/renderer/src/hooks/useTerminal.ts` | B | `scrollback: 5000`, `convertEol: true` |
| `src/shared/constants.ts` | C | `CHAT_STREAM_TIMEOUT_MS = 120_000` |
| `src/main/core/orchestrator.ts` | C | `Promise.race` timeout + `abortActiveStream()` in catch |
| `tests/test_rate_limit.mjs` | — | T61 assertion updated for new `Promise.race` pattern |
| `tests/test_hotfix_012.mjs` | ALL | New: 37 assertions |

---

## Quality Baseline

- **New test file**: `test_hotfix_012.mjs` — 37/37 PASS
- **Regression**: test_broker (57), test_sandbox_paths (105), test_terminal_e2e (35), test_chat_e2e (40), test_rate_limit (66), test_hotfix_workspace_cwd (27) — all PASS
- **TypeScript**: `npx tsc --noEmit` — exit 0
- **IPC channels**: 49 (unchanged)
- **Total non-sqlite assertions**: 2243 / 39 test files

---

## Upgrade Path

Direct upgrade from v0.1.0 or v0.1.1. No database migration. No configuration changes. No breaking changes.

---

## SHA256

```
C58DB9EADEF1D1A56E2EE2B65AE0433E6A884214347FE983B18256C3B131B32C  kairo-desktop-0.1.2-setup.exe
```

Installer size: 105.74 MB.
