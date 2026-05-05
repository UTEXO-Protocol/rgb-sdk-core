import type { IRlnWalletBinding } from './IRlnWalletBinding';
import type { IRlnNodeBinding } from './IRlnNodeBinding';
import type {
  RlnSdkInitParams,
  SwapMakerInitParams,
  SwapMakerInitResult,
  SwapInfo,
} from '../types/rln-model';

/**
 * Top-level contract for the full RLN SDK capability set.
 *
 * Extends IRlnWalletBinding (which extends IRgbLibBinding) and adds:
 * - SDK lifecycle: init, lock, unlock
 * - Atomic swaps: maker/taker flow
 * - Access to the optional Lightning node binding
 *
 * Implemented by RlnWasmBinding (web) and future Kotlin UniFFI binding.
 */
export interface IRlnSdkBinding extends IRlnWalletBinding {
  /**
   * Initialize the SDK with a password and optional mnemonic.
   * Must be called before any wallet or node operation.
   */
  initSdk(params: RlnSdkInitParams): Promise<void>;

  /** Lock the SDK — wipes in-memory keys and detaches the default wallet. */
  lock(): Promise<void>;

  /** Unlock the SDK with the password used during initSdk. */
  unlock(password: string): Promise<void>;

  /** SDK version string. */
  version(): string;

  // ── Swaps ──────────────────────────────────────────────────────────────────
  makerInit(params: SwapMakerInitParams): Promise<SwapMakerInitResult>;
  makerExecute(swapString: string): Promise<void>;
  taker(requestJson: string): Promise<void>;
  getSwap(swapString: string): Promise<SwapInfo>;
  listSwaps(): Promise<SwapInfo[]>;

  // ── Node access ────────────────────────────────────────────────────────────
  /** Returns the Lightning node binding, or null if no proxyUrl was configured. */
  getLightningNode(): IRlnNodeBinding | null;
}
