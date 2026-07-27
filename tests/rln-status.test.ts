import {
  normalizeInvoiceStatus,
  normalizePaymentStatus,
  normalizeChannelStatus,
  tryNormalizeInvoiceStatus,
  tryNormalizePaymentStatus,
  isTerminalPaymentStatus,
  isClaimablePaymentStatus,
  msatToSat,
  satToMsat,
  toNumber,
  toBigInt,
  mapAll,
  mapMaybe,
  ValidationError,
} from '../dist/index.mjs';

describe('normalizeInvoiceStatus', () => {
  // The three casings the bindings actually emit:
  //   UniFFI/RN → SCREAMING_SNAKE, wasm runtime → lowercase, Rust → PascalCase
  it.each([
    ['SUCCEEDED', 'Succeeded'],
    ['succeeded', 'Succeeded'],
    ['Succeeded', 'Succeeded'],
    ['PENDING', 'Pending'],
    ['pending', 'Pending'],
    ['EXPIRED', 'Expired'],
    ['expired', 'Expired'],
    ['CLAIMABLE', 'Claimable'],
    ['CLAIMING', 'Claiming'],
    ['CANCELLED', 'Cancelled'],
    ['FAILED', 'Failed'],
  ])('normalizes %s -> %s', (raw, expected) => {
    expect(normalizeInvoiceStatus(raw)).toBe(expected);
  });

  it('maps the legacy web-only "Paid" alias onto the real state Succeeded', () => {
    // 'Paid' never existed in the node — rgb-sdk-web invented it.
    expect(normalizeInvoiceStatus('Paid')).toBe('Succeeded');
    expect(normalizeInvoiceStatus('PAID')).toBe('Succeeded');
  });

  it('maps the legacy "Settled" fold onto Succeeded', () => {
    // rgb-sdk-rn folded SUCCEEDED -> 'Settled' (a TransferStatus value).
    expect(normalizeInvoiceStatus('Settled')).toBe('Succeeded');
  });

  it('accepts the American spelling "Canceled"', () => {
    expect(normalizeInvoiceStatus('Canceled')).toBe('Cancelled');
  });

  it('tolerates surrounding whitespace', () => {
    expect(normalizeInvoiceStatus('  SUCCEEDED  ')).toBe('Succeeded');
  });

  it.each([['Unknown'], [''], ['   '], [null], [undefined], [42], [{}]])(
    'throws ValidationError on %p',
    (raw) => {
      expect(() => normalizeInvoiceStatus(raw)).toThrow(ValidationError);
    }
  );
});

describe('normalizePaymentStatus', () => {
  it.each([
    ['SUCCEEDED', 'Succeeded'],
    ['succeeded', 'Succeeded'],
    ['Claimable', 'Claimable'],
    ['CLAIMING', 'Claiming'],
    ['CANCELLED', 'Cancelled'],
    ['FAILED', 'Failed'],
    ['PENDING', 'Pending'],
  ])('normalizes %s -> %s', (raw, expected) => {
    expect(normalizePaymentStatus(raw)).toBe(expected);
  });

  it('rejects Expired — it is an invoice state, not an HTLC state', () => {
    // Rust HtlcStatus has 6 variants; Expired belongs to InvoiceStatus only.
    expect(() => normalizePaymentStatus('Expired')).toThrow(ValidationError);
    expect(normalizeInvoiceStatus('Expired')).toBe('Expired');
  });
});

describe('normalizeChannelStatus', () => {
  it.each([
    ['OPENING', 'Opening'],
    ['OPENED', 'Opened'],
    ['CLOSING', 'Closing'],
    ['opened', 'Opened'],
  ])('normalizes %s -> %s', (raw, expected) => {
    expect(normalizeChannelStatus(raw)).toBe(expected);
  });
});

describe('try* variants', () => {
  it('return null instead of throwing on unknown input', () => {
    expect(tryNormalizeInvoiceStatus('nope')).toBeNull();
    expect(tryNormalizePaymentStatus(undefined)).toBeNull();
  });

  it('return the canonical value on valid input', () => {
    expect(tryNormalizeInvoiceStatus('SUCCEEDED')).toBe('Succeeded');
    expect(tryNormalizePaymentStatus('pending')).toBe('Pending');
  });
});

describe('status predicates', () => {
  it('identifies terminal states', () => {
    for (const s of ['Succeeded', 'Cancelled', 'Failed', 'Expired']) {
      expect(isTerminalPaymentStatus(s)).toBe(true);
    }
    for (const s of ['Pending', 'Claimable', 'Claiming']) {
      expect(isTerminalPaymentStatus(s)).toBe(false);
    }
  });

  it('identifies HODL claim states', () => {
    expect(isClaimablePaymentStatus('Claimable')).toBe(true);
    expect(isClaimablePaymentStatus('Claiming')).toBe(true);
    expect(isClaimablePaymentStatus('Succeeded')).toBe(false);
    expect(isClaimablePaymentStatus('Pending')).toBe(false);
  });
});

describe('unit helpers', () => {
  it('converts msat <-> sat', () => {
    expect(msatToSat(1_000)).toBe(1);
    expect(msatToSat(1_500)).toBe(1); // floor
    expect(msatToSat(0)).toBe(0);
    expect(satToMsat(1)).toBe(1_000);
  });

  it('accepts bigint (wasm emits bigint for u64)', () => {
    expect(msatToSat(5_000n)).toBe(5);
    expect(satToMsat(5n)).toBe(5_000);
  });

  it('coerces wire numerics, preserving nullish', () => {
    expect(toNumber(5n)).toBe(5);
    expect(toNumber(5)).toBe(5);
    expect(toNumber(null)).toBeUndefined();
    expect(toNumber(undefined)).toBeUndefined();
    expect(toBigInt(5)).toBe(5n);
    expect(toBigInt(null)).toBeUndefined();
  });
});

describe('mapper helpers', () => {
  const double = (n: number) => n * 2;

  it('mapAll maps a list', () => {
    expect(mapAll(double, [1, 2, 3])).toEqual([2, 4, 6]);
    expect(mapAll(double, [])).toEqual([]);
  });

  it('mapMaybe preserves nullish', () => {
    expect(mapMaybe(double, 2)).toBe(4);
    expect(mapMaybe(double, null)).toBeNull();
    expect(mapMaybe(double, undefined)).toBeNull();
  });
});
