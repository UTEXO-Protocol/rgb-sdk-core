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
 * Result of an atomic inflation.
 *
 * ⚠️ **Open item (§2.6).** The old contract returned `OperationResult`
 * (`{ txid, batchTransferIdx }`), but rn's UniFFI `InflateResponse` carries
 * **only** `txid` (`rn/ios/RGBLightningNode.swift:3756`). `batchTransferIdx` is
 * therefore optional here rather than having rn fabricate a placeholder.
 *
 * Decide during step 1 whether web's `batchTransferIdx` is load-bearing for any
 * caller; if not, drop the field entirely.
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
  /** §2.4 fix — was `Promise<any>` in the old contract. */
  issueAssetIfa(params: IssueAssetIfaRequestModel): Promise<AssetIfa>;

  /**
   * Atomic IFA inflation.
   *
   * In the core contract, not behind a capability: rn's node supports it
   * (`SdkNode.inflate`, `RGBLightningNode.swift:1251`) — only the JS bridge is
   * unwired (§2.6). The begin/end variants live on the `beginEnd` carrier.
   *
   * §2.5 note: no `mnemonic?` parameter — same reasoning as `onchainSend`.
   */
  inflate(params: InflateAssetIfaRequestModel): Promise<InflateResult>;

  blindReceive(params: InvoiceRequest): Promise<InvoiceReceiveData>;
  witnessReceive(params: InvoiceRequest): Promise<InvoiceReceiveData>;
  decodeRGBInvoice(params: { invoice: string }): Promise<InvoiceData>;

  listTransactions(): Promise<Transaction[]>;
  listTransfers(assetId?: string): Promise<Transfer[]>;
  failTransfers(params: FailTransfersRequest): Promise<boolean>;
}
