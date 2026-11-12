# @utexo/rgb-sdk-core

[![npm](https://img.shields.io/npm/v/@utexo/rgb-sdk-core)](https://www.npmjs.com/package/@utexo/rgb-sdk-core)
[![license](https://img.shields.io/npm/l/@utexo/rgb-sdk-core)](LICENSE)

The shared core of the UTEXO RGB SDK: the wallet engine contract, types, errors, key helpers and the LSP client. Pure TypeScript with no React Native, Node or browser dependencies.

> [!TIP]
> Building a wallet app? Start with [`@utexo/rgb-sdk`](https://www.npmjs.com/package/@utexo/rgb-sdk) and an engine such as [`@utexo/rgb-sdk-rn`](https://www.npmjs.com/package/@utexo/rgb-sdk-rn). They depend on this package and re-export what apps need. Install it directly to write an engine, share types, or use the key and LSP helpers.

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
| LSP             | `UtexoLsp`, `UtexoLSPClient` (see [LSP flows](#lsp-flows))                                                                                |
| Conformance     | `@utexo/rgb-sdk-core/conformance`: test suite for engine implementations                                                                  |

## Keys

```ts
import { generateKeys, deriveKeysFromMnemonic } from '@utexo/rgb-sdk-core';

const keys = await generateKeys('signet'); // { mnemonic, xpub, accountXpubVanilla, … }
const same = await deriveKeysFromMnemonic('signet', keys.mnemonic);
```

`generateKeys()` needs a secure `crypto.getRandomValues` and a global `Buffer`. React Native apps install them with `react-native-get-random-values` and `buffer` (see the `@utexo/rgb-sdk-rn` README).

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

## LSP flows

For Lightning wallets. `UtexoLsp` combines the `utexo-lsp` HTTP API with a
wallet into ready flows: channel setup, receiving RGB over Lightning, Lightning
Addresses and paying them. It needs a Lightning wallet that implements
`ILspWallet`; the on-chain (`RGB_L1`) engines such as `@utexo/rgb-sdk-rn` do
not. `UtexoLSPClient` is the plain HTTP client.

| Method                                             | What it does                                                               |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| `connect()` / `waitForChannel()`                   | Peer with the LSP and wait until it has provisioned a usable asset channel |
| `receiveAsset()` / `awaitReceiveSettlement()`      | Be paid on-chain in RGB and delivered over Lightning                       |
| `sendAsset()`                                      | The reverse: pay over Lightning, LSP sends RGB on-chain                    |
| `enableLightningAddress()` / `refillHashPool()`    | Register an APay hash batch and get an LSP-hosted Lightning Address        |
| `payAddress()` / `quoteAddress()`                  | Pay a Lightning Address, or just quote the invoice                         |
| `discoverAddress()` / `listPayableAssets()`        | What an address can be paid in, from LNURL discovery                       |
| `requestExternalInvoice()`                         | Quote a hosted BOLT11 for a payer that is not this wallet                  |
| `payExternalInvoice()` / `externalPaymentStatus()` | Pay a third party's plain BOLT11 out of an asset this wallet does not hold |

### Two-asset LSPs

An LSP can serve one asset over Lightning while accepting another that it
converts to it 1:1 — typically an `LNUSDT`-shaped asset it provisions, and a
canonical on-chain `USDT` its users already hold. The two are unrelated RGB
contracts; the pairing is an LSP operator setting, and the rate is the
operator's word rather than anything the protocol enforces.

Where that applies:

- **Receiving** — `receiveAsset()` names only the Lightning-side asset. The LSP
  resolves the on-chain counterpart, so its contract id is never configured
  client-side and comes back as `onchainAssetId`.
- **Paying an address** — omit `asset.assetId` and `selectPaymentAsset()` reads
  the address's payout and accepted assets off discovery, then picks by local
  liquidity. Conversion is the fallback, not the default: quoting the payout
  asset trusts the LSP for delivery only, converting also trusts it for the
  second leg's amount.
- **Relaying** — `payExternalInvoice()` pays an ordinary third-party invoice out
  of a different asset. Both legs share that invoice's payment hash, and the SDK
  decodes the LSP's HODL invoice locally and refuses the quote unless the hash,
  the assets and the amounts match what the LSP reported.

## License

[MIT](LICENSE)
