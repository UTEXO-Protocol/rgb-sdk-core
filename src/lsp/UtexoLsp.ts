/**
 * UtexoLsp — composed LSP flows (connect, channel wait, receive, send, pay
 * address, APay).
 *
 * Reconciled from the rgb-sdk-web and rgb-sdk-rn copies. Depends on
 * {@link ILspWallet}, not a concrete platform wallet, so it can live in core.
 *
 * Two things the shared domain types buy us over the previous copies:
 *   - RN's `raw(obj, camel, snake)` fallback helper is gone. It existed to read
 *     unmapped wire objects; bindings now normalize to `LightningChannel` /
 *     `LightningPayment` at their boundary.
 *   - Claim detection uses the canonical status vocabulary instead of
 *     `String(status).toUpperCase()` comparisons that differed per platform.
 */

import { UtexoLSPClient } from './UtexoLSPClient';
import { parseLightningAddress } from '../utils/lightning-address';
import { isSameLspHost, lnurlDiscoveryUrl } from '../utils/hosts';
import type { IUtexoLSPClient } from './IUtexoLSPClient';
import type { ILspWallet } from './ILspWallet';
import type { LightningSendRequest } from '../types/wallet-model';
import type {
  LightningChannel,
  ApayNewResponse,
  LightningAssetParam,
} from '../rln/model';
import { isClaimablePaymentStatus } from '../rln/status';
import {
  type LspPeer,
  type ChannelReadyInfo,
  type LspOnchainSendResponse,
  type LspLnParams,
  type LspLnurlpDiscovery,
  type ReceiveSettlementOutcome,
  peerUri,
} from './lsp-types';
import {
  LspAmountOutOfRangeError,
  LspChannelTimeoutError,
  LspLiquidityTimeoutError,
  LspSettlementError,
} from './LspErrors';
import {
  assertAmtMsatInSendableRange,
  assertValidAmtMsat,
} from './lnurlp-amount';
import { ValidationError } from '../errors';

// ── Shared wait options ───────────────────────────────────────────────────────

export interface WaitOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
  signal?: AbortSignal;
  onProgress?: (msg: string) => void;
  /**
   * Called at the start of each poll iteration, before the wallet check.
   * Use in regtest to mine a block per iteration: `onEachPoll: () => mine(1)`.
   */
  onEachPoll?: () => Promise<void>;
}

// ── receiveAsset ──────────────────────────────────────────────────────────────

export interface ReceiveAssetOptions {
  assetId: string;
  amountSats: number;
  amountRgb: number;
  /**
   * Applied to both the LN invoice and the RGB invoice — they are always kept
   * in sync; the LSP rejects the request if they differ. Default: 3600.
   */
  expirySeconds?: number;
}

export interface ReceiveAssetResult {
  /** BOLT11 created on this wallet. The LSP pays it once the RGB transfer settles. */
  lnInvoice: string;
  /** RGB invoice issued by the LSP. Give this to the on-chain sender. */
  rgbInvoice: string;
  mappingId: string;
}

// ── sendAsset ─────────────────────────────────────────────────────────────────

export interface SendAssetOptions {
  /** Recipient's on-chain RGB invoice. */
  rgbInvoice: string;
  ln?: LspLnParams;
}

export interface SendAssetResult extends LspOnchainSendResponse {
  sendResult: LightningSendRequest;
}

// ── payAddress ────────────────────────────────────────────────────────────────

export interface PayAddressOptions {
  /**
   * Lightning Address, e.g. `alice@lsp.utexo.com`. UMA's `$alice@lsp.utexo.com`
   * form is accepted too — the `$` is stripped before LNURL discovery.
   */
  address: string;
  amtMsat: number;
  asset?: LightningAssetParam;
}

// ── enableLightningAddress ────────────────────────────────────────────────────

export interface LightningAddressInfo {
  username: string;
  domain: string;
  /** Convenience: `username@domain`. */
  address: string;
  /** Hashes still available in the pool after registration — drive refills off this. */
  unusedHashes?: number;
  /** Hash index the next batch will start from. */
  nextIndexExpected?: number;
  /** LSP-suggested size for the next refill batch. */
  refillBatchSize?: number;
}

// ── claimPendingPayments ──────────────────────────────────────────────────────

export interface ClaimResult {
  paymentHash: string;
  claimed: boolean;
  error?: string;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_CHANNEL_TIMEOUT_MS = 120_000;
const DEFAULT_SETTLEMENT_TIMEOUT_MS = 60_000;
const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_EXPIRY_SECONDS = 3600;

// ── UtexoLsp ──────────────────────────────────────────────────────────────────

export class UtexoLsp {
  /** Direct access to the HTTP client for one-off LSP calls. */
  readonly http: IUtexoLSPClient;

  constructor(
    private readonly wallet: ILspWallet,
    readonly peer: LspPeer
  ) {
    this.http = new UtexoLSPClient({
      baseUrl: peer.baseUrl,
      bearerToken: peer.bearerToken,
      timeoutMs: peer.timeoutMs,
    });
  }

  // ── 1. Connection ───────────────────────────────────────────────────────────

  /**
   * Connect to the LSP peer over Lightning P2P.
   * Idempotent — swallows "already connected" errors from LDK.
   */
  async connect(): Promise<void> {
    try {
      await this.wallet.connectPeer(peerUri(this.peer));
    } catch (err) {
      if (
        !String((err as Error)?.message ?? '')
          .toLowerCase()
          .includes('already')
      )
        throw err;
    }
  }

  // ── 2. Channel readiness ────────────────────────────────────────────────────

  /**
   * Poll `listChannels` until a usable RGB channel for `assetId` exists with
   * the LSP peer. Call {@link connect} — and, in regtest, mine confirmations —
   * before this.
   *
   * @throws LspChannelTimeoutError when `timeoutMs` elapses first.
   */
  async waitForChannel(
    assetId: string,
    opts: WaitOptions = {}
  ): Promise<ChannelReadyInfo> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_CHANNEL_TIMEOUT_MS;
    const pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      this.checkAbort(opts.signal);
      if (opts.onEachPoll) await opts.onEachPoll();

      await this.wallet.syncWallet();
      const channels = await this.wallet.listChannels();
      const match = channels.find((c) => this.isUsableRgbChannel(c, assetId));

      opts.onProgress?.(
        `channels: ${channels.length} — RGB usable: ${match ? 'yes' : 'no'}`
      );

      if (match) return this.toChannelReadyInfo(match);

      await this.sleep(pollIntervalMs, opts.signal);
    }

    throw new LspChannelTimeoutError(assetId, timeoutMs);
  }

  // ── 3. Receive RGB over Lightning (POST /lightning_receive) ─────────────────

  /**
   * Lightning → RGB bridge:
   *   1. Creates a LN invoice on this wallet (`expirySeconds`).
   *   2. Registers it with the LSP → the LSP returns an RGB invoice.
   *   3. Returns both invoices.
   *
   * Share `rgbInvoice` with whoever will send the on-chain RGB; the LSP pays
   * `lnInvoice` once the RGB transfer settles.
   */
  async receiveAsset(opts: ReceiveAssetOptions): Promise<ReceiveAssetResult> {
    const expirySeconds = opts.expirySeconds ?? DEFAULT_EXPIRY_SECONDS;

    const createdAtMs = Date.now();
    const { lnInvoice } = await this.wallet.createLightningInvoice({
      amountSats: opts.amountSats,
      expirySeconds,
      asset: { assetId: opts.assetId, amount: opts.amountRgb },
    });

    // The LSP validates durationSeconds against the LN invoice's *remaining*
    // lifetime (EXPIRY_MATCH_TOLERANCE_SEC). Send the remaining lifetime, not
    // the full expiry.
    const elapsedSeconds = Math.round((Date.now() - createdAtMs) / 1000);
    const durationSeconds = Math.max(1, expirySeconds - elapsedSeconds);

    const lr = await this.http.lightningReceive({
      lnInvoice,
      rgb: { assetId: opts.assetId, durationSeconds },
    });

    return { lnInvoice, rgbInvoice: lr.rgbInvoice, mappingId: lr.mappingId };
  }

  // ── 4. Settlement polling ───────────────────────────────────────────────────

  /**
   * Poll the wallet until the inbound receive reaches a terminal state.
   *
   * @returns `'settled'` when status is Succeeded; `'timed_out'` when
   *   `timeoutMs` elapses without a terminal status (the LSP may still be
   *   processing).
   * @throws LspSettlementError when the status is Failed or Expired.
   */
  async awaitReceiveSettlement(
    lnInvoice: string,
    opts: WaitOptions = {}
  ): Promise<ReceiveSettlementOutcome> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_SETTLEMENT_TIMEOUT_MS;
    const pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      this.checkAbort(opts.signal);

      await this.wallet.syncWallet();
      // The node's own vocabulary — no TransferStatus fold in between.
      const status = await this.wallet.getLightningReceiveStatus(lnInvoice);

      opts.onProgress?.(status);

      if (status === 'Succeeded') return 'settled';
      if (
        status === 'Failed' ||
        status === 'Expired' ||
        status === 'Cancelled'
      ) {
        throw new LspSettlementError('ln_invoice', status);
      }

      await this.sleep(pollIntervalMs, opts.signal);
    }

    opts.onProgress?.('timeout');
    return 'timed_out';
  }

  // ── 5. Outbound liquidity wait ──────────────────────────────────────────────

  /**
   * Poll until outbound balance on the LSP channel reaches `minMsat`.
   * Use before paying to confirm routing capacity.
   *
   * @throws LspLiquidityTimeoutError when `timeoutMs` elapses first.
   */
  async waitForOutboundLiquidity(
    minMsat: number,
    opts: WaitOptions = {}
  ): Promise<void> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_CHANNEL_TIMEOUT_MS;
    const pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const started = Date.now();
    const deadline = started + timeoutMs;
    let lastOutbound = 0;

    while (Date.now() < deadline) {
      this.checkAbort(opts.signal);

      await this.wallet.syncWallet();
      const channels = await this.wallet.listChannels();
      const lspChan = channels.find(
        (c) => c.peerPubkey === this.peer.peerPubkey && this.isUsable(c)
      );
      const outbound = Number(
        lspChan?.outboundBalanceMsat ?? lspChan?.localBalanceMsat ?? 0
      );
      lastOutbound = outbound;

      opts.onProgress?.(`outbound: ${outbound} msat (need ${minMsat})`);

      if (outbound >= minMsat) return;

      await this.sleep(pollIntervalMs, opts.signal);
    }

    throw new LspLiquidityTimeoutError(
      minMsat,
      lastOutbound,
      Date.now() - started
    );
  }

  // ── 6. Send RGB via LSP (POST /onchain_send) ────────────────────────────────

  /**
   * RGB → Lightning bridge:
   *   1. Submits the recipient's on-chain RGB invoice to the LSP.
   *   2. The LSP returns a LN invoice.
   *   3. This wallet pays it immediately.
   *   4. The LSP executes `sendrgb` to the recipient once the LN payment settles.
   */
  async sendAsset(opts: SendAssetOptions): Promise<SendAssetResult> {
    const issued = await this.http.onchainSend({
      rgbInvoice: opts.rgbInvoice,
      ln: opts.ln,
    });
    const sendResult = await this.wallet.payLightningInvoice({
      lnInvoice: issued.lnInvoice,
    });
    return { ...issued, sendResult };
  }

  // ── 7. Pay a Lightning Address ──────────────────────────────────────────────

  /**
   * Resolve a Lightning Address and pay it.
   *
   * Discovery is routed by the address's own domain:
   *   - hosted on this LSP → `resolveAddress`, which carries our bearer token,
   *     timeouts and host rewriting (e.g. the Android emulator's `10.0.2.2`)
   *   - hosted anywhere else → plain LNURL discovery against that domain, with
   *     no LSP credentials attached
   *
   * Routing on the domain rather than trying the LSP first is deliberate: the
   * LSP answers `/.well-known/lnurlp/<username>` for its *own* users, so asking
   * it about a foreign address returns a valid invoice for the wrong person
   * whenever the usernames happen to collide.
   */
  async payAddress(
    opts: PayAddressOptions
  ): Promise<{ invoice: string; sendResult: LightningSendRequest }> {
    // Accepts both plain Lightning Addresses and UMA's `$user@host` form
    // (UMAD-01) — the `$` is stripped before LNURL discovery.
    assertValidAmtMsat(opts.amtMsat);
    const { username, domain } = parseLightningAddress(opts.address);

    const assetAmount = opts.asset
      ? (opts.asset.assetAmount ?? opts.asset.amount)
      : undefined;
    if (opts.asset && assetAmount == null)
      throw new Error(
        'payAddress: asset.assetAmount (or its alias asset.amount) is required when asset is set'
      );

    let invoice: string | undefined;

    if (isSameLspHost(domain, this.peer.baseUrl)) {
      // LNURL resolution is an idempotent GET; a freshly (re)started LSP can
      // 404 for a beat while its cron provisions the address account, so retry
      // before giving up. There is no second source for a local address —
      // surface the real error rather than a misleading fetch failure.
      // Amount / validation errors are client-side and must not be retried.
      let resolveErr: unknown;
      for (let attempt = 1; attempt <= 3 && !invoice; attempt++) {
        try {
          const cb = await this.http.resolveAddress(
            username,
            opts.amtMsat,
            opts.asset?.assetId,
            assetAmount
          );
          invoice = cb.pr;
        } catch (err) {
          resolveErr = err;
          if (
            err instanceof LspAmountOutOfRangeError ||
            err instanceof ValidationError
          ) {
            break;
          }
          if (attempt < 3) await new Promise((r) => setTimeout(r, 2000));
        }
      }
      if (!invoice) {
        throw resolveErr instanceof Error
          ? resolveErr
          : new Error(String(resolveErr));
      }
    } else {
      // Foreign host: plain LNURL, no LSP credentials. The callback it returns
      // is absolute and belongs to that host, so it is used as-is.
      const meta = (await fetch(lnurlDiscoveryUrl(domain, username)).then((r) =>
        r.json()
      )) as LspLnurlpDiscovery;
      if (!meta?.callback)
        throw new Error('Missing callback in LNURL response');

      assertAmtMsatInSendableRange(
        opts.amtMsat,
        meta.minSendable,
        meta.maxSendable
      );

      let url = `${meta.callback}${meta.callback.includes('?') ? '&' : '?'}amount=${opts.amtMsat}`;
      if (opts.asset?.assetId)
        url += `&asset_id=${encodeURIComponent(opts.asset.assetId)}`;
      if (assetAmount !== undefined) url += `&asset_amount=${assetAmount}`;

      const cb = (await fetch(url).then((r) => r.json())) as { pr: string };
      invoice = cb.pr;
    }

    if (!invoice) throw new Error('No invoice returned for Lightning Address');
    const sendResult = await this.wallet.payLightningInvoice({
      lnInvoice: invoice,
    });
    return { invoice, sendResult };
  }

  // ── 8. Async / offline receive (APay) ───────────────────────────────────────

  /**
   * Register the async-payment hash pool with this LSP and return the
   * auto-generated Lightning Address for this wallet's pubkey. Call once after
   * first unlock to enable offline receive.
   *
   * The LSP provisions the address account (and mints the username) for every
   * connected peer via its own cron, so the username already exists by the time
   * we register — no bootstrap call is needed. We therefore:
   *   1. Resolve username/domain via `getLightningAddressByPubkey`, polling
   *      briefly in case the LSP cron hasn't provisioned the account yet.
   *   2. Register ONE attested batch via `apayNewWithAddress` — the node signs
   *      the username+domain attestation (APay hash-substitution resistance;
   *      works for password and external signers alike).
   *
   * Important: the node's batch size equals the LSP's hash-pool cap, so a
   * single batch fills the pool. Issuing a second batch (e.g. a bootstrap
   * `apayNew` first) overflows it and the LSP rejects it with
   * `invalid_hash_batch`.
   */
  async enableLightningAddress(): Promise<LightningAddressInfo> {
    const nodeInfo = await this.wallet.getNodeInfo();
    const pubkey = String(nodeInfo?.pubkey ?? '');
    if (!pubkey) throw new Error('enableLightningAddress: wallet not unlocked');

    const lspInfo = await this.http.getInfo();
    const addr = await this.resolveLightningAddress(pubkey);
    const pool = await this.wallet.apayNewWithAddress(
      lspInfo.pubkey,
      addr.username,
      addr.domain
    );

    return {
      username: addr.username,
      domain: addr.domain,
      address: `${addr.username}@${addr.domain}`,
      unusedHashes: pool.unusedHashes,
      nextIndexExpected: pool.nextIndexExpected,
      refillBatchSize: pool.refillBatchSize,
    };
  }

  /**
   * Resolve this wallet's LSP-assigned Lightning Address, retrying while the
   * LSP cron provisions the account (`getLightningAddressByPubkey` 404s until
   * then).
   */
  private async resolveLightningAddress(
    pubkey: string,
    attempts = 8,
    delayMs = 2000
  ): Promise<{ username: string; domain: string }> {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        const addr = await this.http.getLightningAddressByPubkey(pubkey);
        if (addr?.username && addr?.domain) return addr;
      } catch (e) {
        lastErr = e;
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
    throw new Error(
      `enableLightningAddress: LSP did not provision an address for ${pubkey} ` +
        `(ensure the wallet is connected to the LSP). Last error: ${String(lastErr)}`
    );
  }

  /**
   * Top up the async-payment hash pool with a fresh signed batch.
   *
   * Call after {@link enableLightningAddress} when the pool runs low (see
   * {@link LightningAddressInfo.unusedHashes}). Each call registers a NEW
   * batch — the node advances its hash index, builds a new Merkle root and
   * signs it. Refills go straight through `apayNewWithAddress` so every batch
   * also carries the address attestation (the username already exists, so no
   * extra bootstrap is needed).
   */
  async refillHashPool(): Promise<ApayNewResponse> {
    const nodeInfo = await this.wallet.getNodeInfo();
    const pubkey = String(nodeInfo?.pubkey ?? '');
    if (!pubkey) throw new Error('refillHashPool: wallet not unlocked');

    const lspInfo = await this.http.getInfo();
    const addr = await this.http.getLightningAddressByPubkey(pubkey);

    return this.wallet.apayNewWithAddress(
      lspInfo.pubkey,
      addr.username,
      addr.domain
    );
  }

  // ── 9. Claim pending HODL payments ──────────────────────────────────────────

  /**
   * Find all claimable inbound payments and claim each via `claimHodlInvoice`.
   *
   * Uses the canonical status vocabulary — previously each SDK did its own
   * `String(status).toUpperCase()` comparison against different field names.
   */
  async claimPendingPayments(): Promise<ClaimResult[]> {
    const payments = await this.wallet.listPayments();
    const claimable = payments.filter((p) =>
      isClaimablePaymentStatus(p.status)
    );

    const results: ClaimResult[] = [];
    for (const p of claimable) {
      const hash = p.paymentHash;
      const preimage = p.preimage ?? '';
      try {
        await this.wallet.claimHodlInvoice(hash, preimage);
        results.push({ paymentHash: hash, claimed: true });
      } catch (err) {
        results.push({
          paymentHash: hash,
          claimed: false,
          error: (err as Error)?.message,
        });
      }
    }
    return results;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /** `isUsable` when the binding reports it, else fall back to `ready`. */
  private isUsable(c: LightningChannel): boolean {
    return Boolean(c.isUsable ?? c.ready);
  }

  private isUsableRgbChannel(c: LightningChannel, assetId: string): boolean {
    return c.assetId === assetId && this.isUsable(c);
  }

  private toChannelReadyInfo(c: LightningChannel): ChannelReadyInfo {
    return {
      channelId: c.channelId,
      peerPubkey: this.peer.peerPubkey,
      capacitySat: c.capacitySat,
      outboundBalanceMsat: Number(
        c.outboundBalanceMsat ?? c.localBalanceMsat ?? 0
      ),
      inboundBalanceMsat: Number(
        c.inboundBalanceMsat ?? c.remoteBalanceMsat ?? 0
      ),
    };
  }

  private checkAbort(signal?: AbortSignal): void {
    if (signal?.aborted) throw new Error('UtexoLsp: operation aborted');
  }

  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, ms);
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(t);
          reject(new Error('UtexoLsp: aborted'));
        },
        { once: true }
      );
    });
  }
}
