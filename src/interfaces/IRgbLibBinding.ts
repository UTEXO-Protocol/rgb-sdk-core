import type {
  BtcBalance,
  Unspent,
  ListAssets,
  AssetBalance,
  AssetNIA,
  AssetIfa,
  CreateUtxosBeginRequestModel,
  CreateUtxosEndRequestModel,
  SendAssetBeginRequestModel,
  SendAssetEndRequestModel,
  SendResult,
  SendBtcBeginRequestModel,
  SendBtcEndRequestModel,
  InvoiceRequest,
  InvoiceReceiveData,
  InvoiceData,
  IssueAssetNiaRequestModel,
  IssueAssetIfaRequestModel,
  InflateAssetIfaRequestModel,
  InflateEndRequestModel,
  OperationResult,
  Transaction,
  Transfer,
  FailTransfersRequest,
  WalletBackupResponse,
  VssBackupConfig,
  VssBackupInfo,
  GetFeeEstimationResponse,
  RecipientMap,
} from '../types/wallet-model';

/**
 * Platform-agnostic interface for rgb-lib bindings.
 *
 * Each platform (Node napi, React Native JSI, WASM) provides a concrete
 * implementation that normalises its binding's raw output to the canonical
 * wallet-model.ts types.
 */
export interface IRgbLibBinding {
  /** Connect the wallet (set online state). */
  getOnline(): void;
  /** Tear down the wallet instance. */
  dropWallet(): void;
  /** Register the wallet and return the first address + balance snapshot. */
  registerWallet(): { address: string; btcBalance: BtcBalance };

  getBtcBalance(): Promise<BtcBalance>;
  getAddress(): Promise<string>;

  listUnspents(): Promise<Unspent[]>;
  createUtxosBegin(params: CreateUtxosBeginRequestModel): Promise<string>;
  createUtxosEnd(params: CreateUtxosEndRequestModel): Promise<number>;

  listAssets(): Promise<ListAssets>;
  getAssetBalance(assetId: string): Promise<AssetBalance>;
  issueAssetNia(params: IssueAssetNiaRequestModel): Promise<AssetNIA>;
  issueAssetIfa(params: IssueAssetIfaRequestModel): Promise<AssetIfa>;
  inflateBegin(params: InflateAssetIfaRequestModel): Promise<string>;
  inflateEnd(params: InflateEndRequestModel): Promise<OperationResult>;

  sendBegin(params: SendAssetBeginRequestModel): Promise<string>;
  sendBeginBatch(params: {
    recipientMap: RecipientMap;
    feeRate?: number;
    minConfirmations?: number;
    donation?: boolean;
  }): Promise<string>;
  sendEnd(params: SendAssetEndRequestModel): Promise<SendResult>;

  sendBtcBegin(params: SendBtcBeginRequestModel): Promise<string>;
  sendBtcEnd(params: SendBtcEndRequestModel): Promise<string>;

  blindReceive(params: InvoiceRequest): Promise<InvoiceReceiveData>;
  witnessReceive(params: InvoiceRequest): Promise<InvoiceReceiveData>;
  decodeRGBInvoice(params: { invoice: string }): Promise<InvoiceData>;

  listTransactions(): Promise<Transaction[]>;
  listTransfers(assetId?: string): Promise<Transfer[]>;
  failTransfers(params: FailTransfersRequest): Promise<boolean>;
  refreshWallet(): void;
  syncWallet(): void;

  getFeeEstimation(params: { blocks: number }): Promise<GetFeeEstimationResponse>;
  createBackup(params: { backupPath: string; password: string }): Promise<WalletBackupResponse>;

  configureVssBackup(config: VssBackupConfig): void;
  disableVssAutoBackup(): void;
  vssBackup(config: VssBackupConfig): Promise<number>;
  vssBackupInfo(config: VssBackupConfig): Promise<VssBackupInfo>;
}
