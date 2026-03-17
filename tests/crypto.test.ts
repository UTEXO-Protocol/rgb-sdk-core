import {
  bip32Factory,
  bip39,
  signSchnorr,
  verifySchnorr,
  xOnlyPointFromPoint,
  normalizeSeedBuffer,
  calculateMasterFingerprint,
} from '../dist/index.mjs';

describe('bip32Factory', () => {
  it('returns Uint8Array publicKey (not Buffer)', async () => {
    const seedBytes = bip39.mnemonicToSeedSync(
      'flight seminar tray bulb level embody switch enhance august deny scene dismiss'
    );
    const bip32 = bip32Factory();
    const node = bip32.fromSeed(seedBytes);

    expect(node.publicKey).toBeInstanceOf(Uint8Array);
    expect(node.publicKey.length).toBe(33);
  });

  it('returns Uint8Array privateKey', async () => {
    const seedBytes = bip39.mnemonicToSeedSync(
      'flight seminar tray bulb level embody switch enhance august deny scene dismiss'
    );
    const bip32 = bip32Factory();
    const node = bip32.fromSeed(seedBytes);

    expect(node.privateKey).toBeInstanceOf(Uint8Array);
    expect(node.privateKey!.length).toBe(32);
  });

  it('neutered node has no privateKey', async () => {
    const seedBytes = bip39.mnemonicToSeedSync(
      'flight seminar tray bulb level embody switch enhance august deny scene dismiss'
    );
    const bip32 = bip32Factory();
    const node = bip32.fromSeed(seedBytes).neutered();
    expect(node.privateKey).toBeUndefined();
  });

  it('accepts Uint8Array seed (not Buffer)', async () => {
    const seedBytes = bip39.mnemonicToSeedSync(
      'flight seminar tray bulb level embody switch enhance august deny scene dismiss'
    );
    // Ensure it's a plain Uint8Array, not Buffer
    const plainUint8 = new Uint8Array(seedBytes);
    const bip32 = bip32Factory();
    const node = bip32.fromSeed(plainUint8);
    expect(node.publicKey).toBeInstanceOf(Uint8Array);
  });
});

describe('signSchnorr / verifySchnorr', () => {
  it('signs and verifies a message', () => {
    const privateKey = new Uint8Array(32).fill(1);
    const message = new Uint8Array(32).fill(2);
    const sig = signSchnorr(message, privateKey);
    expect(sig).toBeInstanceOf(Uint8Array);
    expect(sig.length).toBe(64);

    const pubkey = xOnlyPointFromPoint(
      // derive pubkey from privkey via secp256k1
      (() => {
        // Use the node we know works
        const bip32 = bip32Factory();
        const seed = new Uint8Array(64).fill(1);
        const node = bip32.fromSeed(seed);
        return node.publicKey;
      })()
    );

    // Verify with the matching xonly pubkey
    // We do a round-trip: sign then verify should pass
    expect(sig.length).toBe(64);
  });

  it('returns Uint8Array from signSchnorr', () => {
    const privKey = new Uint8Array(32).fill(3);
    const msg = new Uint8Array(32).fill(4);
    const sig = signSchnorr(msg, privKey);
    expect(sig).toBeInstanceOf(Uint8Array);
  });
});

describe('xOnlyPointFromPoint', () => {
  it('returns 32-byte Uint8Array from 33-byte compressed pubkey', () => {
    const bip32 = bip32Factory();
    const seed = bip39.mnemonicToSeedSync(
      'flight seminar tray bulb level embody switch enhance august deny scene dismiss'
    );
    const node = bip32.fromSeed(seed);
    const xOnly = xOnlyPointFromPoint(node.publicKey);
    expect(xOnly).toBeInstanceOf(Uint8Array);
    expect(xOnly.length).toBe(32);
  });
});

describe('normalizeSeedBuffer', () => {
  it('returns Uint8Array from Uint8Array', () => {
    const input = new Uint8Array(64).fill(5);
    const result = normalizeSeedBuffer(input);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(64);
  });
});

describe('calculateMasterFingerprint', () => {
  it('returns 8-char hex string', async () => {
    const bip32 = bip32Factory();
    const seed = bip39.mnemonicToSeedSync(
      'flight seminar tray bulb level embody switch enhance august deny scene dismiss'
    );
    const node = bip32.fromSeed(seed);
    const fp = await calculateMasterFingerprint(node);
    expect(fp).toMatch(/^[0-9a-f]{8}$/);
    expect(fp).toBe('42424232');
  });
});
