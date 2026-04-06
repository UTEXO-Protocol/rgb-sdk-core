import { jest } from '@jest/globals';
import {
  BaseWalletManager,
  WalletError,
  ValidationError,
  bip39,
} from '../dist/index.mjs';

// Minimal concrete subclass for testing
class TestWalletManager extends BaseWalletManager {
  async initialize() {}
  async goOnline(_url: string) {}
}

/** Exposes protected fields for constructor / seed behavior tests only */
class SeedInspectableWalletManager extends BaseWalletManager {
  async initialize() {}
  async goOnline(_url: string) {}

  getMnemonicSnapshot(): string | null {
    return this.mnemonic;
  }

  getSeedSnapshot(): Uint8Array | null {
    return this.seed ? new Uint8Array(this.seed) : null;
  }
}

function bip39SeedBytes(mnemonic: string): Uint8Array {
  return new Uint8Array(bip39.mnemonicToSeedSync(mnemonic.trim()));
}

const testMnemonic =
  'flight seminar tray bulb level embody switch enhance august deny scene dismiss';

const minimalParams = {
  xpubVan:
    'tpubDDTg3fRGqAvEvshRUUwuS8brXkewNsE6y6Jbb9xZcuzBbmxAWa3UCmwyQG4peM9RwjgY8BDwuRVRU5KGtvRby5kiv1dk13YHU8z39o18QJK',
  xpubCol:
    'tpubDDqoEexZxewBLjXmZ7kxSHgZgmdAtej6DrXLBMiSSuPCdGQqjkTvyETLLVY7qNpxNRGUivvxDj8sswHHihT5effNNDmsbMUX2Lrpy4zjRcS',
  masterFingerprint: '42424232',
  network: 'testnet',
};

describe('BaseWalletManager construction', () => {
  it('constructs without binding or signer', () => {
    const wm = new TestWalletManager(minimalParams);
    expect(wm.getNetwork()).toBe('testnet');
    expect(wm.getXpub().xpubVan).toBe(minimalParams.xpubVan);
    expect(wm.getXpub().xpubCol).toBe(minimalParams.xpubCol);
    expect(wm.isDisposed()).toBe(false);
  });

  it('throws ValidationError if xpubVan is missing', () => {
    expect(
      () => new TestWalletManager({ ...minimalParams, xpubVan: '' })
    ).toThrow(ValidationError);
  });

  it('throws ValidationError if xpubCol is missing', () => {
    expect(
      () => new TestWalletManager({ ...minimalParams, xpubCol: '' })
    ).toThrow(ValidationError);
  });

  it('throws ValidationError if masterFingerprint is missing', () => {
    expect(
      () => new TestWalletManager({ ...minimalParams, masterFingerprint: '' })
    ).toThrow(ValidationError);
  });

  it('defaults network to regtest', () => {
    const wm = new TestWalletManager({ ...minimalParams, network: undefined });
    expect(wm.getNetwork()).toBe('regtest');
  });

  it('derives seed from mnemonic when seed is omitted', () => {
    const wm = new SeedInspectableWalletManager({
      ...minimalParams,
      mnemonic: testMnemonic,
    });
    expect(wm.getMnemonicSnapshot()).toBe(testMnemonic);
    expect(wm.getSeedSnapshot()).toEqual(bip39SeedBytes(testMnemonic));
  });

  it('uses explicit seed when both seed and mnemonic are provided', () => {
    const explicitSeed = new Uint8Array(64).fill(1);
    const wm = new SeedInspectableWalletManager({
      ...minimalParams,
      mnemonic: testMnemonic,
      seed: explicitSeed,
    });
    expect(wm.getMnemonicSnapshot()).toBe(testMnemonic);
    expect(wm.getSeedSnapshot()).toEqual(explicitSeed);
    expect(wm.getSeedSnapshot()).not.toEqual(bip39SeedBytes(testMnemonic));
  });
});

describe('BaseWalletManager requireBinding / requireSigner', () => {
  it('getBtcBalance throws WalletError when no binding', async () => {
    const wm = new TestWalletManager(minimalParams);
    await expect(wm.getBtcBalance()).rejects.toBeInstanceOf(WalletError);
  });

  it('listUnspents throws WalletError when no binding', async () => {
    const wm = new TestWalletManager(minimalParams);
    await expect(wm.listUnspents()).rejects.toBeInstanceOf(WalletError);
  });

  it('estimateFee throws WalletError when no signer', async () => {
    const wm = new TestWalletManager(minimalParams);
    await expect(wm.estimateFee('psbt-base64')).rejects.toBeInstanceOf(
      WalletError
    );
  });

  it('signPsbt throws WalletError when no mnemonic/seed/signer', async () => {
    const wm = new TestWalletManager(minimalParams);
    await expect(wm.signPsbt('psbt')).rejects.toBeInstanceOf(WalletError);
  });
});

describe('BaseWalletManager with mock binding', () => {
  const mockBinding = {
    getOnline: jest.fn(),
    dropWallet: jest.fn(),
    registerWallet: jest.fn().mockReturnValue({
      address: 'addr',
      btcBalance: {
        vanilla: { settled: 0, future: 0, spendable: 0 },
        colored: { settled: 0, future: 0, spendable: 0 },
      },
    }),
    getBtcBalance: jest.fn().mockResolvedValue({
      vanilla: { settled: 100, future: 0, spendable: 100 },
      colored: { settled: 0, future: 0, spendable: 0 },
    }),
    getAddress: jest.fn().mockResolvedValue('tb1qtest'),
    rotateAddress: jest.fn().mockResolvedValue('tb1qrotated'),
    listUnspents: jest.fn().mockResolvedValue([]),
    createUtxosBegin: jest.fn().mockResolvedValue('psbt1'),
    createUtxosEnd: jest.fn().mockResolvedValue(1),
    listAssets: jest.fn().mockResolvedValue({ nia: [], ifa: [] }),
    getAssetBalance: jest
      .fn()
      .mockResolvedValue({ future: 0, settled: 0, spendable: 0 }),
    issueAssetNia: jest.fn().mockResolvedValue({}),
    issueAssetIfa: jest.fn().mockResolvedValue({}),
    inflateBegin: jest.fn().mockResolvedValue('psbt2'),
    inflateEnd: jest.fn().mockResolvedValue({ success: true }),
    sendBegin: jest.fn().mockResolvedValue('psbt3'),
    sendEnd: jest.fn().mockResolvedValue({ txid: 'abc' }),
    sendBtcBegin: jest.fn().mockResolvedValue('psbt4'),
    sendBtcEnd: jest.fn().mockResolvedValue('txid'),
    blindReceive: jest.fn().mockResolvedValue({
      invoice: 'inv',
      expirationTimestamp: null,
      batchTransferIdx: 0,
    }),
    witnessReceive: jest.fn().mockResolvedValue({
      invoice: 'inv2',
      expirationTimestamp: null,
      batchTransferIdx: 0,
    }),
    decodeRGBInvoice: jest.fn().mockResolvedValue({}),
    listTransactions: jest.fn().mockResolvedValue([]),
    listTransfers: jest.fn().mockResolvedValue([]),
    failTransfers: jest.fn().mockResolvedValue(true),
    refreshWallet: jest.fn(),
    syncWallet: jest.fn(),
    getFeeEstimation: jest.fn().mockResolvedValue({ feeRate: 1 }),
    createBackup: jest.fn().mockResolvedValue({ path: '/backup' }),
    configureVssBackup: jest.fn(),
    disableVssAutoBackup: jest.fn(),
    vssBackup: jest.fn().mockResolvedValue(1),
    vssBackupInfo: jest.fn().mockResolvedValue({}),
    sendBeginBatch: jest.fn().mockResolvedValue('psbt5'),
  };

  it('getBtcBalance delegates to binding', async () => {
    const wm = new TestWalletManager(minimalParams, mockBinding as any);
    const balance = await wm.getBtcBalance();
    expect(mockBinding.getBtcBalance).toHaveBeenCalled();
    expect(balance.vanilla.settled).toBe(100);
  });

  it('getAddress delegates to binding', async () => {
    const wm = new TestWalletManager(minimalParams, mockBinding as any);
    const addr = await wm.getAddress();
    expect(addr).toBe('tb1qtest');
  });

  it('listUnspents delegates to binding', async () => {
    const wm = new TestWalletManager(minimalParams, mockBinding as any);
    const utxos = await wm.listUnspents();
    expect(Array.isArray(utxos)).toBe(true);
  });

  it('estimateFeeRate throws for non-positive blocks', async () => {
    const wm = new TestWalletManager(minimalParams, mockBinding as any);
    await expect(wm.estimateFeeRate(0)).rejects.toBeInstanceOf(ValidationError);
    await expect(wm.estimateFeeRate(-1)).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('estimateFeeRate delegates valid request to binding', async () => {
    const wm = new TestWalletManager(minimalParams, mockBinding as any);
    const result = await wm.estimateFeeRate(6);
    expect(mockBinding.getFeeEstimation).toHaveBeenCalledWith({ blocks: 6 });
    expect(result).toEqual({ feeRate: 1 });
  });
});

describe('WalletInitParams — new optional fields', () => {
  it('accepts reuseAddresses: true', () => {
    expect(
      () => new TestWalletManager({ ...minimalParams, reuseAddresses: true })
    ).not.toThrow();
  });

  it('accepts reuseAddresses: false', () => {
    expect(
      () => new TestWalletManager({ ...minimalParams, reuseAddresses: false })
    ).not.toThrow();
  });

  it('accepts reuseAddresses: undefined (default)', () => {
    expect(
      () => new TestWalletManager({ ...minimalParams, reuseAddresses: undefined })
    ).not.toThrow();
  });

  it('accepts vanillaKeychain: 0', () => {
    expect(
      () => new TestWalletManager({ ...minimalParams, vanillaKeychain: 0 })
    ).not.toThrow();
  });

  it('accepts vanillaKeychain: null', () => {
    expect(
      () => new TestWalletManager({ ...minimalParams, vanillaKeychain: null })
    ).not.toThrow();
  });

  it('accepts vanillaKeychain: undefined (default)', () => {
    expect(
      () => new TestWalletManager({ ...minimalParams, vanillaKeychain: undefined })
    ).not.toThrow();
  });

  it('accepts maxAllocationsPerUtxo: 1', () => {
    expect(
      () => new TestWalletManager({ ...minimalParams, maxAllocationsPerUtxo: 1 })
    ).not.toThrow();
  });

  it('accepts maxAllocationsPerUtxo: undefined (default)', () => {
    expect(
      () => new TestWalletManager({ ...minimalParams, maxAllocationsPerUtxo: undefined })
    ).not.toThrow();
  });
});

describe('BaseWalletManager rotateAddress', () => {
  it('throws WalletError when no binding', async () => {
    const wm = new TestWalletManager(minimalParams);
    await expect(wm.rotateAddress(0)).rejects.toBeInstanceOf(WalletError);
  });

  it('throws WalletError after dispose', async () => {
    const mockBinding = {
      rotateAddress: jest.fn().mockResolvedValue('tb1qnew'),
      dropWallet: jest.fn(),
    } as any;
    const wm = new TestWalletManager(minimalParams, mockBinding);
    await wm.dispose();
    await expect(wm.rotateAddress(0)).rejects.toBeInstanceOf(WalletError);
  });

  it('delegates to binding with keychain 0 (external)', async () => {
    const mockBinding = {
      rotateAddress: jest.fn().mockResolvedValue('tb1qexternal'),
      dropWallet: jest.fn(),
    } as any;
    const wm = new TestWalletManager(minimalParams, mockBinding);
    const addr = await wm.rotateAddress(0);
    expect(mockBinding.rotateAddress).toHaveBeenCalledWith(0);
    expect(addr).toBe('tb1qexternal');
  });

  it('delegates to binding with keychain 1 (internal)', async () => {
    const mockBinding = {
      rotateAddress: jest.fn().mockResolvedValue('tb1qinternal'),
      dropWallet: jest.fn(),
    } as any;
    const wm = new TestWalletManager(minimalParams, mockBinding);
    const addr = await wm.rotateAddress(1);
    expect(mockBinding.rotateAddress).toHaveBeenCalledWith(1);
    expect(addr).toBe('tb1qinternal');
  });
});

describe('BaseWalletManager dispose', () => {
  it('isDisposed returns true after dispose()', async () => {
    const wm = new TestWalletManager(minimalParams);
    expect(wm.isDisposed()).toBe(false);
    await wm.dispose();
    expect(wm.isDisposed()).toBe(true);
  });

  it('getBtcBalance throws after dispose', async () => {
    const mockBinding = {
      getBtcBalance: jest.fn(),
      dropWallet: jest.fn(),
    } as any;
    const wm = new TestWalletManager(minimalParams, mockBinding);
    await wm.dispose();
    await expect(wm.getBtcBalance()).rejects.toBeInstanceOf(WalletError);
  });

  it('dispose is idempotent', async () => {
    const wm = new TestWalletManager(minimalParams);
    await wm.dispose();
    await wm.dispose(); // should not throw
    expect(wm.isDisposed()).toBe(true);
  });

  it('zeroes seed on dispose', async () => {
    const seed = new Uint8Array(64).fill(7);
    const wm = new TestWalletManager({ ...minimalParams, seed });
    await wm.dispose();
    // seed should be zeroed
    expect(seed.every((b) => b === 0)).toBe(true);
  });
});
