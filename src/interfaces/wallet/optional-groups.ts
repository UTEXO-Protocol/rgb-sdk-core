/**
 * Optional capability groups — exposed as **carriers**, never as stubs.
 *
 * Each group is reached through an optional property on the wallet
 * (`wallet.psbt`, `wallet.beginEnd`). Presence *is* the type:
 * where a platform cannot perform the group, the property is `undefined` and
 * there is nothing to call. This is what replaces `throw new Error('not
 * implemented')`.
 *
 * Type guards were rejected (§3.1): `w is T & IGroup` is an **unchecked
 * assertion**, so a capability flag that disagrees with reality would be
 * believed by the compiler — reintroducing the very defect this plan removes.
 *
 * ── Why these three, and why two of them are permanent ──────────────────────
 *
 * Root cause (§2.7a): **web runs two engines, rn runs one.** web bundles an
 * rgb-lib wallet in wasm *plus* the RLN node; rn has only the node. Verified:
 * `RlnWasmBinding.ts` calls `this.wallet.createUtxosBegin/inflateBegin/
 * sendBegin/sendBtcBegin`, while rn's UniFFI surface exposes no begin/end
 * method at all.
 *
 * So `IBeginEndFlows` and `IPsbtSigning` are architectural and permanent.
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
 * PSBT signing — **web only, permanent**.
 *
 * rn removed bdk-rn; `rn/src/crypto/signer.ts` is three functions that only
 * throw. `NativeExternalRLNSigner` does not restore this: it signs channel/LDK
 * operations *inside* the node, not arbitrary PSBTs handed in from JS (§2.8).
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
