/**
 * Wallet lifecycle — always present.
 *
 * v2 deliberately left lifecycle out of the shared contract because "rn's
 * `unlock` takes native params, web's takes none". Correct observation, wrong
 * remedy: the result was that **no platform-agnostic consumer could be
 * written**, because it could not construct, unlock or dispose a wallet — which
 * pushes `if (platform === 'rn')` back into app code, the exact thing the
 * contract exists to prevent.
 *
 * The generic parameter resolves it without lying:
 *
 *   class UTEXOWallet implements IUTEXOWallet<RnUnlockParams> { … }   // rn
 *   class UTEXOWallet implements IUTEXOWallet<void> { … }             // web
 *
 * `goOnline` folds in here and is deleted (§2.3) — rn already throws with
 * "use unlock(params) instead", which is the real lifecycle.
 */
export interface IWalletLifecycle<TUnlockParams = void> {
  /**
   * First-time setup. Idempotent; a thrown failure must leave the wallet
   * retryable rather than half-initialised.
   */
  init(): Promise<void>;

  /**
   * Bring the wallet online. On rn this also attaches the node unlocker
   * (see `INodeUnlocker`, §2.8), which is why the params are generic.
   */
  unlock(params: TUnlockParams): Promise<void>;

  /** Release resources and zeroise key material. Must be idempotent. */
  dispose(): Promise<void>;

  isDisposed(): boolean;
}
