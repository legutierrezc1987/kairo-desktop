# KAIRO DESKTOP — Beta Onboarding Guide

Version: 1.0
Date: 2026-03-01
Author: [Proposed: Claude]

## Purpose

This guide walks a new beta tester through their first 15 minutes with Kairo Desktop: install, configure, create a project, and validate all core features.

## Quickstart (15 Minutes)

### Minute 0-2: Install

1. Run `kairo-desktop-0.1.0-setup.exe`.
2. Accept the SmartScreen warning ("More info" > "Run anyway") — the installer is unsigned (beta).
3. Complete the NSIS installer (defaults are fine).
4. Launch Kairo Desktop from the desktop shortcut.

### Minute 2-5: Configure API Key

1. Click the **gear icon** (Settings) in the top-right area.
2. In the **Accounts** section, enter your Gemini API key.
   - Obtain one free at [Google AI Studio](https://aistudio.google.com/apikey).
   - The key is encrypted locally via `safeStorage` (Windows DPAPI).
3. Close Settings.

### Minute 5-8: Create Your First Project

1. Click **"New Project"** in the project manager (left sidebar).
2. Select a folder on your machine — this becomes the project workspace.
   - All file operations are sandboxed to this folder.
   - Do NOT select a drive root (`C:\`, `D:\`) — this is blocked for safety.
3. Give it a name (e.g., "my-first-project").
4. The project loads: file explorer on the left, chat in the center, terminal at the bottom.

### Minute 8-12: Test Core Features

#### Chat (AI Conversation)

1. Type a message in the chat input (e.g., "Hello, what can you help me with?").
2. Press Enter or click Send.
3. Observe streaming response (text appears incrementally).
4. Send 2-3 more messages to verify multi-turn conversation.

#### Editor (File Editing)

1. In the file explorer (left panel), click on any file to open it.
2. The Monaco editor opens with syntax highlighting.
3. Make a small edit and save (Ctrl+S).
4. Verify the file is saved (re-open to confirm).

#### Terminal (Command Execution)

1. Click on the terminal panel (bottom area).
2. Type a safe command: `dir` (Windows) or `ls` (if using Git Bash shell).
3. Observe output appears in the terminal.
4. Try a supervised command (e.g., `npm install something`) — it should queue for approval in supervised mode.

#### Settings

1. Re-open Settings (gear icon).
2. Verify your API key is shown (masked).
3. Check execution mode toggle (Supervised / Auto).
4. Verify token budget display.

### Minute 12-15: Verify Advanced Features

#### Session Management

- After several chat messages, observe the status bar shows turn count and token usage.
- Sessions auto-cut at 40 turns (configurable via budget settings).

#### Memory (Consolidate / Recall)

- The **Consolidate** button (in chat panel) triggers session consolidation to memory.
- The **Recall** button fetches relevant context from previous sessions.
- Both operate on the local markdown memory provider by default.

#### Kill Switch

- The kill switch (emergency stop) terminates all running processes, clears pending commands, and archives the current session.
- Use only in emergencies — it resets terminal and chat state.

## First Project Workflow (Complete)

```
Install → Launch → Settings (API key) → New Project (folder)
  → Chat (test streaming) → Editor (open/edit file) → Terminal (run command)
  → Consolidate (save memory) → Close → Reopen → Recall (verify persistence)
```

## Smoke Test Checklist (Windows Clean Machine)

Use this checklist when validating on a fresh Windows installation.

### Pre-Install

- [ ] Windows 10 64-bit or Windows 11
- [ ] No prior Kairo installation
- [ ] Internet connection (for Gemini API calls)

### Install

- [ ] Run `kairo-desktop-0.1.0-setup.exe`
- [ ] SmartScreen warning appears and can be bypassed
- [ ] Installer completes without errors
- [ ] Desktop shortcut created
- [ ] Start Menu entry created

### Launch

- [ ] App launches from desktop shortcut
- [ ] No crash on first launch
- [ ] Main window renders (chat + terminal + sidebar visible)
- [ ] No DevTools console errors (Ctrl+Shift+I to check)

### Settings

- [ ] Settings panel opens (gear icon)
- [ ] API key can be entered and saved
- [ ] Execution mode toggle works (Supervised / Auto)
- [ ] Token budget is displayed

### Project

- [ ] New project can be created (folder picker works)
- [ ] Project loads: file explorer populates
- [ ] Project can be switched/deleted
- [ ] Drive root selection (`C:\`) is blocked

### Chat

- [ ] Message can be sent
- [ ] Streaming response appears incrementally
- [ ] Multi-turn conversation works (3+ turns)
- [ ] Error recovery: disconnect Wi-Fi mid-stream, reconnect, send new message
- [ ] Rate-limit indicator appears on 429 (amber bar)

### Editor

- [ ] File opens from explorer click
- [ ] Syntax highlighting works (try `.ts`, `.json`, `.md`)
- [ ] File saves correctly (Ctrl+S)
- [ ] Undo preview works (if changes were made via AI)

### Terminal

- [ ] Terminal panel is interactive
- [ ] `dir` or `echo hello` executes and shows output
- [ ] Supervised mode: yellow commands queue for approval
- [ ] Red commands (e.g., `rm -rf /`) are blocked
- [ ] Approval/rejection works on pending commands

### Memory

- [ ] Consolidate button triggers without error
- [ ] Recall button fetches context (may be empty on first use)
- [ ] Memory files created in project workspace under `.kairo/` or configured path

### Kill Switch

- [ ] Kill switch terminates running operations
- [ ] Chat and terminal recover after kill
- [ ] No data loss (session archived)

### Uninstall

- [ ] Uninstall via Windows Settings > Apps
- [ ] Desktop shortcut removed
- [ ] Start Menu entry removed
- [ ] App data in `%APPDATA%/kairo-desktop` may persist (by design)

## Known Limitations (Beta)

- **Gemini API quota**: Free-tier projects may have zero quota for `generateContent`. Enable billing in GCP or use a paid API key.
- **Unsigned installer**: Windows SmartScreen warning on every fresh install.
- **MCP provider**: External MCP (NotebookLM) is not yet available. Memory uses local markdown fallback.
- **ConPTY noise**: "AttachConsole failed" messages in terminal are cosmetic — not errors.
- **Monaco bundle size**: Editor may be slow to load on low-end machines (large worker bundles).
