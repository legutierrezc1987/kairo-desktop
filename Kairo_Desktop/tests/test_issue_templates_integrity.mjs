/**
 * test_issue_templates_integrity.mjs - Verify GitHub issue templates
 *
 * Assertions:
 * - .github/ISSUE_TEMPLATE/ directory structure
 * - beta_bug_report.md has required sections (front matter, priority, repro, etc.)
 * - beta_feedback.md has required sections (category, suggestions, etc.)
 * - config.yml has required fields (blank_issues_enabled, contact_links)
 * - Cross-references between templates and docs
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strict as assert } from 'node:assert';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DESKTOP_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(DESKTOP_ROOT, '..');
const TEMPLATES = resolve(REPO_ROOT, '.github', 'ISSUE_TEMPLATE');

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

function readTemplate(name) {
  const full = resolve(TEMPLATES, name);
  if (!existsSync(full)) return null;
  return readFileSync(full, 'utf-8');
}

// -- T1: Directory structure --

console.log('\nT1: .github/ISSUE_TEMPLATE structure');

test('T1.01 - .github/ISSUE_TEMPLATE directory exists', () => {
  assert.ok(existsSync(TEMPLATES));
});

test('T1.02 - beta_bug_report.md exists', () => {
  assert.ok(existsSync(resolve(TEMPLATES, 'beta_bug_report.md')));
});

test('T1.03 - beta_feedback.md exists', () => {
  assert.ok(existsSync(resolve(TEMPLATES, 'beta_feedback.md')));
});

test('T1.04 - config.yml exists', () => {
  assert.ok(existsSync(resolve(TEMPLATES, 'config.yml')));
});

// -- T2: beta_bug_report.md content --

console.log('\nT2: beta_bug_report.md sections');

const bugReport = readTemplate('beta_bug_report.md');

test('T2.01 - has YAML front matter', () => {
  assert.ok(bugReport.startsWith('---'), 'must start with YAML front matter');
});

test('T2.02 - front matter has name field', () => {
  assert.ok(bugReport.includes('name:'));
});

test('T2.03 - front matter has about field', () => {
  assert.ok(bugReport.includes('about:'));
});

test('T2.04 - front matter has labels including beta', () => {
  assert.ok(bugReport.includes('labels:') && bugReport.includes('beta'));
});

test('T2.05 - front matter has title prefix', () => {
  assert.ok(bugReport.includes('title:') && bugReport.includes('BETA'));
});

test('T2.06 - has Reporter Info section', () => {
  assert.ok(bugReport.includes('Reporter'));
});

test('T2.07 - has Priority checkboxes', () => {
  assert.ok(bugReport.includes('P0') && bugReport.includes('P1'));
});

test('T2.08 - has P2 and P3 levels', () => {
  assert.ok(bugReport.includes('P2') && bugReport.includes('P3'));
});

test('T2.09 - has Steps to Reproduce', () => {
  assert.ok(bugReport.includes('Steps to Reproduce'));
});

test('T2.10 - has Expected Behavior', () => {
  assert.ok(bugReport.includes('Expected Behavior'));
});

test('T2.11 - has Actual Behavior', () => {
  assert.ok(bugReport.includes('Actual Behavior'));
});

test('T2.12 - has Screenshots / Logs', () => {
  assert.ok(bugReport.includes('Screenshots') || bugReport.includes('Logs'));
});

test('T2.13 - has Environment Details', () => {
  assert.ok(bugReport.includes('Environment'));
});

test('T2.14 - mentions Gemini API Key', () => {
  assert.ok(bugReport.includes('Gemini API'));
});

test('T2.15 - has Frequency section', () => {
  assert.ok(bugReport.includes('Frequency'));
});

test('T2.16 - has Workaround section', () => {
  assert.ok(bugReport.includes('Workaround'));
});

test('T2.17 - references collect-beta-evidence.ps1', () => {
  assert.ok(bugReport.includes('collect-beta-evidence'));
});

test('T2.18 - has checkbox syntax', () => {
  const checkboxCount = (bugReport.match(/- \[ \]/g) || []).length;
  assert.ok(checkboxCount >= 7, `only ${checkboxCount} checkboxes, expected >= 7`);
});

// -- T3: beta_feedback.md content --

console.log('\nT3: beta_feedback.md sections');

const feedback = readTemplate('beta_feedback.md');

test('T3.01 - has YAML front matter', () => {
  assert.ok(feedback.startsWith('---'));
});

test('T3.02 - front matter has name field', () => {
  assert.ok(feedback.includes('name:'));
});

test('T3.03 - front matter has labels including beta and feedback', () => {
  assert.ok(feedback.includes('beta') && feedback.includes('feedback'));
});

test('T3.04 - front matter has title prefix', () => {
  assert.ok(feedback.includes('title:') && feedback.includes('FEEDBACK'));
});

test('T3.05 - has Tester Info section', () => {
  assert.ok(feedback.includes('Tester'));
});

test('T3.06 - has Feedback Category section', () => {
  assert.ok(feedback.includes('Feedback Category'));
});

test('T3.07 - has category checkboxes', () => {
  assert.ok(feedback.includes('Usability') || feedback.includes('UX'));
  assert.ok(feedback.includes('Performance'));
  assert.ok(feedback.includes('Feature request'));
});

test('T3.08 - has Suggestions section', () => {
  assert.ok(feedback.includes('Suggestions'));
});

test('T3.09 - has What Worked Well', () => {
  assert.ok(feedback.includes('What Worked Well') || feedback.includes('worked well'));
});

test('T3.10 - has What Didn\'t Work Well', () => {
  assert.ok(feedback.includes("Didn't Work Well") || feedback.includes('Didn'));
});

test('T3.11 - has Would You Use question', () => {
  assert.ok(feedback.includes('Would You Use'));
});

test('T3.12 - has checkbox syntax', () => {
  const checkboxCount = (feedback.match(/- \[ \]/g) || []).length;
  assert.ok(checkboxCount >= 8, `only ${checkboxCount} checkboxes, expected >= 8`);
});

// -- T4: config.yml content --

console.log('\nT4: config.yml');

const config = readTemplate('config.yml');

test('T4.01 - has blank_issues_enabled field', () => {
  assert.ok(config.includes('blank_issues_enabled'));
});

test('T4.02 - blank_issues_enabled is false', () => {
  assert.ok(config.includes('blank_issues_enabled: false'));
});

test('T4.03 - has contact_links section', () => {
  assert.ok(config.includes('contact_links'));
});

test('T4.04 - has documentation link', () => {
  assert.ok(config.includes('Documentation') || config.includes('documentation'));
});

test('T4.05 - has onboarding link', () => {
  assert.ok(config.includes('Onboarding') || config.includes('onboarding') || config.includes('Beta'));
});

test('T4.06 - references docs URL', () => {
  assert.ok(config.includes('docs'));
});

// -- T5: Cross-references --

console.log('\nT5: Cross-references');

test('T5.01 - bug report mentions DevTools shortcut', () => {
  assert.ok(bugReport.includes('Ctrl+Shift+I'));
});

test('T5.02 - bug report has App Version field', () => {
  assert.ok(bugReport.includes('App Version'));
});

test('T5.03 - feedback has App Version field', () => {
  assert.ok(feedback.includes('App Version'));
});

test('T5.04 - bug report label includes bug', () => {
  assert.ok(bugReport.includes('bug'));
});

test('T5.05 - feedback label includes feedback', () => {
  assert.ok(feedback.includes('feedback'));
});

test('T5.06 - config references onboarding doc', () => {
  assert.ok(config.includes('09_KAIRO_ONBOARDING_BETA') || config.includes('Onboarding'));
});

// -- Summary --

console.log(`\n${'='.repeat(50)}`);
console.log(`Issue templates integrity: ${pass} PASS / ${fail} FAIL (${pass + fail} total)`);
if (fail > 0) process.exit(1);
