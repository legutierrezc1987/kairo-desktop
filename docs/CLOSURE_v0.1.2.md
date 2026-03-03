# Operational Closure — v0.1.2

**Date**: 2026-03-02
**Status**: CLOSED
**Verdict**: All bugs fixed, runtime validated, no v0.1.3 required.

---

## Bugs Addressed

| ID | Description | Fix | File(s) |
|----|-------------|-----|---------|
| A | Benign commands blocked by invisible ANSI/zero-width chars | `normalizeInput()` strips transport noise before classification | `command-classifier.ts` |
| B | Terminal scrollback limited to 1000 lines | `scrollback: 5000`, `convertEol: true` | `useTerminal.ts` |
| C | Chat streaming hangs indefinitely | `Promise.race` 120s timeout + `abortActiveStream()` | `orchestrator.ts`, `constants.ts` |

## Validation Evidence

### Automated (Headless)

| Suite | Assertions | Result |
|-------|-----------|--------|
| test_hotfix_012.mjs | 37 | PASS |
| test_broker.mjs (regression) | 57 | PASS |
| test_sandbox_paths.mjs (regression) | 105 | PASS |
| test_terminal_e2e.mjs (regression) | 35 | PASS |
| test_chat_e2e.mjs (regression) | 40 | PASS |
| test_rate_limit.mjs (regression) | 66 | PASS |
| test_hotfix_workspace_cwd.mjs (regression) | 27 | PASS |
| `npx tsc --noEmit` | — | exit 0 |
| `electron-vite build` | — | PASS |

### Runtime (Director, installed app v0.1.2)

| Case | Description | Result |
|------|-------------|--------|
| RT-1 | `dir` typed 5x from keyboard | PASS |
| RT-2 | `dir` pasted 5x (Ctrl+V) | PASS |
| RT-3 | Long output + scroll wheel | PASS |
| RT-4 | Short chat prompt | PASS |
| RT-5 | Long chat prompt | PASS |

### Build Artifacts

- Installer: `kairo-desktop-0.1.2-setup.exe` (105.74 MB)
- SHA256: `C58DB9EADEF1D1A56E2EE2B65AE0433E6A884214347FE983B18256C3B131B32C`
- Tag: `v0.1.2` (pushed to `origin`)

## Commit History

| Hash | Description |
|------|-------------|
| `ba15732` | `fix: terminal+chat stability hotfix v0.1.2` |
| `b4895e1` | `docs(release): populate v0.1.2 installer SHA256` |
| `1017e89` | `docs: mark v0.1.2 as published with installer hash` |

## Total Quality Baseline

- 2243 non-sqlite assertions / 39 test files / 0 failures
- IPC channels: 49 (unchanged)
- Zero scope violations
