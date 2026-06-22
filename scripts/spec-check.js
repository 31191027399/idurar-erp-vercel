#!/usr/bin/env node
/**
 * scripts/spec-check.js
 *
 * Drift detector. Runs the generator into a temp directory and diffs against
 * the committed generated artifacts. Exits non-zero on any difference.
 *
 * Run via `npm run spec:check`. Designed for CI.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// Generated paths (must match gen-spec.js)
const GENERATED_DIRS = [
  path.join(ROOT, 'openapi/build'),
  path.join(ROOT, 'backend/src/controllers/appControllers/_generated'),
];

function main() {
  // Strategy: snapshot current generated file contents, regenerate, compare.
  // If anything changed, the committed artifacts are stale.

  const snapshot = new Map(); // relPath -> content
  for (const dir of GENERATED_DIRS) {
    if (!fs.existsSync(dir)) continue;
    walk(dir, (abs) => {
      const rel = path.relative(ROOT, abs);
      snapshot.set(rel, fs.readFileSync(abs, 'utf8'));
    });
  }

  // Regenerate
  try {
    execSync('node scripts/gen-spec.js', { cwd: ROOT, stdio: 'pipe' });
  } catch (err) {
    console.error('spec-check: generator failed to run.');
    console.error(err.stderr ? err.stderr.toString() : err.message);
    process.exit(1);
  }

  // Compare: build the post-regen snapshot
  const postSnapshot = new Map();
  for (const dir of GENERATED_DIRS) {
    if (!fs.existsSync(dir)) continue;
    walk(dir, (abs) => {
      const rel = path.relative(ROOT, abs);
      postSnapshot.set(rel, fs.readFileSync(abs, 'utf8'));
    });
  }

  // Diff
  const allKeys = new Set([...snapshot.keys(), ...postSnapshot.keys()]);
  const stale = [];
  const missing = [];
  const unexpected = [];

  for (const key of allKeys) {
    const before = snapshot.get(key);
    const after = postSnapshot.get(key);
    if (before === undefined) {
      unexpected.push(key); // file appeared after generation that wasn't committed
    } else if (after === undefined) {
      missing.push(key); // committed file was deleted by generation
    } else if (before !== after) {
      stale.push(key);
    }
  }

  const problems = [...stale, ...missing, ...unexpected];
  if (problems.length === 0) {
    console.log('spec-check: generated artifacts are up to date.');
    process.exit(0);
  }

  console.error('spec-check: generated artifacts are STALE.');
  console.error('');
  if (stale.length > 0) {
    console.error('  Modified (committed content differs from generated):');
    for (const f of stale) console.error('    - ' + f);
  }
  if (missing.length > 0) {
    console.error('  Missing (committed file no longer generated):');
    for (const f of missing) console.error('    - ' + f);
  }
  if (unexpected.length > 0) {
    console.error('  Untracked (generated file not committed):');
    for (const f of unexpected) console.error('    - ' + f);
  }
  console.error('');
  console.error('Run `npm run spec:gen` and commit the result.');
  process.exit(1);
}

function walk(dir, visit) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, visit);
    else if (entry.isFile()) visit(abs);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
