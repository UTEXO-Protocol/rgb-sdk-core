import type {
  CreateUtxosBeginRequestModel,
  CreateUtxosEndRequestModel,
  FailTransfersRequest,
  InvoiceRequest,
  InvoiceReceiveData,
  IssueAssetNiaRequestModel,
  IssueAssetIfaRequestModel,
  SendAssetBeginRequestModel,
  SendAssetEndRequestModel,
  SendResult,
  BtcBalance,
  Unspent,
  WalletBackupResponse,
  SendBtcBeginRequestModel,
  SendBtcEndRequestModel,
  GetFeeEstimationResponse,
  InflateAssetIfaRequestModel,
  InflateEndRequestModel,
  OperationResult,
  AssetNIA,
  AssetBalance,
  ListAssets,
  Transaction,
  Transfer,
  InvoiceData,
  VssBackupConfig,
  VssBackupInfo,
} from '../types/wallet-model';
import type { EstimateFeeResult, Network } from '../crypto/types';

/**
 * Wallet initialization parameters
 */
export interface WalletInitParams {
  xpubVan: string;
  xpubCol: string;
  mnemonic?: string;
  seed?: Uint8Array;
  network?: string | number;
  xpub?: string;
  masterFingerprint: string;
  transportEndpoint?: string;
  indexerUrl?: string;
  dataDir?: string;
  reuseAddresses?: boolean;
  vanillaKeychain?: number | null;
  maxAllocationsPerUtxo?: number;
}

/**
 * Unified WalletManager interface for cross-platform compatibility.
 * All methods are async to support native module requirements.
 */
export interface IWalletManager {
  // ── Initialization & Lifecycle ───────────────────────────────────────────────

  initialize(): Promise<void>;
  goOnline(indexerUrl: string, skipConsistencyCheck?: boolean): Promise<void>;
  getXpub(): { xpubVan: string; xpubCol: string };
  getNetwork(): Network;
  dispose(): Promise<void>;
  isDisposed(): boolean;

  // ── Balance & Address ────────────────────────────────────────────────────────

  getBtcBalance(): Promise<BtcBalance>;
  getAddress(): Promise<string>;
  rotateVanillaAddress(): Promise<string>;
  rotateColoredAddress(): Promise<string>;

  // ── UTXO Management ──────────────────────────────────────────────────────────

  listUnspents(): Promise<Unspent[]>;
  createUtxosBegin(params: CreateUtxosBeginRequestModel): Promise<string>;
  createUtxosEnd(params: CreateUtxosEndRequestModel): Promise<number>;
  createUtxos(params: {
    upTo?: boolean;
    num?: number;
    size?: number;
    feeRate?: number;
  }): Promise<number>;

  // ── Asset Operations ─────────────────────────────────────────────────────────

  listAssets(): Promise<ListAssets>;
  getAssetBalance(asset_id: string): Promise<AssetBalance>;
  issueAssetNia(params: IssueAssetNiaRequestModel): Promise<AssetNIA>;
  issueAssetIfa(params: IssueAssetIfaRequestModel): Promise<any>;
  inflateBegin(params: InflateAssetIfaRequestModel): Promise<string>;
  inflateEnd(params: InflateEndRequestModel): Promise<OperationResult>;
  inflate(
    params: InflateAssetIfaRequestModel,
    mnemonic?: string
  ): Promise<OperationResult>;

  // ── Sending Assets ───────────────────────────────────────────────────────────

  sendBegin(params: SendAssetBeginRequestModel): Promise<string>;
  sendEnd(params: SendAssetEndRequestModel): Promise<SendResult>;
  send(
    invoiceTransfer: SendAssetBeginRequestModel,
    mnemonic?: string
  ): Promise<SendResult>;

  // ── Sending BTC ──────────────────────────────────────────────────────────────

  sendBtcBegin(params: SendBtcBeginRequestModel): Promise<string>;
  sendBtcEnd(params: SendBtcEndRequestModel): Promise<string>;
  sendBtc(params: SendBtcBeginRequestModel): Promise<string>;

  // ── Receiving Assets ─────────────────────────────────────────────────────────

  blindReceive(params: InvoiceRequest): Promise<InvoiceReceiveData>;
  witnessReceive(params: InvoiceRequest): Promise<InvoiceReceiveData>;
  decodeRGBInvoice(params: { invoice: string }): Promise<InvoiceData>;

  // ── Transactions & Transfers ─────────────────────────────────────────────────

  listTransactions(): Promise<Transaction[]>;
  listTransfers(asset_id?: string): Promise<Transfer[]>;
  failTransfers(params: FailTransfersRequest): Promise<boolean>;
  refreshWallet(): Promise<void>;
  syncWallet(): Promise<void>;

  // ── VSS Cloud Backup (optional — Node SDK only today) ────────────────────────

  configureVssBackup(config: VssBackupConfig): Promise<void>;
  disableVssAutoBackup(): Promise<void>;
  vssBackup(config: VssBackupConfig): Promise<number>;
  vssBackupInfo(config: VssBackupConfig): Promise<VssBackupInfo>;

  // ── Fee Estimation ───────────────────────────────────────────────────────────

  estimateFeeRate(blocks: number): Promise<GetFeeEstimationResponse>;
  estimateFee(psbtBase64: string): Promise<EstimateFeeResult>;

  // ── Backup & Restore ─────────────────────────────────────────────────────────

  createBackup(params: {
    backupPath: string;
    password: string;
  }): Promise<WalletBackupResponse>;

  // ── Cryptographic Operations ─────────────────────────────────────────────────

  signPsbt(psbt: string, mnemonic?: string): Promise<string>;
  signMessage(message: string): Promise<string>;
  verifyMessage(
    message: string,
    signature: string,
    accountXpub?: string
  ): Promise<boolean>;
}
