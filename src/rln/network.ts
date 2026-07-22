/**
 * Canonical network vocabulary for **binding output**.
 *
 * `BitcoinNetwork` is lowercase (`'regtest'`), but the bindings each spell the
 * same network differently — the same problem `status.ts` solves for invoice
 * and payment states:
 *   - UniFFI / RN  → PascalCase  (`'Regtest'`, `'SignetCustom'`)
 *   - wasm runtime → lowercase   (`'regtest'`)
 *
 * rn e2e (§6.0m) caught three methods returning the raw `'Regtest'` — the exact
 * cast-instead-of-normalize bug this migration exists to remove, invisible to
 * the type system because both sides are `string`.
 *
 * This is deliberately **not** `normalizeNetwork` from `utils/validation`.
 * That one validates *caller input*, where a mis-cased `'Mainnet'` is a config
 * typo that must fail loudly (a test pins that). This one normalizes *binding
 * output*, where casing carries no meaning and rejecting it would just move a
 * binding's spelling choice into the app.
 */

import type { BitcoinNetwork } from '../types/wallet-model';
import { ValidationError } from '../errors';

/**
 * Comparison keys are lowercased with separators stripped, so `'SIGNET_CUSTOM'`,
 * `'SignetCustom'` and `'signetcustom'` are one entry.
 *
 * `signetcustom` → `utexo`: the utexo network *is* a custom signet, and
 * `BitcoinNetwork` names it by its product name (see `NETWORK_MAP`).
 * `bitcoin` → `mainnet`: rust-bitcoin's own variant name leaks through some
 * paths.
 */
const NETWORK_ALIASES: Readonly<Record<string, BitcoinNetwork>> = {
  mainnet: 'mainnet',
  bitcoin: 'mainnet',
  testnet: 'testnet',
  testnet3: 'testnet',
  testnet4: 'testnet4',
  signet: 'signet',
  signetcustom: 'utexo',
  utexo: 'utexo',
  regtest: 'regtest',
};

/** Normalize any binding's network value to the canonical `BitcoinNetwork`. */
export function normalizeRlnNetwork(raw: unknown): BitcoinNetwork {
  const network = tryNormalizeRlnNetwork(raw);
  if (!network) {
    throw new ValidationError(
      `network: unknown value ${JSON.stringify(raw)} (expected one of ` +
        `${Object.keys(NETWORK_ALIASES).join(', ')})`,
      'network'
    );
  }
  return network;
}

/** Non-throwing variant — `null` instead of throwing on unknown input. */
export function tryNormalizeRlnNetwork(raw: unknown): BitcoinNetwork | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim().toLowerCase().replace(/[_\-\s]+/g, '');
  return NETWORK_ALIASES[key] ?? null;
}
