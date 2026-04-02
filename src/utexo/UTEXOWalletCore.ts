/**
 * UTEXOWalletCore — Abstract base class for UTEXO wallet across all platforms.
 *
 * Provides all bridge/protocol business logic (onchainReceive, onchainSend,
 * Lightning flows, VSS helpers, IWalletManager delegation).
 *
 * Platform SDKs extend this class by:
 *   1. Overriding initialize() to create layer1Wallet and utexoWallet instances.
 *   2. Providing a concrete WalletManager for their platform.
 */

import { deriveKeysFromMnemonicOrSeed } from '../crypto/keys';
import type { Network } from '../crypto/types';
import { ValidationError, WalletError } from '../errors';
import type { IWalletManager } from '../interfaces/IWalletManager';
import type { IUTEXOProtocol } from '../interfaces/IUTEXOProtocol';
import { UTEXOProtocol } from './utexo-protocol';
import {
  getUtxoNetworkConfig,
  getDestinationAsset,
  type UtxoNetworkPreset,
  type UtxoNetworkMap,
  type UtxoNetworkIdMap,
  type NetworkAsset,
} from './utils/network';
import { getBridgeAPI } from './bridge/api';
import type { TransferByMainnetInvoiceResponse } from './bridge/types';
import {
  decodeBridgeInvoice,
  toUnitsNumber,
  fromUnitsNumber,
} from './utils/helpers';
import { DEFAULT_VSS_SERVER_URL, getVssConfigs } from './config/vss';
import type { ConfigOptions } from './config/options';
import { buildVssConfigFromMnemonic } from './restore';
import type {
  PublicKeys,
  BitcoinNetwork,
  BtcBalance,
  Unspent,
  CreateUtxosBeginRequestModel,
  CreateUtxosEndRequestModel,
  FailTransfersRequest,
  InvoiceRequest,
  InvoiceReceiveData,
  IssueAssetNiaRequestModel,
  IssueAssetIfaRequestModel,
  AssetNIA,
  SendAssetBeginRequestModel,
  SendAssetEndRequestModel,
  SendResult,
  SendBtcBeginRequestModel,
  SendBtcEndRequestModel,
  GetFeeEstimationResponse,
  InflateAssetIfaRequestModel,
  InflateEndRequestModel,
  OperationResult,
  AssetBalance,
  ListAssets,
  Transaction,
  Transfer,
  InvoiceData,
  OnchainSendStatus,
  TransferStatus,
  VssBackupConfig,
  VssBackupInfo,
  WalletBackupResponse,
  CreateLightningInvoiceRequestModel,
  LightningReceiveRequest,
  LightningSendRequest,
  PayLightningInvoiceRequestModel,
  OnchainSendRequestModel,
  OnchainSendResponse,
  OnchainReceiveRequestModel,
  OnchainReceiveResponse,
  ListLightningPaymentsResponse,
} from '../types/wallet-model';
import type { EstimateFeeResult } from '../crypto/types';

export abstract class UTEXOWalletCore
  extends UTEXOProtocol
  implements IWalletManager, IUTEXOProtocol
{
  protected readonly mnemonicOrSeed: string | Uint8Array;
  protected readonly options: ConfigOptions;
  protected readonly networkMap: UtxoNetworkMap;
  protected readonly networkIdMap: UtxoNetworkIdMap;
  protected readonly bridge: ReturnType<typeof getBridgeAPI>;

  protected layer1Wallet: IWalletManager | null = null;
  protected utexoWallet: IWalletManager | null = null;

  constructor(
    mnemonicOrSeed: string | Uint8Array,
    options: ConfigOptions = {}
  ) {
    super();
    this.mnemonicOrSeed = mnemonicOrSeed;
    this.options = options;

    const preset: UtxoNetworkPreset = options.network ?? 'mainnet';
    const networkConfig = getUtxoNetworkConfig(preset);
    this.networkMap = networkConfig.networkMap;
    this.networkIdMap = networkConfig.networkIdMap;
    this.bridge = getBridgeAPI(preset);
  }

  // ── Abstract — platform SDK must implement ────────────────────────────────────

  abstract initialize(): Promise<void>;

  // ── Key derivation helpers ────────────────────────────────────────────────────

  async derivePublicKeys(network: BitcoinNetwork): Promise<PublicKeys> {
    const generatedKeys = await deriveKeysFromMnemonicOrSeed(
      network,
      this.mnemonicOrSeed
    );
    const { xpub, accountXpubVanilla, accountXpubColored, masterFingerprint } =
      generatedKeys;
    return { xpub, accountXpubVanilla, accountXpubColored, masterFingerprint };
  }

  async getPubKeys(): Promise<PublicKeys> {
    this.ensureInitialized();
    return this.layer1Wallet!.getXpub() as unknown as PublicKeys;
  }

  // ── Guards ────────────────────────────────────────────────────────────────────

  protected ensureInitialized(): void {
    if (!this.utexoWallet) {
      throw new WalletError('Wallet not initialized. Call initialize() first.');
    }
  }

  // ── IWalletManager: lifecycle ─────────────────────────────────────────────────

  async goOnline(
    _indexerUrl: string,
    _skipConsistencyCheck?: boolean
  ): Promise<void> {
    this.ensureInitialized();
    throw new Error('goOnline not implemented');
  }

  getXpub(): { xpubVan: string; xpubCol: string } {
    this.ensureInitialized();
    return this.utexoWallet!.getXpub();
  }

  getNetwork(): Network {
    this.ensureInitialized();
    return this.utexoWallet!.getNetwork();
  }

  async dispose(): Promise<void> {
    if (this.layer1Wallet) await this.layer1Wallet.dispose();
    if (this.utexoWallet) await this.utexoWallet.dispose();
  }

  isDisposed(): boolean {
    return this.utexoWallet ? this.utexoWallet.isDisposed() : false;
  }

  // ── IWalletManager: delegation to utexoWallet ────────────────────────────────

  async getBtcBalance(): Promise<BtcBalance> {
    this.ensureInitialized();
    return this.utexoWallet!.getBtcBalance();
  }

  async getAddress(): Promise<string> {
    this.ensureInitialized();
    return this.utexoWallet!.getAddress();
  }

  async listUnspents(): Promise<Unspent[]> {
    this.ensureInitialized();
    return this.utexoWallet!.listUnspents();
  }

  async createUtxosBegin(
    params: CreateUtxosBeginRequestModel
  ): Promise<string> {
    this.ensureInitialized();
    return this.utexoWallet!.createUtxosBegin(params);
  }

  async createUtxosEnd(params: CreateUtxosEndRequestModel): Promise<number> {
    this.ensureInitialized();
    return this.utexoWallet!.createUtxosEnd(params);
  }

  async createUtxos(params: {
    upTo?: boolean;
    num?: number;
    size?: number;
    feeRate?: number;
  }): Promise<number> {
    this.ensureInitialized();
    return this.utexoWallet!.createUtxos(params);
  }

  async listAssets(): Promise<ListAssets> {
    this.ensureInitialized();
    return this.utexoWallet!.listAssets();
  }

  async getAssetBalance(asset_id: string): Promise<AssetBalance> {
    this.ensureInitialized();
    return this.utexoWallet!.getAssetBalance(asset_id);
  }

  async issueAssetNia(params: IssueAssetNiaRequestModel): Promise<AssetNIA> {
    this.ensureInitialized();
    return this.utexoWallet!.issueAssetNia(params);
  }

  async issueAssetIfa(params: IssueAssetIfaRequestModel): Promise<any> {
    this.ensureInitialized();
    return this.utexoWallet!.issueAssetIfa(params);
  }

  async inflateBegin(params: InflateAssetIfaRequestModel): Promise<string> {
    this.ensureInitialized();
    return this.utexoWallet!.inflateBegin(params);
  }

  async inflateEnd(params: InflateEndRequestModel): Promise<OperationResult> {
    this.ensureInitialized();
    return this.utexoWallet!.inflateEnd(params);
  }

  async inflate(
    params: InflateAssetIfaRequestModel,
    mnemonic?: string
  ): Promise<OperationResult> {
    this.ensureInitialized();
    return this.utexoWallet!.inflate(params, mnemonic);
  }

  async sendBegin(params: SendAssetBeginRequestModel): Promise<string> {
    this.ensureInitialized();
    return this.utexoWallet!.sendBegin(params);
  }

  async sendEnd(params: SendAssetEndRequestModel): Promise<SendResult> {
    this.ensureInitialized();
    return this.utexoWallet!.sendEnd(params);
  }

  async send(
    invoiceTransfer: SendAssetBeginRequestModel,
    mnemonic?: string
  ): Promise<SendResult> {
    this.ensureInitialized();
    return this.utexoWallet!.send(invoiceTransfer, mnemonic);
  }

  async sendBtcBegin(params: SendBtcBeginRequestModel): Promise<string> {
    this.ensureInitialized();
    return this.utexoWallet!.sendBtcBegin(params);
  }

  async sendBtcEnd(params: SendBtcEndRequestModel): Promise<string> {
    this.ensureInitialized();
    return this.utexoWallet!.sendBtcEnd(params);
  }

  async sendBtc(params: SendBtcBeginRequestModel): Promise<string> {
    this.ensureInitialized();
    return this.utexoWallet!.sendBtc(params);
  }

  async blindReceive(params: InvoiceRequest): Promise<InvoiceReceiveData> {
    this.ensureInitialized();
    return this.utexoWallet!.blindReceive(params);
  }

  async witnessReceive(params: InvoiceRequest): Promise<InvoiceReceiveData> {
    this.ensureInitialized();
    return this.utexoWallet!.witnessReceive(params);
  }

  async decodeRGBInvoice(params: { invoice: string }): Promise<InvoiceData> {
    this.ensureInitialized();
    return this.utexoWallet!.decodeRGBInvoice(params);
  }

  async listTransactions(): Promise<Transaction[]> {
    this.ensureInitialized();
    return this.utexoWallet!.listTransactions();
  }

  async listTransfers(asset_id?: string): Promise<Transfer[]> {
    this.ensureInitialized();
    return this.utexoWallet!.listTransfers(asset_id);
  }

  async failTransfers(params: FailTransfersRequest): Promise<boolean> {
    this.ensureInitialized();
    return this.utexoWallet!.failTransfers(params);
  }

  async refreshWallet(): Promise<void> {
    this.ensureInitialized();
    return this.utexoWallet!.refreshWallet();
  }

  async syncWallet(): Promise<void> {
    this.ensureInitialized();
    return this.utexoWallet!.syncWallet();
  }

  async estimateFeeRate(blocks: number): Promise<GetFeeEstimationResponse> {
    this.ensureInitialized();
    return this.utexoWallet!.estimateFeeRate(blocks);
  }

  async estimateFee(psbtBase64: string): Promise<EstimateFeeResult> {
    this.ensureInitialized();
    return this.utexoWallet!.estimateFee(psbtBase64);
  }

  async createBackup(params: {
    backupPath: string;
    password: string;
  }): Promise<WalletBackupResponse> {
    this.ensureInitialized();
<<<<<<< HEAD
    this.layer1Wallet!.createBackup(params);
=======
    await this.layer1Wallet!.createBackup(params);
>>>>>>> 1abde8ce7278c1d60103f6f8293803c883efda64
    return this.utexoWallet!.createBackup(params);
  }

  // ── VSS config helper ─────────────────────────────────────────────────────────

  /**
   * Returns the default VSS config that will be used for zero-arg vssBackup / vssBackupInfo calls.
   * Useful when you need to capture the config (e.g. to pass it to restoreFromVss later).
   */
  async getDefaultVssConfig(): Promise<VssBackupConfig> {
    return this._resolveVssConfig();
  }

  // ── IWalletManager: VSS (delegates to both wallets) ──────────────────────────

  async configureVssBackup(config: VssBackupConfig): Promise<void> {
    this.ensureInitialized();
    const { layer1, utexo } = getVssConfigs(config);
    await this.layer1Wallet!.configureVssBackup(layer1);
    await this.utexoWallet!.configureVssBackup(utexo);
  }

  async disableVssAutoBackup(): Promise<void> {
    this.ensureInitialized();
    await this.layer1Wallet!.disableVssAutoBackup();
    await this.utexoWallet!.disableVssAutoBackup();
  }

  async vssBackup(
    config?: VssBackupConfig,
    mnemonic?: string
  ): Promise<number> {
    this.ensureInitialized();
    const vssConfig = await this._resolveVssConfig(config, mnemonic);
    const { layer1, utexo } = getVssConfigs(vssConfig);
    await this.layer1Wallet!.vssBackup(layer1);
    return this.utexoWallet!.vssBackup(utexo);
  }

  async vssBackupInfo(
    config?: VssBackupConfig,
    mnemonic?: string
  ): Promise<VssBackupInfo> {
    this.ensureInitialized();
    const vssConfig = await this._resolveVssConfig(config, mnemonic);
    const { utexo } = getVssConfigs(vssConfig);
    return this.utexoWallet!.vssBackupInfo(utexo);
  }

  // ── IWalletManager: signing (delegates to utexoWallet) ───────────────────────

  async signPsbt(psbt: string, mnemonic?: string): Promise<string> {
    this.ensureInitialized();
    return this.utexoWallet!.signPsbt(psbt, mnemonic);
  }

  async signMessage(message: string): Promise<string> {
    this.ensureInitialized();
    return this.utexoWallet!.signMessage(message);
  }

  async verifyMessage(
    message: string,
    signature: string,
    accountXpub?: string
  ): Promise<boolean> {
    this.ensureInitialized();
    return this.utexoWallet!.verifyMessage(message, signature, accountXpub);
  }

  // ── IUTEXOProtocol: onchain ───────────────────────────────────────────────────

  async onchainReceive(
    params: OnchainReceiveRequestModel
  ): Promise<OnchainReceiveResponse> {
    this.ensureInitialized();

    const destinationAsset = getDestinationAsset(
      'mainnet',
      'utexo',
      params.assetId ?? null,
      this.networkIdMap
    );
    if (!destinationAsset) {
      throw new ValidationError(
        'Destination asset is not supported',
        'assetId'
      );
    }
    if (!params.amount) {
      throw new ValidationError('Amount is required', 'amount');
    }

    const destinationInvoice = await this.utexoWallet!.witnessReceive({
      assetId: '',
      amount: params.amount,
      minConfirmations: params.minConfirmations,
      durationSeconds: params.durationSeconds,
    });

    const bridgeTransfer = await this.bridge.getBridgeInSignature({
      sender: {
        address: 'rgb-address',
        networkName: this.networkIdMap.mainnet.networkName,
        networkId: this.networkIdMap.mainnet.networkId,
      },
      tokenId: destinationAsset.tokenId,
      amount: params.amount.toString(),
      destination: {
        address: destinationInvoice.invoice,
        networkName: this.networkIdMap.utexo.networkName,
        networkId: this.networkIdMap.utexo.networkId,
      },
      additionalAddresses: [],
    });

    const decodedInvoice = decodeBridgeInvoice(bridgeTransfer.signature);
    return { invoice: decodedInvoice };
  }

  async onchainSendBegin(params: OnchainSendRequestModel): Promise<string> {
    this.ensureInitialized();
    const bridgeTransfer = await this.bridge.getTransferByMainnetInvoice(
      params.invoice,
      this.networkIdMap.mainnet.networkId
    );
    if (!bridgeTransfer) {
      return this._utexoToMainnetRGB(params);
    }

    const utexoInvoice = bridgeTransfer.recipient.address;
    const invoiceData = await this.decodeRGBInvoice({ invoice: utexoInvoice });
    const bridgeAmount = bridgeTransfer.recipientAmount;
    const destinationAsset = this.networkIdMap.utexo.getAssetById(
      bridgeTransfer.recipientToken.id
    );
    if (!destinationAsset) {
      throw new ValidationError(
        'Destination asset is not supported',
        'assetId'
      );
    }
    const amount = toUnitsNumber(bridgeAmount, destinationAsset.precision);
    const isWitness = invoiceData.recipientId.includes('wvout:');
    await this.validateBalance(destinationAsset.assetId, amount);

    return this.utexoWallet!.sendBegin({
      invoice: utexoInvoice,
      amount,
      assetId: destinationAsset.assetId,
      donation: true,
      ...(isWitness && { witnessData: { amountSat: 1000, blinding: 0 } }),
    });
  }

  async onchainSendEnd(params: {
    signedPsbt: string;
    invoice?: string;
  }): Promise<OnchainSendResponse> {
    this.ensureInitialized();
    return this.utexoWallet!.sendEnd({ signedPsbt: params.signedPsbt });
  }

  async onchainSend(
    params: OnchainSendRequestModel,
    mnemonic?: string
  ): Promise<OnchainSendResponse> {
    this.ensureInitialized();
    const psbt = await this.onchainSendBegin(params);
    const signedPsbt = await this.utexoWallet!.signPsbt(psbt, mnemonic);
    return this.onchainSendEnd({ signedPsbt, invoice: params.invoice });
  }

  async getOnchainSendStatus(
    invoice: string
  ): Promise<OnchainSendStatus | null> {
    const bridgeTransfer = await this.bridge.getTransferByMainnetInvoice(
      invoice,
      this.networkIdMap.mainnet.networkId
    );
    if (!bridgeTransfer) {
      const withdrawTransfer = await this.bridge.getWithdrawTransfer(
        invoice,
        this.networkIdMap.utexo.networkId
      );
      return withdrawTransfer
        ? (withdrawTransfer.status as OnchainSendStatus)
        : null;
    }
    const { invoiceData, destinationAsset } =
      await this._extractInvoiceAndAsset(bridgeTransfer);
    const assets = await this.utexoWallet!.listAssets();
    const walletAsset = assets.nia.find(
      (a) => a.assetId === destinationAsset.assetId
    );
    const transfers = await this.utexoWallet!.listTransfers(
      walletAsset?.assetId
    );
    const transfer = transfers.find(
      (t) => t.recipientId === invoiceData.recipientId
    );
    if (transfer) return transfer.status;
    return bridgeTransfer.status as OnchainSendStatus;
  }

  async listOnchainTransfers(asset_id?: string): Promise<Transfer[]> {
    this.ensureInitialized();
    return this.utexoWallet!.listTransfers(asset_id);
  }

  // ── IUTEXOProtocol: lightning ─────────────────────────────────────────────────

  async createLightningInvoice(
    params: CreateLightningInvoiceRequestModel
  ): Promise<LightningReceiveRequest> {
    this.ensureInitialized();
    const asset = params.asset;
    if (!asset) throw new ValidationError('Asset is required', 'asset');
    if (!asset.assetId)
      throw new ValidationError('Asset ID is required', 'assetId');
    if (!asset.amount)
      throw new ValidationError('Amount is required', 'amount');

    const destinationAsset = getDestinationAsset(
      'mainnet',
      'utexo',
      asset.assetId,
      this.networkIdMap
    );
    if (!destinationAsset) {
      throw new ValidationError(
        'Destination asset is not supported',
        'assetId'
      );
    }

    const destinationInvoice = await this.utexoWallet!.witnessReceive({
      assetId: '',
      amount: asset.amount,
    });

    const bridgeTransfer = await this.bridge.getBridgeInSignature({
      sender: {
        address: 'rgb-address',
        networkName: this.networkIdMap.mainnetLightning.networkName,
        networkId: this.networkIdMap.mainnetLightning.networkId,
      },
      tokenId: destinationAsset.tokenId,
      amount: asset.amount.toString(),
      destination: {
        address: destinationInvoice.invoice,
        networkName: this.networkIdMap.utexo.networkName,
        networkId: this.networkIdMap.utexo.networkId,
      },
      additionalAddresses: [],
    });

    return { lnInvoice: decodeBridgeInvoice(bridgeTransfer.signature) };
  }

  async payLightningInvoiceBegin(
    params: PayLightningInvoiceRequestModel
  ): Promise<string> {
    this.ensureInitialized();
    const bridgeTransfer = await this.bridge.getTransferByMainnetInvoice(
      params.lnInvoice,
      this.networkIdMap.mainnetLightning.networkId
    );
    if (!bridgeTransfer) {
      return this._utexoToMainnetLightning(params);
    }

    const bridgeAmount = bridgeTransfer.recipientAmount;
    const { utexoInvoice, invoiceData, destinationAsset } =
      await this._extractInvoiceAndAsset(bridgeTransfer);
    const amount = toUnitsNumber(bridgeAmount, destinationAsset.precision);
    const isWitness = invoiceData.recipientId.includes('wvout:');

    return this.utexoWallet!.sendBegin({
      invoice: utexoInvoice,
      amount,
      assetId: destinationAsset.assetId,
      donation: true,
      ...(isWitness && { witnessData: { amountSat: 1000, blinding: 0 } }),
    });
  }

  async payLightningInvoiceEnd(params: {
    signedPsbt: string;
    lnInvoice?: string;
  }): Promise<LightningSendRequest> {
    this.ensureInitialized();
    return this.utexoWallet!.sendEnd({ signedPsbt: params.signedPsbt });
  }

  async payLightningInvoice(
    params: PayLightningInvoiceRequestModel,
    mnemonic?: string
  ): Promise<LightningSendRequest> {
    this.ensureInitialized();
    const psbt = await this.payLightningInvoiceBegin(params);
    const signedPsbt = await this.utexoWallet!.signPsbt(psbt, mnemonic);
    return this.payLightningInvoiceEnd({
      signedPsbt,
      lnInvoice: params.lnInvoice,
    });
  }

  async getLightningSendRequest(
    lnInvoice: string
  ): Promise<TransferStatus | null> {
    this.ensureInitialized();
    return this._getLightningTransferStatus(
      lnInvoice,
      this.networkIdMap.mainnetLightning.networkId
    );
  }

  async getLightningReceiveRequest(
    lnInvoice: string
  ): Promise<TransferStatus | null> {
    this.ensureInitialized();
    return this._getLightningTransferStatus(
      lnInvoice,
      this.networkIdMap.mainnetLightning.networkId
    );
  }

  async getLightningSendFeeEstimate(_params: {
    invoice: string;
    assetId?: string;
  }): Promise<number> {
    throw new Error('getLightningSendFeeEstimate not implemented');
  }

  async listLightningPayments(): Promise<ListLightningPaymentsResponse> {
    throw new Error('listLightningPayments not implemented');
  }

  // ── Shared helpers ────────────────────────────────────────────────────────────

  async validateBalance(assetId: string, amount: number): Promise<void> {
    const assetBalance = await this.getAssetBalance(assetId);
    if (!assetBalance?.spendable) {
      throw new ValidationError('Asset balance is not found', 'assetBalance');
    }
    if (assetBalance.spendable < amount) {
      throw new ValidationError(
        `Insufficient balance ${assetBalance.spendable} < ${amount}`,
        'amount'
      );
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  private async _resolveVssConfig(
    config?: VssBackupConfig,
    mnemonic?: string
  ): Promise<VssBackupConfig> {
    if (config) return config;
    const mnemonicToUse =
      mnemonic ??
      (typeof this.mnemonicOrSeed === 'string' ? this.mnemonicOrSeed : null);
    if (!mnemonicToUse) {
      throw new ValidationError(
        'mnemonic is required for VSS when config is not passed',
        'mnemonic'
      );
    }
    const serverUrl = this.options.vssServerUrl ?? DEFAULT_VSS_SERVER_URL;
    const preset: UtxoNetworkPreset = this.options.network ?? 'mainnet';
    return buildVssConfigFromMnemonic(mnemonicToUse.trim(), serverUrl, preset);
  }

  private async _extractInvoiceAndAsset(
    bridgeTransfer: TransferByMainnetInvoiceResponse
  ): Promise<{
    utexoInvoice: string;
    invoiceData: InvoiceData;
    destinationAsset: NetworkAsset;
  }> {
    const utexoInvoice = bridgeTransfer.recipient.address;
    const invoiceData = await this.decodeRGBInvoice({ invoice: utexoInvoice });
    const destinationAsset = this.networkIdMap.utexo.getAssetById(
      bridgeTransfer.recipientToken.id
    );
    if (!destinationAsset) {
      throw new ValidationError(
        'Destination asset is not supported',
        'assetId'
      );
    }
    return { utexoInvoice, invoiceData, destinationAsset };
  }

  private async _getLightningTransferStatus(
    invoice: string,
    networkId: number
  ): Promise<TransferStatus | null> {
    const bridgeTransfer = await this.bridge.getTransferByMainnetInvoice(
      invoice,
      networkId
    );
    if (!bridgeTransfer) {
      const withdrawTransfer = await this.bridge.getWithdrawTransfer(
        invoice,
        this.networkIdMap.utexo.networkId
      );
      return withdrawTransfer
        ? (withdrawTransfer.status as TransferStatus)
        : null;
    }
    const { invoiceData, destinationAsset } =
      await this._extractInvoiceAndAsset(bridgeTransfer);
    const transfers = await this.utexoWallet!.listTransfers(
      destinationAsset.assetId
    );
    return transfers.length > 0
      ? (transfers.find((t) => t.recipientId === invoiceData.recipientId)
          ?.status ?? null)
      : null;
  }

  private async _utexoToMainnetRGB(
    params: OnchainSendRequestModel
  ): Promise<string> {
    const invoiceData = await this.decodeRGBInvoice({
      invoice: params.invoice,
    });
    if (!params.assetId && !invoiceData.assetId) {
      throw new ValidationError(
        'Asset ID is required for external invoice',
        'assetId'
      );
    }
    const assetId = params.assetId ?? invoiceData.assetId;
    const utexoAsset = getDestinationAsset(
      'mainnet',
      'utexo',
      assetId ?? null,
      this.networkIdMap
    );
    if (!utexoAsset) {
      throw new ValidationError('UTEXO asset is not supported', 'assetId');
    }
    const destinationAsset = this.networkIdMap.mainnet.getAssetById(
      utexoAsset.tokenId
    );
    if (!destinationAsset) {
      throw new ValidationError(
        'Destination asset is not supported',
        'assetId'
      );
    }
    if (!params.amount && !invoiceData.assignment.amount) {
      throw new ValidationError(
        'Amount is required for external invoice',
        'amount'
      );
    }

    let amount: number;
    if (params.amount) {
      amount = params.amount;
    } else if (invoiceData.assignment.amount) {
      amount = fromUnitsNumber(
        invoiceData.assignment.amount,
        destinationAsset.precision
      );
    } else {
      throw new ValidationError('Amount is required', 'amount');
    }

    await this.validateBalance(
      utexoAsset.assetId,
      toUnitsNumber(amount.toString(), utexoAsset.precision)
    );

    const bridgeOutTransfer = await this.bridge.getBridgeInSignature({
      sender: {
        address: 'rgb-address',
        networkName: this.networkIdMap.utexo.networkName,
        networkId: this.networkIdMap.utexo.networkId,
      },
      tokenId: destinationAsset.tokenId,
      amount: amount.toString(),
      destination: {
        address: params.invoice,
        networkName: this.networkIdMap.mainnet.networkName,
        networkId: this.networkIdMap.mainnet.networkId,
      },
      additionalAddresses: [],
    });
    const decodedInvoice = decodeBridgeInvoice(bridgeOutTransfer.signature);
    const isWitness = decodedInvoice.includes('wvout:');

    return this.utexoWallet!.sendBegin({
      invoice: decodedInvoice,
      amount: Number(bridgeOutTransfer.amount),
      assetId: utexoAsset.assetId,
      donation: true,
      ...(isWitness && { witnessData: { amountSat: 1000, blinding: 0 } }),
    });
  }

  private async _utexoToMainnetLightning(
    params: PayLightningInvoiceRequestModel
  ): Promise<string> {
    if (!params.assetId) {
      throw new ValidationError(
        'Asset ID is required for external invoice',
        'assetId'
      );
    }
    const utexoAsset = getDestinationAsset(
      'mainnet',
      'utexo',
      params.assetId,
      this.networkIdMap
    );
    const destinationAsset = this.networkIdMap.mainnet.getAssetById(
      utexoAsset?.tokenId ?? 0
    );
    if (!destinationAsset || !utexoAsset) {
      throw new ValidationError(
        'Destination asset is not supported',
        'assetId'
      );
    }
    if (!params.amount) {
      throw new ValidationError(
        'Amount is required for external invoice',
        'amount'
      );
    }

    await this.validateBalance(
      utexoAsset.assetId,
      toUnitsNumber(params.amount.toString(), utexoAsset.precision)
    );

    const bridgeOutTransfer = await this.bridge.getBridgeInSignature({
      sender: {
        address: 'rgb-address',
        networkName: this.networkIdMap.utexo.networkName,
        networkId: this.networkIdMap.utexo.networkId,
      },
      tokenId: destinationAsset.tokenId,
      amount: params.amount.toString(),
      destination: {
        address: params.lnInvoice,
        networkName: this.networkIdMap.mainnetLightning.networkName,
        networkId: this.networkIdMap.mainnetLightning.networkId,
      },
      additionalAddresses: [],
    });
    const decodedInvoice = decodeBridgeInvoice(bridgeOutTransfer.signature);
    const isWitness = decodedInvoice.includes('wvout:');

    return this.utexoWallet!.sendBegin({
      invoice: decodedInvoice,
      amount: Number(bridgeOutTransfer.amount),
      assetId: utexoAsset.assetId,
      donation: true,
      ...(isWitness && { witnessData: { amountSat: 1000, blinding: 0 } }),
    });
  }
}
