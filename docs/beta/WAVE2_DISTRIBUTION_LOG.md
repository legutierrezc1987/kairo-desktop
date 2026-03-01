# Wave 2 Distribution Log

Created: 2026-03-01 (D0)
Status: READY TO DISTRIBUTE

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

| Tester ID | Machine ID | OS | API Quota Status | Date Sent | Date Evidence Received | Smoke Checklist | Status |
|-----------|------------|-----|-----------------|-----------|----------------------|-----------------|--------|
| T-001 | *(pending)* | Windows 10/11 | *(pending)* | *(pending)* | *(pending)* | *(pending)* | SLOT OPEN |
| T-002 | *(pending)* | Windows 10/11 | *(pending)* | *(pending)* | *(pending)* | *(pending)* | SLOT OPEN |
| T-003 | *(pending)* | Windows 10/11 | *(pending)* | *(pending)* | *(pending)* | *(pending)* | SLOT OPEN |
| T-004 | *(pending)* | Windows 10/11 | *(pending)* | *(pending)* | *(pending)* | *(pending)* | SLOT OPEN |
| T-005 | *(pending)* | Windows 10/11 | *(pending)* | *(pending)* | *(pending)* | *(pending)* | SLOT OPEN |

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
6. Update Date Evidence Received + Smoke Checklist columns

## Distribution History

| Date | Action | Details |
|------|--------|---------|
| 2026-03-01 | D0 Readiness | Artifacts built, verified, zipped. 5 tester slots created. |
