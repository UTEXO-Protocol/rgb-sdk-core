import * as bip39Scure from '@scure/bip39';
// @ts-ignore - wordlist import path issue with TypeScript module resolution
import { wordlist } from '@scure/bip39/wordlists/english.js';
import * as secp256k1 from '@noble/secp256k1';
import { sha256 as nobleSha256 } from '@noble/hashes/sha2.js';
import { hmac } from '@noble/hashes/hmac.js';
import { HDKey } from '@scure/bip32';

// React Native doesn't have Web Crypto — configure noble/secp256k1 with
// synchronous sha256 and hmacSha256 so Schnorr sign/verify work correctly.
secp256k1.hashes.sha256 = nobleSha256;
secp256k1.hashes.hmacSha256 = (key: Uint8Array, msg: Uint8Array) =>
  hmac(nobleSha256, key, msg);
import type { NetworkVersions, BIP32Interface, BIP32Factory } from './types';

export const bip39 = {
  mnemonicToSeedSync: (mnemonic: string): Uint8Array => {
    return bip39Scure.mnemonicToSeedSync(mnemonic);
  },
  validateMnemonic: (mnemonic: string): boolean => {
    return bip39Scure.validateMnemonic(mnemonic, wordlist);
  },
  generateMnemonic: (strength: number = 128): string => {
    return bip39Scure.generateMnemonic(wordlist, strength);
  },
};

export function xOnlyPointFromPoint(point: Uint8Array): Uint8Array {
  const pointArray = point;
  if (pointArray.length === 33) {
    return pointArray.slice(1, 33);
  } else if (pointArray.length === 65) {
    return pointArray.slice(1, 33);
  } else if (pointArray.length === 32) {
    return pointArray;
  }
  throw new Error(`Invalid public key length: ${pointArray.length}`);
}

export function signSchnorr(
  message: Uint8Array,
  privateKey: Uint8Array,
  auxRand?: Uint8Array
): Uint8Array {
  return secp256k1.schnorr.sign(message, privateKey, auxRand);
}

export function verifySchnorr(
  message: Uint8Array,
  publicKey: Uint8Array,
  signature: Uint8Array
): boolean {
  return secp256k1.schnorr.verify(signature, message, publicKey);
}

function createBIP32Node(hdkey: HDKey): BIP32Interface {
  if (!hdkey.publicKey) {
    throw new Error('HDKey publicKey is null');
  }
  const pubKey =
    hdkey.publicKey instanceof Uint8Array
      ? hdkey.publicKey
      : new Uint8Array(hdkey.publicKey);

  return {
    derivePath: (path: string) => {
      const derived = hdkey.derive(path);
      return createBIP32Node(derived);
    },
    publicKey: pubKey,
    privateKey: hdkey.privateKey ? new Uint8Array(hdkey.privateKey) : undefined,
    neutered: () => {
      const publicKey = hdkey.publicExtendedKey;
      if (!publicKey) {
        throw new Error(
          'Cannot create neutered key: no public extended key available'
        );
      }
      const neuteredKey = hdkey.versions
        ? HDKey.fromExtendedKey(publicKey, hdkey.versions)
        : HDKey.fromExtendedKey(publicKey);
      return createBIP32Node(neuteredKey);
    },
    toBase58: () => {
      try {
        return hdkey.privateExtendedKey || hdkey.publicExtendedKey || '';
      } catch {
        return hdkey.publicExtendedKey || '';
      }
    },
  };
}

export const bip32Factory: BIP32Factory = () => {
  return {
    fromSeed: (seed: Uint8Array, versions?: NetworkVersions) => {
      const hdkey = versions?.bip32
        ? HDKey.fromMasterSeed(seed, {
            private: versions.bip32.private,
            public: versions.bip32.public,
          })
        : HDKey.fromMasterSeed(seed);
      return createBIP32Node(hdkey);
    },
    fromBase58: (base58Key: string, versions?: NetworkVersions) => {
      const hdkey = versions?.bip32
        ? HDKey.fromExtendedKey(base58Key, {
            private: versions.bip32.private,
            public: versions.bip32.public,
          })
        : HDKey.fromExtendedKey(base58Key);
      return createBIP32Node(hdkey);
    },
  };
};
