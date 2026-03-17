import {
  generateKeys,
  deriveKeysFromMnemonic,
  deriveKeysFromSeed,
  deriveKeysFromXpriv,
  restoreKeys,
  getXprivFromMnemonic,
  getXpubFromXpriv,
  accountXpubsFromMnemonic,
  ValidationError,
  CryptoError,
} from '../dist/index.mjs';

const testMnemonic =
  'flight seminar tray bulb level embody switch enhance august deny scene dismiss';

const expectedTestnet = {
  mnemonic: testMnemonic,
  xpub: 'tpubD6NzVbkrYhZ4WLw9njYmLvMEWp5nqVmjfkgAZfj7uivNXCFS7Ls9DyDZM82P4cDpobCDGAZpNsR9Gs9wuvv5yYCNFsqxcbsDn6VU4nU3ZcW',
  accountXpubVanilla:
    'tpubDDTg3fRGqAvEvshRUUwuS8brXkewNsE6y6Jbb9xZcuzBbmxAWa3UCmwyQG4peM9RwjgY8BDwuRVRU5KGtvRby5kiv1dk13YHU8z39o18QJK',
  accountXpubColored:
    'tpubDDqoEexZxewBLjXmZ7kxSHgZgmdAtej6DrXLBMiSSuPCdGQqjkTvyETLLVY7qNpxNRGUivvxDj8sswHHihT5effNNDmsbMUX2Lrpy4zjRcS',
  masterFingerprint: '42424232',
};

describe('generateKeys', () => {
  it('generates valid keys for testnet', async () => {
    const keys = await generateKeys('testnet');
    expect(keys.mnemonic.split(' ').length).toBe(12);
    expect(keys.xpub).toMatch(/^tpub/);
    expect(keys.accountXpubVanilla).toMatch(/^tpub/);
    expect(keys.accountXpubColored).toMatch(/^tpub/);
    expect(keys.masterFingerprint).toMatch(/^[0-9a-f]{8}$/i);
    expect(keys.xpriv).toMatch(/^tprv/);
  });

  it('generates valid keys for mainnet', async () => {
    const keys = await generateKeys('mainnet');
    expect(keys.xpub).toMatch(/^xpub/);
    expect(keys.accountXpubVanilla).toMatch(/^xpub/);
    expect(keys.accountXpubColored).toMatch(/^xpub/);
    expect(keys.masterFingerprint).toMatch(/^[0-9a-f]{8}$/i);
    expect(keys.xpriv).toMatch(/^xprv/);
  });

  it('generates valid keys for regtest', async () => {
    const keys = await generateKeys('regtest');
    expect(keys.xpub).toMatch(/^tpub/);
    expect(keys.xpriv).toMatch(/^tprv/);
  });

  it('generates unique mnemonics each call', async () => {
    const a = await generateKeys('testnet');
    const b = await generateKeys('testnet');
    expect(a.mnemonic).not.toBe(b.mnemonic);
  });
});

describe('deriveKeysFromMnemonic', () => {
  it('derives deterministic keys for testnet', async () => {
    const keys = await deriveKeysFromMnemonic('testnet', testMnemonic);
    expect(keys.mnemonic).toBe(testMnemonic);
    expect(keys.xpub).toBe(expectedTestnet.xpub);
    expect(keys.accountXpubVanilla).toBe(expectedTestnet.accountXpubVanilla);
    expect(keys.accountXpubColored).toBe(expectedTestnet.accountXpubColored);
    expect(keys.masterFingerprint).toBe(expectedTestnet.masterFingerprint);
    expect(keys.xpriv).toMatch(/^tprv/);
  });

  it('is consistent with restoreKeys alias', async () => {
    const a = await deriveKeysFromMnemonic('testnet', testMnemonic);
    const b = await restoreKeys('testnet', testMnemonic);
    expect(a.masterFingerprint).toBe(b.masterFingerprint);
    expect(a.xpub).toBe(b.xpub);
  });

  it('throws ValidationError for empty mnemonic', async () => {
    await expect(deriveKeysFromMnemonic('testnet', '')).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('throws for invalid mnemonic', async () => {
    await expect(
      deriveKeysFromMnemonic('testnet', 'not valid words here extra padding ok')
    ).rejects.toThrow();
  });

  it('derives different xpubs for mainnet vs testnet', async () => {
    const testnet = await deriveKeysFromMnemonic('testnet', testMnemonic);
    const mainnet = await deriveKeysFromMnemonic('mainnet', testMnemonic);
    expect(testnet.xpub).not.toBe(mainnet.xpub);
    expect(mainnet.xpub).toMatch(/^xpub/);
  });
});

describe('deriveKeysFromSeed', () => {
  it('derives consistent keys from seed matching mnemonic derivation', async () => {
    const fromMnemonic = await deriveKeysFromMnemonic('testnet', testMnemonic);
    // derive seed hex from mnemonic via bip39
    const { bip39 } = await import('../dist/index.mjs');
    const seedBytes = bip39.mnemonicToSeedSync(testMnemonic);
    const seedHex = Buffer.from(seedBytes).toString('hex');

    const fromSeed = await deriveKeysFromSeed('testnet', seedHex);
    expect(fromSeed.masterFingerprint).toBe(fromMnemonic.masterFingerprint);
    expect(fromSeed.xpub).toBe(fromMnemonic.xpub);
    expect(fromSeed.accountXpubVanilla).toBe(fromMnemonic.accountXpubVanilla);
    expect(fromSeed.accountXpubColored).toBe(fromMnemonic.accountXpubColored);
  });

  it('accepts Uint8Array seed', async () => {
    const { bip39 } = await import('../dist/index.mjs');
    const seedBytes = bip39.mnemonicToSeedSync(testMnemonic);
    const keys = await deriveKeysFromSeed('testnet', seedBytes);
    expect(keys.masterFingerprint).toBe(expectedTestnet.masterFingerprint);
  });

  it('throws ValidationError for wrong-length hex seed', async () => {
    await expect(
      deriveKeysFromSeed('testnet', 'deadbeef')
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('getXprivFromMnemonic / getXpubFromXpriv / deriveKeysFromXpriv', () => {
  it('roundtrips xpriv → xpub', async () => {
    const xpriv = await getXprivFromMnemonic('testnet', testMnemonic);
    expect(xpriv).toMatch(/^tprv/);

    const xpub = await getXpubFromXpriv(xpriv);
    expect(xpub).toBe(expectedTestnet.xpub);
  });

  it('deriveKeysFromXpriv returns same fingerprint as mnemonic path', async () => {
    const xpriv = await getXprivFromMnemonic('testnet', testMnemonic);
    const keys = await deriveKeysFromXpriv(xpriv);
    expect(keys.masterFingerprint).toBe(expectedTestnet.masterFingerprint);
    expect(keys.accountXpubVanilla).toBe(expectedTestnet.accountXpubVanilla);
    expect(keys.accountXpubColored).toBe(expectedTestnet.accountXpubColored);
  });

  it('getXpubFromXpriv throws for empty string', async () => {
    await expect(getXpubFromXpriv('')).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('accountXpubsFromMnemonic', () => {
  it('returns correct account xpubs', async () => {
    const xpubs = await accountXpubsFromMnemonic('testnet', testMnemonic);
    expect(xpubs.account_xpub_vanilla).toBe(expectedTestnet.accountXpubVanilla);
    expect(xpubs.account_xpub_colored).toBe(expectedTestnet.accountXpubColored);
  });
});
