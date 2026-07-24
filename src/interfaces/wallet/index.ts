/**
 * The UTEXO protocol contract — decomposed into domain groups plus optional
 * carriers. Re-exported from the package root.
 */

// ── Always present ────────────────────────────────────────────────────────────
export type { ILightningNode } from './ILightningNode';
export type {
  ILightningPayments,
  CreateLnInvoiceRequest,
} from './ILightningPayments';
export type { IAsyncPayments } from './IAsyncPayments';
export type { IOnchainTransfers } from './IOnchainTransfers';
export type { IRgbAssets, InflateResult } from './IRgbAssets';
export type { IBitcoinWallet } from './IBitcoinWallet';
export type { IWalletLifecycle } from './IWalletLifecycle';

// ── Optional carriers ─────────────────────────────────────────────────────────
export type {
  IPsbtSigning,
  IBeginEndFlows,
  WalletCapabilities,
} from './optional-groups';

// ── Composition root ──────────────────────────────────────────────────────────
export type { IUTEXOProtocolCore, IUTEXOProtocol } from './IUTEXOProtocol';
export type { UTEXOWalletCreateParams } from './params';
