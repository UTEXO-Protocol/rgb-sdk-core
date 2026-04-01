import {
  buildVssConfigFromMnemonic,
  DEFAULT_VSS_SERVER_URL,
  UTEXOWalletCore,
} from '../dist/index.mjs';

class TestUTEXOWalletCore extends UTEXOWalletCore {
  async initialize(): Promise<void> {}
}

describe('UTEXOWalletCore.getDefaultVssConfig', () => {
  it('returns the default VSS config when no config is provided', async () => {
    const mnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const wallet = new TestUTEXOWalletCore(mnemonic);

    const config = await wallet.getDefaultVssConfig();
    const expected = await buildVssConfigFromMnemonic(
      mnemonic,
      DEFAULT_VSS_SERVER_URL,
      'mainnet'
    );

    expect(config).toEqual(expected);
    expect(config.serverUrl).toBe(DEFAULT_VSS_SERVER_URL);
    expect(config.backupMode).toBe('Blocking');
  });
});
