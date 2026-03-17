import { sha256 } from '@noble/hashes/sha2.js';
import { ValidationError, CryptoError } from '../errors';
import { normalizeNetwork } from '../utils/validation';
import { getNetworkVersions } from '../utils/bip32-helpers';
import { accountDerivationPath, normalizeSeedInput } from './keys';
import {
  bip32Factory,
  signSchnorr,
  verifySchnorr,
  xOnlyPointFromPoint,
} from './dependencies';
import type { Network } from './types';

export interface SignMessageParams {
  message: string | Uint8Array;
  seed: string | Uint8Array;
  network?: Network;
}

export interface VerifyMessageParams {
  message: string | Uint8Array;
  signature: string;
  accountXpub: string;
  network?: Network;
}

const DEFAULT_MESSAGE_DERIVATION_PATH = 'm/0/0';

function ensureMessageInput(message: string | Uint8Array): Uint8Array {
  if (typeof message === 'string') {
    if (!message.length) {
      throw new ValidationError('message must not be empty', 'message');
    }
    return new TextEncoder().encode(message);
  }
  if (message instanceof Uint8Array) {
    if (!message.length) {
      throw new ValidationError('message must not be empty', 'message');
    }
    return message;
  }
  throw new ValidationError(
    'message must be a string or Uint8Array',
    'message'
  );
}

export async function signMessage(params: SignMessageParams): Promise<string> {
  const { message, seed } = params;
  if (!seed) {
    throw new ValidationError('seed is required', 'seed');
  }
  const normalizedNetwork = normalizeNetwork(params.network ?? 'regtest');
  const accountPath = accountDerivationPath(normalizedNetwork, false);
  const messageBytes = ensureMessageInput(message);
  const normalizedSeed = normalizeSeedInput(seed, 'seed');
  const versions = getNetworkVersions(normalizedNetwork);

  let root;
  try {
    root = bip32Factory().fromSeed(normalizedSeed, versions);
  } catch (error) {
    throw new CryptoError(
      'Failed to create BIP32 root node from seed',
      error as Error
    );
  }

  const accountNode = root.derivePath(accountPath);
  const child = accountNode.derivePath(DEFAULT_MESSAGE_DERIVATION_PATH);
  const privateKey = child.privateKey;

  if (!privateKey) {
    throw new CryptoError('Derived node does not contain a private key');
  }

  const messageHash = sha256(messageBytes);
  return Buffer.from(signSchnorr(messageHash, privateKey)).toString('base64');
}

export async function verifyMessage(
  params: VerifyMessageParams
): Promise<boolean> {
  const { message, signature, accountXpub } = params;
  const messageBytes = ensureMessageInput(message);
  const signatureBytes = Buffer.from(signature, 'base64');

  const normalizedNetwork = normalizeNetwork(params.network ?? 'regtest');
  const versions = getNetworkVersions(normalizedNetwork);

  let accountNode;
  try {
    accountNode = bip32Factory().fromBase58(accountXpub, versions);
  } catch {
    throw new ValidationError('Invalid account xpub provided', 'accountXpub');
  }

  const child = accountNode.derivePath(DEFAULT_MESSAGE_DERIVATION_PATH);
  const xOnlyPubkey = xOnlyPointFromPoint(child.publicKey);
  const messageHash = sha256(messageBytes);

  try {
    return verifySchnorr(messageHash, xOnlyPubkey, signatureBytes);
  } catch {
    return false;
  }
}
