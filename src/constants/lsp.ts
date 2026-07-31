/**
 * utexo-lsp defaults.
 *
 * Single source of truth — previously duplicated in rgb-sdk-web
 * (`binding/RlnDefaults.ts`) and rgb-sdk-rn (`wallet/network-defaults.ts`).
 * Platform-specific resolution (e.g. RN's `resolveUnlockParams`) reads these
 * tables rather than keeping its own copy.
 */

import type { Network } from '../crypto/types';
import { ConfigurationError } from '../errors';

/**
 * Default utexo-lsp HTTP base URL per network.
 *
 * Networks without an entry have no default and must be configured explicitly
 * via `lspBaseUrl`.
 */
export const DEFAULT_LSP_BASE_URLS: Partial<Record<Network, string>> = {
  utexo: 'https://lsp-signet.utexo.com',
};

/** The default LSP base URL for a network, or `undefined` if none exists. */
export function getDefaultLspBaseUrl(network: string): string | undefined {
  return (DEFAULT_LSP_BASE_URLS as Record<string, string | undefined>)[network];
}

/**
 * Resolve the LSP base URL: the explicit value when provided, else the
 * per-network default.
 *
 * Throws when neither is available so callers fail loudly instead of silently
 * pointing at a missing LSP.
 */
export function resolveLspBaseUrl(
  network: string,
  lspBaseUrl?: string | null
): string {
  const resolved = lspBaseUrl ?? getDefaultLspBaseUrl(network);
  if (!resolved) {
    throw new ConfigurationError(
      `No lspBaseUrl configured for network "${network}" and no default is available. ` +
        'Set lspBaseUrl in the wallet params or pass an explicit LSP peer.'
    );
  }
  return resolved;
}
