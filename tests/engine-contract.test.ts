import {
  assertEngineContract,
  EngineContractError,
  isEngineError,
  WalletError,
} from '../dist/index.mjs';
import type {
  BackupExportApi,
  BackupRestoreApi,
  BurnApi,
  ConsignmentApi,
  EngineCapabilities,
  FileBackupApi,
  RestartableWalletApi,
  SharedWalletApi,
  VssBackupApi,
  VssBackupInfoApi,
  VssRestoreApi,
} from '../dist/index.mjs';
import {
  ENGINE_CONTRACT_VERSION_UNDER_TEST,
  runEngineConformanceChecks,
} from '../dist/conformance/index.mjs';

type Unlock = { indexerUrl: string };

const notUsed = (): never => {
  throw new Error('not used in these tests');
};

/**
 * A minimal engine. `implements` makes the compiler check it against the
 * base and the extensions it declares.
 */
class FakeEngine
  implements
    SharedWalletApi<Unlock>,
    RestartableWalletApi<Unlock>,
    FileBackupApi,
    BackupExportApi,
    BackupRestoreApi,
    BurnApi,
    ConsignmentApi,
    VssBackupApi,
    VssRestoreApi,
    VssBackupInfoApi
{
  readonly protocol = 'RGB_L1' as const;
  readonly contractVersion = '1' as const;
  readonly psbt = undefined;
  readonly beginEnd = undefined;
  initCalls = 0;

  constructor(private readonly watchOnly = false) {}

  get capabilities(): EngineCapabilities {
    return {
      psbtSigning: this.psbt !== undefined,
      beginEndFlows: this.beginEnd !== undefined,
      canSignTransactions: !this.watchOnly,
    };
  }

  async init() {
    this.initCalls += 1;
  }
  async unlock(_params: Unlock) {}
  async destroy() {}
  isDisposed() {
    return false;
  }
  getNetwork() {
    return 'regtest' as const;
  }
  getNetworkInfo = notUsed;
  getWalletIdentity = notUsed;
  getAddress = notUsed;
  getBtcBalance = notUsed;
  listUnspents = notUsed;
  sendBtc = notUsed;
  createUtxos = notUsed;
  estimateFeeRate = notUsed;
  listAssets = notUsed;
  getAssetBalance = notUsed;
  issueAssetNia = notUsed;
  issueAssetIfa = notUsed;
  inflate = notUsed;
  blindReceive = notUsed;
  witnessReceive = notUsed;
  decodeRGBInvoice = notUsed;
  failTransfers = notUsed;
  onchainReceive = notUsed;
  onchainSend = notUsed;
  listTransfers = notUsed;
  listTransactions = notUsed;
  refresh = notUsed;
  refreshWallet = notUsed;
  syncWallet = notUsed;
  shutdown = notUsed;
  reinit = notUsed;
  exportBackupToFile = notUsed;
  exportBackup = notUsed;
  restoreBackup = notUsed;
  backupToVss = notUsed;
  restoreFromVss = notUsed;
  getVssBackupInfo = notUsed;
  getBfaCapabilities = notUsed;
  burn = notUsed;
  getConsignment = notUsed;
}

/**
 * The prototype checks need real prototype methods; class fields live on the
 * instance. Copy the instance's functions onto a prototype for the suite.
 */
function asClass(instance: object): { prototype: object } {
  const proto = Object.create(Object.getPrototypeOf(instance));
  for (const [key, value] of Object.entries(instance)) {
    if (typeof value === 'function') proto[key] = value;
  }
  return { prototype: proto };
}

const extensions = [
  'restartable',
  'fileBackup',
  'backupExport',
  'backupRestore',
  'burn',
  'consignment',
  'vssBackup',
  'vssRestore',
  'vssBackupInfo',
] as const;

runEngineConformanceChecks({
  name: 'FakeEngine',
  engineClass: asClass(new FakeEngine()),
  createEngineSync: () =>
    new FakeEngine() as unknown as Record<string, unknown>,
  extensions,
});

/** Runs the suite with a recording runner and returns the failing test names. */
function failuresOf(
  options: Omit<
    Parameters<typeof runEngineConformanceChecks>[0],
    'describe' | 'it' | 'expect'
  >
): string[] {
  const failures: string[] = [];
  const prefix: string[] = [];
  runEngineConformanceChecks({
    ...options,
    describe: (name, fn) => {
      prefix.push(name);
      fn();
      prefix.pop();
    },
    it: (name, fn) => {
      try {
        void fn();
      } catch {
        failures.push([...prefix, name].join(' › '));
      }
    },
    expect: (actual) => ({
      toBe: (expected) => {
        if (actual !== expected) throw new Error('toBe');
      },
      toContain: (expected) => {
        if (!(actual as unknown[]).includes(expected))
          throw new Error('toContain');
      },
    }),
  });
  return failures;
}

describe('runEngineConformanceChecks catches', () => {
  it('a method of an undeclared extension (a stub)', () => {
    const engine = new FakeEngine() as unknown as Record<string, unknown>;
    engine.signMessage = notUsed;
    const failures = failuresOf({
      name: 'stub',
      engineClass: asClass(engine),
      extensions,
    });
    expect(failures).toEqual([
      'stub — engine contract › extensions › messageSigning (not declared): signMessage() is absent',
    ]);
  });

  it('a declared extension with a method missing', () => {
    const engine = new FakeEngine() as unknown as Record<string, unknown>;
    delete engine.restoreBackup;
    const failures = failuresOf({
      name: 'half',
      engineClass: asClass(engine),
      extensions,
    });
    expect(failures).toEqual([
      'half — engine contract › extensions › backupRestore: exposes restoreBackup()',
    ]);
  });

  it('a missing base method', () => {
    const engine = new FakeEngine() as unknown as Record<string, unknown>;
    delete engine.syncWallet;
    const failures = failuresOf({
      name: 'gap',
      engineClass: asClass(engine),
      extensions,
    });
    expect(failures).toEqual([
      'gap — engine contract › base surface › exposes syncWallet()',
    ]);
  });

  it('a wrong contract version', () => {
    const failures = failuresOf({
      name: 'old',
      engineClass: asClass(new FakeEngine()),
      createEngineSync: () =>
        Object.assign(new FakeEngine(), {
          contractVersion: '0',
        }) as unknown as Record<string, unknown>,
      extensions,
    });
    expect(failures).toEqual([
      "old — engine contract › instance › declares contractVersion '1'",
      'old — engine contract › instance › passes assertEngineContract()',
    ]);
  });
});

describe('assertEngineContract', () => {
  it('accepts the embedded version', () => {
    expect(() =>
      assertEngineContract(new FakeEngine(), [
        ENGINE_CONTRACT_VERSION_UNDER_TEST,
      ])
    ).not.toThrow();
  });

  it.each([
    ['a wrong version', { contractVersion: '2', protocol: 'RGB_L1' }],
    ['a missing version', { protocol: 'RGB_L1' }],
    ['a non-string version', { contractVersion: 1, protocol: 'RGB_L1' }],
  ])('rejects %s without calling init()', (_label, fields) => {
    const engine = Object.assign(new FakeEngine(), fields);
    if (!('contractVersion' in fields)) {
      Object.defineProperty(engine, 'contractVersion', { value: undefined });
    }
    let error: unknown;
    try {
      assertEngineContract(engine, ['1']);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(EngineContractError);
    expect(isEngineError(error, 'ENGINE_CONTRACT_MISMATCH')).toBe(true);
    expect((error as EngineContractError).protocol).toBe('RGB_L1');
    expect(engine.initCalls).toBe(0);
  });

  it('rejects a non-object', () => {
    expect(() => assertEngineContract(null, ['1'])).toThrow(
      EngineContractError
    );
  });
});

describe('isEngineError', () => {
  const shape = {
    code: 'UNSUPPORTED_CAPABILITY',
    message: 'no',
    operation: 'burn',
    protocol: 'RGB_L1',
  };

  it('accepts a plain object with the shape (another core copy)', () => {
    expect(isEngineError({ ...shape })).toBe(true);
    expect(isEngineError({ ...shape, operation: undefined })).toBe(true);
    expect(isEngineError({ ...shape, protocol: undefined })).toBe(true);
  });

  it('filters by code', () => {
    expect(isEngineError(shape, 'UNSUPPORTED_CAPABILITY')).toBe(true);
    expect(isEngineError(shape, 'WALLET_OFFLINE')).toBe(false);
  });

  it('rejects other values', () => {
    const { operation: _o, ...noOperation } = shape;
    const { protocol: _p, ...noProtocol } = shape;
    expect(isEngineError(noOperation)).toBe(false);
    expect(isEngineError(noProtocol)).toBe(false);
    expect(isEngineError({ ...shape, protocol: 'BTC' })).toBe(false);
    expect(isEngineError({ ...shape, code: 7 })).toBe(false);
    expect(isEngineError(new Error('plain'))).toBe(false);
    expect(isEngineError(null)).toBe(false);
    expect(isEngineError('ENGINE_CONTRACT_MISMATCH')).toBe(false);
  });

  it("does not treat core's older WalletError class as an engine error", () => {
    expect(isEngineError(new WalletError('legacy', 'WALLET_ERROR'))).toBe(
      false
    );
  });
});

describe('FakeEngine capabilities', () => {
  it('watch-only cannot sign transactions', () => {
    expect(new FakeEngine(true).capabilities.canSignTransactions).toBe(false);
    expect(new FakeEngine(false).capabilities.canSignTransactions).toBe(true);
  });
});
