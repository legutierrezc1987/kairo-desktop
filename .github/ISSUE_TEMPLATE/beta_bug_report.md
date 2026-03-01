---
name: Beta Bug Report
about: Report a bug found during Kairo Desktop closed beta testing
title: "[BETA BUG] "
labels: beta, bug
assignees: ''
---

## Reporter Info

- **Tester Name / ID**:
- **Date**: YYYY-MM-DD
- **App Version**: (e.g., 0.1.0)
- **OS**: (e.g., Windows 11 Pro 24H2, build 26200)
- **Install Method**: setup.exe / win-unpacked

## Priority (Reporter's Assessment)

- [ ] P0 - Critical (crash, data loss, security)
- [ ] P1 - High (feature non-functional)
- [ ] P2 - Medium (degraded but usable)
- [ ] P3 - Low (cosmetic, enhancement)

## Bug Summary

_One-line description of the issue._

## Steps to Reproduce

1.
2.
3.

## Expected Behavior

_What should have happened._

## Actual Behavior

_What actually happened. Include error messages verbatim._

## Screenshots / Logs

_Attach screenshots if visual. For errors, open DevTools with Ctrl+Shift+I and copy Console output._

## Environment Details

- **Gemini API Key**: Working / Not working / Not configured
- **Project folder**: (path, or "no project open")
- **Execution mode**: Supervised / Auto
- **Network**: Online / Offline / Intermittent

## Frequency

- [ ] Always reproducible
- [ ] Intermittent (roughly X out of Y attempts)
- [ ] Happened once

## Workaround

_If found, describe how to avoid the issue._

## Evidence Report

_Optional: attach the output of `collect-beta-evidence.ps1`._

```powershell
powershell -ExecutionPolicy Bypass -File scripts/qa/collect-beta-evidence.ps1
```
