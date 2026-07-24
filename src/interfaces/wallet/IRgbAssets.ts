/**
 * RGB assets — issuance, balances, invoices, transfers. Always present.
 */

import type {
  AssetBalance,
  AssetIfa,
  AssetNIA,
  FailTransfersRequest,
  InflateAssetIfaRequestModel,
  InvoiceData,
  InvoiceReceiveData,
  InvoiceRequest,
  IssueAssetIfaRequestModel,
  IssueAssetNiaRequestModel,
  ListAssets,
  Transaction,
  Transfer,
} from '../../types/wallet-model';

/**
 * Result of an atomic inflation. rn's node returns only `txid`, so
 * `batchTransferIdx` is web-only and optional.
 */
export interface InflateResult {
  txid: string;
  /** web only — rn's node does not return it. */
  batchTransferIdx?: number;
}

export interface IRgbAssets {
  listAssets(): Promise<ListAssets>;
  getAssetBalance(assetId: string): Promise<AssetBalance>;

  issueAssetNia(params: IssueAssetNiaRequestModel): Promise<AssetNIA>;
  issueAssetIfa(params: IssueAssetIfaRequestModel): Promise<AssetIfa>;

  /**
   * Atomic IFA inflation — in the core contract, not behind a carrier: both
   * platforms' nodes support it. The begin/end variants live on the `beginEnd`
   * carrier. No `mnemonic?` parameter — same reasoning as `onchainSend`.
   */
  inflate(params: InflateAssetIfaRequestModel): Promise<InflateResult>;

  blindReceive(params: InvoiceRequest): Promise<InvoiceReceiveData>;
  witnessReceive(params: InvoiceRequest): Promise<InvoiceReceiveData>;
  decodeRGBInvoice(params: { invoice: string }): Promise<InvoiceData>;

  listTransactions(): Promise<Transaction[]>;
  listTransfers(assetId?: string): Promise<Transfer[]>;
  failTransfers(params: FailTransfersRequest): Promise<boolean>;
}
