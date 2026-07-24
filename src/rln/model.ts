/**
 * Lightning domain types — the shared contract both SDKs return.
 *
 * These are the *domain* shapes, not wire shapes. Each platform keeps its own
 * generator-specific wire types (RN's `Rln*` from UniFFI, web's JSON from
 * wasm-bindgen) and maps them here at the binding boundary — see `mapper.ts`.
 *
 * Fields present on only one platform today are optional, so the type is a
 * genuine superset rather than a lowest common denominator.
 */

import type { RlnChannelStatus, RlnPaymentStatus } from './status';

// ─── Channels ─────────────────────────────────────────────────────────────────

export interface LightningChannel {
  channelId: string;
  peerPubkey: string;
  capacitySat: number;
  /** Channel is open and ready. */
  ready: boolean;
  isPublic: boolean;
  /** Usable for routing (ready + peer connected). */
  isUsable?: boolean;
  status?: RlnChannelStatus;
  localBalanceMsat?: number;
  remoteBalanceMsat?: number;
  /** Spendable outbound liquidity (our side). */
  outboundBalanceMsat?: number;
  /** Inbound liquidity (peer side). */
  inboundBalanceMsat?: number;
  nextOutboundHtlcLimitMsat?: number;
  nextOutboundHtlcMinimumMsat?: number;
  fundingTxid?: string;
  peerAlias?: string;
  shortChannelId?: number;
  assetId?: string;
  assetLocalAmount?: number;
  assetRemoteAmount?: number;
  virtualOpenMode?: string;
}

/**
 * What **both** platforms honour when opening a channel.
 *
 * The wasm node's `openChannel` takes exactly these. `push_msat`,
 * `with_anchors`, the fee overrides, `temporary_channel_id` and
 * `push_asset_amount` have no argument to be passed in, and `virtual_open_mode`
 * is a node-wide setting on web (`enableVirtualChannels` at init) rather than a
 * per-channel one — declaring any of them shared would mean web accepts and
 * silently drops them. rn widens this type locally with its own extras.
 */
export interface OpenChannelParams {
  /** Peer pubkey, optionally `pubkey@host:port` when the peer is not connected. */
  peerPubkey: string;
  capacitySat: number | bigint;
  isPublic: boolean;
  assetId?: string;
  assetLocalAmount?: number | bigint;
}

export interface OpenChannelResult {
  temporaryChannelId: string;
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export interface CreateLnInvoiceParams {
  amtMsat?: number | bigint;
  expirySec: number;
  assetId?: string;
  assetAmount?: number | bigint;
}

export interface CreateHodlInvoiceParams extends CreateLnInvoiceParams {
  paymentHash: string;
  minFinalCltvExpiryDelta?: number | null;
}

export interface LightningInvoice {
  invoice: string;
  paymentHash: string;
  expirySeconds: number;
  amtMsat?: number | bigint;
  assetId?: string;
  assetAmount?: number | bigint;
}

/**
 * Result of claiming a HODL invoice.
 *
 * Mirrors the node's `ClaimHodlInvoiceResponse { changed: bool }`
 * (`rgb-lightning-node/src/uniffi_api/types.rs`). `changed` is `false` when the
 * payment was already in the requested state.
 *
 * Note: `cancelHodlInvoice` returns unit at the node — it has no result type.
 */
export interface HodlInvoiceResult {
  changed: boolean;
}

export interface DecodedLnInvoice {
  paymentHash: string;
  amtMsat?: number | bigint;
  expirySeconds?: number;
  timestamp?: number;
  description?: string;
  /** Payee node pubkey. */
  payee?: string;
  paymentSecret?: string;
  assetId?: string;
  assetAmount?: number | bigint;
  network?: string;
}

// ─── Payments ─────────────────────────────────────────────────────────────────

/** Direction/claim mode of a payment, as reported by the node. */
export type LightningPaymentType =
  | 'Outbound'
  | 'InboundAutoClaim'
  | 'InboundHodl';

export interface LightningPayment {
  paymentHash: string;
  status: RlnPaymentStatus;
  paymentType?: LightningPaymentType;
  amtMsat?: number | bigint;
  assetId?: string;
  assetAmount?: number | bigint;
  invoice?: string;
  /** True for received payments. */
  inbound?: boolean;
  /** Known once settled (sends) or claimable (HODL receives). */
  preimage?: string;
  payeePubkey?: string;
  /** Unix timestamp in **seconds** (UTC). Multiply by 1000 for `new Date()`. */
  createdAt?: number;
  /** Unix timestamp in **seconds** (UTC). Multiply by 1000 for `new Date()`. */
  updatedAt?: number;
}

export interface SendPaymentParams {
  invoice: string;
  amtMsat?: number | bigint;
  assetId?: string;
  assetAmount?: number | bigint;
}

export interface SendPaymentResult extends LightningPayment {}

export interface KeysendParams {
  destPubkey: string;
  amtMsat: number | bigint;
  assetId?: string;
  assetAmount?: number | bigint;
}

/**
 * Asset reference for Lightning invoice / pay-address params.
 *
 * `amount` and `assetAmount` are aliases for the asset-unit amount — both
 * shapes appear across the wallet and LSP APIs. Exactly one must be set.
 */
export interface LightningAssetParam {
  assetId: string;
  amount?: number;
  assetAmount?: number;
}

// ─── Peers & node ─────────────────────────────────────────────────────────────

export interface LightningPeer {
  pubkey: string;
  address?: string;
  isConnected?: boolean;
}

export interface LightningNodeInfo {
  pubkey: string;
  numChannels?: number;
  numUsableChannels?: number;
  numPeers?: number;
  localBalanceMsat?: number;
  localBalanceSat?: number;
  maxMediaUploadSizeMb?: number;
  rgbHtlcMinMsat?: number;
  rgbChannelCapacityMinSat?: number;
  channelCapacityMinSat?: number;
  channelCapacityMaxSat?: number;
  channelAssetMinAmount?: number;
  channelAssetMaxAmount?: number;
  networkNodes?: number;
  networkChannels?: number;
  latestRgsSnapshotTimestamp?: number | null;
}

export interface LightningNetworkInfo {
  network: string;
  blockHeight?: number;
}

// ─── Async payments (APay) ────────────────────────────────────────────────────

export interface ApayHashEntry {
  hashIndex: number;
  paymentHash: string;
}

/** Acknowledgement of `apayNew` / `apayNewWithAddress` (async_order.new). */
export interface ApayNewResponse {
  requestId: string;
  hostNodeId: string;
  protocolVersion: number;
  orderId: string;
  status: string;
  acceptedThroughIndex: number;
  nextIndexExpected: number;
  unusedHashes: number;
  refillBatchSize: number;
  firstHashIndex: number;
  lastHashIndex: number;
  hashes: ApayHashEntry[];
}

// ─── VSS (LDK channel-state replication) ──────────────────────────────────────

/** Health view of the node's LDK VSS replication. */
export interface LdkVssBackupInfo {
  /** True when replication was configured successfully for this node. */
  configured: boolean;
  /** Writes queued but not yet on the VSS server; alert if it stays > 0. */
  pendingWrites: number;
  /** Most recent replication error, or null. */
  lastError: string | null;
  /** True when the fence was lost to another instance and replication stopped. */
  disabled: boolean;
}
