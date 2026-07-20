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
  LightningAddressInfo,
  ClaimResult,
} from './UtexoLsp';

export {
  LspChannelTimeoutError,
  LspLiquidityTimeoutError,
  LspSettlementError,
} from './LspErrors';

export { peerUri, normalizeReceiveStatus } from './lsp-types';
export type {
  LspClientConfig,
  LspGetInfoResponse,
  LspGetInfoWire,
  LspLnParams,
  LspOnchainSendRequest,
  LspOnchainSendResponse,
  LspOnchainSendWire,
  LspRgbParams,
  LspLightningReceiveRequest,
  LspLightningReceiveResponse,
  LspLightningReceiveWire,
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
