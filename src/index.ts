// @utexo/rgb-sdk-core
// Platform-agnostic shared core for RGB SDK

// Types
export * from './types/wallet-model';

// Crypto types (Network, NetworkVersions, BIP32Interface, etc.)
export type {
  Network,
  PsbtType,
  NetworkVersions,
  Descriptors,
  BufferLike,
  BIP32Interface,
  BIP32Factory,
  EstimateFeeResult,
} from './crypto/types';

// Constants
export * from './constants';

// Errors
export {
  SDKError,
  NetworkError,
  ValidationError,
  WalletError,
  CryptoError,
  ConfigurationError,
  BadRequestError,
  NotFoundError,
  ConflictError,
  RgbNodeError,
} from './errors';

// Utils
export { logger, configureLogging, LogLevel } from './utils/logger';
export {
  validateNetwork,
  normalizeNetwork,
  validateMnemonic,
  validatePsbt,
  validateBase64,
  validateHex,
  validateRequired,
  validateString,
} from './utils/validation';
export { isNetwork } from './utils/network';
export {
  isUmaAddress,
  normalizeLightningAddress,
  parseLightningAddress,
  UMA_PREFIX,
  UMA_MAX_USERNAME_LENGTH,
} from './utils/lightning-address';
export type { ParsedLightningAddress } from './utils/lightning-address';
export {
  LOOPBACK_HOSTS,
  hostnameOf,
  isLoopbackHost,
  isSameLspHost,
  lnurlDiscoveryUrl,
} from './utils/hosts';
export { toUnitsNumber, fromUnitsNumber } from './utils/units';
export { calculateMasterFingerprint } from './utils/fingerprint';
export {
  normalizeSeedBuffer,
  toNetworkName,
  getNetworkVersions,
} from './utils/bip32-helpers';

// Interfaces
export type { IRgbLibBinding } from './interfaces/IRgbLibBinding';
export type { ISigner } from './interfaces/ISigner';

// The UTEXO protocol contract — domain groups + optional carriers.
export type {
  ILightningNode,
  ILightningPayments,
  CreateLnInvoiceRequest,
  IAsyncPayments,
  IOnchainTransfers,
  IRgbAssets,
  InflateResult,
  IBitcoinWallet,
  IWalletLifecycle,
  IPsbtSigning,
  IBeginEndFlows,
  WalletCapabilities,
  IUTEXOProtocolCore,
  IUTEXOProtocol,
  UTEXOWalletCreateParams,
} from './interfaces/wallet';

// VSS defaults
export { DEFAULT_VSS_SERVER_URL, getVssConfigs } from './utexo/config/vss';

// HTTP transport (injectable; used by core clients such as the LSP client)
export { FetchClient } from './utils/fetch-client';

// RLN — Lightning domain types, canonical statuses, wire-mapping contract
export * from './rln';

// utexo-lsp — client, composed flows, types, errors
export * from './lsp';

// Crypto — VSS key derivation
export { deriveVssSigningKeyFromMnemonic } from './crypto/vss-keys';

// Crypto — message signing (pure @scure/*, works in Node, RN, and Web)
export { signMessage, verifyMessage } from './crypto/message';
export type { SignMessageParams, VerifyMessageParams } from './crypto/message';

// Crypto — PSBT utilities (pure, no platform deps)
export { detectPsbtType, deriveDescriptors } from './crypto/psbt';

// UTEXO restore helpers (pure, no fs)
export { buildVssConfigFromMnemonic, getBackupStoreId } from './utexo/restore';
export type { UtxoNetworkPreset } from './utexo/restore';

// Crypto — key derivation (pure @scure/*, works in Node, RN, and Web)
export {
  bip39,
  bip32Factory,
  signSchnorr,
  verifySchnorr,
  xOnlyPointFromPoint,
} from './crypto/dependencies';
export type { GeneratedKeys, AccountXpubs, SeedInput } from './crypto/keys';
export {
  generateKeys,
  deriveKeysFromMnemonic,
  deriveKeysFromSeed,
  deriveKeysFromMnemonicOrSeed,
  restoreKeys,
  accountXpubsFromMnemonic,
  getXprivFromMnemonic,
  getXpubFromXpriv,
  deriveKeysFromXpriv,
  accountDerivationPath,
  normalizeSeedInput,
  seedFromMnemonic,
} from './crypto/keys';
