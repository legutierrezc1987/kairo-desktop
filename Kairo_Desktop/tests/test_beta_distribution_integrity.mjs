/**
 * test_beta_distribution_integrity.mjs - Verify beta distribution assets
 *
 * Assertions:
 * - create-beta-zip.ps1 exists and has required sections
 * - aggregate-beta-evidence.ps1 exists and has required sections
 * - collect-beta-evidence.ps1 exists (prerequisite)
 * - verify-packaging.ps1 exists (prerequisite)
 * - package.json has beta:zip script
 * - .gitignore has beta QA exclusions
 * - docs/beta/BETA_DASHBOARD.md template exists
 * - Distribution docs referenced in beta zip are present
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strict as assert } from 'node:assert';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DESKTOP_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(DESKTOP_ROOT, '..');

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

// -- T1: create-beta-zip.ps1 structure --

console.log('\nT1: create-beta-zip.ps1');

const betaZipPath = resolve(DESKTOP_ROOT, 'scripts', 'qa', 'create-beta-zip.ps1');
const betaZipSrc = existsSync(betaZipPath) ? readFileSync(betaZipPath, 'utf-8') : '';

test('T1.01 - create-beta-zip.ps1 exists', () => {
  assert.ok(existsSync(betaZipPath));
});

test('T1.02 - searches for setup.exe', () => {
  assert.ok(betaZipSrc.includes('setup.exe') || betaZipSrc.includes('setup'));
});

test('T1.03 - computes SHA256', () => {
  assert.ok(betaZipSrc.includes('SHA256') || betaZipSrc.includes('Get-FileHash'));
});

test('T1.04 - creates ZIP archive', () => {
  assert.ok(betaZipSrc.includes('Compress-Archive'));
});

test('T1.05 - includes onboarding doc', () => {
  assert.ok(betaZipSrc.includes('09_KAIRO_ONBOARDING_BETA'));
});

test('T1.06 - includes bug template doc', () => {
  assert.ok(betaZipSrc.includes('12_KAIRO_BETA_BUG_INTAKE_TEMPLATE'));
});

test('T1.07 - includes release checklist doc', () => {
  assert.ok(betaZipSrc.includes('10_KAIRO_RELEASE_CHECKLIST'));
});

test('T1.08 - includes beta execution plan doc', () => {
  assert.ok(betaZipSrc.includes('11_KAIRO_BETA_EXECUTION_PLAN'));
});

test('T1.09 - generates README-BETA', () => {
  assert.ok(betaZipSrc.includes('README-BETA'));
});

test('T1.10 - generates SHA256SUMS.txt', () => {
  assert.ok(betaZipSrc.includes('SHA256SUMS'));
});

test('T1.11 - has pre-flight check (abort if no installer)', () => {
  assert.ok(betaZipSrc.includes('ABORT') || betaZipSrc.includes('exit 1'));
});

test('T1.12 - cleans up staging directory', () => {
  assert.ok(betaZipSrc.includes('staging') && betaZipSrc.includes('Remove-Item'));
});

// -- T2: aggregate-beta-evidence.ps1 structure --

console.log('\nT2: aggregate-beta-evidence.ps1');

const aggregatePath = resolve(DESKTOP_ROOT, 'scripts', 'qa', 'aggregate-beta-evidence.ps1');
const aggregateSrc = existsSync(aggregatePath) ? readFileSync(aggregatePath, 'utf-8') : '';

test('T2.01 - aggregate-beta-evidence.ps1 exists', () => {
  assert.ok(existsSync(aggregatePath));
});

test('T2.02 - scans for beta-evidence-*.txt files', () => {
  assert.ok(aggregateSrc.includes('beta-evidence-'));
});

test('T2.03 - writes BETA_DASHBOARD.md', () => {
  assert.ok(aggregateSrc.includes('BETA_DASHBOARD'));
});

test('T2.04 - parses machine name', () => {
  assert.ok(aggregateSrc.includes('Machine'));
});

test('T2.05 - parses OS version', () => {
  assert.ok(aggregateSrc.includes('OS'));
});

test('T2.06 - checks hash consistency', () => {
  assert.ok(aggregateSrc.includes('Hash Consistency') || aggregateSrc.includes('uniqueHashes'));
});

test('T2.07 - generates markdown table', () => {
  assert.ok(aggregateSrc.includes('| Machine'));
});

test('T2.08 - has Beta Health section', () => {
  assert.ok(aggregateSrc.includes('Beta Health'));
});

// -- T3: QA scripts prerequisite --

console.log('\nT3: QA scripts prerequisites');

test('T3.01 - collect-beta-evidence.ps1 exists', () => {
  assert.ok(existsSync(resolve(DESKTOP_ROOT, 'scripts', 'qa', 'collect-beta-evidence.ps1')));
});

test('T3.02 - verify-packaging.ps1 exists', () => {
  assert.ok(existsSync(resolve(DESKTOP_ROOT, 'scripts', 'qa', 'verify-packaging.ps1')));
});

// -- T4: package.json beta:zip script --

console.log('\nT4: package.json beta script');

const pkgPath = resolve(DESKTOP_ROOT, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

test('T4.01 - package.json exists', () => {
  assert.ok(existsSync(pkgPath));
});

test('T4.02 - beta:zip script exists', () => {
  assert.ok(pkg.scripts['beta:zip'], 'must have beta:zip script');
});

test('T4.03 - beta:zip calls create-beta-zip.ps1', () => {
  assert.ok(pkg.scripts['beta:zip'].includes('create-beta-zip'));
});

test('T4.04 - beta:zip uses PowerShell', () => {
  assert.ok(pkg.scripts['beta:zip'].includes('powershell'));
});

// -- T5: .gitignore beta exclusions --

console.log('\nT5: .gitignore beta exclusions');

const gitignorePath = resolve(REPO_ROOT, '.gitignore');
const gitignore = readFileSync(gitignorePath, 'utf-8');

test('T5.01 - .gitignore exists', () => {
  assert.ok(existsSync(gitignorePath));
});

test('T5.02 - excludes beta-evidence-*.txt', () => {
  assert.ok(gitignore.includes('beta-evidence-'));
});

test('T5.03 - excludes kairo-beta-*.zip', () => {
  assert.ok(gitignore.includes('kairo-beta-'));
});

test('T5.04 - excludes beta-staging/', () => {
  assert.ok(gitignore.includes('beta-staging'));
});

// -- T6: BETA_DASHBOARD.md template --

console.log('\nT6: BETA_DASHBOARD.md template');

const dashboardPath = resolve(REPO_ROOT, 'docs', 'beta', 'BETA_DASHBOARD.md');
const dashboardExists = existsSync(dashboardPath);

test('T6.01 - docs/beta/BETA_DASHBOARD.md exists', () => {
  assert.ok(dashboardExists);
});

if (dashboardExists) {
  const dashboard = readFileSync(dashboardPath, 'utf-8');

  test('T6.02 - has Beta Dashboard title', () => {
    assert.ok(dashboard.includes('Beta Dashboard'));
  });

  test('T6.03 - has Beta Health section', () => {
    assert.ok(dashboard.includes('Beta Health'));
  });

  test('T6.04 - has Evidence Reports metric', () => {
    assert.ok(dashboard.includes('Evidence Reports'));
  });

  test('T6.05 - references collect-beta-evidence.ps1', () => {
    assert.ok(dashboard.includes('collect-beta-evidence'));
  });

  test('T6.06 - has P0 Bugs field', () => {
    assert.ok(dashboard.includes('P0'));
  });

  test('T6.07 - has health status indicator', () => {
    assert.ok(dashboard.includes('GREEN') || dashboard.includes('AMBER') || dashboard.includes('RED'));
  });
}

// -- T7: Distribution docs exist --

console.log('\nT7: Distribution docs (required by beta zip)');

const distDocs = [
  '09_KAIRO_ONBOARDING_BETA.md',
  '10_KAIRO_RELEASE_CHECKLIST.md',
  '11_KAIRO_BETA_EXECUTION_PLAN.md',
  '12_KAIRO_BETA_BUG_INTAKE_TEMPLATE.md',
];

distDocs.forEach((doc, i) => {
  test(`T7.${String(i + 1).padStart(2, '0')} - ${doc} exists`, () => {
    assert.ok(existsSync(resolve(REPO_ROOT, 'docs', doc)), `${doc} not found`);
  });
});

// -- Summary --

console.log(`\n${'='.repeat(50)}`);
console.log(`Beta distribution integrity: ${pass} PASS / ${fail} FAIL (${pass + fail} total)`);
if (fail > 0) process.exit(1);
