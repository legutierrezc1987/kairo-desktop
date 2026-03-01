# KAIRO DESKTOP — Beta Bug Report Template

Version: 1.0
Date: 2026-03-01

## How to Use

Copy the template below and fill in all sections when reporting a bug during beta testing. Submit via the agreed channel (GitHub Issues, email, or shared doc).

---

## Bug Report

### Reporter Info

- **Name / ID**:
- **Date**:
- **App Version**: (e.g., 0.1.0 — check Settings or window title)
- **OS**: (e.g., Windows 11 Pro 24H2, build 26200)
- **Install Method**: (setup.exe / win-unpacked)

### Bug Summary

**One-line description**:

### Priority (Reporter's Assessment)

- [ ] P0 — Critical (crash, data loss, security)
- [ ] P1 — High (feature non-functional)
- [ ] P2 — Medium (degraded but usable)
- [ ] P3 — Low (cosmetic, enhancement)

### Steps to Reproduce

1.
2.
3.

### Expected Behavior

(What should have happened)

### Actual Behavior

(What actually happened — include error messages verbatim)

### Screenshots / Logs

(Attach screenshots if visual. For errors, open DevTools with Ctrl+Shift+I and copy Console output.)

### Environment Details

- **Gemini API Key**: Working / Not working / Not configured
- **Project folder**: (path, or "no project open")
- **Execution mode**: Supervised / Auto
- **Network**: Online / Offline / Intermittent

### Frequency

- [ ] Always reproducible
- [ ] Intermittent (roughly X out of Y attempts)
- [ ] Happened once

### Workaround

(If found, describe how to avoid the issue)

### Additional Context

(Any other relevant information: recent actions, error codes, stack traces)

---

## Evidence Collection (Optional)

If the triage team requests it, run the evidence collection script:

```powershell
# From Kairo_Desktop/ directory:
powershell -ExecutionPolicy Bypass -File scripts/qa/collect-beta-evidence.ps1
```

This generates a timestamped report with OS info, app version, artifact hashes, and log snapshots. Share the output file with the triage team.

---

## Triage Fields (Filled by Team)

| Field | Value |
|-------|-------|
| Triage priority | |
| Assigned to | |
| Sprint | |
| Root cause | |
| Fix commit | |
| Status | Open / In Progress / Fixed / Won't Fix / Duplicate |
