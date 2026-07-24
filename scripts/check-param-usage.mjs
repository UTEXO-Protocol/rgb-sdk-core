#!/usr/bin/env node
/**
 * Declared-but-dropped parameter check (MIGRATION-PLAN-v3 §6.0r).
 *
 * §2.5's rule is "a parameter may be optional only if every platform accepts
 * its absence AND honours its presence". The original sweep compared
 * signatures, which cannot see a body that ignores a field — `openChannel`
 * accepted `pushMsat` on web and threw it away for as long as it existed.
 *
 * Scope is deliberately narrow, because a wrong finding costs more than a
 * missed one:
 *
 *   - only types used as a **parameter** in the contract (`src/interfaces/`)
 *     are checked — response models are supersets by design (a platform not
 *     populating an optional field is not a defect);
 *   - a field counts as honoured if it is referenced by the platform **or by
 *     core itself** (the LSP client lives in core and serializes its own
 *     params).
 *
 *   node scripts/check-param-usage.mjs            # fail on unaccepted finds
 *   node scripts/check-param-usage.mjs --list     # print every find
 *
 * It remains a heuristic: it proves a field is never *mentioned*, not that it
 * is honoured. That is what the e2e suites are for.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CORE_SRC = path.resolve(here, '../src');
const CONTRACT_DIR = path.join(CORE_SRC, 'interfaces');
const IMPLS = {
  web: path.resolve(here, '../../rgb-sdk-web/src'),
  rn: path.resolve(here, '../../rgb-sdk-rn/src'),
};
/** Declaration-only trees: mentions here are the type, not a use of it. */
const DECLARATION_DIRS = [
  path.join(CORE_SRC, 'types'),
  path.join(CORE_SRC, 'interfaces'),
];

/** `Model.field` → why it is fine that the listed platform never reads it. */
const ALLOWED = {
  'SignMessageParams.seed': 'rn signs with the node key; §2.5',
  'VerifyMessageParams.accountXpub': 'meaningless on an RLN node; §2.5',
  'SendAssetEndRequestModel.signedPsbt': 'rn has no begin/end flows; §2.7a',
  'CreateUtxosEndRequestModel.signedPsbt': 'rn has no begin/end flows; §2.7a',
  'InflateEndRequestModel.signedPsbt': 'rn has no begin/end flows; §2.7a',
  'SendBtcEndRequestModel.signedPsbt': 'rn has no begin/end flows; §2.7a',
  'OnchainSendEndRequestModel.signedPsbt': 'rn has no begin/end flows; §2.7a',
};

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith('.ts') && !p.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const readAll = (files) =>
  files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');

const coreFiles = walk(CORE_SRC);
const coreText = readAll(coreFiles);
// Core's own implementation code — declarations excluded.
const coreImplText = readAll(
  coreFiles.filter((f) => !DECLARATION_DIRS.some((d) => f.startsWith(d)))
);
const implText = Object.fromEntries(
  Object.entries(IMPLS).map(([k, d]) => [k, readAll(walk(d))])
);

// ── which types are actually parameters on the contract? ─────────────────────
const contractText = readAll(walk(CONTRACT_DIR));
const paramTypes = new Set();
for (const [, type] of contractText.matchAll(
  /\w+\s*\??:\s*([A-Z]\w+)(?:<[^>]*>)?\s*[,)&]/g
)) {
  paramTypes.add(type);
}

const INTERFACE_RE = /export interface (\w+)\b[^{]*\{([^}]*)\}/g;
const FIELD_RE = /^\s*(?:\/\*\*[\s\S]*?\*\/\s*)?(\w+)\??:/gm;

const mentions = (text, field) =>
  new RegExp(
    `[.\\s({,\\[]${field}\\s*[,:)\\]}=?.]|\\b${field}\\b\\s*\\?\\?`
  ).test(text);

const findings = [];
for (const [, name, body] of coreText.matchAll(INTERFACE_RE)) {
  if (!paramTypes.has(name)) continue;
  const fields = [...body.matchAll(FIELD_RE)].map((m) => m[1]);
  for (const field of fields) {
    if (mentions(coreImplText, field)) continue; // core honours it for everyone
    for (const [platform, text] of Object.entries(implText)) {
      if (mentions(text, field)) continue;
      const key = `${name}.${field}`;
      findings.push({ key, platform, allowed: ALLOWED[key] });
    }
  }
}

const unexpected = findings.filter((f) => !f.allowed);

if (process.argv.includes('--list')) {
  console.log(`checked ${paramTypes.size} parameter types`);
  for (const f of findings) {
    console.log(
      `${f.allowed ? '·' : '✗'} ${f.platform.padEnd(3)} ${f.key}` +
        (f.allowed ? `  (accepted: ${f.allowed})` : '')
    );
  }
}

if (unexpected.length === 0) {
  console.log(
    `✓ parameter usage — every contract parameter is referenced by both SDKs ` +
      `(${findings.length} accepted exception${findings.length === 1 ? '' : 's'})`
  );
  process.exit(0);
}

console.error(
  `✗ parameter usage — ${unexpected.length} declared field(s) never referenced ` +
    `by an implementation:\n`
);
for (const f of unexpected) console.error(`  ${f.platform}: ${f.key}`);
console.error(
  '\nEither honour the field in that platform, move it to a platform-local\n' +
    'extras type (core keeps the intersection — §6.0r), or delete it. Add to\n' +
    'ALLOWED only when the platform genuinely cannot honour it, with a reason.'
);
process.exit(1);
