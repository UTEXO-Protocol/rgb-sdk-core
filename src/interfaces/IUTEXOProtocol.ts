import type {
  CreateLightningInvoiceRequestModel,
  LightningReceiveRequest,
  LightningSendRequest,
  PayLightningInvoiceRequestModel,
  OnchainReceiveRequestModel,
  OnchainReceiveResponse,
  OnchainSendRequestModel,
  OnchainSendResponse,
  ListLightningPaymentsResponse,
  SendAssetEndRequestModel,
  Transfer,
} from '../types/wallet-model';

/**
 * Lightning Protocol Interface
 *
 * Note: LN status polling is intentionally absent here. The former
 * `getLightningReceiveRequest`/`getLightningSendRequest` returned
 * `TransferStatus`, an RGB on-chain vocabulary that folds LN states lossily
 * (and differently on each platform). They are replaced by
 * `getLightningReceiveStatus`/`getLightningSendStatus`, which return the
 * canonical LN status vocabulary — added with the Lightning surface.
 */
export interface ILightningProtocol {
  createLightningInvoice(
    params: CreateLightningInvoiceRequestModel
  ): Promise<LightningReceiveRequest>;

  payLightningInvoice(
    params: PayLightningInvoiceRequestModel,
    mnemonic?: string
  ): Promise<LightningSendRequest>;

  listLightningPayments(): Promise<ListLightningPaymentsResponse>;
}

/**
 * Onchain Protocol Interface
 */
export interface IOnchainProtocol {
  /** Creates a receive invoice for an inbound cross-network transfer into UTEXO */
  onchainReceive(
    params: OnchainReceiveRequestModel
  ): Promise<OnchainReceiveResponse>;

  onchainSendBegin(params: OnchainSendRequestModel): Promise<string>;

  onchainSendEnd(
    params: SendAssetEndRequestModel
  ): Promise<OnchainSendResponse>;

  onchainSend(
    params: OnchainSendRequestModel,
    mnemonic?: string
  ): Promise<OnchainSendResponse>;

  listOnchainTransfers(asset_id?: string): Promise<Transfer[]>;
}

/**
 * UTEXO Protocol Interface — combines Lightning and Onchain.
 * This is the main interface that UTEXOWallet implements.
 */
export interface IUTEXOProtocol extends ILightningProtocol, IOnchainProtocol {}
