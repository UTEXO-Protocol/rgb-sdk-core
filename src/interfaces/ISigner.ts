import type { Network, EstimateFeeResult } from '../crypto/types';

/**
 * Platform-agnostic PSBT and message signing interface.
 *
 * Implementations use the platform's preferred crypto stack
 * (e.g. @scure/bip32 + BDK on Node/RN/WASM).
 */
export interface ISigner {
  signPsbtWithMnemonic(
    mnemonic: string,
    psbt: string,
    network: Network
  ): Promise<string>;

  signPsbtWithSeed(
    seed: Uint8Array,
    psbt: string,
    network: Network
  ): Promise<string>;

  signMessage(params: {
    message: string | Uint8Array;
    seed: Uint8Array;
    network: Network;
  }): Promise<string>;

  verifyMessage(params: {
    message: string | Uint8Array;
    signature: string;
    accountXpub: string;
    network: Network;
  }): Promise<boolean>;

  estimateFee(psbt: string): Promise<EstimateFeeResult>;
}
