import { normalizeNetwork } from '../utils/validation';
import { seedFromMnemonic } from '../crypto/keys';
import { ValidationError, WalletError } from '../errors';
import type {
  IWalletManager,
  WalletInitParams,
} from '../interfaces/IWalletManager';
import type { IRgbLibBinding } from '../interfaces/IRgbLibBinding';
import type { ISigner } from '../interfaces/ISigner';
import type { EstimateFeeResult, Network } from '../crypto/types';
import type {
  BtcBalance,
  Unspent,
  ListAssets,
  AssetBalance,
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
  AssetNIA,
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
 * Abstract base class for wallet managers across all platforms.
 *
 * Phase 14: Constructor injection of IRgbLibBinding + ISigner eliminates
 * the need for 35 abstract method overrides in each platform SDK.
 * Only initialize() and goOnline() remain abstract — they require
 * platform-specific setup that cannot be expressed through the binding interface.
 *
 * Usage:
 *   class WalletManager extends BaseWalletManager {
 *     constructor(params: WalletInitParams) {
 *       super(params, new NodeRgbLibBinding(params), new NodeSigner());
 *     }
 *     async initialize(): Promise<void> { ... }
 *     async goOnline(url: string): Promise<void> { ... }
 *   }
 */
export abstract class BaseWalletManager implements IWalletManager {
  protected readonly xpubVan: string;
  protected readonly xpubCol: string;
  protected mnemonic: string | null;
  protected seed: Uint8Array | null;
  protected readonly network: Network;
  protected readonly masterFingerprint: string;
  protected disposed: boolean = false;

  protected readonly binding: IRgbLibBinding | null;
  protected readonly signer: ISigner | null;

  constructor(
    params: WalletInitParams,
    binding?: IRgbLibBinding,
    signer?: ISigner
  ) {
    if (!params.xpubVan) {
      throw new ValidationError('xpubVan is required', 'xpubVan');
    }
    if (!params.xpubCol) {
      throw new ValidationError('xpubCol is required', 'xpubCol');
    }
    if (!params.masterFingerprint) {
      throw new ValidationError(
        'masterFingerprint is required',
        'masterFingerprint'
      );
    }

    this.network = normalizeNetwork(params.network ?? 'regtest');
    this.xpubVan = params.xpubVan;
    this.xpubCol = params.xpubCol;
    this.mnemonic = params.mnemonic ?? null;
    this.seed = params.seed ?? (this.mnemonic ? seedFromMnemonic(this.mnemonic) : null);
    this.masterFingerprint = params.masterFingerprint;
    this.binding = binding ?? null;
    this.signer = signer ?? null;
  }

  // ── Platform-specific abstract methods (2 remain) ────────────────────────────

  abstract initialize(): Promise<void>;
  abstract goOnline(
    indexerUrl: string,
    skipConsistencyCheck?: boolean
  ): Promise<void>;

  // ── Tear down helper (uses binding if available) ──────────────────────────────

  protected dropWallet(): void {
    this.binding?.dropWallet();
  }

  // ── Shared concrete helpers ───────────────────────────────────────────────────

  public getXpub(): { xpubVan: string; xpubCol: string } {
    return { xpubVan: this.xpubVan, xpubCol: this.xpubCol };
  }

  public getNetwork(): Network {
    return this.network;
  }

  public isDisposed(): boolean {
    return this.disposed;
  }

  public async dispose(): Promise<void> {
    if (this.disposed) return;

    if (this.mnemonic !== null) {
      this.mnemonic = null;
    }
    if (this.seed !== null && this.seed.length > 0) {
      this.seed.fill(0);
      this.seed = null;
    }

    this.dropWallet();
    this.disposed = true;
  }

  protected ensureNotDisposed(): void {
    if (this.disposed) {
      throw new WalletError('Wallet has been disposed');
    }
  }

  protected requireBinding(): IRgbLibBinding {
    if (!this.binding) {
      throw new WalletError(
        'No IRgbLibBinding provided. Pass a binding to the BaseWalletManager constructor.'
      );
    }
    return this.binding;
  }

  protected requireSigner(): ISigner {
    if (!this.signer) {
      throw new WalletError(
        'No ISigner provided. Pass a signer to the BaseWalletManager constructor.'
      );
    }
    return this.signer;
  }

  // ── Balance & Address ─────────────────────────────────────────────────────────

  async getBtcBalance(): Promise<BtcBalance> {
    this.ensureNotDisposed();
    return this.requireBinding().getBtcBalance();
  }

  async getAddress(): Promise<string> {
    this.ensureNotDisposed();
    return this.requireBinding().getAddress();
  }

  // ── UTXO Management ───────────────────────────────────────────────────────────

  async listUnspents(): Promise<Unspent[]> {
    this.ensureNotDisposed();
    return this.requireBinding().listUnspents();
  }

  async createUtxosBegin(
    params: CreateUtxosBeginRequestModel
  ): Promise<string> {
    this.ensureNotDisposed();
    return this.requireBinding().createUtxosBegin(params);
  }

  async createUtxosEnd(params: CreateUtxosEndRequestModel): Promise<number> {
    this.ensureNotDisposed();
    return this.requireBinding().createUtxosEnd(params);
  }

  // ── Asset Operations ──────────────────────────────────────────────────────────

  async listAssets(): Promise<ListAssets> {
    this.ensureNotDisposed();
    return this.requireBinding().listAssets();
  }

  async getAssetBalance(asset_id: string): Promise<AssetBalance> {
    this.ensureNotDisposed();
    return this.requireBinding().getAssetBalance(asset_id);
  }

  async issueAssetNia(params: IssueAssetNiaRequestModel): Promise<AssetNIA> {
    this.ensureNotDisposed();
    return this.requireBinding().issueAssetNia(params);
  }

  async issueAssetIfa(params: IssueAssetIfaRequestModel): Promise<any> {
    this.ensureNotDisposed();
    return this.requireBinding().issueAssetIfa(params);
  }

  async inflateBegin(params: InflateAssetIfaRequestModel): Promise<string> {
    this.ensureNotDisposed();
    return this.requireBinding().inflateBegin(params);
  }

  async inflateEnd(params: InflateEndRequestModel): Promise<OperationResult> {
    this.ensureNotDisposed();
    return this.requireBinding().inflateEnd(params);
  }

  // ── Sending Assets ────────────────────────────────────────────────────────────

  async sendBegin(params: SendAssetBeginRequestModel): Promise<string> {
    this.ensureNotDisposed();
    return this.requireBinding().sendBegin(params);
  }

  async sendEnd(params: SendAssetEndRequestModel): Promise<SendResult> {
    this.ensureNotDisposed();
    return this.requireBinding().sendEnd(params);
  }

  async sendBtcBegin(params: SendBtcBeginRequestModel): Promise<string> {
    this.ensureNotDisposed();
    return this.requireBinding().sendBtcBegin(params);
  }

  async sendBtcEnd(params: SendBtcEndRequestModel): Promise<string> {
    this.ensureNotDisposed();
    return this.requireBinding().sendBtcEnd(params);
  }

  // ── Receiving Assets ──────────────────────────────────────────────────────────

  async blindReceive(params: InvoiceRequest): Promise<InvoiceReceiveData> {
    this.ensureNotDisposed();
    return this.requireBinding().blindReceive(params);
  }

  async witnessReceive(params: InvoiceRequest): Promise<InvoiceReceiveData> {
    this.ensureNotDisposed();
    return this.requireBinding().witnessReceive(params);
  }

  async decodeRGBInvoice(params: { invoice: string }): Promise<InvoiceData> {
    this.ensureNotDisposed();
    return this.requireBinding().decodeRGBInvoice(params);
  }

  // ── Transactions & Transfers ──────────────────────────────────────────────────

  async listTransactions(): Promise<Transaction[]> {
    this.ensureNotDisposed();
    return this.requireBinding().listTransactions();
  }

  async listTransfers(asset_id?: string): Promise<Transfer[]> {
    this.ensureNotDisposed();
    return this.requireBinding().listTransfers(asset_id);
  }

  async failTransfers(params: FailTransfersRequest): Promise<boolean> {
    this.ensureNotDisposed();
    return this.requireBinding().failTransfers(params);
  }

  async refreshWallet(): Promise<void> {
    this.ensureNotDisposed();
    this.requireBinding().refreshWallet();
  }

  async syncWallet(): Promise<void> {
    this.ensureNotDisposed();
    this.requireBinding().syncWallet();
  }

  // ── Fee Estimation ────────────────────────────────────────────────────────────

  async estimateFeeRate(blocks: number): Promise<GetFeeEstimationResponse> {
    this.ensureNotDisposed();
    if (!Number.isFinite(blocks)) {
      throw new ValidationError('blocks must be a finite number', 'blocks');
    }
    if (!Number.isInteger(blocks) || blocks <= 0) {
      throw new ValidationError('blocks must be a positive integer', 'blocks');
    }
    return this.requireBinding().getFeeEstimation({ blocks });
  }

  async estimateFee(psbtBase64: string): Promise<EstimateFeeResult> {
    this.ensureNotDisposed();
    return this.requireSigner().estimateFee(psbtBase64);
  }

  // ── Backup & Restore ──────────────────────────────────────────────────────────

  async createBackup(params: {
    backupPath: string;
    password: string;
  }): Promise<WalletBackupResponse> {
    this.ensureNotDisposed();
    return this.requireBinding().createBackup(params);
  }

  // ── VSS Cloud Backup ──────────────────────────────────────────────────────────

  async configureVssBackup(config: VssBackupConfig): Promise<void> {
    this.ensureNotDisposed();
    this.requireBinding().configureVssBackup(config);
  }

  async disableVssAutoBackup(): Promise<void> {
    this.ensureNotDisposed();
    this.requireBinding().disableVssAutoBackup();
  }

  async vssBackup(config: VssBackupConfig): Promise<number> {
    this.ensureNotDisposed();
    return this.requireBinding().vssBackup(config);
  }

  async vssBackupInfo(config: VssBackupConfig): Promise<VssBackupInfo> {
    this.ensureNotDisposed();
    return this.requireBinding().vssBackupInfo(config);
  }

  // ── Cryptographic Operations ──────────────────────────────────────────────────

  async signMessage(message: string): Promise<string> {
    this.ensureNotDisposed();
    if (!message) {
      throw new ValidationError('message is required', 'message');
    }
    if (!this.seed) {
      throw new WalletError(
        'Wallet seed is required for message signing. Initialize the wallet with a seed.'
      );
    }
    return this.requireSigner().signMessage({
      message,
      seed: this.seed,
      network: this.network,
    });
  }

  async verifyMessage(
    message: string,
    signature: string,
    accountXpub?: string
  ): Promise<boolean> {
    if (!message) {
      throw new ValidationError('message is required', 'message');
    }
    if (!signature) {
      throw new ValidationError('signature is required', 'signature');
    }
    return this.requireSigner().verifyMessage({
      message,
      signature,
      accountXpub: accountXpub ?? this.xpubVan,
      network: this.network,
    });
  }

  // ── Internal PSBT signing helpers ────────────────────────────────────────────

  protected async _signPsbtWithMnemonic(
    mnemonic: string,
    psbt: string,
    network: Network
  ): Promise<string> {
    return this.requireSigner().signPsbtWithMnemonic(mnemonic, psbt, network);
  }

  protected async _signPsbtWithSeed(
    seed: Uint8Array,
    psbt: string,
    network: Network
  ): Promise<string> {
    return this.requireSigner().signPsbtWithSeed(seed, psbt, network);
  }

  public async signPsbt(psbt: string, mnemonic?: string): Promise<string> {
    this.ensureNotDisposed();
    const mnemonicToUse = mnemonic ?? this.mnemonic;

    if (mnemonicToUse) {
      return this._signPsbtWithMnemonic(mnemonicToUse, psbt, this.network);
    }
    if (this.seed) {
      return this._signPsbtWithSeed(this.seed, psbt, this.network);
    }

    throw new WalletError(
      'mnemonic is required. Provide it as parameter or initialize wallet with mnemonic.'
    );
  }

  // ── Compound operations (begin → sign → end) ─────────────────────────────────

  public async send(
    invoiceTransfer: SendAssetBeginRequestModel,
    mnemonic?: string
  ): Promise<SendResult> {
    this.ensureNotDisposed();
    const psbt = await this.sendBegin(invoiceTransfer);
    const signedPsbt = await this.signPsbt(psbt, mnemonic);
    return this.sendEnd({ signedPsbt });
  }

  public async sendBtc(params: SendBtcBeginRequestModel): Promise<string> {
    this.ensureNotDisposed();
    const psbt = await this.sendBtcBegin(params);
    const signed = await this.signPsbt(psbt);
    return this.sendBtcEnd({ signedPsbt: signed });
  }

  public async createUtxos({
    upTo,
    num,
    size,
    feeRate,
  }: {
    upTo?: boolean;
    num?: number;
    size?: number;
    feeRate?: number;
  }): Promise<number> {
    this.ensureNotDisposed();
    const psbt = await this.createUtxosBegin({ upTo, num, size, feeRate });
    const signedPsbt = await this.signPsbt(psbt);
    return this.createUtxosEnd({ signedPsbt });
  }

  public async inflate(
    params: InflateAssetIfaRequestModel,
    mnemonic?: string
  ): Promise<OperationResult> {
    this.ensureNotDisposed();
    const psbt = await this.inflateBegin(params);
    const signedPsbt = await this.signPsbt(psbt, mnemonic);
    return this.inflateEnd({ signedPsbt });
  }

  public async sendBeginBatch(params: {
    recipientMap: RecipientMap;
    feeRate?: number;
    minConfirmations?: number;
    donation?: boolean;
  }): Promise<string> {
    this.ensureNotDisposed();
    return this.requireBinding().sendBeginBatch(params);
  }

  public async sendBatch(
    params: {
      recipientMap: RecipientMap;
      feeRate?: number;
      minConfirmations?: number;
      donation?: boolean;
    },
    mnemonic?: string
  ): Promise<SendResult> {
    this.ensureNotDisposed();
    const psbt = await this.sendBeginBatch(params);
    const signedPsbt = await this.signPsbt(psbt, mnemonic);
    return this.sendEnd({ signedPsbt });
  }
}
