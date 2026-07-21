/**
 * v3 wallet contract — decomposed into domain groups plus optional carriers.
 *
 * See MIGRATION-PLAN-v3.md. Not yet re-exported from the package root: web and
 * rn still compile against the v2 `IUTEXOWallet`, and both names cannot occupy
 * the root export at once. Wire this up in step 4, delete the old contract in
 * step 5.
 */

// ── Always present ────────────────────────────────────────────────────────────
export type { ILightningNode } from './ILightningNode';
export type {
  ILightningPayments,
  CreateLnInvoiceRequest,
} from './ILightningPayments';
export type { ILightningAddress } from './ILightningAddress';
export type { IOnchainTransfers } from './IOnchainTransfers';
export type { IRgbAssets, InflateResult } from './IRgbAssets';
export type { IBitcoinWallet } from './IBitcoinWallet';
export type { IWalletLifecycle } from './IWalletLifecycle';

// ── Optional carriers ─────────────────────────────────────────────────────────
export type {
  IPsbtSigning,
  IBeginEndFlows,
  IVssBackup,
  WalletCapabilities,
} from './optional-groups';

// ── Composition root ──────────────────────────────────────────────────────────
export type { IUTEXOWalletCore, IUTEXOWallet } from './IUTEXOWallet';
export type { UTEXOWalletCreateParams } from './params';
