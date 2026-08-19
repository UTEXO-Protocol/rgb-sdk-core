/**
 * utexo-lsp module — client, composed flows, types, and errors.
 *
 * Reconciled from the rgb-sdk-web and rgb-sdk-rn copies, which had drifted.
 * `UtexoLsp` depends on `ILspWallet` rather than a concrete platform wallet.
 */

export { UtexoLSPClient, LspError } from './UtexoLSPClient';
export type { IUtexoLSPClient } from './IUtexoLSPClient';
export type { ILspWallet } from './ILspWallet';

export { UtexoLsp } from './UtexoLsp';
export type {
  WaitOptions,
  ReceiveAssetOptions,
  ReceiveAssetResult,
  SendAssetOptions,
  SendAssetResult,
  PayAddressOptions,
  PayAddressAssetParam,
  AddressQuote,
  PayableAssets,
  RequestExternalInvoiceOptions,
  ExternalInvoice,
  SelectPaymentAssetOptions,
  AssetSelection,
  LightningAddressInfo,
  ClaimResult,
} from './UtexoLsp';

export {
  LspAmbiguousPayableAssetError,
  LspAmountOutOfRangeError,
  LspChannelTimeoutError,
  LspInsufficientAssetLiquidityError,
  LspLiquidityTimeoutError,
  LspNoPayableAssetError,
  LspSettlementError,
  LspUnknownPayableAssetError,
} from './LspErrors';

export {
  assertValidAmtMsat,
  assertAmtMsatInSendableRange,
} from './lnurlp-amount';

export { peerUri, normalizeReceiveStatus } from './lsp-types';
export type {
  LspClientConfig,
  LspGetInfoResponse,
  LspGetInfoWire,
  LspSupportedAsset,
  LspSupportedAssetWire,
  LspLnParams,
  LspOnchainSendRequest,
  LspOnchainSendResponse,
  LspOnchainSendWire,
  LspRgbParams,
  LspLightningReceiveRequest,
  LspLightningReceiveResponse,
  LspLightningReceiveWire,
  LspLnurlpDiscovery,
  LspLnurlpDiscoveryWire,
  LspLnurlpCallbackResponse,
  LspLnurlpCallbackWire,
  LspLightningAddressByPubkeyResponse,
  LspLightningAddressByPubkeyWire,
  LspApayInvoiceProofWire,
  ApayInvoiceProof,
  ApayMerkleProofElement,
  LspPeer,
  ReceiveStatus,
  ReceiveSettlementOutcome,
  ChannelReadyInfo,
} from './lsp-types';
