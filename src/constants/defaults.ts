/** Default network to use */
export const DEFAULT_NETWORK = 'regtest' as const;

/** Default API request timeout in milliseconds */
export const DEFAULT_API_TIMEOUT = 120000;

/** Default maximum number of retries for failed requests */
export const DEFAULT_MAX_RETRIES = 3;

/** Default log level */
export const DEFAULT_LOG_LEVEL = 3; // ERROR level

/** Default Electrum/Esplora indexers used by WalletManager bindings. */
export const DEFAULT_INDEXER_URLS = {
  utexo: 'https://esplora-api.utexo.com',
  mainnet: 'ssl://electrum.iriswallet.com:50003',
  testnet: 'ssl://electrum.iriswallet.com:50013',
  testnet4: 'ssl://electrum.iriswallet.com:50053',
  signet: 'ssl://electrum.iriswallet.com:50033',
  regtest: 'tcp://regtest.thunderstack.org:50001',
} as const;

/** Default RGB transport proxies used by WalletManager bindings. */
export const DEFAULT_TRANSPORT_ENDPOINTS = {
  utexo: 'rpcs://rgb-proxy-utexo.utexo.com/json-rpc',
  mainnet: 'rpcs://rgb-proxy-mainnet.utexo.com/json-rpc',
  testnet: 'rpcs://rgb-proxy-testnet3.utexo.com/json-rpc',
  testnet4: 'rpcs://proxy.iriswallet.com/0.2/json-rpc',
  signet: 'rpcs://proxy.iriswallet.com/0.2/json-rpc',
  regtest: 'rpcs://proxy.iriswallet.com/0.2/json-rpc',
} as const;
