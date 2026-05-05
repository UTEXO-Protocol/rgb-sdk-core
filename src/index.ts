// @utexo/rgb-sdk-core
// Platform-agnostic shared core for RGB SDK

// Types
export * from './types/wallet-model';
export * from './types/rln-model';

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
export { toUnitsNumber, fromUnitsNumber } from './utils/units';
export { calculateMasterFingerprint } from './utils/fingerprint';
export {
  normalizeSeedBuffer,
  toNetworkName,
  getNetworkVersions,
} from './utils/bip32-helpers';

// Interfaces
export type {
  WalletInitParams,
  IWalletManager,
} from './interfaces/IWalletManager';
export type { IRgbLibBinding } from './interfaces/IRgbLibBinding';
export type { ISigner } from './interfaces/ISigner';
export type {
  ILightningProtocol,
  IOnchainProtocol,
  IUTEXOProtocol,
} from './interfaces/IUTEXOProtocol';
export type { IRlnWalletBinding } from './interfaces/IRlnWalletBinding';
export type { IRlnNodeBinding } from './interfaces/IRlnNodeBinding';
export type { IRlnSdkBinding } from './interfaces/IRlnSdkBinding';

// BaseWalletManager abstract class
export { BaseWalletManager } from './wallet/BaseWalletManager';

// UTEXOWalletCore abstract class
export { UTEXOWalletCore } from './utexo/UTEXOWalletCore';

// UTEXO Protocol base classes
export {
  LightningProtocol,
  OnchainProtocol,
  UTEXOProtocol,
} from './utexo/utexo-protocol';

// UTEXO network config
export {
  getUtxoNetworkConfig,
  utexoNetworkMap,
  utexoNetworkIdMap,
  getDestinationAsset,
} from './utexo/utils/network';
export type {
  UtxoNetworkPreset,
  UtxoNetworkMap,
  UtxoNetworkIdMap,
  UtxoNetworkPresetConfig,
  NetworkAsset,
  UtxoNetworkId,
} from './utexo/utils/network';
export { testnetPreset, mainnetPreset } from './utexo/config/utexo-presets';
export { DEFAULT_GATEWAY_BASE_URLS } from './utexo/config/gateway';
export { DEFAULT_VSS_SERVER_URL, getVssConfigs } from './utexo/config/vss';
export type { ConfigOptions } from './utexo/config/options';

// Bridge client
export { getBridgeAPI, encodeTransferStatus } from './utexo/bridge/api';
export type {
  NetworkAddress,
  TransferType,
  Estimation,
  BridgeInSignatureRequest,
  BridgeInSignatureResponse,
  SubmitTransactionRequest,
  SubmitTransactionResponse,
  VerifyBridgeInRequest,
  ReceiverInvoiceResponse,
  TokenInfo,
  TransactionHash,
  TransferByMainnetInvoiceResponse,
  ApiError,
} from './utexo/bridge/types';
export { TransferStatuses } from './utexo/bridge/types';

// Crypto — VSS key derivation
export { deriveVssSigningKeyFromMnemonic } from './crypto/vss-keys';

// Crypto — message signing (pure @scure/*, works in Node, RN, and Web)
export { signMessage, verifyMessage } from './crypto/message';
export type { SignMessageParams, VerifyMessageParams } from './crypto/message';

// Crypto — PSBT utilities (pure, no platform deps)
export { detectPsbtType, deriveDescriptors } from './crypto/psbt';

// UTEXO helpers
export { decodeBridgeInvoice } from './utexo/utils/helpers';

// UTEXO restore helpers (pure, no fs)
export { buildVssConfigFromMnemonic, getBackupStoreId } from './utexo/restore';

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
} from './crypto/keys';
