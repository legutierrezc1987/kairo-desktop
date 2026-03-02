# KAIRO DESKTOP - External Tester Packet [ARCHIVED]

Version: 1.0
Date: 2026-03-01

## Welcome

Thank you for testing Kairo Desktop! This document contains everything you need to install, test, and report feedback. Please allow 30-45 minutes for the full process.

## What You Need

- **Windows 10 (64-bit) or Windows 11**
- **A Gemini API key** with billing enabled (free-tier may have zero quota)
  - Get one at: https://aistudio.google.com/apikey
  - IMPORTANT: Enable billing in your Google Cloud project, otherwise chat will not work.
- **Internet connection** (for API calls)

## Step 1: Install (5 minutes)

1. Download the installer: `kairo-desktop-0.1.0-setup.exe`
2. Verify the installer hash (optional but recommended):
   ```powershell
   Get-FileHash kairo-desktop-0.1.0-setup.exe -Algorithm SHA256
   ```
   Expected: `F584B8DA00C98C6446594A13C03F42B3ED00C01A840F9B13005D78FD7EB28C93`
3. Run the installer.
4. **SmartScreen warning**: Click "More info" then "Run anyway". This is expected — the installer is unsigned (beta).
5. Complete the installation with default settings.
6. Launch Kairo Desktop from the desktop shortcut.

## Step 2: Configure (2 minutes)

1. Click the **gear icon** (top-right area) to open Settings.
2. In the **Accounts** section, paste your Gemini API key.
3. Close Settings.

## Step 3: Create a Project (2 minutes)

1. Click **"New Project"** in the left sidebar.
2. Select any folder on your machine as the workspace.
   - Do NOT select a drive root like `C:\` — this is blocked for safety.
   - Example: `C:\Users\YourName\Documents\kairo-test`
3. Give it a name (e.g., "test-project").

## Step 4: Test Core Features (15 minutes)

### Chat (AI Conversation)

1. Type a message: "Hello, what can you help me with?"
2. Press Enter. Watch for streaming response (text appears incrementally).
3. Send 2-3 more messages to test multi-turn conversation.
4. **Note**: If you get a rate-limit error (amber bar), wait 5 seconds and try again.

### Editor (File Editing)

1. In the file explorer (left panel), click on any file.
2. The editor opens with syntax highlighting.
3. Make a small edit and press Ctrl+S to save.

### Terminal (Command Execution)

1. Click on the terminal panel (bottom area).
2. Type: `dir` and press Enter.
3. Verify output appears.
4. Try: `echo hello world` — should execute immediately (green zone).

### Settings Verification

1. Re-open Settings (gear icon).
2. Confirm your API key is shown (masked).
3. Check the execution mode toggle (Supervised / Auto).

## Step 5: Collect Evidence (3 minutes)

Run the evidence collection script to generate your report:

```powershell
powershell -ExecutionPolicy Bypass -File "PATH_TO_KAIRO\Kairo_Desktop\scripts\qa\collect-beta-evidence.ps1"
```

Replace `PATH_TO_KAIRO` with the actual path where Kairo is cloned/extracted.

This creates a file called `beta-evidence-YYYY-MM-DD_HH-MM-SS.txt` in the `Kairo_Desktop` folder.

**Send this file back** to whoever gave you the beta.

## Step 6: Smoke Checklist

Please check off what worked and what didn't:

- [ ] Installer ran successfully
- [ ] App launched without crash
- [ ] Settings opened and API key saved
- [ ] Project created with folder picker
- [ ] Chat: sent message and received streaming response
- [ ] Chat: multi-turn conversation (3+ turns) worked
- [ ] Editor: opened a file with syntax highlighting
- [ ] Editor: saved a file (Ctrl+S)
- [ ] Terminal: executed `dir` or `echo` command
- [ ] Terminal: output appeared correctly
- [ ] Status bar shows turn count and token usage

**Send this checklist back** with your evidence file.

## Step 7: Report Bugs (if any)

If something doesn't work:

1. Describe what you did (steps to reproduce).
2. Describe what you expected.
3. Describe what actually happened.
4. Include a screenshot if possible.
5. Send the report to whoever gave you the beta.

### Bug Priority Guide

| Severity | Examples |
|----------|----------|
| Critical | App crashes, data loss, can't launch |
| High | Chat doesn't work, terminal broken, can't create project |
| Medium | Slow response, visual glitch, workaround exists |
| Low | Minor cosmetic issue, enhancement idea |

## Known Limitations

- **SmartScreen warning**: Expected on every fresh install (unsigned beta).
- **Gemini free-tier**: May have zero API quota. You MUST enable billing.
- **"AttachConsole failed"**: Cosmetic message in terminal — not an error.
- **No auto-update**: If a new version is released, you must reinstall manually.

## FAQ

**Q: Chat says "rate limit" or shows an amber bar.**
A: Wait 5-10 seconds and try again. If persistent, your API quota may be exhausted.

**Q: The installer was blocked by my antivirus.**
A: Add an exception for `kairo-desktop-0.1.0-setup.exe`. The installer is unsigned but safe.

**Q: I don't see any files in the editor.**
A: Make sure you selected a folder with files when creating the project. Empty folders will show an empty explorer.

**Q: Terminal commands are "queued for approval".**
A: Switch to Auto mode in Settings, or approve the command in the pending queue panel.

---

_Thank you for your time! Your feedback directly shapes the quality of Kairo Desktop._
