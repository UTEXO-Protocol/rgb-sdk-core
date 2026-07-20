import {
  buildVssConfigFromMnemonic,
  getBackupStoreId,
  deriveKeysFromMnemonic,
  DEFAULT_VSS_SERVER_URL,
} from '../dist/index.mjs';

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('buildVssConfigFromMnemonic', () => {
  it('builds a config with the given server url and Blocking backup mode', async () => {
    const config = await buildVssConfigFromMnemonic(
      MNEMONIC,
      DEFAULT_VSS_SERVER_URL,
      'mainnet'
    );

    expect(config.serverUrl).toBe(DEFAULT_VSS_SERVER_URL);
    expect(config.backupMode).toBe('Blocking');
    expect(typeof config.signingKey).toBe('string');
    expect(config.signingKey.length).toBeGreaterThan(0);
  });

  it('derives storeId as wallet_<masterFingerprint>', async () => {
    const keys = await deriveKeysFromMnemonic('mainnet', MNEMONIC);
    const config = await buildVssConfigFromMnemonic(
      MNEMONIC,
      DEFAULT_VSS_SERVER_URL,
      'mainnet'
    );

    expect(config.storeId).toBe(`wallet_${keys.masterFingerprint}`);
    expect(config.storeId).toBe(getBackupStoreId(keys.masterFingerprint));
  });

  it('is deterministic for the same mnemonic and network', async () => {
    const a = await buildVssConfigFromMnemonic(
      MNEMONIC,
      DEFAULT_VSS_SERVER_URL,
      'mainnet'
    );
    const b = await buildVssConfigFromMnemonic(
      MNEMONIC,
      DEFAULT_VSS_SERVER_URL,
      'mainnet'
    );

    expect(a).toEqual(b);
  });

  it('trims surrounding whitespace in the mnemonic', async () => {
    const clean = await buildVssConfigFromMnemonic(
      MNEMONIC,
      DEFAULT_VSS_SERVER_URL,
      'mainnet'
    );
    const padded = await buildVssConfigFromMnemonic(
      `  ${MNEMONIC}  `,
      DEFAULT_VSS_SERVER_URL,
      'mainnet'
    );

    expect(padded).toEqual(clean);
  });

  it('defaults to the testnet preset when none is given', async () => {
    const implicit = await buildVssConfigFromMnemonic(
      MNEMONIC,
      DEFAULT_VSS_SERVER_URL
    );
    const explicit = await buildVssConfigFromMnemonic(
      MNEMONIC,
      DEFAULT_VSS_SERVER_URL,
      'testnet'
    );

    expect(implicit).toEqual(explicit);
  });
});

describe('getBackupStoreId', () => {
  it('prefixes the master fingerprint with wallet_', () => {
    expect(getBackupStoreId('abcd1234')).toBe('wallet_abcd1234');
  });
});
