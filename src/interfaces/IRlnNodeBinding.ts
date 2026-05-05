import type {
  LightningChannel,
  OpenChannelParams,
  LightningInvoice,
  CreateLnInvoiceParams,
  CreateHodlLnInvoiceParams,
  LightningPayment,
  SendPaymentParams,
  SendPaymentResult,
  KeysendParams,
  LightningPeer,
  LightningNodeInfo,
  LdkRuntimeStatus,
  LightningNetworkInfo,
  InvoiceStatus,
  DecodedLnInvoice,
  HodlInvoiceResult,
  PaymentStatusUpdate,
  ListRuntimeEventsResult,
  IssueAssetNiaRequest,
  IssueAssetCfaRequest,
} from '../types/rln-model';
import type { AssetNIA, AssetCFA } from '../types/wallet-model';

/**
 * Platform-agnostic interface for Lightning node operations.
 *
 * Implemented by RlnNodeBinding (web/WASM) and future Kotlin UniFFI binding.
 * Asset issuance lives here because it requires the node to have a wallet
 * attached (node-side issuance pattern in rln-wasm-sdk).
 */
export interface IRlnNodeBinding {
  // ── Asset Issuance (requires wallet attached to node) ─────────────────────
  issueAssetNia(params: IssueAssetNiaRequest): Promise<AssetNIA>;
  issueAssetCfa(params: IssueAssetCfaRequest): Promise<AssetCFA>;

  // ── Channels ───────────────────────────────────────────────────────────────
  openChannel(params: OpenChannelParams): Promise<string>;
  closeChannel(channelId: string, peerPubkey?: string, force?: boolean): void;
  listChannels(): Promise<LightningChannel[]>;

  // ── Payments ───────────────────────────────────────────────────────────────
  createLnInvoice(params: CreateLnInvoiceParams): Promise<LightningInvoice>;
  sendPayment(params: SendPaymentParams): Promise<SendPaymentResult>;
  keysend(params: KeysendParams): Promise<SendPaymentResult>;
  listPayments(): Promise<LightningPayment[]>;
  getPayment(paymentHash: string): Promise<LightningPayment | null>;
  invoiceStatus(invoice: string): Promise<InvoiceStatus>;
  failPendingPayments(): Promise<void>;
  updatePaymentStatus(params: PaymentStatusUpdate): Promise<void>;

  // ── HODL invoices ──────────────────────────────────────────────────────────
  createHodlLnInvoice(
    params: CreateHodlLnInvoiceParams
  ): Promise<LightningInvoice>;
  cancelHodlInvoice(paymentHash: string): Promise<HodlInvoiceResult>;
  claimHodlInvoice(
    paymentHash: string,
    preimage: string
  ): Promise<HodlInvoiceResult>;

  // ── Peers ──────────────────────────────────────────────────────────────────
  connectPeer(peerAddr: string, peerPubkey: string): Promise<void>;
  disconnectPeer(peerPubkey: string): Promise<void>;
  listPeers(): Promise<LightningPeer[]>;

  // ── Info & Status ──────────────────────────────────────────────────────────
  nodePubkey(): string;
  nodeInfo(): Promise<LightningNodeInfo>;
  networkInfo(): Promise<LightningNetworkInfo>;
  ldkRuntimeStatus(): Promise<LdkRuntimeStatus>;
  listRuntimeEvents(): Promise<ListRuntimeEventsResult>;

  // ── Decoding ───────────────────────────────────────────────────────────────
  decodeLnInvoice(invoice: string): Promise<DecodedLnInvoice>;
  decodeRgbInvoice(invoice: string): Promise<unknown>;

  // ── Messaging ─────────────────────────────────────────────────────────────
  signMessage(message: string): Promise<string>;
}
