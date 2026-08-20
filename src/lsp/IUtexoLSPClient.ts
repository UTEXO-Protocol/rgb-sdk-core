import type {
  LspGetInfoResponse,
  LspLightningAddressByPubkeyResponse,
  LspOnchainSendRequest,
  LspOnchainSendResponse,
  LspLightningReceiveRequest,
  LspLightningReceiveResponse,
  LspLightningSendRequest,
  LspLightningSendResponse,
  LspLightningSendStatusResponse,
  LspLnurlpCallbackResponse,
  LspLnurlpDiscovery,
} from './lsp-types';

export interface IUtexoLSPClient {
  getInfo(): Promise<LspGetInfoResponse>;

  /**
   * LUD-06 discovery without the callback hop — the payer reads `payoutAsset` /
   * `acceptedAssets` from it to decide which asset to be quoted in.
   */
  discoverAddress(username: string): Promise<LspLnurlpDiscovery>;

  /**
   * Full LUD-06 resolution: discovers callback URL from LNURL metadata then
   * fetches the BOLT11 invoice. Works for any Lightning Address host.
   */
  resolveAddress(
    username: string,
    amtMsat: number,
    assetId?: string,
    assetAmount?: number
  ): Promise<LspLnurlpCallbackResponse>;

  /**
   * Direct LSP callback — skips LNURL discovery and calls
   * /pay/callback/{username} on the LSP base URL directly.
   */
  lnurlCallback(
    username: string,
    amtMsat: number,
    assetId?: string,
    assetAmount?: number
  ): Promise<LspLnurlpCallbackResponse>;

  /**
   * Resolve the haiku username + domain for a recipient peer pubkey
   * (after `apayNew` / `async_order/new`).
   */
  getLightningAddressByPubkey(
    peerPubkey: string
  ): Promise<LspLightningAddressByPubkeyResponse>;

  /** RGB → Lightning: submit RGB invoice; get BOLT11 to pay. */
  onchainSend(params: LspOnchainSendRequest): Promise<LspOnchainSendResponse>;

  /** Lightning → RGB: submit BOLT11 + RGB params; get RGB invoice. */
  lightningReceive(
    params: LspLightningReceiveRequest
  ): Promise<LspLightningReceiveResponse>;

  /** Lightning → Lightning across assets: submit a third party's BOLT11; get a HODL invoice to pay. */
  lightningSend(
    params: LspLightningSendRequest
  ): Promise<LspLightningSendResponse>;

  /** Progress of a `lightningSend` relay. */
  lightningSendStatus(
    paymentHash: string
  ): Promise<LspLightningSendStatusResponse>;
}
