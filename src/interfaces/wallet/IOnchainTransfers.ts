/**
 * On-chain RGB transfers — always present.
 *
 * `onchainSendBegin`/`onchainSendEnd` live on the `beginEnd` carrier (rn's node
 * has no PSBT begin/end surface), and `onchainSend` has no `mnemonic?`
 * parameter.
 */

import type {
  OnchainReceiveRequestModel,
  OnchainReceiveResponse,
  OnchainSendRequestModel,
  OnchainSendResponse,
  Transfer,
} from '../../types/wallet-model';

export interface IOnchainTransfers {
  /** Receive invoice for an inbound cross-network transfer into UTEXO. */
  onchainReceive(
    params: OnchainReceiveRequestModel
  ): Promise<OnchainReceiveResponse>;

  /**
   * No `mnemonic` parameter — rn's signature never had one, so a mnemonic
   * passed by a caller was silently discarded. web's mnemonic path lives behind
   * the `psbt` carrier.
   */
  onchainSend(params: OnchainSendRequestModel): Promise<OnchainSendResponse>;

  listOnchainTransfers(assetId?: string): Promise<Transfer[]>;
}
