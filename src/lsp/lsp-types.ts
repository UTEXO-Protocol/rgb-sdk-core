/**
 * utexo-lsp public types.
 *
 * Reconciled from the rgb-sdk-web and rgb-sdk-rn copies (they had drifted).
 * Platform-neutral: no wasm, no React Native, no Node built-ins.
 *
 * Note: the HODL and APay *node* types (`CreateHodlInvoiceParams`,
 * `HodlInvoiceResult`, `ApayHashEntry`, `ApayNewResponse`) previously lived
 * here in rgb-sdk-rn. They are wallet/node types, not LSP-API types, and now
 * live in `../rln/model` — re-exported below for import-site compatibility.
 */

import type { AssetSchema } from '../types/wallet-model';

export type { ApayHashEntry, ApayNewResponse } from '../rln/model';

// ── LSP client config ─────────────────────────────────────────────────────────

export interface LspClientConfig {
  baseUrl: string;
  bearerToken?: string;
  timeoutMs?: number;
}

// ── LSP HTTP response / request DTOs ─────────────────────────────────────────

/** One entry of `get_info.supported_assets`. */
export interface LspSupportedAsset {
  assetId: string;
  /** Check it before transacting: `Ifa` is unavailable on mainnet. */
  schema: AssetSchema;
  ticker?: string;
  name: string;
  precision: number;
}

/**
 * utexo-lsp discovery document (`GET /get_info`, api_version 1). Amounts are
 * `bigint`: the wire sends u64 as strings, and `Number` corrupts them above
 * 2^53. Additive-only contract — ignore fields you do not recognize.
 */
export interface LspGetInfoResponse {
  apiVersion: number;
  pubkey: string;
  network: string;
  /** P2P host and port. With `pubkey` they form the `connectPeer()` URI. */
  host?: string;
  port?: number;
  supportedAssets: LspSupportedAsset[];
  minPaymentSizeMsat: bigint;
  /** Static policy, not live capacity — an existing channel may deliver more. */
  maxPaymentSizeMsat: bigint;
  minChannelBalanceSat: bigint;
  maxChannelBalanceSat: bigint;
  minInitialClientBalanceMsat: bigint;
  maxInitialClientBalanceMsat: bigint;
  minChannelAssetAmount: bigint;
  maxChannelAssetAmount: bigint;
  virtualChannelMode?: string;
  /** UI hint only — LNURL stays authoritative once an address is known. */
  lightningAddressMinSendableMsat: bigint;
  lightningAddressMaxSendableMsat: bigint;
}

/** Raw wire shape returned by utexo-lsp (snake_case keys, u64 as strings). */
export interface LspGetInfoWire {
  api_version: number;
  pubkey: string;
  network: string;
  host?: string;
  port?: number;
  supported_assets: {
    asset_id: string;
    schema: AssetSchema;
    ticker?: string;
    name: string;
    precision: number;
  }[];
  min_payment_size_msat: string;
  max_payment_size_msat: string;
  min_channel_balance_sat: string;
  max_channel_balance_sat: string;
  min_initial_client_balance_msat: string;
  max_initial_client_balance_msat: string;
  min_channel_asset_amount: string;
  max_channel_asset_amount: string;
  virtual_channel_mode?: string;
  lightning_address_min_sendable_msat: string;
  lightning_address_max_sendable_msat: string;
}

export interface LspLnParams {
  amtMsat?: number;
  expirySec?: number;
  assetId?: string;
  assetAmount?: number;
  descriptionHash?: string;
  paymentHash?: string;
  minFinalCltvExpiryDelta?: number;
}

export interface LspOnchainSendRequest {
  rgbInvoice: string;
  ln?: LspLnParams;
}

export interface LspOnchainSendResponse {
  rgbInvoice: string;
  lnInvoice: string;
  mappingId: string;
}

export interface LspRgbParams {
  assetId: string;
  assignment?: string;
  durationSeconds?: number;
  minConfirmations?: number;
  witness?: string;
}

export interface LspLightningReceiveRequest {
  lnInvoice: string;
  rgb: LspRgbParams;
}

export interface LspLightningReceiveResponse {
  lnInvoice: string;
  rgbInvoice: string;
  mappingId: string;
}

/** Raw wire shape returned by utexo-lsp `/lightning_receive` (snake_case keys). */
export interface LspLightningReceiveWire {
  ln_invoice: string;
  rgb_invoice: string;
  mapping_id: string | number;
}

/** Raw wire shape returned by utexo-lsp `/onchain_send` (snake_case keys). */
export interface LspOnchainSendWire {
  ln_invoice: string;
  rgb_invoice: string;
  mapping_id: string | number;
}

/** Wire shape of the APay invoice proof (snake_case, as utexo-lsp returns it). */
export interface LspApayInvoiceProofWire {
  version: number;
  recipient_pubkey: string;
  host_pubkey: string;
  batch_id: string;
  hash_index: number;
  payment_hash: string;
  batch_root: string;
  batch_size: number;
  merkle_proof: { sibling: string; side: string }[];
  batch_sig: string;
  created_at: number;
  expires_at: number;
}

/**
 * LUD-06 LNURL-pay discovery (`/.well-known/lnurlp/{username}`).
 *
 * `minSendable` / `maxSendable` are millisatoshis — utexo-lsp defaults both to
 * `DEFAULT_LSP_MIN_AMT_MSAT` (3_000_000) unless env overrides.
 */
export interface LspLnurlpDiscovery {
  callback: string;
  minSendable: number;
  maxSendable: number;
}

/** Wire shape of the LNURL-pay callback (snake_case `proof`). */
export interface LspLnurlpCallbackWire {
  pr: string;
  routes?: unknown[];
  status?: string;
  reason?: string;
  proof?: LspApayInvoiceProofWire;
}

/** Wire shape of `GET /lightning_address/by_pubkey/{pubkey}` (snake_case). */
export interface LspLightningAddressByPubkeyWire {
  username: string;
  domain: string;
  recipient_pubkey?: string;
  address_sig?: string;
}

export interface LspLnurlpCallbackResponse {
  pr: string;
  routes: unknown[];
  status?: string;
  reason?: string;
  /**
   * APay hash-substitution-resistance proof (utexo-lsp >= 0.6 / PR #22).
   * Present when the address was registered with an attestation (see
   * `apayNewWithAddress`). Lets the payer verify the payment hash is committed
   * under the recipient's signed batch root before paying. Optional — older
   * LSPs omit it.
   */
  proof?: ApayInvoiceProof;
}

/** One step of the APay Merkle inclusion proof. */
export interface ApayMerkleProofElement {
  sibling: string;
  /** `'left'` | `'right'` — which side the sibling is on. */
  side: string;
}

/** utexo-lsp APay invoice proof (LNURL callback `proof` field). */
export interface ApayInvoiceProof {
  version: number;
  recipientPubkey: string;
  hostPubkey: string;
  batchId: string;
  hashIndex: number;
  paymentHash: string;
  batchRoot: string;
  batchSize: number;
  merkleProof: ApayMerkleProofElement[];
  batchSig: string;
  createdAt: number;
  expiresAt: number;
}

/** utexo-lsp `GET /lightning_address/by_pubkey/{pubkey}` */
export interface LspLightningAddressByPubkeyResponse {
  username: string;
  domain: string;
  /** Recipient node pubkey — present on utexo-lsp >= 0.6 (PR #22). */
  recipientPubkey?: string;
  /** Address-ownership attestation signature — present once registered via `apayNewWithAddress`. */
  addressSig?: string;
}

// ── LspPeer ───────────────────────────────────────────────────────────────────

/**
 * Single config object replacing the three separate values apps previously
 * passed to `connectPeer()`, `UtexoLSPClient`, and the wallet's `lspBaseUrl`.
 */
export interface LspPeer {
  /** utexo-lsp HTTP base URL — same value as the wallet's `lspBaseUrl`. */
  baseUrl: string;
  /** Lightning P2P pubkey — used for `connectPeer()`. */
  peerPubkey: string;
  peerHost: string;
  peerPort: number;
  /** Required only for APay async routes (`/internal/async_order/*`). */
  bearerToken?: string;
  timeoutMs?: number;
}

/** Returns `pubkey@host:port` — the string accepted by `connectPeer()`. */
export function peerUri(peer: LspPeer): string {
  return `${peer.peerPubkey}@${peer.peerHost}:${peer.peerPort}`;
}

// ── ReceiveStatus ─────────────────────────────────────────────────────────────

/**
 * LSP-side receive status.
 *
 * Distinct from the node's `RlnInvoiceStatus` (see `../rln/status`): the LSP
 * reports a coarser lifecycle for the mapped receive, not the HTLC state.
 */
export type ReceiveStatus = 'Pending' | 'Succeeded' | 'Failed' | 'Expired';

/** Result of `awaitReceiveSettlement` — distinct from `ReceiveStatus`. */
export type ReceiveSettlementOutcome = 'settled' | 'timed_out';

/** Canonicalizes the dual `Succeeded`/`Settled` spellings the LSP may return. */
export function normalizeReceiveStatus(
  raw: string | null | undefined
): ReceiveStatus {
  const s = (raw ?? '').toUpperCase();
  if (s === 'SUCCEEDED' || s === 'SETTLED') return 'Succeeded';
  if (s === 'FAILED') return 'Failed';
  if (s === 'EXPIRED') return 'Expired';
  return 'Pending';
}

// ── ChannelReadyInfo ──────────────────────────────────────────────────────────

export interface ChannelReadyInfo {
  channelId: string;
  peerPubkey: string;
  capacitySat: number;
  outboundBalanceMsat: number;
  inboundBalanceMsat: number;
}
