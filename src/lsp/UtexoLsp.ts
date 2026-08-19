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

import {
  UtexoLSPClient,
  mapApayProof,
  mapLnurlpDiscovery,
} from './UtexoLSPClient';
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
  type ApayInvoiceProof,
  type LspPeer,
  type ChannelReadyInfo,
  type LspOnchainSendResponse,
  type LspLnParams,
  type LspLnurlpCallbackWire,
  type LspLnurlpDiscovery,
  type LspLnurlpDiscoveryWire,
  type LspSupportedAsset,
  type ReceiveSettlementOutcome,
  peerUri,
} from './lsp-types';
import {
  LspAmbiguousPayableAssetError,
  LspAmountOutOfRangeError,
  LspChannelTimeoutError,
  LspInsufficientAssetLiquidityError,
  LspLiquidityTimeoutError,
  LspNoPayableAssetError,
  LspSettlementError,
  LspUnknownPayableAssetError,
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
  /** What you are paid over Lightning — the only asset id this call needs. */
  assetId: string;
  amountSats: number;
  amountRgb: number;
  /**
   * Applied to both the LN invoice and the RGB invoice — they are always kept
   * in sync; the LSP rejects the request if they differ. Default: 3600.
   */
  expirySeconds?: number;
  /**
   * Which asset the **on-chain sender** pays in.
   *
   * `'convertible'` (default) lets the LSP issue the RGB invoice in the asset it
   * accepts and converts 1:1 to `assetId` — typically the canonical contract a
   * sender already holds, rather than the LSP's own Lightning-side asset. The
   * LSP resolves it from its own `CONVERTIBLE_PAIRS`, so its contract id never
   * has to be configured here; the resolved value comes back as
   * {@link ReceiveAssetResult.onchainAssetId}. With no pair declared this is
   * identical to `'payout'`.
   *
   * `'payout'` asks for `assetId` on both legs — one asset end to end, and the
   * only form older LSPs accept.
   */
  onchainAsset?: 'convertible' | 'payout';
}

export interface ReceiveAssetResult {
  /** BOLT11 created on this wallet. The LSP pays it once the RGB transfer settles. */
  lnInvoice: string;
  /** RGB invoice issued by the LSP. Give this to the on-chain sender. */
  rgbInvoice: string;
  mappingId: string;
  /**
   * The asset the on-chain sender must send, as resolved by the LSP. Absent on
   * an LSP that predates the field — the RGB invoice itself remains
   * authoritative either way.
   */
  onchainAssetId?: string;
  /** `true` when the two legs differ, i.e. the LSP converts the pair 1:1. */
  converted: boolean;
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

/**
 * Asset leg of a Lightning Address payment.
 *
 * Widens {@link LightningAssetParam} in one way: `assetId` may be omitted, which
 * asks the SDK to pick it — see {@link UtexoLsp.selectPaymentAsset}.
 */
export interface PayAddressAssetParam {
  /** Omit to select from discovery + local liquidity instead of naming one. */
  assetId?: string;
  amount?: number;
  assetAmount?: number;
}

export interface PayAddressOptions {
  /**
   * Lightning Address, e.g. `alice@lsp.utexo.com`. UMA's `$alice@lsp.utexo.com`
   * form is accepted too — the `$` is stripped before LNURL discovery.
   */
  address: string;
  amtMsat: number;
  asset?: LightningAssetParam | PayAddressAssetParam;
}

// ── quoteAddress ──────────────────────────────────────────────────────────────

/**
 * A BOLT11 quoted against a Lightning Address, not yet paid.
 *
 * The invoice is hosted — its payee is the LSP, which signs it against a payment
 * hash the receiver pre-registered — so it is payable by anyone, not just the
 * wallet that asked for it. See {@link UtexoLsp.requestExternalInvoice}.
 */
export interface AddressQuote {
  invoice: string;
  amtMsat: number;
  /** The asset the invoice is denominated in, when it carries one. */
  assetId?: string;
  assetAmount?: number;
  /** Present only when the SDK chose the asset (`asset.assetId` omitted). */
  assetSelection?: AssetSelection;
  /**
   * APay hash-substitution proof, when the LSP returns one. Its `paymentHash` is
   * the hash the invoice was built against.
   */
  proof?: ApayInvoiceProof;
}

// ── listPayableAssets / requestExternalInvoice ────────────────────────────────

/** What an address can be paid in, straight from its LNURL discovery document. */
export interface PayableAssets {
  /** What the receiver is delivered. Absent until it has a usable asset channel. */
  payoutAsset?: LspSupportedAsset;
  /** Everything the callback will quote — the payout asset first. */
  accepted: LspSupportedAsset[];
  /** `accepted` minus the payout asset: the assets the LSP converts 1:1. */
  convertible: LspSupportedAsset[];
}

export interface RequestExternalInvoiceOptions {
  amtMsat: number;
  /** Payment size in base units (10^-precision). */
  assetAmount: number;
  /**
   * Which asset to quote in — a **ticker** (`'BUSDT'`, case-insensitive) or a
   * contract id, matched against {@link PayableAssets.accepted}. Omit to let
   * `prefer` decide.
   */
  asset?: string;
  /**
   * How to choose when `asset` is omitted. Default `'convertible'`: an external
   * payer is by definition not on the receiver's own payout rails, so the asset
   * worth quoting is the bridge one. `'payout'` asks for the no-conversion asset
   * instead. Either way an unambiguous single candidate wins and more than one
   * throws {@link LspAmbiguousPayableAssetError} rather than being guessed.
   */
  prefer?: 'convertible' | 'payout';
  /** Address to quote against. Defaults to this wallet's own LSP address. */
  address?: string;
}

/** An {@link AddressQuote} plus who it is payable to and in what. */
export interface ExternalInvoice extends AddressQuote {
  address: string;
  username: string;
  domain: string;
  /** The chosen asset with its ticker and precision, for display. */
  asset?: LspSupportedAsset;
  /** `true` when the LSP converts: the receiver is delivered a different asset. */
  converted: boolean;
  /** From the LSP's proof, when it returns one. */
  paymentHash?: string;
}

// ── selectPaymentAsset ────────────────────────────────────────────────────────

export interface SelectPaymentAssetOptions {
  /** Lightning Address to be paid. */
  address: string;
  /** Payment size in base units (10^-precision), the only unit RGB APIs speak. */
  assetAmount: number;
  /** Reuse an already-fetched discovery document instead of fetching again. */
  discovery?: LspLnurlpDiscovery;
}

/** Which asset this wallet should ask to be quoted in, and why. */
export interface AssetSelection {
  assetId: string;
  /** Discovery's entry for it — carries ticker and precision for display. */
  asset?: LspSupportedAsset;
  /**
   * `true` when the chosen asset is not the receiver's payout asset, so the LSP
   * converts the pair 1:1 on its own books. The two assets are independent
   * contracts and the rate is the LSP's word, not the protocol's — see
   * docs/apay-linked-asset-options.uk.md §3 and §10.
   */
  converted: boolean;
  /** Local (spendable) base units found in the channel backing the choice. */
  localAssetAmount: number;
  /** What the receiver is delivered, when discovery says. */
  payoutAsset?: LspSupportedAsset;
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

    // Omitting assetId is what asks the LSP to resolve the on-chain leg — the
    // whole point of 'convertible', and why no contract id for it appears here.
    const lr = await this.http.lightningReceive({
      lnInvoice,
      rgb: {
        assetId:
          (opts.onchainAsset ?? 'convertible') === 'payout'
            ? opts.assetId
            : undefined,
        durationSeconds,
      },
    });

    return {
      lnInvoice,
      rgbInvoice: lr.rgbInvoice,
      mappingId: lr.mappingId,
      onchainAssetId: lr.rgbAssetId,
      converted: lr.converted ?? false,
    };
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
      // An inbound receive can be waiting on chain work this wallet does not do
      // itself — a confirmation, or a counterparty that has to refresh before it
      // broadcasts. Without this hook the loop only ever observes.
      if (opts.onEachPoll) await opts.onEachPoll();

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
      if (opts.onEachPoll) await opts.onEachPoll();

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
  async payAddress(opts: PayAddressOptions): Promise<{
    invoice: string;
    sendResult: LightningSendRequest;
    /** Present only when the SDK chose the asset (`asset.assetId` omitted). */
    assetSelection?: AssetSelection;
  }> {
    const quote = await this.quoteAddress(opts);
    const sendResult = await this.wallet.payLightningInvoice({
      lnInvoice: quote.invoice,
    });
    return {
      invoice: quote.invoice,
      sendResult,
      assetSelection: quote.assetSelection,
    };
  }

  /**
   * Everything {@link payAddress} does except paying: resolve the address and
   * return the BOLT11 it quoted.
   *
   * Split out because the invoice is *hosted* — the LSP signs it against a hash
   * the receiver pre-registered, so its payee is the LSP and nothing in it names
   * the payer. Whoever holds the string can pay it, which is what makes an
   * external, APay-unaware node a viable payer (see
   * {@link requestExternalInvoice}).
   *
   * Quoting is not free: the callback reserves a payment hash out of the
   * receiver's APay batch, so a quote that is never paid burns one.
   */
  async quoteAddress(opts: PayAddressOptions): Promise<AddressQuote> {
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

    // An asset leg without an assetId means "you pick" — resolve it before
    // quoting, because the quote pins the asset for the life of the invoice.
    let assetSelection: AssetSelection | undefined;
    let assetId = opts.asset?.assetId;
    if (opts.asset && !assetId) {
      assetSelection = await this.selectPaymentAsset({
        address: opts.address,
        assetAmount: assetAmount as number,
      });
      assetId = assetSelection.assetId;
    }

    let invoice: string | undefined;
    let proof: ApayInvoiceProof | undefined;

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
            assetId,
            assetAmount
          );
          invoice = cb.pr;
          proof = cb.proof;
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
      if (assetId) url += `&asset_id=${encodeURIComponent(assetId)}`;
      if (assetAmount !== undefined) url += `&asset_amount=${assetAmount}`;

      const cb = (await fetch(url).then((r) =>
        r.json()
      )) as LspLnurlpCallbackWire;
      invoice = cb.pr;
      proof = mapApayProof(cb.proof);
    }

    if (!invoice) throw new Error('No invoice returned for Lightning Address');
    return {
      invoice,
      amtMsat: opts.amtMsat,
      assetId,
      assetAmount,
      assetSelection,
      proof,
    };
  }

  /**
   * LNURL discovery for a Lightning Address, routed on its domain exactly like
   * {@link payAddress}: our LSP for an address it hosts, plain unauthenticated
   * LNURL for anyone else's.
   *
   * The asset fields are the reason to call it: `payoutAsset` is what the
   * receiver is delivered, `acceptedAssets` what the callback will quote.
   */
  async discoverAddress(address: string): Promise<LspLnurlpDiscovery> {
    const { username, domain } = parseLightningAddress(address);
    if (isSameLspHost(domain, this.peer.baseUrl)) {
      return this.http.discoverAddress(username);
    }
    const raw = (await fetch(lnurlDiscoveryUrl(domain, username)).then((r) =>
      r.json()
    )) as LspLnurlpDiscoveryWire;
    if (!raw?.callback) throw new Error('Missing callback in LNURL response');
    return mapLnurlpDiscovery(raw);
  }

  /**
   * What an address can be paid in, split into its payout asset and the assets
   * the LSP converts to it 1:1.
   *
   * Read it instead of hard-coding contract ids: the entries carry ticker and
   * precision, so a UI can offer a picker with no configuration of its own.
   *
   * Discovery, not `/get_info`, is the source — and deliberately so. `get_info`'s
   * `supportedAssets` is the LSP-wide served set (`SUPPORTED_ASSET_IDS`), which
   * excludes the convertible assets it accepts but never provisions. Discovery
   * answers the narrower and correct question: what *this receiver* can be paid
   * in, derived from the channel it actually holds.
   *
   * @param address defaults to this wallet's own LSP-assigned address.
   */
  async listPayableAssets(address?: string): Promise<PayableAssets> {
    const target =
      address ?? (await this.ownLightningAddress('listPayableAssets')).address;
    const discovery = await this.discoverAddress(target);
    const payoutAsset = discovery.payoutAsset;
    const accepted =
      discovery.acceptedAssets ?? (payoutAsset ? [payoutAsset] : []);
    const convertible = payoutAsset
      ? accepted.filter((a) => a.assetId !== payoutAsset.assetId)
      : [];
    return { payoutAsset, accepted, convertible };
  }

  /**
   * Pick the asset to be quoted in: the receiver's payout asset when this wallet
   * can pay it, otherwise an asset discovery advertises as accepted, which the
   * LSP converts 1:1 on its books.
   *
   * Conversion is the fallback, not the default. Paying in the payout asset is
   * one asset end to end and trusts the LSP for nothing beyond delivery;
   * converting additionally trusts it for the amount of the second leg, since
   * only the payment hash — not the asset or the amount — is cryptographically
   * shared between the legs (docs/apay-linked-asset-options.uk.md §3).
   *
   * The choice is the payer's to make because the LNURL callback is
   * unauthenticated: at quote time the LSP does not know who is paying, so it
   * cannot look at their channels. And it must be made *before* the invoice
   * exists — the quote pins the asset, and paying a different one later means a
   * new callback round trip and another hash out of the receiver's batch.
   *
   * Liquidity is read per channel, not summed: there is no cross-asset MPP, so
   * the whole amount has to fit in one channel.
   */
  async selectPaymentAsset(
    opts: SelectPaymentAssetOptions
  ): Promise<AssetSelection> {
    const discovery =
      opts.discovery ?? (await this.discoverAddress(opts.address));
    const payout = discovery.payoutAsset;
    const accepted = discovery.acceptedAssets ?? [];

    // Payout first: it is the no-conversion path, and an LSP that lists it
    // anywhere else in `accepted_assets` still means the same thing.
    const ordered: LspSupportedAsset[] = [];
    if (payout) ordered.push(payout);
    for (const a of accepted) {
      if (!ordered.some((seen) => seen.assetId === a.assetId)) ordered.push(a);
    }
    if (!ordered.length) {
      throw new Error(
        'selectPaymentAsset: discovery advertises no payout or accepted asset ' +
          '— this LSP predates asset discovery, so pass asset.assetId explicitly'
      );
    }

    const local = await this.localAssetAmounts();
    const considered: { assetId: string; localAmount: number }[] = [];
    for (const asset of ordered) {
      const localAmount = local.get(asset.assetId) ?? 0;
      considered.push({ assetId: asset.assetId, localAmount });
      if (localAmount >= opts.assetAmount) {
        return {
          assetId: asset.assetId,
          asset,
          converted: !!payout && asset.assetId !== payout.assetId,
          localAssetAmount: localAmount,
          payoutAsset: payout,
        };
      }
    }
    throw new LspInsufficientAssetLiquidityError(opts.assetAmount, considered);
  }

  /**
   * Largest spendable RGB amount per asset across this wallet's usable channels.
   * Per channel rather than summed, for the same reason as above: one payment
   * rides one channel.
   */
  private async localAssetAmounts(): Promise<Map<string, number>> {
    await this.wallet.syncWallet();
    const out = new Map<string, number>();
    for (const c of await this.wallet.listChannels()) {
      if (!c.assetId || !this.isUsable(c)) continue;
      const amount = Number(c.assetLocalAmount ?? 0);
      if (amount > (out.get(c.assetId) ?? 0)) out.set(c.assetId, amount);
    }
    return out;
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
    const addr = await this.ownLightningAddress('enableLightningAddress');
    const lspInfo = await this.http.getInfo();
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
   * Quote a BOLT11 for an **external** payer — a node that knows nothing about
   * this SDK, APay or Lightning Addresses and can only be handed an invoice.
   *
   * The invoice is hosted by the LSP, so it names no payer and carries the RGB
   * contract id and amount inside the BOLT11 itself. Paying it is therefore a
   * plain `POST /sendpayment {"invoice": …}` on any RGB Lightning node that has
   * a channel with this LSP in the quoted asset — no other integration.
   *
   * The asset is resolved from LNURL discovery rather than configured: pass a
   * ticker, or nothing and let `prefer` decide (`'convertible'` by default —
   * see {@link RequestExternalInvoiceOptions.prefer}).
   *
   * Every call reserves a payment hash from the receiver's APay batch, so call
   * {@link enableLightningAddress} first and refill via {@link refillHashPool}
   * as `unusedHashes` runs down. An invoice that is quoted and never paid still
   * costs a hash.
   */
  async requestExternalInvoice(
    opts: RequestExternalInvoiceOptions
  ): Promise<ExternalInvoice> {
    if (!Number.isFinite(opts.assetAmount) || opts.assetAmount <= 0) {
      throw new ValidationError(
        'requestExternalInvoice: assetAmount must be a positive number of base units'
      );
    }

    const { username, domain } = opts.address
      ? parseLightningAddress(opts.address)
      : await this.ownLightningAddress('requestExternalInvoice');
    const address = `${username}@${domain}`;

    const payable = await this.listPayableAssets(address);
    const { asset, converted } = this.pickPayableAsset(
      address,
      payable,
      opts.asset,
      opts.prefer ?? 'convertible'
    );

    const quote = await this.quoteAddress({
      address,
      amtMsat: opts.amtMsat,
      asset: { assetId: asset.assetId, assetAmount: opts.assetAmount },
    });

    return {
      ...quote,
      address,
      username,
      domain,
      asset,
      converted,
      paymentHash: quote.proof?.paymentHash,
    };
  }

  /**
   * Resolve `requested` (ticker or contract id) against the address's menu, or
   * choose for the caller when it named nothing.
   *
   * Ambiguity throws instead of picking. The quote pins one asset for the life
   * of the invoice, and an external payer holding the other one finds out only
   * by failing to pay — a guess here is paid for by someone who cannot see it.
   */
  private pickPayableAsset(
    address: string,
    payable: PayableAssets,
    requested: string | undefined,
    prefer: 'convertible' | 'payout'
  ): { asset: LspSupportedAsset; converted: boolean } {
    const { accepted, convertible, payoutAsset } = payable;
    if (!accepted.length) throw new LspNoPayableAssetError(address);

    const isConverted = (a: LspSupportedAsset) =>
      !!payoutAsset && a.assetId !== payoutAsset.assetId;

    if (requested) {
      const needle = requested.trim().toLowerCase();
      const hit = accepted.find(
        (a) =>
          a.assetId.toLowerCase() === needle ||
          (a.ticker ?? '').toLowerCase() === needle
      );
      if (!hit) throw new LspUnknownPayableAssetError(requested, accepted);
      return { asset: hit, converted: isConverted(hit) };
    }

    if (accepted.length === 1) {
      return { asset: accepted[0], converted: isConverted(accepted[0]) };
    }
    if (prefer === 'payout' && payoutAsset) {
      return { asset: payoutAsset, converted: false };
    }
    if (prefer === 'convertible') {
      if (convertible.length === 1) {
        return { asset: convertible[0], converted: true };
      }
      // Nothing to convert to: fall back rather than refuse — "prefer" is a
      // preference, and the payout asset is still payable.
      if (!convertible.length && payoutAsset) {
        return { asset: payoutAsset, converted: false };
      }
    }
    throw new LspAmbiguousPayableAssetError(
      prefer === 'payout' ? accepted : convertible,
      prefer
    );
  }

  /**
   * This wallet's own LSP-assigned Lightning Address.
   *
   * `context` only names the caller in the "not unlocked" message — the pubkey
   * is what the LSP keys the address account on, and there is none before
   * unlock.
   */
  private async ownLightningAddress(
    context: string
  ): Promise<{ username: string; domain: string; address: string }> {
    const nodeInfo = await this.wallet.getNodeInfo();
    const pubkey = String(nodeInfo?.pubkey ?? '');
    if (!pubkey) throw new Error(`${context}: wallet not unlocked`);
    const addr = await this.resolveLightningAddress(pubkey);
    return { ...addr, address: `${addr.username}@${addr.domain}` };
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
      `LSP did not provision a Lightning Address for ${pubkey} ` +
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
