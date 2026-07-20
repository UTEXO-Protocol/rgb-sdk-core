#!/usr/bin/env node
/**
 * RLN binding version lock.
 *
 * The shared contract only holds if both SDKs speak to the *same* node version.
 * Every past divergence between rgb-sdk-web and rgb-sdk-rn traces back to the
 * two adapting to the same Rust structs at different times.
 *
 * This check exists because a commit message is not a pin: `chore: bump RLN
 * bindings to v0.9.0-beta.3` was in the RN history while both actual pin points
 * still read `0.6.0-beta.2`.
 *
 * Usage:
 *   node scripts/check-rln-versions.mjs [--root ../]
 *
 * Exit 0 when every pin agrees, 1 otherwise. Wire it into each package's CI.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const rootArgIndex = process.argv.indexOf('--root');
const ROOT = resolve(
  rootArgIndex !== -1 ? process.argv[rootArgIndex + 1] : join(process.cwd(), '..')
);

/** Each pin point: where it lives and how to read the version out of it. */
const PINS = [
  {
    label: 'web · @utexo/rln-wasm',
    file: 'rgb-sdk-web/package.json',
    extract: (s) => JSON.parse(s).dependencies?.['@utexo/rln-wasm'],
  },
  {
    label: 'rn · iOS xcframework',
    file: 'rgb-sdk-rn/scripts/download-rln-bindings.js',
    extract: (s) => s.match(/^const VERSION\s*=\s*['"]([^'"]+)['"]/m)?.[1],
  },
  {
    label: 'rn · Android AAR',
    file: 'rgb-sdk-rn/android/build.gradle',
    extract: (s) =>
      s.match(/rgb-lightning-node-android:([0-9][^"')\s]*)/)?.[1],
  },
];

const found = [];
const missing = [];

for (const pin of PINS) {
  const path = join(ROOT, pin.file);
  if (!existsSync(path)) {
    missing.push(`${pin.label} — file not found: ${pin.file}`);
    continue;
  }
  let version;
  try {
    version = pin.extract(readFileSync(path, 'utf8'));
  } catch (err) {
    missing.push(`${pin.label} — could not parse ${pin.file}: ${err.message}`);
    continue;
  }
  if (!version) {
    missing.push(`${pin.label} — no version found in ${pin.file}`);
    continue;
  }
  found.push({ ...pin, version: version.replace(/^[\^~]/, '') });
}

const width = Math.max(...PINS.map((p) => p.label.length));
for (const p of found) {
  console.log(`  ${p.label.padEnd(width)}  ${p.version}`);
}
for (const m of missing) {
  console.log(`  ${m}`);
}

if (missing.length) {
  console.error('\n✗ RLN version check could not read every pin point.');
  process.exit(1);
}

const versions = [...new Set(found.map((p) => p.version))];
if (versions.length > 1) {
  console.error(
    `\n✗ RLN binding versions disagree: ${versions.join(' vs ')}\n\n` +
      '  Both SDKs must target the same node build — the shared domain types and\n' +
      '  the per-platform mappers are written against one wire contract. Bump every\n' +
      '  pin above in a single coordinated change, never one at a time.'
  );
  process.exit(1);
}

console.log(`\n✓ RLN binding versions agree: ${versions[0]}`);
