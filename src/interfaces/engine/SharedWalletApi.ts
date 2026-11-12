/**
 * The engine contract — the base every wallet engine implements.
 *
 * It sits next to the legacy `IUTEXOProtocol`, which stays unchanged. The base
 * holds what an on-chain RGB wallet does; Lightning, VSS and other
 * engine-specific operations are extensions (`./extensions`).
 *
 * Rules:
 *   - No method in the base or in an implemented extension may always throw.
 *     A method that works for the values it supports is not a stub: a valid
 *     but unsupported input rejects with `UNSUPPORTED_CAPABILITY`, an invalid
 *     input with a validation error, both before any network or other side
 *     effect.
 *   - Construction opens no state and makes no network calls.
 *   - Call `unlock()` before online operations. The base does not promise
 *     automatic connection; an engine may connect lazily as an extra.
 */

import type { Network } from '../../crypto/types';
import type {
  ListAssetsOptions,
  OnchainReceiveParams,
  ReadOptions,
  ReceiveParams,
  RefreshTransfersResult,
  WalletIdentity,
  WalletInvoiceData,
  WalletListAssets,
  WalletNetworkInfo,
  WalletProtocol,
  WalletTransfer,
  WalletUnspent,
} from '../../types/engine-model';
import type {
  AssetBalance,
  AssetIfa,
  AssetNIA,
  BtcBalance,
  FailTransfersRequest,
  GetFeeEstimationResponse,
  InflateAssetIfaRequestModel,
  InvoiceReceiveData,
  IssueAssetIfaRequestModel,
  IssueAssetNiaRequestModel,
  OnchainReceiveResponse,
  OnchainSendRequestModel,
  OnchainSendResponse,
  SendBtcBeginRequestModel,
  Transaction,
} from '../../types/wallet-model';
import type { InflateResult } from '../wallet/IRgbAssets';
import type {
  IBeginEndFlows,
  IPsbtSigning,
  WalletCapabilities,
} from '../wallet/optional-groups';

/**
 * Contract identifiers this core version defines. An engine embeds the one it
 * implements as a literal; it never copies a runtime value from core, so a
 * newer core copy cannot make an old engine claim a newer contract.
 */
export type SharedWalletContractVersion = '1';

export interface EngineLifecycleApi<TUnlockParams> {
  /**
   * Opens local state. Idempotent. A failure leaves the engine retryable or,
   * if cleanup also failed, destroyable.
   */
  init(): Promise<void>;
  /** Goes online. The parameters are engine-specific. */
  unlock(params: TUnlockParams): Promise<void>;
  /**
   * Terminal cleanup of runtime resources. Idempotent; failures are visible
   * to the caller and a retry is allowed. It does not delete wallet storage.
   */
  destroy(): Promise<void>;
  isDisposed(): boolean;
}

export interface EngineNetworkApi {
  getNetwork(): Network;
  getNetworkInfo(): Promise<WalletNetworkInfo>;
  getWalletIdentity(): Promise<WalletIdentity>;
}

export interface EngineBitcoinApi {
  getAddress(): Promise<string>;
  getBtcBalance(options?: ReadOptions): Promise<BtcBalance>;
  listUnspents(options?: ReadOptions): Promise<WalletUnspent[]>;
  sendBtc(params: SendBtcBeginRequestModel): Promise<string>;
  createUtxos(
    params: {
      upTo?: boolean;
      num?: number;
      size?: number;
      feeRate?: number;
    } & ReadOptions
  ): Promise<number>;
  estimateFeeRate(blocks: number): Promise<GetFeeEstimationResponse>;
}

export interface EngineRgbAssetsApi {
  listAssets(options?: ListAssetsOptions): Promise<WalletListAssets>;
  getAssetBalance(assetId: string): Promise<AssetBalance>;
  issueAssetNia(params: IssueAssetNiaRequestModel): Promise<AssetNIA>;
  issueAssetIfa(params: IssueAssetIfaRequestModel): Promise<AssetIfa>;
  inflate(params: InflateAssetIfaRequestModel): Promise<InflateResult>;
  blindReceive(params: ReceiveParams): Promise<InvoiceReceiveData>;
  witnessReceive(params: ReceiveParams): Promise<InvoiceReceiveData>;
  decodeRGBInvoice(params: { invoice: string }): Promise<WalletInvoiceData>;
  failTransfers(params: FailTransfersRequest): Promise<boolean>;
}

export interface EngineOnchainApi {
  onchainReceive(params: OnchainReceiveParams): Promise<OnchainReceiveResponse>;
  onchainSend(params: OnchainSendRequestModel): Promise<OnchainSendResponse>;
}

export interface EngineHistoryApi {
  /** RGB on-chain transfer history. */
  listTransfers(assetId?: string): Promise<WalletTransfer[]>;
  listTransactions(options?: ReadOptions): Promise<Transaction[]>;
  /**
   * Refreshes pending transfers and reports what changed, keyed by batch
   * transfer ID. Kept distinct from `syncWallet()`. `skipSync: true` skips the
   * sync before the refresh.
   */
  refresh(options?: ReadOptions): Promise<RefreshTransfersResult>;
  /** `refresh()` without the result. */
  refreshWallet(): Promise<void>;
  /** Syncs chain/wallet state. */
  syncWallet(): Promise<void>;
}

export interface EngineCapabilities extends WalletCapabilities {
  /**
   * Whether this wallet is configured to sign transactions: `false` for a
   * watch-only wallet. `true` does not promise that every signing call
   * succeeds, and it says nothing about message or PSBT signing.
   */
  readonly canSignTransactions: boolean;
}

export interface SharedWalletApi<TUnlockParams = void>
  extends
    EngineLifecycleApi<TUnlockParams>,
    EngineNetworkApi,
    EngineBitcoinApi,
    EngineRgbAssetsApi,
    EngineOnchainApi,
    EngineHistoryApi {
  readonly protocol: WalletProtocol;
  /** The contract this engine implements; embedded in the engine. */
  readonly contractVersion: SharedWalletContractVersion;
  /** Derived from carrier presence and wallet configuration, never stored. */
  readonly capabilities: EngineCapabilities;
  /** Present only where the engine can sign arbitrary PSBTs. */
  readonly psbt?: IPsbtSigning;
  /** Present only where the engine exposes externally signed flows. */
  readonly beginEnd?: IBeginEndFlows;
}
