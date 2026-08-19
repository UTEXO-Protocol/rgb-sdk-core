import type { RlnInvoiceStatus } from '../rln/status';
import type { LspSupportedAsset, ReceiveStatus } from './lsp-types';

/** `assetId`, `ticker` or `assetId (ticker)` — however much the LSP told us. */
function describeAsset(a: LspSupportedAsset): string {
  return a.ticker ? `${a.ticker} (${a.assetId})` : a.assetId;
}

/** No usable RGB channel appeared with the LSP peer before the timeout. */
export class LspChannelTimeoutError extends Error {
  readonly name = 'LspChannelTimeoutError';
  constructor(
    public readonly assetId: string,
    public readonly elapsedMs: number
  ) {
    super(
      `No usable RGB channel for ${assetId} after ${Math.round(elapsedMs / 1000)}s`
    );
  }
}

/**
 * Outbound liquidity on the LSP channel never reached the required minimum.
 *
 * Carries `lastOutboundMsat` so callers can tell "no liquidity at all" from
 * "close, but short".
 */
export class LspLiquidityTimeoutError extends Error {
  readonly name = 'LspLiquidityTimeoutError';
  constructor(
    public readonly minMsat: number,
    public readonly lastOutboundMsat: number,
    public readonly elapsedMs: number
  ) {
    super(
      `Outbound liquidity did not reach ${minMsat} msat after ` +
        `${Math.round(elapsedMs / 1000)}s (last seen: ${lastOutboundMsat} msat)`
    );
  }
}

/**
 * Settlement reached a terminal non-success state.
 *
 * `status` is the node's own invoice status (`RlnInvoiceStatus`) when the
 * failure came from polling the wallet, or the LSP's coarser `ReceiveStatus`
 * when it came from an LSP response. The two vocabularies are deliberately
 * kept separate rather than folded into one another.
 */
export class LspSettlementError extends Error {
  readonly name = 'LspSettlementError';
  constructor(
    public readonly step: 'ln_invoice',
    public readonly status: RlnInvoiceStatus | ReceiveStatus
  ) {
    super(`Settlement ended with status "${status}" at step ${step}`);
  }
}

/**
 * No asset this address accepts has enough local outbound liquidity to cover the
 * payment.
 *
 * Raised by `selectPaymentAsset` before anything is quoted, so no hash is spent
 * from the receiver's APay batch. `candidates` lists every asset that was
 * considered, with the local amount found for each — that is the difference
 * between "wrong asset" and "right asset, short balance".
 */
export class LspInsufficientAssetLiquidityError extends Error {
  readonly name = 'LspInsufficientAssetLiquidityError';
  constructor(
    public readonly required: number,
    public readonly candidates: { assetId: string; localAmount: number }[]
  ) {
    super(
      candidates.length
        ? `No accepted asset has ${required} spendable base units — ` +
            candidates.map((c) => `${c.assetId}: ${c.localAmount}`).join(', ')
        : `No accepted asset with a usable channel to pay ${required} base units`
    );
  }
}

/**
 * The address advertises nothing payable: no payout asset and no accepted asset.
 *
 * Means the receiver has no usable asset channel with the LSP yet (discovery
 * derives both fields from that channel), not that the request was malformed.
 */
export class LspNoPayableAssetError extends Error {
  readonly name = 'LspNoPayableAssetError';
  constructor(public readonly address: string) {
    super(
      `${address} advertises no payable asset — its receiver has no usable ` +
        `asset channel with the LSP yet`
    );
  }
}

/**
 * The asset asked for is not one this address can be paid in.
 *
 * `requested` is whatever the caller passed — a contract id or a ticker — and
 * `accepted` is the menu discovery advertised, so the message can name the
 * alternatives rather than just refusing.
 */
export class LspUnknownPayableAssetError extends Error {
  readonly name = 'LspUnknownPayableAssetError';
  constructor(
    public readonly requested: string,
    public readonly accepted: LspSupportedAsset[]
  ) {
    super(
      `"${requested}" is not payable to this address — accepted: ` +
        (accepted.map(describeAsset).join(', ') || 'none')
    );
  }
}

/**
 * More than one asset fits and the caller named none.
 *
 * Thrown rather than guessed: the invoice pins one asset for its lifetime, and
 * an external payer that holds the other one can only discover the mismatch by
 * failing to pay. Pass `asset` (ticker or contract id) to resolve it.
 */
export class LspAmbiguousPayableAssetError extends Error {
  readonly name = 'LspAmbiguousPayableAssetError';
  constructor(
    public readonly candidates: LspSupportedAsset[],
    public readonly prefer: 'payout' | 'convertible'
  ) {
    super(
      `${candidates.length} assets match prefer="${prefer}" — pass asset ` +
        `(ticker or contract id) to pick one of: ` +
        candidates.map(describeAsset).join(', ')
    );
  }
}

/**
 * LNURL-pay amount is outside the discovery-advertised sendable range.
 *
 * Thrown client-side before `/pay/callback` so callers get a clear range
 * instead of utexo-lsp's opaque `amount is out of acceptable range` 400.
 */
export class LspAmountOutOfRangeError extends Error {
  readonly name = 'LspAmountOutOfRangeError';
  constructor(
    public readonly amtMsat: number,
    public readonly minSendable: number,
    public readonly maxSendable: number
  ) {
    super(
      `amount ${amtMsat} msat is outside LNURL sendable range ` +
        `[${minSendable}, ${maxSendable}]`
    );
  }
}
