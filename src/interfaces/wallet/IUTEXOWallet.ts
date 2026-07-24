/**
 * The UTEXO wallet contract — composition root.
 *
 * The superseded shape still lives at `../IUTEXOWallet.ts` as
 * `IUTEXOWalletLegacy`, kept only until rn migrates off it (step 5 deletes it).
 *
 * ── What changed from `IUTEXOWalletLegacy` ──────────────────────────────────
 *
 * The old contract declared 67 methods and claimed all 67 existed on both
 * platforms. **18 of them threw on rn.** It was an intersection of
 * *signatures*, not of *capabilities* — a throwing stub satisfies `implements`,
 * so the compiler certified a contract that was ~27% untrue at runtime.
 *
 * This version:
 *   1. keeps only what both platforms genuinely perform, grouped by domain
 *      rather than listed alphabetically;
 *   2. moves platform-specific surface behind optional **carriers**, so an
 *      unsupported call is a compile error rather than a runtime throw;
 *   3. adds lifecycle, which the old contract omitted — leaving consumers
 *      unable to construct or dispose a wallet portably;
 *   4. fixes five signature lies invisible to stub-scanning (§2.5).
 *
 * ── Invariant ───────────────────────────────────────────────────────────────
 *
 * A method may appear on the always-present surface **only if every platform
 * actually performs it**. If one platform throws, it belongs on a carrier. The
 * conformance suite (§7) enforces this; types alone cannot.
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
   * §2.5 fix — no `accountXpub` parameter.
   *
   * The old contract accepted `accountXpub?`; rn threw when it was provided
   * ("verification is always against the node key") while web passed it
   * through. Meaningless on an RLN node, so it leaves the shared contract; web
   * may keep it as a platform extra.
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
   * §2.5 fix — `password` is **required**.
   *
   * It was `password?`, which rn rejected at runtime (it requires one) while
   * web ignored it entirely (identity comes from init). The optional marker was
   * a lowest common denominator that neither platform could honour. Required
   * costs web nothing — it already ignores the value.
   */
  vssClearFence(password: string): Promise<void>;

  /**
   * Replicate wallet state to the remote store now; returns the new backup
   * version.
   *
   * Intent, not mechanism (§2.7): each platform covers however many state
   * stores it has. web uploads its rgb-lib wallet snapshot (the node stream
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
