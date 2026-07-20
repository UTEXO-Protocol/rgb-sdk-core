// ─── Bitcoin / Network ────────────────────────────────────────────────────────

export type BitcoinNetwork =
  | 'mainnet'
  | 'testnet'
  | 'testnet4'
  | 'regtest'
  | 'signet'
  | 'utexo';

// ─── Wallet backup ────────────────────────────────────────────────────────────

export interface FailTransfersRequest {
  batchTransferIdx?: number;
  noAssetOnly?: boolean;
  skipSync?: boolean;
}

export interface WalletBackupResponse {
  message: string;
  backupPath: string;
}

export interface WalletRestoreResponse {
  message: string;
}

export interface RestoreWalletRequestModel {
  backupFilePath: string;
  password: string;
  dataDir: string;
}

// ─── VSS (Versioned Storage Service) backup ───────────────────────────────────

/** VSS backup mode: Async (fire-and-forget) or Blocking (wait for upload). */
export type VssBackupMode = 'Async' | 'Blocking';

/**
 * VSS backup configuration for cloud backup.
 * serverUrl, storeId and signingKey are required; other fields are optional.
 */
export interface VssBackupConfig {
  serverUrl: string;
  storeId: string;
  /** Signing key as a hex-encoded 32-byte secret key string. */
  signingKey: string;
  encryptionEnabled?: boolean;
  autoBackup?: boolean;
  backupMode?: VssBackupMode;
}

/** Information about the current VSS backup status for a wallet. */
export interface VssBackupInfo {
  backupExists: boolean;
  serverVersion?: number | null;
  backupRequired: boolean;
}

// ─── Core request / response models ──────────────────────────────────────────

export interface WitnessData {
  amountSat: number;
  blinding?: number;
}

/** amount is optional — omit to receive any amount */
export interface InvoiceRequest {
  amount?: number;
  assetId?: string;
  minConfirmations?: number;
  durationSeconds?: number;
}

export interface Recipient {
  recipientId: string;
  witnessData?: WitnessData;
  amount: number;
  transportEndpoints: string[];
}

export type BatchRecipient = {
  recipientId: string;
  witnessData?: { amountSat: string; blinding?: number | null } | null;
  assignment: { Fungible: number };
  transportEndpoints: string[];
};

export type RecipientMap = Record<string, BatchRecipient[]>;

export interface IssueAssetNiaRequestModel {
  ticker: string;
  name: string;
  amounts: number[];
  precision: number;
}

export interface IssueAssetIfaRequestModel {
  ticker: string;
  name: string;
  precision: number;
  amounts: number[];
  inflationAmounts: number[];
  replaceRightsNum: number;
  rejectListUrl: string | null;
}

export interface SendAssetBeginRequestModel {
  invoice: string;
  witnessData?: WitnessData;
  assetId?: string;
  amount?: number;
  donation?: boolean;
  feeRate?: number;
  minConfirmations?: number;
}

export interface SendAssetEndRequestModel {
  signedPsbt: string;
  skipSync?: boolean;
}

export interface SendResult {
  txid: string;
  batchTransferIdx: number;
}

export interface OperationResult {
  txid: string;
  batchTransferIdx: number;
}

export interface CreateUtxosBeginRequestModel {
  upTo?: boolean;
  num?: number;
  size?: number;
  feeRate?: number;
}

export interface CreateUtxosEndRequestModel {
  signedPsbt: string;
  skipSync?: boolean;
}

export interface InflateAssetIfaRequestModel {
  assetId: string;
  inflationAmounts: number[];
  feeRate?: number;
  minConfirmations?: number;
}

export interface InflateEndRequestModel {
  signedPsbt: string;
}

export interface SendBtcBeginRequestModel {
  address: string;
  amount: number;
  feeRate: number;
  skipSync?: boolean;
}

export interface SendBtcEndRequestModel {
  signedPsbt: string;
  skipSync?: boolean;
}

export interface GetFeeEstimationRequestModel {
  blocks: number;
}

/** Canonical fee-estimation result. */
export interface GetFeeEstimationResponse {
  feeRate: number;
}

// ─── Transactions & Transfers ─────────────────────────────────────────────────

/**
 * Transaction kinds emitted by RLN.
 *
 * `SendBtc` and `Incoming` are emitted by the node; they previously had no
 * core counterpart and were folded into `'User'`, losing information.
 */
export type TransactionType =
  | 'RgbSend'
  | 'Drain'
  | 'CreateUtxos'
  | 'SendBtc'
  | 'Incoming'
  | 'User';

export interface BlockTime {
  height: number;
  timestamp: number;
}

export interface Transaction {
  transactionType: TransactionType;
  txid: string;
  received: number;
  sent: number;
  fee: number;
  confirmationTime?: BlockTime;
}

export type TransferKind =
  | 'Issuance'
  | 'ReceiveBlind'
  | 'ReceiveWitness'
  | 'Send'
  | 'Inflation';

export type Outpoint = {
  txid: string;
  vout: number;
};

export type AssignmentType =
  | 'Fungible'
  | 'NonFungible'
  | 'InflationRight'
  | 'ReplaceRight'
  | 'Any';

export type Assignment = {
  type: AssignmentType;
  amount?: number;
};

export interface Transfer {
  idx: number;
  batchTransferIdx: number;
  createdAt: number;
  updatedAt: number;
  status: TransferStatus;
  requestedAssignment?: Assignment;
  assignments: Assignment[];
  kind: TransferKind;
  txid?: string;
  recipientId?: string;
  receiveUtxo?: Outpoint;
  changeUtxo?: Outpoint;
  expiration?: number;
  transportEndpoints: {
    endpoint: string;
    transportType: string;
    used: boolean;
  }[];
  invoiceString?: string;
  consignmentPath?: string;
}

export type TransferStatus =
  | 'WaitingCounterparty'
  | 'WaitingConfirmations'
  | 'Settled'
  | 'Failed';

// ─── UTXOs & Balances ─────────────────────────────────────────────────────────

export interface Unspent {
  utxo: Utxo;
  rgbAllocations: RgbAllocation[];
  pendingBlinded: number;
}

export interface Utxo {
  outpoint: {
    txid: string;
    vout: number;
  };
  btcAmount: number;
  colorable: boolean;
  exists: boolean;
}

export interface RgbAllocation {
  assetId?: string;
  assignment: Assignment;
  settled: boolean;
}

export interface Balance {
  settled: number;
  future: number;
  spendable: number;
}

export interface BtcBalance {
  vanilla: Balance;
  colored: Balance;
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export interface InvoiceReceiveData {
  invoice: string;
  recipientId: string;
  expirationTimestamp: number | null;
  batchTransferIdx: number;
}

export interface InvoiceData {
  invoice: string;
  recipientId: string;
  assetSchema?: AssetSchema;
  assetId?: string;
  network: BitcoinNetwork;
  assignment: Assignment;
  assignmentName?: string;
  expirationTimestamp: number | null;
  transportEndpoints: string[];
}

// ─── Assets ───────────────────────────────────────────────────────────────────

export enum AssetIface {
  RGB20 = 'RGB20',
  RGB21 = 'RGB21',
  RGB25 = 'RGB25',
}

export enum AssetSchema {
  Nia = 'Nia',
  Uda = 'Uda',
  Cfa = 'Cfa',
}

export interface Media {
  filePath?: string;
  mime?: string;
}

export interface AssetNIA {
  assetId: string;
  assetIface?: AssetIface;
  ticker: string;
  name: string;
  details?: string | null;
  precision: number;
  issuedSupply: number;
  timestamp: number;
  addedAt: number;
  balance: Balance;
  media?: Media | null;
}

export interface AssetIfa {
  assetId: string;
  ticker: string;
  name: string;
  details?: string;
  precision: number;
  initialSupply: number;
  maxSupply: number;
  knownCirculatingSupply: number;
  timestamp: number;
  addedAt: number;
  balance: Balance;
  media?: Media;
  rejectListUrl?: string;
}

export type AssetUDA = {
  assetId: string;
  ticker: string;
  name: string;
  details?: string;
  precision: number;
  timestamp: number;
  addedAt: number;
  balance: Balance;
  token?: {
    index: number;
    ticker?: string;
    name?: string;
    details?: string;
    embeddedMedia: boolean;
    media?: Media;
    attachments: Array<{
      key: number;
      filePath: string;
      mime: string;
      digest: string;
    }>;
    reserves: boolean;
  };
};

export type AssetCFA = {
  assetId: string;
  name: string;
  details?: string;
  precision: number;
  issuedSupply: number;
  timestamp: number;
  addedAt: number;
  balance: Balance;
  media?: Media;
};

export type ListAssets = {
  nia: AssetNIA[];
  uda: AssetUDA[];
  cfa: AssetCFA[];
  ifa: AssetIfa[];
};

export interface IssueAssetNIAResponse {
  asset?: AssetNIA;
}

export interface AssetBalance {
  settled?: number;
  future?: number;
  spendable?: number;
  offchainOutbound?: number;
  offchainInbound?: number;
}

// ─── Public keys ──────────────────────────────────────────────────────────────

export interface PublicKeys {
  xpub: string;
  accountXpubVanilla: string;
  accountXpubColored: string;
  masterFingerprint: string;
}

// ─── UTEXO Protocol — Lightning ───────────────────────────────────────────────

export interface LightningAsset {
  assetId: string;
  amount: number;
}

export interface CreateLightningInvoiceRequestModel {
  amountSats?: number;
  /** Omit for a BTC-only invoice. */
  asset?: LightningAsset;
  expirySeconds?: number;
  /** Pre-image hash for a HODL invoice. */
  paymentHash?: string | null;
  minFinalCltvExpiryDelta?: number | null;
}

export interface LightningReceiveRequest {
  lnInvoice: string;
  expiresAt?: number;
  requestId?: string;
}

export interface LightningSendRequest {
  txid: string;
  status?: string;
  consignmentEndpoint?: string;
}

export interface GetLightningSendFeeEstimateRequestModel {
  invoice: string;
  assetId?: string;
}

export interface PayLightningInvoiceRequestModel {
  lnInvoice: string;
  amount?: number;
  assetId?: string;
  /** RGB asset amount for an asset-denominated payment. */
  assetAmount?: number;
}

export interface ListLightningPaymentsResponse {
  payments: LightningSendRequest[];
}

// ─── UTEXO Protocol — Onchain ─────────────────────────────────────────────────

export interface OnchainReceiveRequestModel extends InvoiceRequest {
  /** Omit to receive any amount. */
  amount?: number;
  assetId?: string;
  /** Witness (vs blinded) receive. Default `true`. */
  witness?: boolean;
}

/** Full receive data — both platforms have all of this available. */
export interface OnchainReceiveResponse {
  invoice: string;
  recipientId?: string;
  expirationTimestamp?: number | null;
  batchTransferIdx?: number;
}

/** Mirrors {@link SendAssetBeginRequestModel} so one model serves both paths. */
export interface OnchainSendRequestModel {
  invoice: string;
  assetId?: string;
  amount?: number;
  witnessData?: WitnessData;
  donation?: boolean;
  feeRate?: number;
  minConfirmations?: number;
  skipSync?: boolean;
}

export interface OnchainSendEndRequestModel {
  invoice: string;
  signedPsbt: string;
}

export interface OnchainSendResponse extends SendResult {}
