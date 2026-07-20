import type { ReceiveStatus } from './lsp-types';

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

/** Settlement reached a terminal non-success state. */
export class LspSettlementError extends Error {
  readonly name = 'LspSettlementError';
  constructor(
    public readonly step: 'ln_invoice',
    public readonly status: ReceiveStatus
  ) {
    super(`Settlement ended with status "${status}" at step ${step}`);
  }
}
