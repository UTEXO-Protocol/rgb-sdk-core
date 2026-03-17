import {
  DERIVATION_PURPOSE,
  DERIVATION_ACCOUNT,
  KEYCHAIN_RGB,
  KEYCHAIN_BTC,
  COIN_RGB_TESTNET,
  COIN_RGB_MAINNET,
  COIN_BITCOIN_MAINNET,
  COIN_BITCOIN_TESTNET,
} from '../constants';
import type { PsbtType, Network, Descriptors, BIP32Interface } from './types';

// ---------------------------------------------------------------------------
// Descriptor derivation (pure BIP32 — no platform dependencies)
// ---------------------------------------------------------------------------

/**
 * Derive BDK-compatible taproot descriptor strings for a given seed root node.
 *
 * - create_utxo  →  standard BTC BIP86 account descriptors (m/86'/coin_btc'/0')
 * - send         →  RGB account descriptors split into RGB keychain and BTC keychain
 */
export function deriveDescriptors(
  rootNode: BIP32Interface,
  fp: string,
  network: Network,
  psbtType: PsbtType,
): Descriptors {
  const isMainnet = network === 'mainnet';
  const coinTypeBtc = isMainnet ? COIN_BITCOIN_MAINNET : COIN_BITCOIN_TESTNET;
  const coinTypeRgb = isMainnet ? COIN_RGB_MAINNET : COIN_RGB_TESTNET;

  if (psbtType === 'create_utxo') {
    const accountPath = `m/${DERIVATION_PURPOSE}'/${coinTypeBtc}'/${DERIVATION_ACCOUNT}'`;
    const accountXprv = rootNode.derivePath(accountPath).toBase58();
    const origin = `[${fp}/${DERIVATION_PURPOSE}'/${coinTypeBtc}'/${DERIVATION_ACCOUNT}']`;
    return {
      external: `tr(${origin}${accountXprv}/0/*)`,
      internal: `tr(${origin}${accountXprv}/1/*)`,
    };
  }

  const rgbAccountPath = `m/${DERIVATION_PURPOSE}'/${coinTypeRgb}'/${DERIVATION_ACCOUNT}'`;
  const rgbKeychainXprv = rootNode.derivePath(rgbAccountPath).derivePath(`m/${KEYCHAIN_RGB}`).toBase58();
  const rgbOrigin = `[${fp}/${DERIVATION_PURPOSE}'/${coinTypeRgb}'/${DERIVATION_ACCOUNT}'/${KEYCHAIN_RGB}]`;

  const btcAccountPath = `m/${DERIVATION_PURPOSE}'/${coinTypeBtc}'/${DERIVATION_ACCOUNT}'`;
  const btcKeychainXprv = rootNode.derivePath(btcAccountPath).derivePath(`m/${KEYCHAIN_BTC}`).toBase58();
  const btcOrigin = `[${fp}/${DERIVATION_PURPOSE}'/${coinTypeBtc}'/${DERIVATION_ACCOUNT}'/${KEYCHAIN_BTC}]`;

  return {
    external: `tr(${rgbOrigin}${rgbKeychainXprv}/*)`,
    internal: `tr(${btcOrigin}${btcKeychainXprv}/*)`,
  };
}

// ---------------------------------------------------------------------------
// PSBT type detection
// ---------------------------------------------------------------------------

/** Read a Bitcoin compact-size integer; returns [value, bytesRead]. */
function readCompactSize(buf: Buffer, pos: number): [number, number] {
  const first = buf[pos];
  if (first < 0xfd) return [first, 1];
  if (first === 0xfd) return [buf.readUInt16LE(pos + 1), 3];
  if (first === 0xfe) return [buf.readUInt32LE(pos + 1), 5];
  return [buf.readUInt32LE(pos + 1), 9];
}

/**
 * Parse a PSBT map (key-value pairs terminated by 0x00).
 * Returns the byte position after the terminating 0x00.
 */
function parsePsbtMap(
  buf: Buffer,
  start: number,
  onEntry: (key: Buffer, value: Buffer) => void,
): number {
  let pos = start;
  while (pos < buf.length) {
    const [keyLen, klBytes] = readCompactSize(buf, pos);
    pos += klBytes;
    if (keyLen === 0) return pos;
    const key = buf.slice(pos, pos + keyLen);
    pos += keyLen;
    const [valLen, vlBytes] = readCompactSize(buf, pos);
    pos += vlBytes;
    const value = buf.slice(pos, pos + valLen);
    pos += valLen;
    onEntry(key, value);
  }
  return pos;
}

/** Count inputs in a raw Bitcoin transaction. */
function parseTxInputCount(txBuf: Buffer): number {
  let pos = 4;
  if (txBuf[pos] === 0x00) pos += 2; // segwit marker
  const [inputCount] = readCompactSize(txBuf, pos);
  return inputCount;
}

/**
 * Detect PSBT type by scanning only the INPUT maps for RGB coin-type derivation paths.
 * Outputs are deliberately excluded to avoid false positives (RGB change outputs in
 * a create_utxo PSBT carry RGB derivation paths in their output maps).
 *
 * COIN_RGB_TESTNET = 827167 = 0x000C9F1F → hardened LE = 1f9f0c80
 * COIN_RGB_MAINNET = 827166 = 0x000C9F1E → hardened LE = 1e9f0c80
 * DERIVATION_PURPOSE = 86 → hardened LE = 56000080
 */
export function detectPsbtType(psbtBase64: string): PsbtType {
  try {
    const buf = Buffer.from(psbtBase64.trim(), 'base64');

    if (buf.length < 5 || buf.readUInt32BE(0) !== 0x70736274 || buf[4] !== 0xff) {
      return 'create_utxo';
    }

    const le4 = (n: number): string => {
      const v = n >>> 0;
      return Buffer.from([v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff]).toString('hex');
    };

    // 8-byte path prefix: purpose' + rgb_coin_type' (avoids false positives from isolated 4-byte matches)
    const testnetPrefix = le4(0x80000000 | DERIVATION_PURPOSE) + le4(0x80000000 | COIN_RGB_TESTNET);
    const mainnetPrefix = le4(0x80000000 | DERIVATION_PURPOSE) + le4(0x80000000 | COIN_RGB_MAINNET);

    const asciiPatterns = [
      Buffer.from(COIN_RGB_TESTNET + "'").toString('hex'),
      Buffer.from(COIN_RGB_MAINNET + "'").toString('hex'),
      Buffer.from('/' + COIN_RGB_TESTNET).toString('hex'),
      Buffer.from('/' + COIN_RGB_MAINNET).toString('hex'),
    ];

    let pos = 5;
    let inputCount = 0;

    pos = parsePsbtMap(buf, pos, (key, value) => {
      if (key.length === 1 && key[0] === 0x00) {
        try { inputCount = parseTxInputCount(value); } catch { /* ignore */ }
      }
    });

    if (inputCount === 0) return 'create_utxo';

    for (let i = 0; i < inputCount; i++) {
      pos = parsePsbtMap(buf, pos, (key, value) => {
        const keyType = key[0];
        if (keyType !== 0x06 && keyType !== 0x16) return;

        const valueHex = value.toString('hex');
        if (valueHex.includes(testnetPrefix) || valueHex.includes(mainnetPrefix)) {
          inputCount = -1; return;
        }
        for (const pat of asciiPatterns) {
          if (valueHex.includes(pat)) { inputCount = -1; return; }
        }
      });

      if (inputCount === -1) return 'send';
    }

    return 'create_utxo';
  } catch {
    return 'create_utxo';
  }
}
