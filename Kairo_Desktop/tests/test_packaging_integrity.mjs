/**
 * test_packaging_integrity.mjs — Verify build artifacts and packaging config
 *
 * Assertions:
 * - electron-builder.yml structure (npmRebuild, asarUnpack, win target)
 * - package.json scripts (build:win, build:unpack)
 * - rebuild-native.js script exists
 * - dist/ artifacts present (if built)
 * - Native .node file names expected
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strict as assert } from 'node:assert';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

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

function findRecursive(dir, filter) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findRecursive(full, filter));
    } else if (filter(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

// ── T1: electron-builder.yml ─────────────────────────────

console.log('\nT1: electron-builder.yml structure');

const ymlPath = join(ROOT, 'electron-builder.yml');
const yml = readFileSync(ymlPath, 'utf-8');

test('T1.01 — electron-builder.yml exists', () => {
  assert.ok(existsSync(ymlPath));
});

test('T1.02 — npmRebuild: false present', () => {
  assert.ok(yml.includes('npmRebuild: false'), 'must disable npm rebuild');
});

test('T1.03 — asarUnpack section exists', () => {
  assert.ok(yml.includes('asarUnpack'), 'must have asarUnpack');
});

test('T1.04 — asarUnpack includes better-sqlite3', () => {
  assert.ok(yml.includes('better-sqlite3'), 'better-sqlite3 must be unpacked');
});

test('T1.05 — asarUnpack includes node-pty', () => {
  assert.ok(yml.includes('node-pty'), 'node-pty must be unpacked');
});

test('T1.06 — win target defined', () => {
  assert.ok(yml.includes('target: nsis') || yml.includes('target:\n'), 'win target must be nsis');
});

test('T1.07 — arch x64 specified', () => {
  assert.ok(yml.includes('x64'), 'must target x64');
});

test('T1.08 — appId defined', () => {
  assert.ok(yml.includes('appId:'), 'must have appId');
});

test('T1.09 — productName defined', () => {
  assert.ok(yml.includes('productName:'), 'must have productName');
});

test('T1.10 — artifactName pattern', () => {
  assert.ok(yml.includes('artifactName:'), 'must have artifactName');
});

// ── T2: package.json scripts ──────────────────────────────

console.log('\nT2: package.json build scripts');

const pkgPath = join(ROOT, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

test('T2.01 — package.json exists', () => {
  assert.ok(existsSync(pkgPath));
});

test('T2.02 — build:win script exists', () => {
  assert.ok(pkg.scripts['build:win'], 'must have build:win');
});

test('T2.03 — build:win calls electron-builder --win', () => {
  assert.ok(pkg.scripts['build:win'].includes('electron-builder --win'));
});

test('T2.04 — build:unpack script exists', () => {
  assert.ok(pkg.scripts['build:unpack'], 'must have build:unpack');
});

test('T2.05 — build:unpack calls electron-builder --dir', () => {
  assert.ok(pkg.scripts['build:unpack'].includes('electron-builder --dir'));
});

test('T2.06 — build script includes typecheck', () => {
  assert.ok(pkg.scripts['build'].includes('typecheck'));
});

test('T2.07 — postinstall runs electron-builder install-app-deps', () => {
  assert.ok(pkg.scripts['postinstall'].includes('electron-builder install-app-deps'));
});

test('T2.08 — version is semver', () => {
  assert.ok(/^\d+\.\d+\.\d+/.test(pkg.version), `version ${pkg.version} must be semver`);
});

test('T2.09 — name is kebab-case', () => {
  assert.ok(/^[a-z][a-z0-9-]*$/.test(pkg.name), `name ${pkg.name} must be kebab-case`);
});

// ── T3: rebuild-native.js ─────────────────────────────────

console.log('\nT3: rebuild-native.js script');

const rebuildPath = join(ROOT, 'scripts', 'rebuild-native.js');
const rebuildSrc = readFileSync(rebuildPath, 'utf-8');

test('T3.01 — rebuild-native.js exists', () => {
  assert.ok(existsSync(rebuildPath));
});

test('T3.02 — patches winpty.gyp', () => {
  assert.ok(rebuildSrc.includes('winpty.gyp'), 'must reference winpty.gyp');
});

test('T3.03 — generates GenVersion.h', () => {
  assert.ok(rebuildSrc.includes('GenVersion.h'), 'must generate GenVersion.h');
});

test('T3.04 — uses SUBST drive', () => {
  assert.ok(rebuildSrc.includes('subst'), 'must use SUBST for spaceless path');
});

test('T3.05 — targets Electron runtime', () => {
  assert.ok(rebuildSrc.includes('--runtime=electron'), 'must target Electron ABI');
});

test('T3.06 — rebuilds better-sqlite3', () => {
  assert.ok(rebuildSrc.includes('better-sqlite3'), 'must rebuild better-sqlite3');
});

test('T3.07 — cleans up SUBST in finally', () => {
  assert.ok(rebuildSrc.includes('finally'), 'must clean up SUBST in finally block');
});

// ── T4: dist artifacts (conditional) ──────────────────────

console.log('\nT4: dist/ artifacts (conditional — requires prior build)');

const distDir = join(ROOT, 'dist');
const distExists = existsSync(distDir);

test('T4.01 — dist/ directory exists', () => {
  assert.ok(distExists, 'dist/ must exist (run npm run build:win first)');
});

if (distExists) {
  const setupFiles = readdirSync(distDir).filter(f => f.match(/kairo-desktop-.*-setup\.exe$/));

  test('T4.02 — setup.exe present', () => {
    assert.ok(setupFiles.length > 0, 'installer exe must exist');
  });

  if (setupFiles.length > 0) {
    const setupStat = statSync(join(distDir, setupFiles[0]));
    test('T4.03 — setup.exe > 50 MB', () => {
      assert.ok(setupStat.size > 50 * 1024 * 1024, `${Math.round(setupStat.size / 1024 / 1024)} MB`);
    });
  }

  const winUnpacked = join(distDir, 'win-unpacked');
  const winUnpackedExists = existsSync(winUnpacked);

  test('T4.04 — win-unpacked/ directory exists', () => {
    assert.ok(winUnpackedExists);
  });

  if (winUnpackedExists) {
    const exePath = join(winUnpacked, 'kairo-desktop.exe');
    test('T4.05 — kairo-desktop.exe exists', () => {
      assert.ok(existsSync(exePath));
    });

    const asarUnpacked = join(winUnpacked, 'resources', 'app.asar.unpacked');
    if (existsSync(asarUnpacked)) {
      const nodeFiles = findRecursive(asarUnpacked, n => n.endsWith('.node'));
      const nodeNames = nodeFiles.map(f => f.split(/[/\\]/).pop());

      test('T4.06 — native .node files found (>= 2)', () => {
        assert.ok(nodeFiles.length >= 2, `found ${nodeFiles.length}: ${nodeNames.join(', ')}`);
      });

      test('T4.07 — better_sqlite3.node present', () => {
        assert.ok(nodeNames.includes('better_sqlite3.node'));
      });

      test('T4.08 — pty.node present', () => {
        assert.ok(nodeNames.includes('pty.node'));
      });

      test('T4.09 — conpty.node present', () => {
        assert.ok(nodeNames.includes('conpty.node'));
      });

      test('T4.10 — conpty_console_list.node present', () => {
        assert.ok(nodeNames.includes('conpty_console_list.node'));
      });
    } else {
      test('T4.06 — app.asar.unpacked exists', () => {
        assert.fail('app.asar.unpacked not found');
      });
    }
  }
} else {
  console.log('  SKIP  dist/ not found — build artifacts not available');
}

// ── T5: QA scripts ────────────────────────────────────────

console.log('\nT5: QA scripts');

test('T5.01 — verify-packaging.ps1 exists', () => {
  assert.ok(existsSync(join(ROOT, 'scripts', 'qa', 'verify-packaging.ps1')));
});

test('T5.02 — collect-beta-evidence.ps1 exists', () => {
  assert.ok(existsSync(join(ROOT, 'scripts', 'qa', 'collect-beta-evidence.ps1')));
});

// ── Summary ───────────────────────────────────────────────

console.log(`\n${'='.repeat(50)}`);
console.log(`Packaging integrity: ${pass} PASS / ${fail} FAIL (${pass + fail} total)`);
if (fail > 0) process.exit(1);
