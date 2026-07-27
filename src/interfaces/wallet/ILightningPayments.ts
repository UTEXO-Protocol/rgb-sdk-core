/**
 * Lightning invoices and payments — always present.
 */

import type {
  CreateHodlInvoiceParams,
  DecodedLnInvoice,
  HodlInvoiceResult,
  LightningInvoice,
  LightningPayment,
  RlnInvoiceStatus,
  RlnPaymentStatus,
  SendPaymentResult,
} from '../../rln';
import type {
  LightningAsset,
  LightningReceiveRequest,
  LightningSendRequest,
  ListLightningPaymentsResponse,
  PayLightningInvoiceRequestModel,
} from '../../types/wallet-model';

/**
 * Invoice request — the true intersection of both native APIs.
 *
 * Narrower than the old `CreateLightningInvoiceRequestModel`, which carried
 * fields the web node cannot accept:
 *
 *   - `paymentHash` — web silently dropped it (a caller asking for a HODL
 *     invoice got a plain one, with no error). HODL now belongs exclusively to
 *     `createHodlInvoice`.
 *   - `minFinalCltvExpiryDelta`, `descriptionHash` — rn-only, moved to platform
 *     extras.
 *
 * `asset` uses `LightningAsset` (required `amount`) — one spelling, and the
 * type enforces the amount rather than throwing at runtime.
 */
export interface CreateLnInvoiceRequest {
  amountSats?: number;
  /** Omit for a BTC-only invoice. */
  asset?: LightningAsset;
  expirySeconds?: number;
}

export interface ILightningPayments {
  createLightningInvoice(
    params: CreateLnInvoiceRequest
  ): Promise<LightningReceiveRequest>;

  /**
   * No `mnemonic` parameter — mnemonic-based signing is web-only and lives
   * behind the `psbt` carrier (rn's signature never had one).
   */
  payLightningInvoice(
    params: PayLightningInvoiceRequestModel
  ): Promise<LightningSendRequest>;

  listLightningPayments(): Promise<ListLightningPaymentsResponse>;
  listPayments(): Promise<LightningPayment[]>;

  decodeLnInvoice(invoice: string): Promise<DecodedLnInvoice>;
  invoiceStatus(invoice: string): Promise<RlnInvoiceStatus>;

  /** Canonical inbound LN status — never folded into `TransferStatus`. */
  getLightningReceiveStatus(id: string): Promise<RlnInvoiceStatus>;
  /** `null` when the payment hash is unknown to the node. */
  getLightningSendStatus(id: string): Promise<RlnPaymentStatus | null>;

  keysend(
    destPubkey: string,
    amtMsat: number,
    assetId?: string,
    assetAmount?: number
  ): Promise<SendPaymentResult>;

  // ── HODL invoices — the only place a payment hash is accepted ──────────────

  createHodlInvoice(params: CreateHodlInvoiceParams): Promise<LightningInvoice>;
  claimHodlInvoice(
    paymentHash: string,
    preimage: string
  ): Promise<HodlInvoiceResult>;
  cancelHodlInvoice(paymentHash: string): Promise<HodlInvoiceResult>;
}
