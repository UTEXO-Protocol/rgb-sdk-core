/**
 * The UTEXO wallet contract — composition root.
 *
 * Design principles:
 *   1. the always-present surface holds only what **both** platforms genuinely
 *      perform, grouped by domain;
 *   2. platform-specific surface lives behind optional **carriers**, so an
 *      unsupported call is a compile error rather than a runtime throw;
 *   3. lifecycle (construct / unlock / dispose) is part of the contract, so a
 *      platform-agnostic consumer can be written portably.
 *
 * Invariant: a method may appear on the always-present surface **only if every
 * platform actually performs it**. If one platform throws, it belongs on a
 * carrier. The conformance suite enforces this; types alone cannot.
 */

import type { Network } from '../../crypto/types';
import type { WalletBackupResponse } from '../../types/wallet-model';
import type { IBitcoinWallet } from './IBitcoinWallet';
import type { ILightningAddress } from './ILightningAddress';
import type { ILightningNode } from './ILightningNode';
import type { ILightningPayments } from './ILightningPayments';
import type { IOnchainTransfers } from './IOnchainTransfers';
import type { IRgbAssets } from './IRgbAssets';
import type { IWalletLifecycle } from './IWalletLifecycle';
import type {
  IBeginEndFlows,
  IPsbtSigning,
  WalletCapabilities,
} from './optional-groups';

/**
 * Everything both platforms implement — 49 methods across six domain groups
 * plus the wallet-meta members below.
 */
export interface IUTEXOWalletCore
  extends
    ILightningNode,
    ILightningPayments,
    ILightningAddress,
    IOnchainTransfers,
    IRgbAssets,
    IBitcoinWallet {
  getNetwork(): Network;

  /**
   * `refreshWallet` and `syncWallet` are **deliberately distinct** — they map
   * to separate node operations (`rlnRefresh` vs `rlnSync`) and are not
   * interchangeable. Collapsing them in the SDK would hide a distinction the
   * node itself makes.
   */
  refreshWallet(): Promise<void>;
  syncWallet(): Promise<void>;

  signMessage(message: string): Promise<string>;

  /**
   * No `accountXpub` parameter — verification on an RLN node is always against
   * the node key, so it is meaningless in the shared contract (web may keep it
   * as a platform extra).
   */
  verifyMessage(message: string, signature: string): Promise<boolean>;

  /**
   * **Local**, file-path backup — implemented on both (rn `rlnBackup`, web
   * `manager.createBackup`). Distinct from `backupNow()`, which replicates to
   * the remote store.
   */
  createBackup(params: {
    backupPath: string;
    password: string;
  }): Promise<WalletBackupResponse>;

  /**
   * `password` is **required** — rn needs one; web ignores it (identity comes
   * from init), so requiring it costs web nothing and lets both platforms
   * honour the signature.
   */
  vssClearFence(password: string): Promise<void>;

  /**
   * Replicate wallet state to the remote store now; returns the new backup
   * version.
   *
   * Intent, not mechanism: each platform covers however many state stores it
   * has. web uploads its rgb-lib wallet snapshot (the node stream
   * replicates continuously on its own); rn's node backs up its single store.
   * Both platforms also back up automatically — this is the "don't wait for
   * the next state change" call.
   */
  backupNow(): Promise<number>;
}

/**
 * The full contract: shared surface + lifecycle + optional carriers.
 *
 * @typeParam TUnlockParams - platform unlock parameters; `void` where none are
 * needed (web), a native params object on rn.
 *
 * @example Consuming optional groups
 * ```ts
 * if (!wallet.psbt) {
 *   throw new Error('PSBT signing unavailable on this platform');
 * }
 * await wallet.psbt.signPsbt(psbt);         // narrowed by the check itself
 * ```
 */
export interface IUTEXOWallet<TUnlockParams = void>
  extends IUTEXOWalletCore, IWalletLifecycle<TUnlockParams> {
  /** Derived from carrier presence — never stored independently. */
  readonly capabilities: WalletCapabilities;

  /** Present only where the platform can sign PSBTs (web). */
  readonly psbt?: IPsbtSigning;

  /** Present only where the platform exposes externally-signed flows (web). */
  readonly beginEnd?: IBeginEndFlows;
}
