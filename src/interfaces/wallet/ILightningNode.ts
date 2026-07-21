/**
 * Lightning node, peers and channels — always present.
 *
 * Every method here is implemented on both platforms (§2.1 of
 * MIGRATION-PLAN-v3.md). Nothing in this file may be a throwing stub.
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
   * §2.5 fix — `peerPubkey` and `force` are **required**.
   *
   * They were `peerPubkey?`/`force?` in the old contract, but rn declares both
   * as required (`rn/src/wallet/utexo-wallet.ts:1131`). TypeScript accepted the
   * mismatch because method parameters are bivariant, so `closeChannel(id)`
   * type-checked and then passed `undefined` into a native call expecting a
   * string. web already defaults `force`, so requiring both costs it nothing.
   */
  closeChannel(
    channelId: string,
    peerPubkey: string,
    force: boolean
  ): Promise<void>;
}
