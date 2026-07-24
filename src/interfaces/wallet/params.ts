/**
 * Shared wallet construction parameters.
 */

import type { BitcoinNetwork } from '../../types/wallet-model';

/**
 * Configuration shared by both platforms.
 *
 * Plain, serializable config only — no live objects. On rn the signer is a
 * separate constructor argument (`new UTEXOWallet(params, signer)`), so
 * credentials are deliberately not fields here; rn `Omit`s `mnemonic` and
 * `password` for exactly that reason.
 *
 * Each platform extends this with its own extras:
 *   - web: `proxyUrl`, `nodeRuntimeId`, `transportEndpoint`, …
 *   - rn:  `storageDirPath`, ports, `vssAllowHttp`, …
 */
export interface UTEXOWalletCreateParams {
  mnemonic: string;
  password: string;
  /** Default `'utexo'`. */
  network?: BitcoinNetwork;
  /** Defaults to the core table for the network — see `resolveIndexerUrl`. */
  indexerUrl?: string;
  transportEndpoint?: string;
  /** `null` disables VSS. */
  vssUrl?: string | null;
  /** Default `true`. */
  vssAutoRestore?: boolean;
  lspBaseUrl?: string | null;
  lspBearerToken?: string | null;
}
