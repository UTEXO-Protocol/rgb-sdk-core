import type { Network } from '../crypto/types';

export const DEFAULT_TRANSPORT_ENDPOINTS: Record<Network, string> = {
  mainnet: 'rpcs://rgb-proxy-mainnet.utexo.com/json-rpc',
  testnet: 'rpcs://rgb-proxy-testnet3.utexo.com/json-rpc',
  testnet4: 'rpcs://proxy.iriswallet.com/0.2/json-rpc',
  signet: 'rpcs://proxy.iriswallet.com/0.2/json-rpc',
  utexo: 'rpcs://rgb-proxy-utexo.utexo.com/json-rpc',
  regtest: 'rpcs://proxy.iriswallet.com/0.2/json-rpc',
};

/**
 * Default chain-indexer URLs per network.
 *
 * Single source of truth — rgb-sdk-web previously kept a conflicting copy in
 * `binding/RlnDefaults.ts` that silently shadowed this table. Consolidated onto
 * the UTEXO-operated Esplora hosts (web's values), since
 * `electrum.iriswallet.com` is third-party infrastructure.
 *
 * ⚠️ Verify against deployed infra before publishing — a wrong entry does not
 * fail at build time, it fails at `goOnline`.
 */
export const DEFAULT_INDEXER_URLS: Record<Network, string> = {
  mainnet: 'https://esplora-mainnet.utexo.com',
  testnet: 'https://esplora-testnet3.utexo.com',
  testnet4: 'https://esplora-testnet4.utexo.com',
  signet: 'ssl://electrum.iriswallet.com:50033',
  utexo: 'https://esplora-api.utexo.com',
  regtest: 'http://127.0.0.1:3002',
};

/**
 * Resolve the indexer URL: the explicit value when provided, else the
 * per-network default. Lets apps point at their own infra without patching
 * the SDK.
 */
export function resolveIndexerUrl(
  network: Network,
  indexerUrl?: string | null
): string {
  return indexerUrl ?? DEFAULT_INDEXER_URLS[network];
}

/** Resolve the RGB transport endpoint, with the same override semantics. */
export function resolveTransportEndpoint(
  network: Network,
  transportEndpoint?: string | null
): string {
  return transportEndpoint ?? DEFAULT_TRANSPORT_ENDPOINTS[network];
}
