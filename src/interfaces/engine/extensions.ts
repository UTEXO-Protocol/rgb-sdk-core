/**
 * Engine extensions — operations outside the base contract.
 *
 * An engine implements an extension interface directly on its class, so its
 * type says exactly what it can do; there are no stubs. An extension it does
 * not implement is simply absent. Whether an implemented operation can run
 * *right now* (signer, runtime build, connection) is checked at call time.
 *
 * Lightning stays in the legacy groups (`ILightningNode`, `ILightningPayments`,
 * `IAsyncPayments`) until the RLN stage.
 */

import type {
  AssetMetadata,
  BfaCapabilities,
  BurnParams,
  BurnResult,
  IndexerUrlInfo,
  IssueAssetCfaParams,
  IssueAssetUdaParams,
  ReadOptions,
  WalletTransfer,
} from '../../types/engine-model';
import type {
  AssetCFA,
  AssetUDA,
  Transaction,
  WalletBackupResponse,
} from '../../types/wallet-model';

/** Stop and reopen the same engine instance. */
export interface RestartableWalletApi<TUnlockParams> {
  /** Closes runtime resources; the instance can be reopened. */
  shutdown(): Promise<void>;
  /**
   * Reopens after `shutdown()`, or on a fresh instance. Rejects with
   * `WALLET_INVALID_STATE` while a session is open. With `params`, also
   * unlocks.
   */
  reinit(params?: TUnlockParams): Promise<void>;
}

/** Local, password-protected backup written to a file path. */
export interface FileBackupApi {
  createBackup(params: {
    backupPath: string;
    password: string;
  }): Promise<WalletBackupResponse>;
}

/**
 * Password-protected backup as bytes, for engines without a file system (a
 * browser). The app stores the bytes where it wants.
 */
export interface BackupBytesApi {
  /** Encrypted backup of the whole wallet state. */
  exportBackup(params: { password: string }): Promise<Uint8Array>;
  /**
   * Replaces the local wallet state with the backup. Allowed only after
   * `init()` and before the wallet connects; rejects with
   * `WALLET_INVALID_STATE` afterwards, and on a wallet with local data unless
   * `overwrite` is true.
   */
  restoreBackup(params: {
    bytes: Uint8Array;
    password: string;
    overwrite?: boolean;
  }): Promise<void>;
}

export interface WalletMaintenanceApi {
  /** Sends the whole vanilla BTC balance to `address`; returns the txid. */
  drainTo(params: { address: string; feeRate?: number }): Promise<string>;
  /** Removes failed transfers from the local database. */
  deleteTransfers(params?: {
    batchTransferIdx?: number;
    noAssetOnly?: boolean;
  }): Promise<boolean>;
}

/** Burn of RGB assets. Availability per build and wallet is in `getBfaCapabilities()`. */
export interface BurnApi {
  getBfaCapabilities(): Promise<BfaCapabilities>;
  burn(params: BurnParams): Promise<BurnResult>;
}

/** Consignment content. Portable: no filesystem involved. */
export interface ConsignmentApi {
  getBfaCapabilities(): Promise<BfaCapabilities>;
  getConsignment(assetId: string, txid: string): Promise<string>;
}

/** Consignment as a local file. Native engines only. */
export interface ConsignmentFileApi {
  getConsignmentPath(assetId: string, txid: string): Promise<string>;
}

/** Replicate wallet state to a VSS server now. */
export interface VssBackupApi {
  /** Returns the new backup version. */
  backupNow(): Promise<number>;
}

/** Clear the VSS write fence. Separate from backup: not every VSS engine has it. */
export interface VssFenceApi {
  vssClearFence(password: string): Promise<void>;
}

/**
 * Message signing. Which key and domain it signs with is defined in the RLN
 * stage; until then no rgb-lib engine implements it.
 */
export interface MessageSigningApi {
  signMessage(message: string): Promise<string>;
  verifyMessage(message: string, signature: string): Promise<boolean>;
}

/** Probe an indexer URL before using it. */
export interface IndexerCheckApi {
  /** Detects the indexer protocol behind `url`. */
  checkIndexerUrl(url: string): Promise<IndexerUrlInfo>;
}

/** Contract metadata of one asset. */
export interface AssetMetadataApi {
  getAssetMetadata(assetId: string): Promise<AssetMetadata>;
}

/** CFA and UDA issuance with media and attachments read from local files. */
export interface FileIssuanceApi {
  issueAssetCfa(params: IssueAssetCfaParams): Promise<AssetCFA>;
  issueAssetUda(params: IssueAssetUdaParams): Promise<AssetUDA>;
}

/** History filtered by one Bitcoin transaction. */
export interface TxidLookupApi {
  /** RGB transfers whose witness transaction is `txid`. */
  listTransfersByTxid(txid: string): Promise<WalletTransfer[]>;
  /** Wallet transactions with this `txid` (zero or one). */
  listTransactionsByTxid(
    txid: string,
    options?: ReadOptions
  ): Promise<Transaction[]>;
}

/** A fresh vanilla (BTC) receive address. */
export interface AddressRotationApi {
  rotateVanillaAddress(): Promise<string>;
}
