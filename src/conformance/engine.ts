/**
 * Engine contract conformance — base plus declared extensions.
 *
 * Separate from the legacy `runConformanceChecks()` (`IUTEXOProtocol`), which
 * stays unchanged. These checks cover what can be checked without a native or
 * WASM runtime: method presence, honest absence of undeclared extensions,
 * the embedded contract version, and capability flags. Behavior under load
 * (shutdown ordering, cleanup after a failed init, error normalization) needs
 * engine-specific mocks and lives in each engine package's own tests.
 *
 * ```ts
 * runEngineConformanceChecks({
 *   name: 'rgb-lib-rn',
 *   engineClass: RgbLibWallet,
 *   createEngineSync: () => new RgbLibWallet(params, keys, fakeBinding),
 *   extensions: ['restartable', 'fileBackup', 'maintenance', 'burn', 'consignment', 'consignmentFile'],
 * });
 * ```
 */

import { assertEngineContract } from '../engine/errors';
import { CARRIER_GROUPS } from './index';
import { resolveRunner } from './runner';
import type { RunnerBindings } from './runner';

/** The contract version this core release defines. Test tooling only. */
export const ENGINE_CONTRACT_VERSION_UNDER_TEST = '1';

/** Methods of `SharedWalletApi`, as data: interfaces are erased at runtime. */
export const SHARED_WALLET_METHODS = [
  // lifecycle
  'init',
  'unlock',
  'destroy',
  'isDisposed',
  // network
  'getNetwork',
  'getNetworkInfo',
  'getWalletIdentity',
  // bitcoin
  'getAddress',
  'getBtcBalance',
  'listUnspents',
  'sendBtc',
  'createUtxos',
  'estimateFeeRate',
  // rgb assets
  'listAssets',
  'getAssetBalance',
  'issueAssetNia',
  'issueAssetIfa',
  'inflate',
  'blindReceive',
  'witnessReceive',
  'decodeRGBInvoice',
  'failTransfers',
  // on-chain
  'onchainReceive',
  'onchainSend',
  // history
  'listTransfers',
  'listTransactions',
  'refresh',
  'refreshWallet',
  'syncWallet',
] as const;

/** Extension name → its methods. Mirrors `interfaces/engine/extensions.ts`. */
export const ENGINE_EXTENSIONS = {
  restartable: ['shutdown', 'reinit'],
  fileBackup: ['exportBackupToFile'],
  backupExport: ['exportBackup'],
  backupRestore: ['restoreBackup'],
  maintenance: ['drainTo', 'deleteTransfers'],
  burn: ['getBfaCapabilities', 'burn'],
  consignment: ['getBfaCapabilities', 'getConsignment'],
  consignmentFile: ['getConsignmentPath'],
  vssBackup: ['backupToVss'],
  vssRestore: ['restoreFromVss'],
  vssBackupInfo: ['getVssBackupInfo'],
  vssFence: ['clearVssFence'],
  messageSigning: ['signMessage', 'verifyMessage'],
  indexerCheck: ['checkIndexerUrl'],
  assetMetadata: ['getAssetMetadata'],
  fileIssuance: ['issueAssetCfa', 'issueAssetUda'],
  txidLookup: ['listTransfersByTxid', 'listTransactionsByTxid'],
  addressRotation: ['rotateVanillaAddress'],
} as const;

export type EngineExtensionName = keyof typeof ENGINE_EXTENSIONS;

export interface EngineConformanceOptions extends RunnerBindings {
  /** Package name, used in the test titles. */
  name: string;
  /** The engine class; method presence is checked on its prototype. */
  engineClass: { prototype: object };
  /**
   * Builds an engine without initializing it. Construction must not open
   * state or touch the network, so this is safe in unit tests. Without it
   * the instance checks (version, protocol, capabilities) are skipped.
   */
  createEngineSync?: () => Record<string, unknown>;
  /** Extensions the engine implements. All others must be absent. */
  extensions: readonly EngineExtensionName[];
}

export function runEngineConformanceChecks(
  opts: EngineConformanceOptions
): void {
  const { describe, it, expect } = resolveRunner(
    'runEngineConformanceChecks',
    opts
  );
  const proto = () => opts.engineClass.prototype as Record<string, unknown>;

  const declared = new Set<string>(
    opts.extensions.flatMap((name) => [...ENGINE_EXTENSIONS[name]])
  );
  const undeclared = (
    Object.keys(ENGINE_EXTENSIONS) as EngineExtensionName[]
  ).filter((name) => !opts.extensions.includes(name));

  describe(`${opts.name} — engine contract`, () => {
    describe('base surface', () => {
      for (const method of SHARED_WALLET_METHODS) {
        it(`exposes ${method}()`, () => {
          expect(typeof proto()[method]).toBe('function');
        });
      }
    });

    describe('extensions', () => {
      for (const name of opts.extensions) {
        for (const method of ENGINE_EXTENSIONS[name]) {
          it(`${name}: exposes ${method}()`, () => {
            expect(typeof proto()[method]).toBe('function');
          });
        }
      }
      // An extension that is not declared must not be half-present: that is
      // where always-throwing stubs would hide.
      for (const name of undeclared) {
        for (const method of ENGINE_EXTENSIONS[name]) {
          if (declared.has(method)) continue; // shared with a declared one
          it(`${name} (not declared): ${method}() is absent`, () => {
            expect(typeof proto()[method]).toBe('undefined');
          });
        }
      }
    });

    const build = opts.createEngineSync;
    if (!build) return;

    describe('instance', () => {
      it(`declares contractVersion '${ENGINE_CONTRACT_VERSION_UNDER_TEST}'`, () => {
        expect(build().contractVersion).toBe(
          ENGINE_CONTRACT_VERSION_UNDER_TEST
        );
      });

      it('passes assertEngineContract()', () => {
        let error: unknown;
        try {
          assertEngineContract(build(), [ENGINE_CONTRACT_VERSION_UNDER_TEST]);
        } catch (e) {
          error = e;
        }
        expect(error).toBe(undefined);
      });

      it('declares a known protocol', () => {
        expect(['RGB_L1', 'RGB_LN']).toContain(build().protocol);
      });

      it('capabilities.canSignTransactions is a boolean', () => {
        const caps = build().capabilities as Record<string, unknown>;
        expect(typeof caps?.canSignTransactions).toBe('boolean');
      });

      for (const group of CARRIER_GROUPS) {
        it(`capabilities.${group.flag} matches presence of .${group.property}`, () => {
          const engine = build();
          const caps = engine.capabilities as Record<string, unknown>;
          expect(caps[group.flag]).toBe(engine[group.property] !== undefined);
        });
      }
    });
  });
}
