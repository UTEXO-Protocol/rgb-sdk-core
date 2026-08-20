/**
 * The narrow wallet surface `UtexoLsp` depends on.
 *
 * `UtexoLsp` previously imported the concrete `UTEXOWallet` from each platform,
 * which is why the module could not live in core. Depending on this interface
 * instead decouples it: both platform wallets satisfy it structurally, and a
 * future platform needs no core change.
 *
 * Every member here is part of the shared protocol contract, so implementing
 * `IUTEXOProtocol` implies satisfying `ILspWallet`.
 */

import type {
  LightningChannel,
  LightningNodeInfo,
  LightningPayment,
  ApayNewResponse,
  HodlInvoiceResult,
  DecodedLnInvoice,
} from '../rln/model';
import type { RlnInvoiceStatus } from '../rln/status';
import type {
  CreateLightningInvoiceRequestModel,
  LightningReceiveRequest,
  LightningSendRequest,
  PayLightningInvoiceRequestModel,
} from '../types/wallet-model';

export interface ILspWallet {
  /** Connect to a Lightning peer. `peerUri` is `pubkey@host:port`. */
  connectPeer(peerUri: string): Promise<unknown>;

  /** Channels in the canonical domain shape (bindings normalize at their boundary). */
  listChannels(): Promise<LightningChannel[]>;

  getNodeInfo(): Promise<LightningNodeInfo>;

  /** Payments in the canonical domain shape — used by the claim flow. */
  listPayments(): Promise<LightningPayment[]>;

  createLightningInvoice(
    params: CreateLightningInvoiceRequestModel
  ): Promise<LightningReceiveRequest>;

  payLightningInvoice(
    params: PayLightningInvoiceRequestModel
  ): Promise<LightningSendRequest>;

  /**
   * Decode a BOLT11 locally.
   *
   * `payExternalInvoice` needs it: the LSP signs the invoice it hands back, and
   * only the payer's own node can confirm it carries the third party's payment
   * hash — the one thing that flow does not have to trust the LSP for.
   */
  decodeLnInvoice(invoice: string): Promise<DecodedLnInvoice>;

  /** Reveal the preimage to claim an inbound HODL payment. */
  claimHodlInvoice(
    paymentHash: string,
    preimage: string
  ): Promise<HodlInvoiceResult>;

  /** Register an attested APay hash batch with the invoice-host / LSP peer. */
  apayNewWithAddress(
    hostNodeId: string,
    username: string,
    domain: string
  ): Promise<ApayNewResponse>;

  syncWallet(): Promise<unknown>;

  /**
   * Poll an inbound LN receive, in the node's own status vocabulary.
   *
   * Deliberately not `TransferStatus` — that is an RGB on-chain consignment
   * vocabulary with no Lightning meaning.
   */
  getLightningReceiveStatus(id: string): Promise<RlnInvoiceStatus>;
}
