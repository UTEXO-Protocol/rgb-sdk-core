/**
 * Wallet lifecycle — always present.
 *
 * Lifecycle is part of the shared contract so a platform-agnostic consumer can
 * construct, unlock and dispose a wallet without `if (platform === 'rn')` in
 * app code. The generic parameter carries the platform's unlock params:
 *
 *   class UTEXOWallet implements IUTEXOWallet<RnUnlockParams> { … }   // rn
 *   class UTEXOWallet implements IUTEXOWallet<void> { … }             // web
 */
export interface IWalletLifecycle<TUnlockParams = void> {
  /**
   * First-time setup. Idempotent; a thrown failure must leave the wallet
   * retryable rather than half-initialised.
   */
  init(): Promise<void>;

  /**
   * Bring the wallet online. On rn this also attaches the node unlocker, which
   * is why the params are generic.
   */
  unlock(params: TUnlockParams): Promise<void>;

  /** Release resources and zeroise key material. Must be idempotent. */
  dispose(): Promise<void>;

  isDisposed(): boolean;
}
