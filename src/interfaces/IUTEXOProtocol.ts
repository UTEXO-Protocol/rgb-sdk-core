import type {
  CreateLightningInvoiceRequestModel,
  LightningReceiveRequest,
  LightningSendRequest,
  GetLightningSendFeeEstimateRequestModel,
  PayLightningInvoiceRequestModel,
  OnchainReceiveRequestModel,
  OnchainReceiveResponse,
  OnchainSendRequestModel,
  OnchainSendResponse,
  ListLightningPaymentsResponse,
  SendAssetEndRequestModel,
  Transfer,
  TransferStatus,
} from '../types/wallet-model';

/**
 * Lightning Protocol Interface
 */
export interface ILightningProtocol {
  createLightningInvoice(
    params: CreateLightningInvoiceRequestModel
  ): Promise<LightningReceiveRequest>;

  getLightningReceiveRequest(id: string): Promise<TransferStatus | null>;

  getLightningSendRequest(id: string): Promise<TransferStatus | null>;

  getLightningSendFeeEstimate(
    params: GetLightningSendFeeEstimateRequestModel
  ): Promise<number>;

  payLightningInvoiceBegin(
    params: PayLightningInvoiceRequestModel
  ): Promise<string>;

  payLightningInvoiceEnd(
    params: SendAssetEndRequestModel
  ): Promise<LightningSendRequest>;

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
