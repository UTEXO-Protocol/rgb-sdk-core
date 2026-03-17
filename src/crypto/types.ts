import type { BitcoinNetwork } from '../types/wallet-model';

/** Bitcoin network type alias */
export type Network = BitcoinNetwork;

/** PSBT type (create_utxo or send) */
export type PsbtType = 'create_utxo' | 'send';

/** Network versions for BIP32 */
export interface NetworkVersions {
  bip32: {
    public: number;
    private: number;
  };
  wif: number;
}

/** Descriptors for wallet derivation */
export interface Descriptors {
  external: string;
  internal: string;
}

/** Buffer-like object that can be converted to Buffer or Uint8Array */
export type BufferLike =
  | Buffer
  | Uint8Array
  | ArrayBuffer
  | {
      buffer?: ArrayBuffer;
      byteOffset?: number;
      byteLength?: number;
      length?: number;
    }
  | number[];

/** HD key node interface (returned by bip32Factory) */
export type BIP32Interface = {
  derivePath(path: string): BIP32Interface;
  publicKey: Uint8Array;
  privateKey?: Uint8Array;
  neutered: () => BIP32Interface;
  toBase58: () => string;
};

/** PSBT fee estimation result */
export interface EstimateFeeResult {
  fee: number;
  vbytes: number;
  feeRate: number;
}

/** BIP32 Factory function type */
export type BIP32Factory = () => {
  fromSeed: (seed: Uint8Array, versions?: NetworkVersions) => BIP32Interface;
  fromBase58: (base58: string, versions?: NetworkVersions) => BIP32Interface;
};
