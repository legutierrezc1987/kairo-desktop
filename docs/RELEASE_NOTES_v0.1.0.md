# Kairo Desktop v0.1.0 — Release Notes (GA)

Date: 2026-03-01
Tag: `v0.1.0`
Status: General Availability
Promoted from: `v0.1.0-rc1` (no code changes)
Author: [Proposed: Claude]

## Overview

Kairo Desktop is an AI-powered development environment built on Electron, featuring multi-turn chat with Gemini models, an integrated terminal with command risk classification, a Monaco-based code editor, and persistent project memory.

This is the first General Availability release. It is identical to `v0.1.0-rc1` — no code, test, or configuration changes were made between RC and GA. Only documentation was updated to reflect GA status.

## Quality Baseline

| Metric | Value |
|--------|-------|
| Automated assertions | 2179 / 0 failures |
| Test files | 37 |
| IPC channels | 49 |
| TypeScript strict | exit 0 |
| electron-vite build | PASS |
| Packaging checks | 14/14 PASS |
| Beta pipeline runs | 6 (42/42 steps PASS) |
| Open P0 bugs | 0 |
| Open P1 bugs | 0 |
| Bugs discovered in beta | 0 |

## Features

### AI Chat (Gemini Integration)
- Multi-turn streaming conversation with Gemini 2.5 Flash (foreground) and Gemini 3 Flash Preview (background/fallback).
- Automatic session cut at 40 turns with memory archival.
- Rate-limit detection (429) with exponential backoff and jitter (1s/2s/4s, max 60s, 3 retries).
- 401/403 error discrimination with deterministic error messages.
- Account preflight validation (lightweight API ping on startup and account change).

### Terminal
- Integrated terminal via ConPTY (node-pty) with command risk classification.
- Three execution zones: GREEN (auto-execute), YELLOW (approval required), RED (blocked).
- Workspace sandbox enforcement — commands cannot escape project directory.
- Kill switch for emergency process termination.
- Chain injection prevention (`;`, `&&`, `||`, `|` detection in YELLOW commands).

### Code Editor
- Monaco-based editor with syntax highlighting.
- File explorer with lazy-loaded directory tree.
- Side-by-side diff viewer for impact preview.
- Undo manager with ephemeral LIFO stack (15 entries, 2MB cap).
- Content-based collision guard for safe undo operations.

### Project Management
- SQLite-backed project and session persistence (WAL mode, FK ON).
- Account management with safeStorage encryption for API keys.
- Configurable token budgets with real-time status bar.
- Session archival and recall from memory.

### Memory System
- Local Markdown memory provider (active).
- MCP provider interface (fallback to local — MCP package unresolved).
- Consolidation engine for memory compaction.
- Workspace-bound memory isolation per project.

### Settings
- Model selection (Gemini 2.5 Flash, 3 Flash Preview, 3.1 Pro Preview).
- Execution mode toggle (Supervised / Auto).
- Custom token budget configuration.
- Runtime model ID normalization for legacy entries.

## System Requirements

- Windows 10 (64-bit) or Windows 11
- Gemini API key with **paid billing enabled** (free-tier has zero quota)
- Internet connection for API calls

## Installation

1. Download `kairo-desktop-0.1.0-setup.exe` (105.71 MB).
2. Verify SHA256: `F584B8DA00C98C6446594A13C03F42B3ED00C01A840F9B13005D78FD7EB28C93`.
3. Run installer. Click "More info" then "Run anyway" on SmartScreen warning (unsigned).
4. Launch from desktop shortcut.
5. Open Settings, enter Gemini API key.
6. Create a project (select a workspace folder).

## Known Limitations

- **Unsigned installer**: Windows SmartScreen warning on every fresh install. No code-signing certificate.
- **Gemini free-tier**: Zero API quota. Paid billing required.
- **MCP provider**: Unresolved in npm registry. Local Markdown fallback active.
- **ConPTY noise**: "AttachConsole failed" message in terminal — cosmetic, not functional.
- **No auto-update**: Manual reinstall required for new versions.
- **Native module rebuild**: `better-sqlite3` and `node-pty` require ABI-matched rebuilds between Node.js test and Electron runtime contexts.
- **Monaco worker size**: Large TypeScript worker chunks may stress low-end devices.

## Accepted Gaps (from Beta)

These gaps were explicitly accepted by the Director via CONDITIONAL GO ratification. They are operational (no external testers), not engineering defects.

| Gap | Description | Risk | Mitigation |
|-----|-------------|------|------------|
| GAP-01 | No external smoke testing (C3) | Medium | 2179 automated assertions cover all subsystems |
| GAP-02 | Install verified on 1 machine only (C4) | Medium | Opportunistic: test on second machine if available |
| GAP-03 | Single machine tested (C5) | Medium | Same as GAP-02 |
| GAP-04 | No external chat validation (C6) | Low | Chat E2E test: 40 assertions + dev smoke |
| GAP-05 | No external terminal validation (C7) | Low | Terminal tests: 92 dedicated assertions |
| GAP-06 | No external editor validation (C8) | Low | Editor tests: 335 dedicated assertions |

## Architecture

- **Stack**: Electron 35 + React 19 + TypeScript 5.9 + electron-vite 4
- **Database**: SQLite (better-sqlite3) with WAL mode, schema v2
- **Terminal**: node-pty + ConPTY
- **Editor**: Monaco Editor
- **AI Provider**: Google Gemini (via @google/generative-ai SDK)
- **State**: Zustand (renderer), SQLite (main process)
- **IPC**: 49 channels with bridge-guard pattern

## Governance

- 28 frozen DECs (Decision Records)
- 8 closed debates (DEB-001 through DEB-008)
- Multi-agent tribunal: Codex (orchestrator), Claude (implementer), Gemini (auditor), User (director)
- PRD: `01_KAIRO_PRD_FINAL_v3-1.md`

## Version History

| Version | Date | Type | Notes |
|---------|------|------|-------|
| 0.1.0 | 2026-03-01 | General Availability | Promoted from RC1. Zero code changes. |
| 0.1.0-rc1 | 2026-03-01 | Release Candidate | First RC. CONDITIONAL GO from beta. |

---

_[Proposed: Claude] -- Release Notes v0.1.0 (GA)_
