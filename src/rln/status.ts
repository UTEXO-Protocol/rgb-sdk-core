/**
 * Canonical Lightning status vocabulary.
 *
 * Source of truth: the Rust enums in `rgb-lightning-node`
 * (`src/uniffi_api/types.rs` — `InvoiceStatus`, `HtlcStatus`). Values are
 * PascalCase, matching the Rust variant names.
 *
 * The bindings each emit a different casing for the same states:
 *   - UniFFI / RN  → SCREAMING_SNAKE (`'SUCCEEDED'`)
 *   - wasm runtime → lowercase       (`'succeeded'`)
 *   - Rust / docs  → PascalCase      (`'Succeeded'`)
 *
 * Platforms MUST pass raw binding values through the normalizers below rather
 * than casting, so both SDKs return identical values for identical states.
 *
 * Note: these are deliberately NOT folded into `TransferStatus`.
 * `TransferStatus` is an RGB on-chain consignment vocabulary with no Lightning
 * meaning; folding loses the HODL states (`Claimable`/`Claiming`) and the
 * distinct failure causes (`Expired`/`Cancelled`/`Failed`).
 */

import { ValidationError } from '../errors';

/** Invoice lifecycle — mirrors Rust `InvoiceStatus` (7 variants). */
export type RlnInvoiceStatus =
  | 'Pending'
  | 'Claimable'
  | 'Claiming'
  | 'Succeeded'
  | 'Cancelled'
  | 'Failed'
  | 'Expired';

/** Payment/HTLC lifecycle — mirrors Rust `HtlcStatus` (6 variants, no Expired). */
export type RlnPaymentStatus =
  | 'Pending'
  | 'Claimable'
  | 'Claiming'
  | 'Succeeded'
  | 'Cancelled'
  | 'Failed';

/** Channel lifecycle — mirrors Rust `ChannelStatus`. */
export type RlnChannelStatus = 'Opening' | 'Opened' | 'Closing';

const INVOICE_STATUSES: readonly RlnInvoiceStatus[] = [
  'Pending',
  'Claimable',
  'Claiming',
  'Succeeded',
  'Cancelled',
  'Failed',
  'Expired',
];

const PAYMENT_STATUSES: readonly RlnPaymentStatus[] = [
  'Pending',
  'Claimable',
  'Claiming',
  'Succeeded',
  'Cancelled',
  'Failed',
];

const CHANNEL_STATUSES: readonly RlnChannelStatus[] = [
  'Opening',
  'Opened',
  'Closing',
];

/**
 * Legacy aliases accepted on input only.
 *
 * `Paid` was rgb-sdk-web's own invention — it never existed in the node. It
 * maps to the real state, `Succeeded`.
 */
const ALIASES: Record<string, string> = {
  paid: 'Succeeded',
  settled: 'Succeeded',
  success: 'Succeeded',
  canceled: 'Cancelled',
};

/** `'SUCCEEDED'` / `'succeeded'` / `'Succeeded'` / `'SEND_BTC'` → `'Succeeded'` / `'SendBtc'`. */
function toPascalCase(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function normalize<T extends string>(
  raw: unknown,
  allowed: readonly T[],
  label: string
): T {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new ValidationError(
      `${label}: expected a non-empty string, received ${JSON.stringify(raw)}`,
      label
    );
  }
  const aliased = ALIASES[raw.trim().toLowerCase()] ?? toPascalCase(raw);
  const match = allowed.find((v) => v === aliased);
  if (!match) {
    throw new ValidationError(
      `${label}: unknown value ${JSON.stringify(raw)} (expected one of ${allowed.join(', ')})`,
      label
    );
  }
  return match;
}

/** Normalize any binding's invoice status to the canonical vocabulary. */
export function normalizeInvoiceStatus(raw: unknown): RlnInvoiceStatus {
  return normalize(raw, INVOICE_STATUSES, 'invoiceStatus');
}

/** Normalize any binding's payment/HTLC status to the canonical vocabulary. */
export function normalizePaymentStatus(raw: unknown): RlnPaymentStatus {
  return normalize(raw, PAYMENT_STATUSES, 'paymentStatus');
}

/** Normalize any binding's channel status to the canonical vocabulary. */
export function normalizeChannelStatus(raw: unknown): RlnChannelStatus {
  return normalize(raw, CHANNEL_STATUSES, 'channelStatus');
}

/** Non-throwing variant — returns `null` instead of throwing on unknown input. */
export function tryNormalizeInvoiceStatus(
  raw: unknown
): RlnInvoiceStatus | null {
  try {
    return normalizeInvoiceStatus(raw);
  } catch {
    return null;
  }
}

/** Non-throwing variant — returns `null` instead of throwing on unknown input. */
export function tryNormalizePaymentStatus(
  raw: unknown
): RlnPaymentStatus | null {
  try {
    return normalizePaymentStatus(raw);
  } catch {
    return null;
  }
}

/** Non-throwing variant — returns `null` instead of throwing on unknown input. */
export function tryNormalizeChannelStatus(
  raw: unknown
): RlnChannelStatus | null {
  try {
    return normalizeChannelStatus(raw);
  } catch {
    return null;
  }
}

/** True for states where the invoice/payment can no longer change. */
export function isTerminalPaymentStatus(
  status: RlnPaymentStatus | RlnInvoiceStatus
): boolean {
  return (
    status === 'Succeeded' ||
    status === 'Cancelled' ||
    status === 'Failed' ||
    status === 'Expired'
  );
}

/** True for HODL states awaiting an explicit claim/cancel decision. */
export function isClaimablePaymentStatus(
  status: RlnPaymentStatus | RlnInvoiceStatus
): boolean {
  return status === 'Claimable' || status === 'Claiming';
}
