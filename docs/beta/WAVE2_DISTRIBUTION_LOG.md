# Wave 2 Distribution Log

Created: 2026-03-01 (D0)
Status: D5 CHECKPOINT COMPLETE — PENDING USER DECISION

## Artifact Hashes

| Artifact | File | Size | SHA256 |
|----------|------|------|--------|
| Installer | `kairo-desktop-0.1.0-setup.exe` | 105.71 MB | `F584B8DA00C98C6446594A13C03F42B3ED00C01A840F9B13005D78FD7EB28C93` |
| Beta ZIP | `kairo-beta-v0.1.0-2026-03-01_17-52-06.zip` | 105.69 MB | `74340F8DACC790C38BFE7D6B8750629A23D6626D8A14E9D5F3C8279F06221084` |

## Packaging Verification

| Check | Result |
|-------|--------|
| verify-packaging.ps1 | 14/14 PASS |
| create-beta-zip.ps1 | 8/8 PASS |
| Native modules (asar.unpacked) | better_sqlite3.node, pty.node, conpty.node, conpty_console_list.node |
| Unsigned installer | Expected (no code-signing cert) |

## ZIP Contents

- `kairo-desktop-0.1.0-setup.exe` (installer)
- `09_KAIRO_ONBOARDING_BETA.md` (15-min quickstart)
- `10_KAIRO_RELEASE_CHECKLIST.md` (release checklist)
- `11_KAIRO_BETA_EXECUTION_PLAN.md` (execution plan)
- `12_KAIRO_BETA_BUG_INTAKE_TEMPLATE.md` (bug report template)
- `SHA256SUMS.txt` (file hashes)
- `README-BETA.txt` (quick start + known limitations)

## Tester Control Table

| Tester ID | Machine ID | OS | API Quota Status | Date Sent | Date Evidence Received | Smoke % (C3) | Chat OK (C6) | Term OK (C7) | Edit OK (C8) | Status |
|-----------|------------|-----|-----------------|-----------|------------------------|--------------|--------------|--------------|--------------|--------|
| T-001 | *(pending)* | Windows 10/11 | *(pending)* | *(pending)* | *(pending)* | *(pending)* | *(pending)* | *(pending)* | *(pending)* | SLOT OPEN |
| T-002 | *(pending)* | Windows 10/11 | *(pending)* | *(pending)* | *(pending)* | *(pending)* | *(pending)* | *(pending)* | *(pending)* | SLOT OPEN |
| T-003 | *(pending)* | Windows 10/11 | *(pending)* | *(pending)* | *(pending)* | *(pending)* | *(pending)* | *(pending)* | *(pending)* | SLOT OPEN |
| T-004 | *(pending)* | Windows 10/11 | *(pending)* | *(pending)* | *(pending)* | *(pending)* | *(pending)* | *(pending)* | *(pending)* | SLOT OPEN |
| T-005 | *(pending)* | Windows 10/11 | *(pending)* | *(pending)* | *(pending)* | *(pending)* | *(pending)* | *(pending)* | *(pending)* | SLOT OPEN |

### Tester Requirements

- Windows 10 or 11 (x64)
- Node.js 20+ installed
- Gemini API key with **paid billing enabled** (free-tier has zero `generateContent` quota)
- Ability to run `collect-beta-evidence.ps1` and return output file

### Distribution Process

1. User recruits tester, fills row in table above
2. User sends beta ZIP + link to `EXTERNAL_TESTER_PACKET.md`
3. Tester installs, configures API key, runs smoke checklist
4. Tester runs `collect-beta-evidence.ps1`, sends evidence file back
5. User places evidence files in `Kairo_Desktop/`, runs `run-beta-day.ps1`
6. Update Date Evidence Received + C3/C6/C7/C8 columns

### Column Rules (Exit Criteria Mapping)

- `Smoke % (C3)`: porcentaje de checklist completado por tester.
- `Chat OK (C6)`: `YES/NO` (multi-turn chat funcional).
- `Term OK (C7)`: `YES/NO` (terminal execution funcional).
- `Edit OK (C8)`: `YES/NO` (apertura/edición/guardado en editor).

## Distribution History

| Date | Action | Details |
|------|--------|---------|
| 2026-03-01 | D0 Readiness | Artifacts built, verified, zipped. 5 tester slots created. |
| 2026-03-01 | D1 Pipeline | run-beta-day 7/7 PASS. validate-wave-inputs 9/10 (1 FAIL: 1 unique machine). 0 testers enrolled. 6 evidence files (all LABORATORIO). |
| 2026-03-01 | D2 Pipeline | run-beta-day 7/7 PASS. validate-wave-inputs 9/10 (1 FAIL: 1 unique machine). 0 testers enrolled. 7 evidence files (all LABORATORIO). No delta vs D1. |
| 2026-03-01 | D3 Midpoint | run-beta-day 7/7 PASS. validate-wave-inputs 9/10. 8 evidence files. 4/10 criteria. Midpoint doc created. |
| 2026-03-01 | D4 Pre-D5 | run-beta-day 7/7 PASS. validate-wave-inputs 9/10. 9 evidence files. D5 Decision Input created. |
| 2026-03-01 | D5 Checkpoint | run-beta-day 7/7 PASS. validate-wave-inputs 9/10. 10 evidence files. D5_DECISION.md updated. Veredicto: PENDING USER — CONDITIONAL GO or EXTEND. |
