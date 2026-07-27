/**
 * Optional capability groups — exposed as **carriers**, never as stubs.
 *
 * Each group is reached through an optional property on the wallet
 * (`wallet.psbt`, `wallet.beginEnd`). Presence *is* the type:
 * where a platform cannot perform the group, the property is `undefined` and
 * there is nothing to call. This is what replaces `throw new Error('not
 * implemented')`.
 *
 * Type guards were rejected: `w is T & IGroup` is an **unchecked assertion**,
 * so a capability flag that disagreed with reality would be believed by the
 * compiler.
 *
 * Why these groups are web-only and permanent: web runs two engines — an
 * rgb-lib wallet in wasm *plus* the RLN node — while rn has only the node. The
 * rgb-lib wallet is what hands out PSBTs and begin/end flows; rn's node has no
 * such surface. So `IBeginEndFlows` and `IPsbtSigning` are architectural.
 */

import type { EstimateFeeResult } from '../../crypto/types';
import type {
  CreateUtxosBeginRequestModel,
  CreateUtxosEndRequestModel,
  InflateAssetIfaRequestModel,
  InflateEndRequestModel,
  OperationResult,
  OnchainSendRequestModel,
  OnchainSendResponse,
  SendAssetEndRequestModel,
  SendBtcBeginRequestModel,
  SendBtcEndRequestModel,
} from '../../types/wallet-model';

/**
 * PSBT signing — **web only, permanent**. rn has no JS-side PSBT signer; its
 * node signs channel/LDK operations internally, not arbitrary PSBTs handed in
 * from JS.
 */
export interface IPsbtSigning {
  signPsbt(psbt: string, mnemonic?: string): Promise<string>;
  estimateFee(psbtBase64: string): Promise<EstimateFeeResult>;
}

/**
 * Externally-signed begin/end flows — **web only, permanent**.
 *
 * These exist because web has an rgb-lib wallet that can hand out an unsigned
 * PSBT. rn's node performs each of these atomically and signs internally; the
 * atomic forms (`createUtxos`, `sendBtc`, `onchainSend`, `inflate`) are in the
 * core contract and work everywhere.
 */
export interface IBeginEndFlows {
  createUtxosBegin(params: CreateUtxosBeginRequestModel): Promise<string>;
  createUtxosEnd(params: CreateUtxosEndRequestModel): Promise<number>;

  onchainSendBegin(params: OnchainSendRequestModel): Promise<string>;
  onchainSendEnd(
    params: SendAssetEndRequestModel
  ): Promise<OnchainSendResponse>;

  sendBtcBegin(params: SendBtcBeginRequestModel): Promise<string>;
  sendBtcEnd(params: SendBtcEndRequestModel): Promise<string>;

  inflateBegin(params: InflateAssetIfaRequestModel): Promise<string>;
  inflateEnd(params: InflateEndRequestModel): Promise<OperationResult>;
}

/**
 * Derived, never stored.
 *
 * Computed from carrier presence so the flags cannot drift from reality:
 *
 *   get capabilities() {
 *     return {
 *       psbtSigning:   this.psbt     !== undefined,
 *       beginEndFlows: this.beginEnd !== undefined,
 *     } as const;
 *   }
 */
export interface WalletCapabilities {
  readonly psbtSigning: boolean;
  readonly beginEndFlows: boolean;
}
