# @utexo/rgb-sdk-core

[![npm](https://img.shields.io/npm/v/@utexo/rgb-sdk-core)](https://www.npmjs.com/package/@utexo/rgb-sdk-core)
[![license](https://img.shields.io/npm/l/@utexo/rgb-sdk-core)](LICENSE)

The shared core of the UTEXO RGB SDK: the wallet engine contract, types, errors and key helpers. Pure TypeScript with no React Native, Node or browser dependencies.

> [!TIP]
> Building a wallet app? Start with [`@utexo/rgb-sdk`](https://www.npmjs.com/package/@utexo/rgb-sdk) and an engine such as [`@utexo/rgb-sdk-rn`](https://www.npmjs.com/package/@utexo/rgb-sdk-rn). They depend on this package and re-export what apps need. Install it directly to write an engine, share types, or use the key helpers.

## Installation

```bash
npm install @utexo/rgb-sdk-core
```

## What's inside

| Area            | Exports                                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Engine contract | `SharedWalletApi`, extension interfaces (`RestartableWalletApi`, `FileBackupApi`, `BackupExportApi`, `BackupRestoreApi`, `VssBackupApi`, `VssRestoreApi`, `VssBackupInfoApi`, `VssFenceApi`, `BurnApi`, `ConsignmentApi`, …), `assertEngineContract` |
| Errors          | `isEngineError`, `EngineContractError`, `SDKError` and subclasses (`ValidationError`, `CryptoError`, `NetworkError`, …)                   |
| Keys            | `generateKeys`, `deriveKeysFromMnemonic`, `signMessage`, `verifyMessage`, PSBT and VSS helpers                                            |
| Types           | wallet, asset, transfer and invoice models; network constants and default endpoints                                                       |
| Conformance     | `@utexo/rgb-sdk-core/conformance`: test suite for engine implementations                                                                  |

## Keys

```ts
import { generateKeys, deriveKeysFromMnemonic } from '@utexo/rgb-sdk-core';

const keys = await generateKeys('utexo'); // { mnemonic, xpub, accountXpubVanilla, … }
const same = await deriveKeysFromMnemonic('utexo', keys.mnemonic);
```

`generateKeys()` needs a secure `crypto.getRandomValues`. `signMessage()`, `verifyMessage()`, `detectPsbtType()` and `validateBase64()` also need a global `Buffer`. React Native apps install them with `react-native-get-random-values` and `buffer` (see the `@utexo/rgb-sdk-rn` README).

## Errors

Every engine rejects with an `EngineError`: a stable `code`, the public `operation` and the `protocol`. Check it by shape, which also works across duplicated copies of the SDK:

```ts
import { isEngineError } from '@utexo/rgb-sdk-core';

try {
  await wallet.getBtcBalance();
} catch (error) {
  if (isEngineError(error, 'WALLET_NOT_INITIALIZED')) {
    await wallet.init();
  } else {
    throw error;
  }
}
```

Shared codes: `INVALID_PARAMS`, `UNSUPPORTED_CAPABILITY`, `WALLET_NOT_INITIALIZED`, `WALLET_OFFLINE`, `WALLET_INVALID_STATE`, `WALLET_DISPOSED` and `ENGINE_CONTRACT_MISMATCH`. Engines add their own; each engine's README lists them.

## Writing an engine

An engine is a class that implements `SharedWalletApi`, declares `contractVersion: '1'` and `protocol`, and optionally implements extension interfaces. `UTEXOWallet` from `@utexo/rgb-sdk` accepts any such engine.

Check it with the conformance suite in your tests:

```ts
import { runEngineConformanceChecks } from '@utexo/rgb-sdk-core/conformance';

runEngineConformanceChecks({
  name: 'my-engine',
  engineClass: MyEngine,
  createEngineSync: () => new MyEngine(params, keys),
  extensions: ['restartable', 'fileBackup'],
});
```

It uses the Jest or Vitest globals; with another runner, pass `describe`, `it` and `expect`.

The contract is versioned: a change that breaks engines or apps gets a new `contractVersion`, and `UTEXOWallet` refuses an engine whose version it does not support.

## License

[MIT](LICENSE)
