/**
 * IUTEXOWallet — the shared wallet contract.
 *
 * Generated from the actual intersection of the two `UTEXOWallet` classes, not
 * hand-listed: every method here exists on **both** rgb-sdk-web and
 * rgb-sdk-rn with a compatible signature. Both classes declare
 * `implements IUTEXOWallet`, so from here on the compiler — not review — is
 * what keeps them aligned.
 *
 * What is deliberately NOT here:
 *   - Platform-only methods (14 web-only, 10 rn-only). They stay documented
 *     extras on their own class; forcing them in would mean stubs that throw,
 *     which is the pattern `capabilities` replaces.
 *   - Lifecycle that differs by platform (`init`/`unlock`/`dispose`): RN's
 *     `unlock` takes native params, web's takes none. Shared naming here would
 *     be a lie.
 *   - `createLsp`/`getLspConfig` — convenience wrappers over the LSP module,
 *     not part of the wallet contract.
 *
 * Note: TypeScript does not check constructor signatures via `implements`.
 * Constructor alignment (`(params, signer)`) is a convention — see the
 * migration plan §5a.
 */

import type {
  ApayNewResponse,
  CreateHodlInvoiceParams,
  DecodedLnInvoice,
  HodlInvoiceResult,
  LightningAssetParam,
  LightningChannel,
  LightningInvoice,
  LightningNetworkInfo,
  LightningNodeInfo,
  LightningPayment,
  LightningPeer,
  OpenChannelParams,
  OpenChannelResult,
  RlnInvoiceStatus,
  RlnPaymentStatus,
  SendPaymentResult,
} from '../rln';
import type { EstimateFeeResult, Network } from '../crypto/types';
import type {
  AssetBalance,
  AssetNIA,
  BitcoinNetwork,
  BtcBalance,
  CreateLightningInvoiceRequestModel,
  CreateUtxosBeginRequestModel,
  CreateUtxosEndRequestModel,
  FailTransfersRequest,
  GetFeeEstimationResponse,
  InflateAssetIfaRequestModel,
  InflateEndRequestModel,
  InvoiceData,
  InvoiceReceiveData,
  InvoiceRequest,
  IssueAssetIfaRequestModel,
  IssueAssetNiaRequestModel,
  ListAssets,
  ListLightningPaymentsResponse,
  LightningReceiveRequest,
  LightningSendRequest,
  OnchainReceiveRequestModel,
  OnchainReceiveResponse,
  OnchainSendResponse,
  OperationResult,
  PayLightningInvoiceRequestModel,
  SendAssetBeginRequestModel,
  SendAssetEndRequestModel,
  SendBtcBeginRequestModel,
  SendBtcEndRequestModel,
  Transaction,
  Transfer,
  Unspent,
  VssBackupConfig,
  VssBackupInfo,
  WalletBackupResponse,
} from '../types/wallet-model';

/**
 * Configuration shared by both platforms.
 *
 * Plain, serializable config only — no live objects. The signer is a separate
 * constructor argument (§5a of the migration plan), so it is deliberately not
 * a field here.
 *
 * Each platform extends this with its own extras:
 *   - web: `proxyUrl`, `nodeRuntimeId`, `dataDir`, `supportedSchemas`, …
 *   - rn:  `storageDirPath`, ports, `vssAllowHttp`, …
 */
export interface UTEXOWalletCreateParams {
  mnemonic: string;
  password: string;
  /** Default `'utexo'`. */
  network?: BitcoinNetwork;
  /** Defaults to the core table for the network — see `resolveIndexerUrl`. */
  indexerUrl?: string;
  transportEndpoint?: string;
  /** `null` disables VSS. */
  vssUrl?: string | null;
  /** Default `true`. */
  vssAutoRestore?: boolean;
  lspBaseUrl?: string | null;
  lspBearerToken?: string | null;
}

export interface IUTEXOWallet {
  apayNew(hostNodeId: string): Promise<ApayNewResponse>;
  apayNewWithAddress(
    hostNodeId: string,
    username: string,
    domain: string
  ): Promise<ApayNewResponse>;
  blindReceive(params: InvoiceRequest): Promise<InvoiceReceiveData>;
  cancelHodlInvoice(paymentHash: string): Promise<HodlInvoiceResult>;
  claimHodlInvoice(
    paymentHash: string,
    preimage: string
  ): Promise<HodlInvoiceResult>;
  closeChannel(
    channelId: string,
    peerPubkey?: string,
    force?: boolean
  ): Promise<void>;
  configureVssBackup(config: VssBackupConfig): Promise<void>;
  connectPeer(peerUri: string): Promise<void>;
  createBackup(params: {
    backupPath: string;
    password: string;
  }): Promise<WalletBackupResponse>;
  createHodlInvoice(params: CreateHodlInvoiceParams): Promise<LightningInvoice>;
  createLightningInvoice(
    params: Omit<CreateLightningInvoiceRequestModel, 'asset'> & {
      asset?: LightningAssetParam;
      paymentHash?: string | null;
    }
  ): Promise<LightningReceiveRequest>;
  createUtxos(params: {
    upTo?: boolean;
    num?: number;
    size?: number;
    feeRate?: number;
  }): Promise<number>;
  createUtxosBegin(params: CreateUtxosBeginRequestModel): Promise<string>;
  createUtxosEnd(params: CreateUtxosEndRequestModel): Promise<number>;
  decodeLnInvoice(invoice: string): Promise<DecodedLnInvoice>;
  decodeRGBInvoice(params: { invoice: string }): Promise<InvoiceData>;
  disableVssAutoBackup(): Promise<void>;
  disconnectPeer(peerPubkey: string): Promise<void>;
  estimateFee(psbtBase64: string): Promise<EstimateFeeResult>;
  estimateFeeRate(blocks: number): Promise<GetFeeEstimationResponse>;
  failTransfers(params: FailTransfersRequest): Promise<boolean>;
  getAddress(): Promise<string>;
  getAssetBalance(asset_id: string): Promise<AssetBalance>;
  getBtcBalance(): Promise<BtcBalance>;
  getLightningReceiveStatus(id: string): Promise<RlnInvoiceStatus>;
  getLightningSendStatus(id: string): Promise<RlnPaymentStatus | null>;
  getNetwork(): Network;
  getNetworkInfo(): Promise<LightningNetworkInfo>;
  getNodeInfo(): Promise<LightningNodeInfo>;
  getXpub(): { xpubVan: string; xpubCol: string };
  goOnline(indexerUrl?: string, skipConsistencyCheck?: boolean): Promise<void>;
  inflate(
    params: InflateAssetIfaRequestModel,
    mnemonic?: string
  ): Promise<OperationResult>;
  inflateBegin(params: InflateAssetIfaRequestModel): Promise<string>;
  inflateEnd(params: InflateEndRequestModel): Promise<OperationResult>;
  invoiceStatus(invoice: string): Promise<RlnInvoiceStatus>;
  issueAssetIfa(params: IssueAssetIfaRequestModel): Promise<any>;
  issueAssetNia(params: IssueAssetNiaRequestModel): Promise<AssetNIA>;
  keysend(
    destPubkey: string,
    amtMsat: number,
    assetId?: string,
    assetAmount?: number
  ): Promise<SendPaymentResult>;
  listAssets(): Promise<ListAssets>;
  listChannels(): Promise<LightningChannel[]>;
  listLightningPayments(): Promise<ListLightningPaymentsResponse>;
  listOnchainTransfers(asset_id?: string): Promise<Transfer[]>;
  listPayments(): Promise<LightningPayment[]>;
  listPeers(): Promise<LightningPeer[]>;
  listTransactions(): Promise<Transaction[]>;
  listTransfers(asset_id?: string): Promise<Transfer[]>;
  listUnspents(): Promise<Unspent[]>;
  onchainReceive(
    params: OnchainReceiveRequestModel
  ): Promise<OnchainReceiveResponse>;
  onchainSend(
    params: SendAssetBeginRequestModel,
    mnemonic?: string
  ): Promise<OnchainSendResponse>;
  onchainSendBegin(params: SendAssetBeginRequestModel): Promise<string>;
  onchainSendEnd(
    params: SendAssetEndRequestModel
  ): Promise<OnchainSendResponse>;
  openChannel(params: OpenChannelParams): Promise<OpenChannelResult>;
  payLightningInvoice(
    params: PayLightningInvoiceRequestModel
  ): Promise<LightningSendRequest>;
  refreshWallet(): Promise<void>;
  rotateColoredAddress(): Promise<string>;
  rotateVanillaAddress(): Promise<string>;
  sendBtc(params: SendBtcBeginRequestModel): Promise<string>;
  sendBtcBegin(params: SendBtcBeginRequestModel): Promise<string>;
  sendBtcEnd(params: SendBtcEndRequestModel): Promise<string>;
  signMessage(message: string): Promise<string>;
  signPsbt(psbt: string, mnemonic?: string): Promise<string>;
  syncWallet(): Promise<void>;
  verifyMessage(
    message: string,
    signature: string,
    accountXpub?: string
  ): Promise<boolean>;
  vssBackup(config?: VssBackupConfig): Promise<number>;
  vssBackupInfo(config?: VssBackupConfig): Promise<VssBackupInfo>;
  vssClearFence(password?: string): Promise<void>;
  witnessReceive(params: InvoiceRequest): Promise<InvoiceReceiveData>;
}
