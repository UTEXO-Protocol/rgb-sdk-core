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
 * Invoice request — narrowed to the true intersection of both native APIs
 * (§2.5 of MIGRATION-PLAN-v3.md).
 *
 * Replaces `CreateLightningInvoiceRequestModel`, which carried three fields the
 * web node cannot accept:
 *
 *   - `paymentHash` — web declared it and **silently dropped it**
 *     (`web/src/utexo/utexo-wallet.ts:697` vs `RlnNodeBinding.ts:348`, whose
 *     `createLnInvoiceLiveJson` takes four arguments). A caller asking for a
 *     HODL invoice received a plain one, with no error. HODL now belongs
 *     exclusively to `createHodlInvoice`.
 *   - `minFinalCltvExpiryDelta` — rn-only, moved to a platform extra.
 *   - `descriptionHash` — rn-only (BOLT11 `h` tag for LNURL-pay).
 *
 * `asset` uses `LightningAsset` (required `amount`), not rn's
 * `LightningAssetParam` with its `assetAmount` alias: one concept, one spelling.
 * This also removes web's runtime throw for a missing amount — the type now
 * enforces it.
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
   * §2.5 fix — no `mnemonic` parameter.
   *
   * The old contract accepted `mnemonic?`, which rn dropped silently (its
   * signature has no such parameter). Mnemonic-based signing is a web-only
   * capability and now lives behind the `psbt` carrier.
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
