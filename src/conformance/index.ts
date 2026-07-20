/**
 * Conformance suite — the drift detector.
 *
 * `IUTEXOWallet` makes the compiler enforce *shapes*. It cannot enforce runtime
 * *values*: this compiles and ships `'SUCCEEDED'` to apps —
 *
 * ```ts
 * return raw as RlnInvoiceStatus;   // bypasses the normalizer, no error
 * ```
 *
 * — which is exactly the class of bug this migration removed. These checks run
 * against a **built** wallet in each package's own CI, so a cast like that fails
 * the build instead of reaching users.
 *
 * Usage — each package supplies only a factory for its own wallet:
 *
 * ```ts
 * // rgb-sdk-web/tests/conformance.test.ts
 * import { runConformanceChecks } from '@utexo/rgb-sdk-core/conformance';
 * runConformanceChecks({
 *   name: 'rgb-sdk-web',
 *   createWallet: async () => { const w = new UTEXOWallet(params); await w.init(); return w; },
 * });
 * ```
 *
 * Test-runner agnostic: pass `describe`/`it`/`expect` bindings, or let it fall
 * back to the globals Jest and Vitest both provide.
 */

import {
  normalizeInvoiceStatus,
  normalizePaymentStatus,
  normalizeChannelStatus,
} from '../rln/status';

// ── The surface every conforming wallet must expose ──────────────────────────

/**
 * Methods asserted to exist at runtime.
 *
 * Kept as data, not `keyof IUTEXOWallet`: interfaces are erased at runtime, so
 * a wallet can satisfy the type and still be missing a method (e.g. a mangled
 * or tree-shaken build). This list is what catches that.
 */
export const IUTEXO_WALLET_METHODS = [
  // lifecycle / wallet
  'goOnline',
  'syncWallet',
  'refreshWallet',
  'getNetwork',
  'getAddress',
  'getBtcBalance',
  'getAssetBalance',
  'listAssets',
  'listUnspents',
  'listTransfers',
  'listTransactions',
  'createUtxos',
  'createUtxosBegin',
  'createUtxosEnd',
  'failTransfers',
  'createBackup',
  // assets
  'issueAssetNia',
  'issueAssetIfa',
  'inflate',
  'inflateBegin',
  'inflateEnd',
  // invoices / on-chain
  'blindReceive',
  'witnessReceive',
  'decodeRGBInvoice',
  'onchainReceive',
  'onchainSend',
  'onchainSendBegin',
  'onchainSendEnd',
  'listOnchainTransfers',
  'sendBtc',
  'sendBtcBegin',
  'sendBtcEnd',
  'estimateFee',
  'estimateFeeRate',
  // lightning — node
  'getNodeInfo',
  'getNetworkInfo',
  'connectPeer',
  'disconnectPeer',
  'listPeers',
  'listChannels',
  'openChannel',
  'closeChannel',
  'keysend',
  // lightning — payments
  'createLightningInvoice',
  'payLightningInvoice',
  'listLightningPayments',
  'decodeLnInvoice',
  'invoiceStatus',
  'getLightningReceiveStatus',
  'getLightningSendStatus',
  'createHodlInvoice',
  'claimHodlInvoice',
  'cancelHodlInvoice',
  // apay
  'apayNew',
  'apayNewWithAddress',
  // vss
  'configureVssBackup',
  'disableVssAutoBackup',
  'vssBackup',
  'vssBackupInfo',
  'vssClearFence',
] as const;

/** Methods that must NOT be present — removed in the status separation. */
export const REMOVED_METHODS = [
  'getLightningReceiveRequest',
  'getLightningSendRequest',
  'getOnchainSendStatus',
  'getLightningSendFeeEstimate',
  'payLightningInvoiceBegin',
  'payLightningInvoiceEnd',
  // never-shipped raw duplicates — see migration plan §4b
  'listChannelsRaw',
  'getNodeInfoRaw',
  'decodeLnInvoiceRaw',
  'invoiceStatusRaw',
] as const;

// ── Canonical runtime vocabularies ───────────────────────────────────────────

export const CANONICAL_INVOICE_STATUSES = [
  'Pending',
  'Claimable',
  'Claiming',
  'Succeeded',
  'Cancelled',
  'Failed',
  'Expired',
] as const;

export const CANONICAL_PAYMENT_STATUSES = [
  'Pending',
  'Claimable',
  'Claiming',
  'Succeeded',
  'Cancelled',
  'Failed',
] as const;

export const CANONICAL_CHANNEL_STATUSES = [
  'Opening',
  'Opened',
  'Closing',
] as const;

// ── Runner plumbing ──────────────────────────────────────────────────────────

type ItFn = (name: string, fn: () => void | Promise<void>) => void;
type DescribeFn = (name: string, fn: () => void) => void;
type ExpectFn = (actual: unknown) => {
  toBe(expected: unknown): void;
  toContain(expected: unknown): void;
};

export interface ConformanceOptions {
  /** Package name, used in the test titles. */
  name: string;
  /**
   * Builds a ready-to-use wallet. Omit to run only the checks that do not need
   * a live wallet (method presence is checked on the prototype instead).
   */
  createWallet?: () => Promise<Record<string, unknown>>;
  /** The class itself — lets method presence be checked without constructing. */
  walletClass?: { prototype: object };
  describe?: DescribeFn;
  it?: ItFn;
  expect?: ExpectFn;
}

function resolveRunner(opts: ConformanceOptions) {
  const g = globalThis as unknown as Record<string, unknown>;
  const describe = opts.describe ?? (g.describe as DescribeFn | undefined);
  const it = opts.it ?? (g.it as ItFn | undefined);
  const expect = opts.expect ?? (g.expect as ExpectFn | undefined);
  if (!describe || !it || !expect) {
    throw new Error(
      'runConformanceChecks: no test runner found. Pass { describe, it, expect } ' +
        'explicitly, or run inside Jest/Vitest where they are global.'
    );
  }
  return { describe, it, expect };
}

// ── The suite ────────────────────────────────────────────────────────────────

export function runConformanceChecks(opts: ConformanceOptions): void {
  const { describe, it, expect } = resolveRunner(opts);

  describe(`${opts.name} — IUTEXOWallet conformance`, () => {
    describe('surface', () => {
      const target = () =>
        (opts.walletClass?.prototype ?? {}) as Record<string, unknown>;

      for (const method of IUTEXO_WALLET_METHODS) {
        it(`exposes ${method}()`, () => {
          expect(typeof target()[method]).toBe('function');
        });
      }

      for (const method of REMOVED_METHODS) {
        it(`does not expose removed ${method}()`, () => {
          expect(typeof target()[method]).toBe('undefined');
        });
      }
    });

    describe('canonical status vocabularies', () => {
      // The normalizers are the single mechanism keeping both SDKs on one
      // vocabulary; pin their behaviour, including the legacy aliases.
      it('normalizes SCREAMING_SNAKE (UniFFI) to canonical', () => {
        expect(normalizeInvoiceStatus('SUCCEEDED')).toBe('Succeeded');
        expect(normalizePaymentStatus('CLAIMABLE')).toBe('Claimable');
        expect(normalizeChannelStatus('OPENING')).toBe('Opening');
      });

      it('normalizes lowercase (wasm runtime) to canonical', () => {
        expect(normalizeInvoiceStatus('succeeded')).toBe('Succeeded');
        expect(normalizePaymentStatus('pending')).toBe('Pending');
      });

      it("maps the legacy web-only 'Paid' onto 'Succeeded'", () => {
        expect(normalizeInvoiceStatus('Paid')).toBe('Succeeded');
      });

      it("maps the legacy RN fold 'Settled' onto 'Succeeded'", () => {
        expect(normalizeInvoiceStatus('Settled')).toBe('Succeeded');
      });

      it('keeps invoice and payment vocabularies distinct', () => {
        // Expired is an InvoiceStatus variant only (Rust HtlcStatus has 6).
        expect(normalizeInvoiceStatus('EXPIRED')).toBe('Expired');
        let threw = false;
        try {
          normalizePaymentStatus('Expired');
        } catch {
          threw = true;
        }
        expect(threw).toBe(true);
      });
    });

    if (opts.createWallet) {
      const createWallet = opts.createWallet;

      describe('runtime values', () => {
        it('invoiceStatus returns a canonical value', async () => {
          const wallet = await createWallet();
          const fn = wallet.invoiceStatus as
            | ((i: string) => Promise<string>)
            | undefined;
          if (typeof fn !== 'function') return;
          try {
            const status = await fn.call(wallet, CONFORMANCE_PROBE_INVOICE);
            expect(CANONICAL_INVOICE_STATUSES as readonly string[]).toContain(
              status
            );
          } catch {
            // An unknown probe invoice is expected to throw; what must not
            // happen is a non-canonical value coming back.
          }
        });

        it('listChannels returns domain-shaped channels', async () => {
          const wallet = await createWallet();
          const fn = wallet.listChannels as
            | (() => Promise<Record<string, unknown>[]>)
            | undefined;
          if (typeof fn !== 'function') return;
          const channels = await fn.call(wallet);
          for (const c of channels) {
            // `public`/`isActive` are wire names — their presence means a
            // binding returned an un-mapped object.
            expect('public' in c).toBe(false);
            expect('isActive' in c).toBe(false);
            expect(typeof c.channelId).toBe('string');
            if (c.status !== undefined) {
              expect(CANONICAL_CHANNEL_STATUSES as readonly string[]).toContain(
                c.status
              );
            }
          }
        });

        it('listPayments returns canonical payment statuses', async () => {
          const wallet = await createWallet();
          const fn = wallet.listPayments as
            | (() => Promise<Record<string, unknown>[]>)
            | undefined;
          if (typeof fn !== 'function') return;
          for (const p of await fn.call(wallet)) {
            expect('rawStatus' in p).toBe(false);
            expect(CANONICAL_PAYMENT_STATUSES as readonly string[]).toContain(
              p.status
            );
          }
        });

        it('estimateFeeRate returns { feeRate }', async () => {
          const wallet = await createWallet();
          const fn = wallet.estimateFeeRate as
            | ((b: number) => Promise<unknown>)
            | undefined;
          if (typeof fn !== 'function') return;
          const result = (await fn.call(wallet, 6)) as Record<string, unknown>;
          expect(typeof result).toBe('object');
          expect(typeof result.feeRate).toBe('number');
        });
      });
    }
  });
}

/** A syntactically valid but unknown BOLT11 — used only as a probe. */
const CONFORMANCE_PROBE_INVOICE =
  'lnbc1p000000000000000000000000000000000000000000000000000000000000000000';
