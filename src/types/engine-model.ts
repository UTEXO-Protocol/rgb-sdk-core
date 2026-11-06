/**
 * Data types of the engine contract (`SharedWalletApi`).
 *
 * These are adapter models: what an engine adapter returns after mapping its
 * runtime's output, not raw native or WASM data. They cover RGB 0.11.2 data:
 * Mint/Link transfer kinds, the BFA schema, and exact base-unit amounts for
 * transfers and assignments. An engine does not have to produce every variant
 * of a union.
 *
 * Numbers: balances and supplies are plain `number`. An adapter must reject a
 * value above `Number.MAX_SAFE_INTEGER` with an error; it must never round.
 *
 * The older `Transfer` / `Unspent` / `InvoiceData` / `ListAssets` types stay
 * unchanged for `IUTEXOProtocol`.
 */

import type { Network } from '../crypto/types';
import type {
  AssetSchema,
  AssignmentType,
  Balance,
  InvoiceData,
  InvoiceRequest,
  ListAssets,
  OnchainReceiveRequestModel,
  Transfer,
  TransferKind,
  TransferStatus,
  Unspent,
} from './wallet-model';

/** Which engine family a wallet instance belongs to. */
export type WalletProtocol = 'RGB_L1' | 'RGB_LN';

export interface WalletIdentity {
  /** Stable wallet ID reported by the engine. */
  id: string;
  protocol: WalletProtocol;
  network: Network;
}

/** `getNetworkInfo()` result: the chain as the engine's indexer sees it. */
export interface WalletNetworkInfo {
  network: string;
  /** Absent when the engine's indexer reports no height. */
  blockHeight?: number;
}

/** Read options for balance, unspent and transaction listings. */
export interface ReadOptions {
  /**
   * Read the local wallet state without syncing first. Default `false`.
   *
   * It forbids synchronization only, not all network access. An engine must
   * honor it: one whose runtime never syncs on read must sync explicitly when
   * the flag is `false`.
   */
  skipSync?: boolean;
}

/** Asset schema names as the engines report them. */
export type AssetSchemaName = 'Nia' | 'Cfa' | 'Uda' | 'Ifa' | 'Bfa';

/** Exact amount: the decimal string is always safe; the number only when it fits. */
export interface TransferAmount {
  /** Decimal base units, safe to serialize over JSON. */
  amountBaseUnits?: string;
  /** Present only when the exact amount fits `Number.MAX_SAFE_INTEGER`. */
  amount?: number;
}

export interface WalletAssignment {
  type: AssignmentType | 'MintRight' | 'LinkRight';
  amount?: number;
  amountBaseUnits?: string;
}

export type WalletTransfer = Omit<
  Transfer,
  'kind' | 'assignments' | 'requestedAssignment'
> &
  TransferAmount & {
    kind: TransferKind | 'Mint' | 'Link';
    assignments: WalletAssignment[];
    requestedAssignment?: WalletAssignment;
  };

export type WalletUnspent = Omit<Unspent, 'rgbAllocations'> & {
  rgbAllocations: {
    assetId?: string;
    assignment: WalletAssignment;
    settled: boolean;
  }[];
};

export type WalletInvoiceData = Omit<
  InvoiceData,
  'assignment' | 'assetSchema'
> & {
  assignment: WalletAssignment;
  assetSchema?: AssetSchema | 'Bfa';
  publicKey?: string;
  encryption?: 'Required' | 'Optional' | 'Unsupported';
  unknownQueryParams?: Readonly<Record<string, string>>;
};

/**
 * Assignment an RGB invoice requests. `Fungible` and `InflationRight` need
 * `amount`; the others take none. Omitted: `Fungible` when `amount` is set,
 * otherwise `Any`.
 */
export type ReceiveAssignmentKind =
  | 'Fungible'
  | 'NonFungible'
  | 'InflationRight'
  | 'MintRight'
  | 'Any';

export type ReceiveParams = InvoiceRequest & {
  assignmentKind?: ReceiveAssignmentKind;
};

export type OnchainReceiveParams = OnchainReceiveRequestModel & {
  assignmentKind?: ReceiveAssignmentKind;
};

/** BFA asset as listed by the engine. */
export interface AssetBfa {
  assetId: string;
  ticker: string;
  name: string;
  details?: string;
  precision: number;
  initialSupply: number;
  timestamp: number;
  addedAt: number;
  balance: Balance & { offchainOutbound?: number; offchainInbound?: number };
  media?: { filePath: string; digest: string; mime: string };
  rejectListUrl?: string;
}

export type WalletListAssets = ListAssets & { bfa: AssetBfa[] };

export interface ListAssetsOptions {
  filterAssetSchemas?: AssetSchemaName[];
}

// ── BFA extension ────────────────────────────────────────────────────────────

/** What this engine build and session can do right now. */
export interface BfaCapabilities {
  burn: boolean;
  consignment: boolean;
  bfa: boolean;
}

export interface BurnParams {
  assetId: string;
  /** Exact decimal base units. */
  amount: string;
  /** 32-byte commitment encoded as 64 hex characters, without 0x. */
  burnRecipient?: string;
  /** Positive integer sat/vB. */
  feeRate: number;
  minConfirmations: number;
}

export interface BurnResult {
  txid: string;
  batchTransferIdx: number;
  /** Exact native entropy when supplied by the backend. */
  entropy?: string;
}

// ── Transfer refresh ─────────────────────────────────────────────────────────

export interface RefreshFailure {
  name: string;
  message: string;
}

export interface RefreshedTransfer {
  updatedStatus?: TransferStatus;
  failure?: RefreshFailure;
}

export interface RefreshTransfersResult {
  /** Keys are batch transfer IDs, not the individual `Transfer.idx`. */
  transfers: Record<number, RefreshedTransfer>;
}
