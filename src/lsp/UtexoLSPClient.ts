import type { IUtexoLSPClient } from './IUtexoLSPClient';
import type {
  LspClientConfig,
  LspGetInfoResponse,
  LspGetInfoWire,
  LspOnchainSendRequest,
  LspOnchainSendResponse,
  LspOnchainSendWire,
  LspLightningReceiveRequest,
  LspLightningReceiveResponse,
  LspLightningReceiveWire,
  LspLightningSendRequest,
  LspLightningSendResponse,
  LspLightningSendWire,
  LspLightningSendLeg,
  LspLightningSendLegWire,
  LspLightningSendStatusResponse,
  LspLightningSendStatusWire,
  LspLightningAddressByPubkeyResponse,
  LspLightningAddressByPubkeyWire,
  LspLnurlpCallbackResponse,
  LspLnurlpCallbackWire,
  LspLnurlpDiscovery,
  LspLnurlpDiscoveryWire,
  LspSupportedAsset,
  LspSupportedAssetWire,
  LspApayInvoiceProofWire,
  ApayInvoiceProof,
} from './lsp-types';
import {
  assertAmtMsatInSendableRange,
  assertValidAmtMsat,
} from './lnurlp-amount';

/**
 * Map the snake_case wire proof (utexo-lsp) to the camelCase SDK shape.
 * `request<T>()` does a plain `JSON.parse` with no key transform, so this must
 * be explicit (same pattern as the rest of this client).
 */
export function mapApayProof(
  raw: LspApayInvoiceProofWire | undefined
): ApayInvoiceProof | undefined {
  if (!raw) return undefined;
  return {
    version: raw.version,
    recipientPubkey: raw.recipient_pubkey,
    hostPubkey: raw.host_pubkey,
    batchId: raw.batch_id,
    hashIndex: raw.hash_index,
    paymentHash: raw.payment_hash,
    batchRoot: raw.batch_root,
    batchSize: raw.batch_size,
    merkleProof: (raw.merkle_proof ?? []).map((e) => ({
      sibling: e.sibling,
      side: e.side,
    })),
    batchSig: raw.batch_sig,
    createdAt: raw.created_at,
    expiresAt: raw.expires_at,
  };
}

/** snake_case asset entry → SDK shape. Shared by `/get_info` and LNURL discovery. */
function mapSupportedAsset(a: LspSupportedAssetWire): LspSupportedAsset {
  return {
    assetId: a.asset_id,
    schema: a.schema,
    ticker: a.ticker,
    name: a.name,
    precision: a.precision,
  };
}

/**
 * LNURL discovery, with the asset fields mapped. `payout_asset` /
 * `accepted_assets` stay `undefined` rather than becoming empty arrays when
 * absent: an LSP that predates the fields and a receiver with no asset channel
 * yet are different answers.
 */
export function mapLnurlpDiscovery(
  raw: LspLnurlpDiscoveryWire
): LspLnurlpDiscovery {
  return {
    callback: raw.callback,
    minSendable: raw.minSendable,
    maxSendable: raw.maxSendable,
    metadata: raw.metadata,
    tag: raw.tag,
    recipientPubkey: raw.recipient_pubkey,
    addressSig: raw.address_sig,
    payoutAsset: raw.payout_asset
      ? mapSupportedAsset(raw.payout_asset)
      : undefined,
    acceptedAssets: raw.accepted_assets
      ? raw.accepted_assets.map(mapSupportedAsset)
      : undefined,
  };
}

const DEFAULT_TIMEOUT_MS = 15_000;

export class LspError extends Error {
  constructor(
    public readonly endpoint: string,
    public readonly status: number,
    public readonly body: string,
    cause?: unknown
  ) {
    super(
      status
        ? `LSP ${endpoint} → HTTP ${status}: ${body}`
        : `LSP ${endpoint} → ${(cause as Error)?.message ?? 'request failed'}`
    );
    this.name = 'LspError';
    if (cause) (this as { cause?: unknown }).cause = cause;
  }
}

/**
 * utexo-lsp sends u64 as decimal strings. Surface a malformed one as an
 * `LspError`, not as a bare `SyntaxError` from `BigInt()`.
 */
function toBigInt(
  value: string | undefined,
  field: string,
  endpoint: string
): bigint {
  try {
    return BigInt(value ?? '');
  } catch {
    throw new LspError(
      endpoint,
      200,
      `field ${field} is not a u64 string: ${String(value)}`
    );
  }
}

function snakeCaseLnParams(
  ln: LspOnchainSendRequest['ln']
): Record<string, unknown> {
  if (!ln) return {};
  const out: Record<string, unknown> = {};
  if (ln.amtMsat !== undefined) out.amt_msat = ln.amtMsat;
  if (ln.expirySec !== undefined) out.expiry_sec = ln.expirySec;
  if (ln.assetId !== undefined) out.asset_id = ln.assetId;
  if (ln.assetAmount !== undefined) out.asset_amount = ln.assetAmount;
  if (ln.descriptionHash !== undefined)
    out.description_hash = ln.descriptionHash;
  if (ln.paymentHash !== undefined) out.payment_hash = ln.paymentHash;
  if (ln.minFinalCltvExpiryDelta !== undefined) {
    out.min_final_cltv_expiry_delta = ln.minFinalCltvExpiryDelta;
  }
  return out;
}

function snakeCaseRgbParams(
  rgb: LspLightningReceiveRequest['rgb']
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    min_confirmations: rgb.minConfirmations ?? 1,
    witness: !!rgb.witness,
  };
  // Only sent when named — an absent asset_id is what asks the LSP to resolve
  // the on-chain leg itself, so it must not go out as an explicit null.
  if (rgb.assetId !== undefined) out.asset_id = rgb.assetId;
  if (rgb.assignment !== undefined) out.assignment = rgb.assignment;
  if (rgb.durationSeconds !== undefined)
    out.duration_seconds = rgb.durationSeconds;
  return out;
}

export class UtexoLSPClient implements IUtexoLSPClient {
  constructor(private readonly config: LspClientConfig) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = path.startsWith('http')
      ? path
      : `${this.config.baseUrl}${path}`;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.config.bearerToken) {
      headers['Authorization'] = `Bearer ${this.config.bearerToken}`;
    }
    if (init?.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const signal = this.timeoutSignal(
      this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS
    );
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers: {
          ...headers,
          ...((init?.headers as Record<string, string>) ?? {}),
        },
        signal,
      });
    } catch (err) {
      throw new LspError(path, 0, '', err);
    }

    const text = await res.text();
    if (!res.ok) throw new LspError(path, res.status, text.trim());
    if (!text) return null as T;

    try {
      return JSON.parse(text) as T;
    } catch (err) {
      throw new LspError(
        path,
        res.status,
        `invalid JSON: ${text.slice(0, 200)}`,
        err
      );
    }
  }

  /**
   * The LNURL callback the LSP advertises is its own public URL. Strip it to
   * path+query so `request()` rebases it onto this client's `baseUrl` exactly
   * once — that keeps it on the same proxy path as every other call, and works
   * for both absolute baseUrls and relative prefixes like `"/lsp"` (dev proxy)
   * as well as host rewriting (e.g. the Android emulator's `10.0.2.2`).
   */
  private rewriteCallbackUrl(callbackUrl: string): string {
    try {
      const cb = new URL(callbackUrl);
      return cb.pathname + cb.search + cb.hash;
    } catch {
      return callbackUrl;
    }
  }

  private timeoutSignal(ms: number): AbortSignal | undefined {
    if (
      typeof AbortSignal !== 'undefined' &&
      typeof (AbortSignal as { timeout?: unknown }).timeout === 'function'
    ) {
      return (
        AbortSignal as unknown as { timeout: (ms: number) => AbortSignal }
      ).timeout(ms);
    }
    if (typeof AbortController !== 'undefined') {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), ms);
      return ctrl.signal;
    }
    return undefined;
  }

  async getInfo(): Promise<LspGetInfoResponse> {
    const raw = await this.request<LspGetInfoWire>('/get_info');
    const u64 = (key: keyof LspGetInfoWire & string): bigint =>
      toBigInt(raw[key] as string | undefined, key, '/get_info');
    return {
      apiVersion: raw.api_version,
      pubkey: raw.pubkey,
      network: raw.network,
      host: raw.host,
      port: raw.port,
      supportedAssets: (raw.supported_assets ?? []).map(mapSupportedAsset),
      minPaymentSizeMsat: u64('min_payment_size_msat'),
      maxPaymentSizeMsat: u64('max_payment_size_msat'),
      minChannelBalanceSat: u64('min_channel_balance_sat'),
      maxChannelBalanceSat: u64('max_channel_balance_sat'),
      minInitialClientBalanceMsat: u64('min_initial_client_balance_msat'),
      maxInitialClientBalanceMsat: u64('max_initial_client_balance_msat'),
      minChannelAssetAmount: u64('min_channel_asset_amount'),
      maxChannelAssetAmount: u64('max_channel_asset_amount'),
      virtualChannelMode: raw.virtual_channel_mode,
      lightningAddressMinSendableMsat: u64(
        'lightning_address_min_sendable_msat'
      ),
      lightningAddressMaxSendableMsat: u64(
        'lightning_address_max_sendable_msat'
      ),
    };
  }

  /**
   * Full LUD-06 resolution against **this LSP only**: discovers the callback
   * from `<baseUrl>/.well-known/lnurlp/<username>`, then fetches the BOLT11
   * invoice. `rewriteCallbackUrl` rebases the advertised callback onto
   * `baseUrl` so both hops keep this client's auth, timeouts and host
   * rewriting.
   *
   * It therefore cannot resolve an address hosted elsewhere — passing a foreign
   * username asks our LSP about its own user of that name. Callers must route
   * on the address domain first (see `UtexoLsp.payAddress`).
   */
  /**
   * LUD-06 discovery only (`GET <baseUrl>/.well-known/lnurlp/<username>`), with
   * no callback hop. Read it to decide what to pay with: `payoutAsset` is what
   * the receiver is delivered, `acceptedAssets` what the callback will quote.
   *
   * Same scoping caveat as {@link resolveAddress} — this asks OUR LSP about its
   * own user of that name.
   */
  async discoverAddress(username: string): Promise<LspLnurlpDiscovery> {
    const raw = await this.request<LspLnurlpDiscoveryWire>(
      `/.well-known/lnurlp/${encodeURIComponent(username)}`
    );
    if (!raw?.callback) {
      throw new LspError(
        '/.well-known/lnurlp',
        200,
        'missing callback in LNURL response'
      );
    }
    return mapLnurlpDiscovery(raw);
  }

  async resolveAddress(
    username: string,
    amtMsat: number,
    assetId?: string,
    assetAmount?: number
  ): Promise<LspLnurlpCallbackResponse> {
    assertValidAmtMsat(amtMsat);
    const meta = await this.discoverAddress(username);
    assertAmtMsatInSendableRange(amtMsat, meta.minSendable, meta.maxSendable);
    const sep = meta.callback.includes('?') ? '&' : '?';
    let url = `${this.rewriteCallbackUrl(meta.callback)}${sep}amount=${amtMsat}`;
    if (assetId) url += `&asset_id=${encodeURIComponent(assetId)}`;
    if (assetAmount !== undefined) url += `&asset_amount=${assetAmount}`;
    const raw = await this.request<LspLnurlpCallbackWire>(url);
    return {
      pr: raw.pr,
      routes: raw.routes ?? [],
      status: raw.status,
      reason: raw.reason,
      proof: mapApayProof(raw.proof),
    };
  }

  /**
   * Direct LSP Lightning Address callback — skips LNURL discovery and hits
   * `/pay/callback/{username}` on this LSP's base URL directly. Useful when the
   * username is known to be on this LSP.
   */
  async lnurlCallback(
    username: string,
    amtMsat: number,
    assetId?: string,
    assetAmount?: number
  ): Promise<LspLnurlpCallbackResponse> {
    assertValidAmtMsat(amtMsat);
    let path = `/pay/callback/${encodeURIComponent(username)}?amount=${amtMsat}`;
    if (assetId) path += `&asset_id=${encodeURIComponent(assetId)}`;
    if (assetAmount !== undefined) path += `&asset_amount=${assetAmount}`;
    const raw = await this.request<LspLnurlpCallbackWire>(path);
    return {
      pr: raw.pr,
      routes: raw.routes ?? [],
      status: raw.status,
      reason: raw.reason,
      proof: mapApayProof(raw.proof),
    };
  }

  async getLightningAddressByPubkey(
    peerPubkey: string
  ): Promise<LspLightningAddressByPubkeyResponse> {
    const pubkey = peerPubkey.trim();
    if (!pubkey) {
      throw new Error('getLightningAddressByPubkey: peerPubkey is required');
    }
    const raw = await this.request<LspLightningAddressByPubkeyWire>(
      `/lightning_address/by_pubkey/${encodeURIComponent(pubkey)}`
    );
    return {
      username: raw.username,
      domain: raw.domain,
      recipientPubkey: raw.recipient_pubkey,
      addressSig: raw.address_sig,
    };
  }

  /**
   * RGB → Lightning: submit an RGB invoice to the LSP; receive a BOLT11
   * invoice to pay. The LSP runs `sendrgb` to the recipient once the LN payment
   * settles.
   *
   * Body shape matches utexo-lsp exactly:
   *   `{ rgb_invoice, lninvoice: { amt_msat, expiry_sec, … } }`
   */
  async onchainSend(
    params: LspOnchainSendRequest
  ): Promise<LspOnchainSendResponse> {
    const body: Record<string, unknown> = { rgb_invoice: params.rgbInvoice };
    if (params.ln) body.lninvoice = snakeCaseLnParams(params.ln);

    const raw = await this.request<LspOnchainSendWire>('/onchain_send', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return {
      lnInvoice: raw.ln_invoice,
      rgbInvoice: raw.rgb_invoice,
      mappingId: String(raw.mapping_id),
    };
  }

  /**
   * Lightning → RGB: submit a BOLT11 invoice + RGB params to the LSP; the LSP
   * issues an RGB invoice. Once the RGB transfer settles, the LSP pays the
   * BOLT11 invoice.
   *
   * Body shape matches utexo-lsp exactly:
   *   `{ ln_invoice, rgb_invoice: { asset_id, min_confirmations, witness, … } }`
   */
  async lightningReceive(
    params: LspLightningReceiveRequest
  ): Promise<LspLightningReceiveResponse> {
    const body = {
      ln_invoice: params.lnInvoice,
      rgb_invoice: snakeCaseRgbParams(params.rgb),
    };
    const raw = await this.request<LspLightningReceiveWire>(
      '/lightning_receive',
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );
    return {
      lnInvoice: raw.ln_invoice,
      rgbInvoice: raw.rgb_invoice,
      mappingId: String(raw.mapping_id),
      rgbAssetId: raw.rgb_asset_id,
      converted: raw.converted,
    };
  }

  /**
   * Lightning → Lightning across two assets: hand the LSP a third party's BOLT11
   * and get back a HODL invoice denominated in an asset this wallet actually
   * holds. Paying it makes the LSP pay the third party.
   *
   * The response's `paymentHash` should equal the third party invoice's own
   * hash, so the LSP cannot claim the payment without the preimage only that
   * third party releases. Check it — that check is the atomicity.
   */
  async lightningSend(
    params: LspLightningSendRequest
  ): Promise<LspLightningSendResponse> {
    const body: Record<string, unknown> = { invoice: params.invoice };
    if (params.payWithAssetId) body.pay_with_asset_id = params.payWithAssetId;

    const raw = await this.request<LspLightningSendWire>('/lightning_send', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return {
      lnInvoice: raw.ln_invoice,
      paymentHash: raw.payment_hash,
      inbound: mapLightningSendLeg(raw.inbound),
      outbound: mapLightningSendLeg(raw.outbound),
      converted: raw.converted ?? false,
      feeMsat: raw.fee_msat ?? 0,
      expiresAt: raw.expires_at ?? 0,
    };
  }

  /** Where a `/lightning_send` relay has got to. */
  async lightningSendStatus(
    paymentHash: string
  ): Promise<LspLightningSendStatusResponse> {
    const raw = await this.request<LspLightningSendStatusWire>(
      `/lightning_send/${encodeURIComponent(paymentHash)}`
    );
    return {
      paymentHash: raw.payment_hash,
      status: raw.status,
      reason: raw.reason,
    };
  }
}

function mapLightningSendLeg(
  raw: LspLightningSendLegWire | undefined
): LspLightningSendLeg {
  return {
    assetId: raw?.asset_id,
    assetAmount: raw?.asset_amount,
    amtMsat: raw?.amt_msat ?? 0,
    payeePubkey: raw?.payee_pubkey,
  };
}
