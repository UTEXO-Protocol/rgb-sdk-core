/**
 * UTEXO wallet restore helpers — pure/cross-platform portion.
 *
 * File-system-dependent restore helpers (prepareUtxoBackupDirs,
 * finalizeUtxoBackupPaths, restoreUtxoWalletFromVss,
 * restoreUtxoWalletFromBackup) stay in the platform SDK since they
 * depend on Node's `path` / `fs` and rgb-lib native bindings.
 */

import { deriveKeysFromMnemonic } from '../crypto/keys';
import { deriveVssSigningKeyFromMnemonic } from '../crypto/vss-keys';
import type { VssBackupConfig } from '../types/wallet-model';

/**
 * Which key-derivation bundle to use.
 *
 * Inlined here in step 6c: it was the only surviving member of
 * `utexo/utils/network.ts`, a 119-line UTEXO network-config table that both
 * SDKs re-exported and neither used. Endpoint resolution actually happens
 * through `DEFAULT_RLN_URLS` (web) and `network-defaults.ts` (rn).
 */
export type UtxoNetworkPreset = 'mainnet' | 'testnet';

/** Store id for backup/restore (same convention as VSS: wallet_<masterFingerprint>). */
export function getBackupStoreId(masterFingerprint: string): string {
  return `wallet_${masterFingerprint}`;
}

/**
 * Build VSS config from mnemonic.
 * storeId = wallet_<masterFingerprint>, signingKey derived via HMAC-SHA256.
 * Used when config is not passed to vssBackup or restoreUtxoWalletFromVss.
 */
export async function buildVssConfigFromMnemonic(
  mnemonic: string,
  serverUrl: string,
  networkPreset: UtxoNetworkPreset = 'testnet'
): Promise<VssBackupConfig> {
  const keys = await deriveKeysFromMnemonic(networkPreset, mnemonic.trim());
  return {
    serverUrl,
    storeId: `wallet_${keys.masterFingerprint}`,
    signingKey: deriveVssSigningKeyFromMnemonic(mnemonic.trim()),
    backupMode: 'Blocking',
  };
}
