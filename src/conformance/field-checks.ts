/**
 * Field verification helpers for e2e scenarios (MIGRATION-PLAN-v3.md §7a.2).
 *
 * The bug class this migration was about is a method that exists, resolves, and
 * is **wrong**. `expect(result).toBeDefined()` cannot see it. These helpers make
 * the alternative cheap enough that there is no excuse for the weak assertion.
 *
 * Deliberately runner-agnostic: they throw plain `Error`s rather than depending
 * on Jest/Vitest matchers, because the same checks must run under Playwright
 * (web e2e), a bare Node script (rn contract checks), and a flow-runner screen
 * inside the RN demo. Every runner treats a throw as a failure.
 *
 * ```ts
 * const info = await wallet.getNodeInfo();
 * report('getNodeInfo', info);
 * expectFields(info, {
 *   pubkey:        { type: 'string', pattern: /^[0-9a-f]{66}$/ },
 *   blockHeight:   { type: 'number', min: 1 },
 *   network:       { oneOf: ['regtest', 'testnet', 'mainnet', 'utexo'] },
 *   numChannels:   { type: 'number', optional: true },
 * });
 * expectNoWireKeys(info);
 * ```
 */

// ── Spec ─────────────────────────────────────────────────────────────────────

export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'bigint'
  | 'object'
  | 'array';

export interface FieldSpec {
  type?: FieldType;
  /** Field may be absent or `undefined`. Absent by default means failure. */
  optional?: boolean;
  /** Non-empty string, array, or object (at least one own key). */
  nonEmpty?: boolean;
  /** Numeric lower/upper bound, inclusive. Applies to `number` and `bigint`. */
  min?: number;
  max?: number;
  /** Exact set of permitted values — use for canonical status vocabularies. */
  oneOf?: readonly unknown[];
  /** String shape, e.g. a 64-char txid: `/^[0-9a-f]{64}$/`. */
  pattern?: RegExp;
  /** For arrays: the spec every element must satisfy. */
  each?: FieldSpec;
}

/** Field name → spec. Names may be dot paths (`balance.settled`). */
export type FieldsSpec = Record<string, FieldSpec>;

// ── Internals ────────────────────────────────────────────────────────────────

function typeOf(v: unknown): FieldType | 'undefined' | 'null' {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (Array.isArray(v)) return 'array';
  const t = typeof v;
  if (t === 'string' || t === 'number' || t === 'boolean' || t === 'bigint') {
    return t;
  }
  return 'object';
}

function readPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function preview(v: unknown): string {
  if (typeof v === 'bigint') return `${v}n`;
  try {
    const s = JSON.stringify(v);
    return s === undefined
      ? String(v)
      : s.length > 120
        ? `${s.slice(0, 120)}…`
        : s;
  } catch {
    return String(v);
  }
}

class FieldError extends Error {
  constructor(label: string, path: string, detail: string, actual: unknown) {
    super(`${label}.${path}: ${detail} (got ${preview(actual)})`);
    this.name = 'FieldError';
  }
}

function checkOne(
  label: string,
  path: string,
  value: unknown,
  spec: FieldSpec
): void {
  const actual = typeOf(value);

  if (actual === 'undefined' || actual === 'null') {
    if (spec.optional) return;
    throw new FieldError(label, path, 'is required but missing', value);
  }

  if (spec.type && actual !== spec.type) {
    throw new FieldError(label, path, `expected ${spec.type}`, value);
  }

  if (spec.nonEmpty) {
    const empty =
      (actual === 'string' && (value as string).length === 0) ||
      (actual === 'array' && (value as unknown[]).length === 0) ||
      (actual === 'object' &&
        Object.keys(value as Record<string, unknown>).length === 0);
    if (empty) throw new FieldError(label, path, 'must not be empty', value);
  }

  if (spec.min !== undefined || spec.max !== undefined) {
    if (actual !== 'number' && actual !== 'bigint') {
      throw new FieldError(label, path, 'min/max needs a numeric value', value);
    }
    const n = Number(value);
    if (spec.min !== undefined && n < spec.min) {
      throw new FieldError(label, path, `must be >= ${spec.min}`, value);
    }
    if (spec.max !== undefined && n > spec.max) {
      throw new FieldError(label, path, `must be <= ${spec.max}`, value);
    }
  }

  if (spec.oneOf && !spec.oneOf.includes(value)) {
    throw new FieldError(
      label,
      path,
      `must be one of ${spec.oneOf.map(preview).join(' | ')}`,
      value
    );
  }

  if (spec.pattern) {
    if (actual !== 'string') {
      throw new FieldError(label, path, 'pattern needs a string', value);
    }
    if (!spec.pattern.test(value as string)) {
      throw new FieldError(label, path, `must match ${spec.pattern}`, value);
    }
  }

  if (spec.each) {
    if (actual !== 'array') {
      throw new FieldError(label, path, '`each` needs an array', value);
    }
    (value as unknown[]).forEach((el, i) =>
      checkOne(label, `${path}[${i}]`, el, spec.each!)
    );
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Print a payload in full.
 *
 * Even where an assertion has not been written yet, the log makes an unexpected
 * shape visible in CI output — which is the minimum bar for every scenario.
 * Set `RGB_E2E_QUIET=1` to silence it without touching the scenarios.
 */
export function report(label: string, value: unknown): void {
  const g = globalThis as { process?: { env?: Record<string, string> } };
  if (g.process?.env?.RGB_E2E_QUIET) return;
  let body: string;
  try {
    body = JSON.stringify(
      value,
      (_k, v) => (typeof v === 'bigint' ? `${v}n` : v),
      2
    );
  } catch {
    body = String(value);
  }
  console.log(`\n── ${label} ──\n${body ?? String(value)}`);
}

/**
 * Assert every named field is present, typed, and within bounds.
 *
 * Returns the object so calls can be chained or inlined. Field names may be dot
 * paths, so nested shapes need no intermediate assertions:
 * `{ 'vanilla.settled': { type: 'number' } }`.
 *
 * Throws on the **first** failure, naming the field — a scenario that fails
 * should say which field was wrong, not print a diff of two large objects.
 */
export function expectFields<T>(
  value: T,
  spec: FieldsSpec,
  label = 'response'
): T {
  if (value === null || typeof value !== 'object') {
    throw new Error(
      `${label}: expected an object to check fields on (got ${preview(value)})`
    );
  }
  for (const [path, fieldSpec] of Object.entries(spec)) {
    checkOne(label, path, readPath(value, path), fieldSpec);
  }
  return value;
}

/** Every element of an array must satisfy the same spec. */
export function expectEach<T>(
  values: readonly T[],
  spec: FieldsSpec,
  label = 'items'
): readonly T[] {
  if (!Array.isArray(values)) {
    throw new Error(`${label}: expected an array (got ${preview(values)})`);
  }
  values.forEach((v, i) => expectFields(v, spec, `${label}[${i}]`));
  return values;
}

const SNAKE_CASE = /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/;

/**
 * Assert no wire-shaped keys survived the mapper.
 *
 * A binding whose raw output is passed through untouched is the single most
 * likely regression here, and it is invisible to `toBeDefined()`. Two modes:
 *
 *   - `expectNoWireKeys(obj)` — rejects **any** snake_case key, at any depth.
 *     Preferred: a fixed list cannot catch a *new* field that starts leaking.
 *   - `expectNoWireKeys(obj, ['public', 'isActive'])` — also rejects named
 *     camelCase wire keys that snake-case detection cannot see, such as
 *     `LightningChannel.public` (domain name: `isPublic`).
 */
export function expectNoWireKeys(
  value: unknown,
  extraKeys: readonly string[] = [],
  label = 'response'
): void {
  const seen = new Set<unknown>();

  const walk = (node: unknown, path: string): void => {
    if (node === null || typeof node !== 'object') return;
    if (seen.has(node)) return; // cycle guard
    seen.add(node);

    if (Array.isArray(node)) {
      node.forEach((el, i) => walk(el, `${path}[${i}]`));
      return;
    }

    for (const [key, child] of Object.entries(
      node as Record<string, unknown>
    )) {
      const here = path ? `${path}.${key}` : key;
      if (SNAKE_CASE.test(key)) {
        throw new Error(
          `${label}.${here}: wire-shaped (snake_case) key survived the mapper`
        );
      }
      if (extraKeys.includes(key)) {
        throw new Error(
          `${label}.${here}: wire key '${key}' survived the mapper`
        );
      }
      walk(child, here);
    }
  };

  walk(value, '');
}

/** 64-char lowercase hex — txids, payment hashes, preimages. */
export const HEX_32 = /^[0-9a-f]{64}$/;
/** 66-char lowercase hex — compressed secp256k1 pubkeys (node ids, peers). */
export const HEX_PUBKEY = /^[0-9a-f]{66}$/;
