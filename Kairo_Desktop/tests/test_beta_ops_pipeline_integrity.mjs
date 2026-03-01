/**
 * test_beta_ops_pipeline_integrity.mjs - Verify beta ops automation pipeline
 *
 * Assertions:
 * - run-beta-day.ps1 exists and has required steps
 * - classify-beta-issues.ps1 exists and has required sections
 * - docs/14_KAIRO_BETA_EXIT_CRITERIA.md exists and has required content
 * - docs/beta/BETA_BACKLOG.md exists (or will be created by classify script)
 * - docs/beta/daily/ directory structure
 * - Cross-references between scripts and docs
 * - .gitignore has beta daily exclusions (if applicable)
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strict as assert } from 'node:assert';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DESKTOP_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(DESKTOP_ROOT, '..');
const SCRIPTS_QA = resolve(DESKTOP_ROOT, 'scripts', 'qa');
const DOCS = resolve(REPO_ROOT, 'docs');
const BETA_DIR = resolve(DOCS, 'beta');

let pass = 0;
let fail = 0;

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    fail++;
    console.log(`  FAIL  ${name} -- ${e.message}`);
  }
}

// -- T1: run-beta-day.ps1 --

console.log('\nT1: run-beta-day.ps1 structure');

const runBetaDayPath = resolve(SCRIPTS_QA, 'run-beta-day.ps1');
const runBetaDaySrc = existsSync(runBetaDayPath) ? readFileSync(runBetaDayPath, 'utf-8') : '';

test('T1.01 - run-beta-day.ps1 exists', () => {
  assert.ok(existsSync(runBetaDayPath));
});

test('T1.02 - calls collect-beta-evidence', () => {
  assert.ok(runBetaDaySrc.includes('collect-beta-evidence'));
});

test('T1.03 - calls aggregate-beta-evidence', () => {
  assert.ok(runBetaDaySrc.includes('aggregate-beta-evidence'));
});

test('T1.04 - calls classify-beta-issues', () => {
  assert.ok(runBetaDaySrc.includes('classify-beta-issues'));
});

test('T1.05 - generates daily snapshot', () => {
  assert.ok(runBetaDaySrc.includes('daily') && runBetaDaySrc.includes('.md'));
});

test('T1.06 - uses date-based filename', () => {
  assert.ok(runBetaDaySrc.includes('yyyy-MM-dd'));
});

test('T1.07 - has pipeline results table', () => {
  assert.ok(runBetaDaySrc.includes('Pipeline Results') || runBetaDaySrc.includes('Step'));
});

test('T1.08 - has actions required section', () => {
  assert.ok(runBetaDaySrc.includes('Actions Required') || runBetaDaySrc.includes('Review'));
});

test('T1.09 - references triage doc', () => {
  assert.ok(runBetaDaySrc.includes('13_KAIRO_BETA_DAILY_TRIAGE') || runBetaDaySrc.includes('triage'));
});

test('T1.10 - has pass/fail summary', () => {
  assert.ok(runBetaDaySrc.includes('PASS') && runBetaDaySrc.includes('FAIL'));
});

// -- T2: classify-beta-issues.ps1 --

console.log('\nT2: classify-beta-issues.ps1 structure');

const classifyPath = resolve(SCRIPTS_QA, 'classify-beta-issues.ps1');
const classifySrc = existsSync(classifyPath) ? readFileSync(classifyPath, 'utf-8') : '';

test('T2.01 - classify-beta-issues.ps1 exists', () => {
  assert.ok(existsSync(classifyPath));
});

test('T2.02 - scans issues directory', () => {
  assert.ok(classifySrc.includes('issues'));
});

test('T2.03 - classifies P0 priority', () => {
  assert.ok(classifySrc.includes('P0'));
});

test('T2.04 - classifies P1 priority', () => {
  assert.ok(classifySrc.includes('P1'));
});

test('T2.05 - classifies P2 priority', () => {
  assert.ok(classifySrc.includes('P2'));
});

test('T2.06 - classifies P3 priority', () => {
  assert.ok(classifySrc.includes('P3'));
});

test('T2.07 - has keyword-based auto-classification', () => {
  assert.ok(classifySrc.includes('crash') || classifySrc.includes('data loss'));
});

test('T2.08 - parses Status field', () => {
  assert.ok(classifySrc.includes('Status:'));
});

test('T2.09 - generates BETA_BACKLOG.md', () => {
  assert.ok(classifySrc.includes('BETA_BACKLOG'));
});

test('T2.10 - has health assessment', () => {
  assert.ok(classifySrc.includes('GREEN') && classifySrc.includes('RED'));
});

test('T2.11 - has exit criteria status section', () => {
  assert.ok(classifySrc.includes('Exit Criteria'));
});

test('T2.12 - sorts by priority', () => {
  assert.ok(classifySrc.includes('Sort') || classifySrc.includes('sort'));
});

test('T2.13 - has summary table', () => {
  assert.ok(classifySrc.includes('| Priority'));
});

test('T2.14 - handles empty issues gracefully', () => {
  assert.ok(classifySrc.includes('No issue files') || classifySrc.includes('issueCount -eq 0'));
});

// -- T3: docs/14_KAIRO_BETA_EXIT_CRITERIA.md --

console.log('\nT3: 14_KAIRO_BETA_EXIT_CRITERIA.md content');

const exitCriteriaPath = resolve(DOCS, '14_KAIRO_BETA_EXIT_CRITERIA.md');
const exitCriteria = existsSync(exitCriteriaPath) ? readFileSync(exitCriteriaPath, 'utf-8') : '';

test('T3.01 - exit criteria doc exists', () => {
  assert.ok(existsSync(exitCriteriaPath));
});

test('T3.02 - has Decision Matrix section', () => {
  assert.ok(exitCriteria.includes('Decision Matrix'));
});

test('T3.03 - P0 threshold = 0', () => {
  assert.ok(exitCriteria.includes('P0') && exitCriteria.includes('= 0'));
});

test('T3.04 - P1 threshold <= 2', () => {
  assert.ok(exitCriteria.includes('<= 2'));
});

test('T3.05 - smoke pass rate >= 80%', () => {
  assert.ok(exitCriteria.includes('80%'));
});

test('T3.06 - install success rate = 100%', () => {
  assert.ok(exitCriteria.includes('100%'));
});

test('T3.07 - distinct machines >= 2', () => {
  assert.ok(exitCriteria.includes('>= 2'));
});

test('T3.08 - has GO decision section', () => {
  assert.ok(exitCriteria.includes('GO - Proceed'));
});

test('T3.09 - has CONDITIONAL GO section', () => {
  assert.ok(exitCriteria.includes('CONDITIONAL GO'));
});

test('T3.10 - has NO-GO section', () => {
  assert.ok(exitCriteria.includes('NO-GO'));
});

test('T3.11 - references Phase 8', () => {
  assert.ok(exitCriteria.includes('Phase 8'));
});

test('T3.12 - references 7.7 hotfix cycle', () => {
  assert.ok(exitCriteria.includes('7.7'));
});

test('T3.13 - has automated checks table', () => {
  assert.ok(exitCriteria.includes('Automated Checks'));
});

test('T3.14 - has manual checks table', () => {
  assert.ok(exitCriteria.includes('Manual Checks'));
});

test('T3.15 - references classify-beta-issues.ps1', () => {
  assert.ok(exitCriteria.includes('classify-beta-issues'));
});

test('T3.16 - references aggregate-beta-evidence.ps1', () => {
  assert.ok(exitCriteria.includes('aggregate-beta-evidence'));
});

test('T3.17 - has D5 mid-beta escalation', () => {
  assert.ok(exitCriteria.includes('D5'));
});

test('T3.18 - has D10 beta close', () => {
  assert.ok(exitCriteria.includes('D10'));
});

test('T3.19 - has Version History', () => {
  assert.ok(exitCriteria.includes('Version History'));
});

test('T3.20 - non-negotiable criteria defined', () => {
  assert.ok(exitCriteria.includes('non-negotiable') || exitCriteria.includes('Non-negotiable'));
});

// -- T4: Pipeline prerequisites --

console.log('\nT4: Pipeline prerequisites');

test('T4.01 - collect-beta-evidence.ps1 exists', () => {
  assert.ok(existsSync(resolve(SCRIPTS_QA, 'collect-beta-evidence.ps1')));
});

test('T4.02 - aggregate-beta-evidence.ps1 exists', () => {
  assert.ok(existsSync(resolve(SCRIPTS_QA, 'aggregate-beta-evidence.ps1')));
});

test('T4.03 - verify-packaging.ps1 exists', () => {
  assert.ok(existsSync(resolve(SCRIPTS_QA, 'verify-packaging.ps1')));
});

test('T4.04 - create-beta-zip.ps1 exists', () => {
  assert.ok(existsSync(resolve(SCRIPTS_QA, 'create-beta-zip.ps1')));
});

test('T4.05 - docs/beta directory exists', () => {
  assert.ok(existsSync(BETA_DIR));
});

test('T4.06 - BETA_DASHBOARD.md exists', () => {
  assert.ok(existsSync(resolve(BETA_DIR, 'BETA_DASHBOARD.md')));
});

// -- T5: Cross-references --

console.log('\nT5: Cross-references');

test('T5.01 - exit criteria references release checklist', () => {
  assert.ok(exitCriteria.includes('10_KAIRO_RELEASE_CHECKLIST'));
});

test('T5.02 - exit criteria references onboarding smoke checklist', () => {
  assert.ok(exitCriteria.includes('09_KAIRO_ONBOARDING_BETA'));
});

test('T5.03 - exit criteria references verify-packaging.ps1', () => {
  assert.ok(exitCriteria.includes('verify-packaging'));
});

test('T5.04 - exit criteria references run-beta-day.ps1', () => {
  assert.ok(exitCriteria.includes('run-beta-day'));
});

test('T5.05 - classify script references BETA_BACKLOG', () => {
  assert.ok(classifySrc.includes('BETA_BACKLOG'));
});

test('T5.06 - run-beta-day references dashboard', () => {
  assert.ok(runBetaDaySrc.includes('BETA_DASHBOARD'));
});

test('T5.07 - run-beta-day references backlog', () => {
  assert.ok(runBetaDaySrc.includes('BETA_BACKLOG'));
});

test('T5.08 - exit criteria has test suite count', () => {
  assert.ok(exitCriteria.includes('34') || exitCriteria.includes('test'));
});

// -- Summary --

console.log(`\n${'='.repeat(50)}`);
console.log(`Beta ops pipeline integrity: ${pass} PASS / ${fail} FAIL (${pass + fail} total)`);
if (fail > 0) process.exit(1);
