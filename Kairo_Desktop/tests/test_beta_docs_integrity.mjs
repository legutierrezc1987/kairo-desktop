/**
 * test_beta_docs_integrity.mjs — Verify documentation completeness
 *
 * Assertions:
 * - All required docs exist (08-13, INDEX.md, PROJECT_MEMORY)
 * - Each doc has required sections / keywords
 * - Cross-references between docs are consistent
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strict as assert } from 'node:assert';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const DOCS = resolve(REPO_ROOT, 'docs');

let pass = 0;
let fail = 0;

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    fail++;
    console.log(`  FAIL  ${name} — ${e.message}`);
  }
}

function readDoc(relPath) {
  const full = resolve(DOCS, relPath);
  if (!existsSync(full)) return null;
  return readFileSync(full, 'utf-8');
}

// ── T1: Doc files exist ──────────────────────────────────

console.log('\nT1: Required documentation files exist');

const requiredDocs = [
  '08_KAIRO_SETUP_GUIDE.md',
  '09_KAIRO_ONBOARDING_BETA.md',
  '10_KAIRO_RELEASE_CHECKLIST.md',
  '11_KAIRO_BETA_EXECUTION_PLAN.md',
  '12_KAIRO_BETA_BUG_INTAKE_TEMPLATE.md',
  '13_KAIRO_BETA_DAILY_TRIAGE.md',
  'INDEX.md',
  '00-governance/01_PROJECT_MEMORY.md',
];

requiredDocs.forEach((doc, i) => {
  test(`T1.${String(i + 1).padStart(2, '0')} — ${doc} exists`, () => {
    assert.ok(existsSync(resolve(DOCS, doc)), `${doc} not found`);
  });
});

// ── T2: Setup Guide (08) ─────────────────────────────────

console.log('\nT2: 08_KAIRO_SETUP_GUIDE.md sections');

const setup = readDoc('08_KAIRO_SETUP_GUIDE.md');

test('T2.01 — has Prerequisites section', () => {
  assert.ok(setup.includes('Prerequisites'), 'missing Prerequisites');
});

test('T2.02 — has Installation from Installer section', () => {
  assert.ok(setup.includes('Installation from Installer'), 'missing installer section');
});

test('T2.03 — mentions SmartScreen', () => {
  assert.ok(setup.includes('SmartScreen'), 'missing SmartScreen guidance');
});

test('T2.04 — mentions setup.exe', () => {
  assert.ok(setup.includes('setup.exe'), 'missing setup.exe reference');
});

test('T2.05 — has Troubleshooting section', () => {
  assert.ok(setup.includes('Troubleshooting'), 'missing troubleshooting');
});

test('T2.06 — mentions rebuild-native.js', () => {
  assert.ok(setup.includes('rebuild-native'), 'missing rebuild-native reference');
});

test('T2.07 — has ABI Dual-Rebuild table', () => {
  assert.ok(setup.includes('ABI Dual-Rebuild'), 'missing ABI workflow table');
});

// ── T3: Onboarding (09) ──────────────────────────────────

console.log('\nT3: 09_KAIRO_ONBOARDING_BETA.md sections');

const onboarding = readDoc('09_KAIRO_ONBOARDING_BETA.md');

test('T3.01 — has Quickstart section', () => {
  assert.ok(onboarding.includes('Quickstart'), 'missing quickstart');
});

test('T3.02 — mentions 15 minutes', () => {
  assert.ok(onboarding.includes('15'), 'missing time reference');
});

test('T3.03 — has Configure API Key section', () => {
  assert.ok(onboarding.includes('API Key') || onboarding.includes('API key'), 'missing API key section');
});

test('T3.04 — has Create Your First Project section', () => {
  assert.ok(onboarding.includes('First Project') || onboarding.includes('first project'), 'missing first project');
});

test('T3.05 — has Smoke Test Checklist', () => {
  assert.ok(onboarding.includes('Smoke Test Checklist'), 'missing smoke checklist');
});

test('T3.06 — has checkbox items', () => {
  const checkboxCount = (onboarding.match(/- \[ \]/g) || []).length;
  assert.ok(checkboxCount >= 15, `only ${checkboxCount} checkboxes, expected >= 15`);
});

test('T3.07 — has Known Limitations', () => {
  assert.ok(onboarding.includes('Known Limitations'), 'missing known limitations');
});

// ── T4: Release Checklist (10) ────────────────────────────

console.log('\nT4: 10_KAIRO_RELEASE_CHECKLIST.md sections');

const release = readDoc('10_KAIRO_RELEASE_CHECKLIST.md');

test('T4.01 — has GO/NO-GO matrix', () => {
  assert.ok(release.includes('GO/NO-GO') || release.includes('GO Criterion'), 'missing GO/NO-GO');
});

test('T4.02 — has Build Commands section', () => {
  assert.ok(release.includes('Build Commands'), 'missing build commands');
});

test('T4.03 — has Artifact Verification section', () => {
  assert.ok(release.includes('Artifact Verification'), 'missing artifact verification');
});

test('T4.04 — has SHA256 command', () => {
  assert.ok(release.includes('SHA256') || release.includes('Get-FileHash'), 'missing SHA256');
});

test('T4.05 — has Rollback Procedure', () => {
  assert.ok(release.includes('Rollback'), 'missing rollback');
});

test('T4.06 — has Version History', () => {
  assert.ok(release.includes('Version History'), 'missing version history');
});

test('T4.07 — has Security gate', () => {
  assert.ok(release.includes('Security'), 'missing security gate');
});

// ── T5: Beta Execution Plan (11) ──────────────────────────

console.log('\nT5: 11_KAIRO_BETA_EXECUTION_PLAN.md sections');

const betaPlan = readDoc('11_KAIRO_BETA_EXECUTION_PLAN.md');

test('T5.01 — has Beta Scope section', () => {
  assert.ok(betaPlan.includes('Beta Scope'), 'missing beta scope');
});

test('T5.02 — has Participant Selection', () => {
  assert.ok(betaPlan.includes('Participant'), 'missing participant selection');
});

test('T5.03 — has Timeline', () => {
  assert.ok(betaPlan.includes('Timeline'), 'missing timeline');
});

test('T5.04 — has Success Metrics', () => {
  assert.ok(betaPlan.includes('Success Metrics'), 'missing success metrics');
});

test('T5.05 — has Bug Classification', () => {
  assert.ok(betaPlan.includes('Bug Classification') || betaPlan.includes('P0'), 'missing bug classification');
});

test('T5.06 — has Exit Criteria', () => {
  assert.ok(betaPlan.includes('Exit Criteria'), 'missing exit criteria');
});

test('T5.07 — has Rollback Plan', () => {
  assert.ok(betaPlan.includes('Rollback'), 'missing rollback plan');
});

// ── T6: Bug Intake Template (12) ──────────────────────────

console.log('\nT6: 12_KAIRO_BETA_BUG_INTAKE_TEMPLATE.md sections');

const bugTemplate = readDoc('12_KAIRO_BETA_BUG_INTAKE_TEMPLATE.md');

test('T6.01 — has Reporter Info section', () => {
  assert.ok(bugTemplate.includes('Reporter'), 'missing reporter info');
});

test('T6.02 — has Steps to Reproduce', () => {
  assert.ok(bugTemplate.includes('Steps to Reproduce'), 'missing repro steps');
});

test('T6.03 — has Expected/Actual Behavior', () => {
  assert.ok(bugTemplate.includes('Expected Behavior'), 'missing expected behavior');
  assert.ok(bugTemplate.includes('Actual Behavior'), 'missing actual behavior');
});

test('T6.04 — has Priority checkboxes', () => {
  assert.ok(bugTemplate.includes('P0') && bugTemplate.includes('P1'), 'missing priority levels');
});

test('T6.05 — has Evidence Collection section', () => {
  assert.ok(bugTemplate.includes('Evidence Collection'), 'missing evidence collection');
});

test('T6.06 — references collect-beta-evidence.ps1', () => {
  assert.ok(bugTemplate.includes('collect-beta-evidence'), 'missing script reference');
});

test('T6.07 — has Triage Fields', () => {
  assert.ok(bugTemplate.includes('Triage Fields'), 'missing triage fields');
});

// ── T7: Daily Triage (13) ─────────────────────────────────

console.log('\nT7: 13_KAIRO_BETA_DAILY_TRIAGE.md sections');

const triage = readDoc('13_KAIRO_BETA_DAILY_TRIAGE.md');

test('T7.01 — has Triage Roles', () => {
  assert.ok(triage.includes('Triage Roles') || triage.includes('Triage Lead'), 'missing roles');
});

test('T7.02 — has Daily Checklist', () => {
  assert.ok(triage.includes('Daily Triage Checklist') || triage.includes('Intake Review'), 'missing checklist');
});

test('T7.03 — has Escalation Rules', () => {
  assert.ok(triage.includes('Escalation'), 'missing escalation rules');
});

test('T7.04 — has Beta Health Indicator', () => {
  assert.ok(triage.includes('Beta Health') || triage.includes('GREEN'), 'missing health indicator');
});

test('T7.05 — has Triage Log Template', () => {
  assert.ok(triage.includes('Triage Log'), 'missing log template');
});

test('T7.06 — has Beta Close Process', () => {
  assert.ok(triage.includes('Beta Close'), 'missing close process');
});

// ── T8: INDEX.md cross-references ─────────────────────────

console.log('\nT8: INDEX.md cross-references');

const index = readDoc('INDEX.md');

test('T8.01 — INDEX references 08_KAIRO_SETUP_GUIDE', () => {
  assert.ok(index.includes('08_KAIRO_SETUP_GUIDE'), 'missing setup guide ref');
});

test('T8.02 — INDEX references 09_KAIRO_ONBOARDING_BETA', () => {
  assert.ok(index.includes('09_KAIRO_ONBOARDING_BETA'), 'missing onboarding ref');
});

test('T8.03 — INDEX references 10_KAIRO_RELEASE_CHECKLIST', () => {
  assert.ok(index.includes('10_KAIRO_RELEASE_CHECKLIST'), 'missing release checklist ref');
});

test('T8.04 — INDEX references 11_KAIRO_BETA_EXECUTION_PLAN', () => {
  assert.ok(index.includes('11_KAIRO_BETA_EXECUTION_PLAN'), 'missing beta plan ref');
});

test('T8.05 — INDEX references 12_KAIRO_BETA_BUG_INTAKE_TEMPLATE', () => {
  assert.ok(index.includes('12_KAIRO_BETA_BUG_INTAKE_TEMPLATE'), 'missing bug template ref');
});

test('T8.06 — INDEX references 13_KAIRO_BETA_DAILY_TRIAGE', () => {
  assert.ok(index.includes('13_KAIRO_BETA_DAILY_TRIAGE'), 'missing triage ref');
});

// ── Summary ───────────────────────────────────────────────

console.log(`\n${'='.repeat(50)}`);
console.log(`Beta docs integrity: ${pass} PASS / ${fail} FAIL (${pass + fail} total)`);
if (fail > 0) process.exit(1);
