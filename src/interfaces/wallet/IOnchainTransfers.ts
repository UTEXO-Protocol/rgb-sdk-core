/**
 * On-chain RGB transfers — always present.
 *
 * Supersedes `IOnchainProtocol` from `../IUTEXOProtocol.ts`, with two changes:
 *   - `onchainSendBegin`/`onchainSendEnd` move to the `beginEnd` carrier — rn's
 *     node has no PSBT begin/end surface at all (§2.7a).
 *   - `onchainSend` loses its `mnemonic?` parameter (§2.5).
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
   * §2.5 fix — no `mnemonic` parameter.
   *
   * rn's signature never had one (`rn:1058`), so a mnemonic passed by a caller
   * was discarded by JS argument handling — no throw, no warning, different
   * behaviour per platform. web's mnemonic path belongs behind the `psbt`
   * carrier, not in a signature rn silently ignores.
   */
  onchainSend(params: OnchainSendRequestModel): Promise<OnchainSendResponse>;

  listOnchainTransfers(assetId?: string): Promise<Transfer[]>;
}
