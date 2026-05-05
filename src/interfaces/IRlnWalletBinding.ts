import type { IRgbLibBinding } from './IRgbLibBinding';
import type {
  SendRgbFromGroupsRequest,
  SendRgbFromGroupsResult,
} from '../types/rln-model';

/**
 * Extends IRgbLibBinding with RLN-specific wallet extras.
 *
 * Implemented by RlnWasmBinding (web) and future Kotlin UniFFI binding.
 * The base IRgbLibBinding surface is unchanged; this only adds operations
 * that RLN exposes beyond the standard rgb-lib wallet.
 */
export interface IRlnWalletBinding extends IRgbLibBinding {
  /**
   * Group-based RGB asset send — RLN's multi-asset alternative to sendBeginBatch.
   * Groups multiple asset sends into a single transaction via the SDK-level call.
   */
  sendRgbFromGroups(
    params: SendRgbFromGroupsRequest
  ): Promise<SendRgbFromGroupsResult>;

  /**
   * Upload asset media (image/video) to the RGB proxy server.
   * Returns the hex digest string that can be referenced in asset metadata.
   */
  postAssetMedia(mimeType: string, bytesHex: string): Promise<string>;
}
