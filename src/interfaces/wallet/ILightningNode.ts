/**
 * Lightning node, peers and channels — always present.
 *
 * Every method here is implemented on both platforms; nothing may be a throwing
 * stub.
 */

import type {
  LightningChannel,
  LightningNetworkInfo,
  LightningNodeInfo,
  LightningPeer,
  OpenChannelParams,
  OpenChannelResult,
} from '../../rln';

export interface ILightningNode {
  getNodeInfo(): Promise<LightningNodeInfo>;
  getNetworkInfo(): Promise<LightningNetworkInfo>;

  listPeers(): Promise<LightningPeer[]>;
  connectPeer(peerUri: string): Promise<void>;
  disconnectPeer(peerPubkey: string): Promise<void>;

  listChannels(): Promise<LightningChannel[]>;
  openChannel(params: OpenChannelParams): Promise<OpenChannelResult>;

  /**
   * `peerPubkey` and `force` are **required**. rn declares both required;
   * making them optional here type-checks (parameter bivariance) but then
   * passes `undefined` into a native call expecting a string. web already
   * defaults `force`, so requiring both costs it nothing.
   */
  closeChannel(
    channelId: string,
    peerPubkey: string,
    force: boolean
  ): Promise<void>;
}
