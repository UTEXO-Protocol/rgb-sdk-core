# @utexo/rgb-sdk-core

Platform-agnostic core of the UTEXO RGB SDK: the wallet engine contract, shared types, key helpers, errors and the LSP client. It has no React Native, Node or browser dependencies.

Most apps do not install it alone. It is a peer dependency of:

- `@utexo/rgb-lib-rn`: the RGB_L1 engine for React Native (native rgb-lib);
- `@utexo/rgb-sdk`: the `UTEXOWallet` facade over any engine.

## Installation

```bash
npm install @utexo/rgb-sdk-core
```

## What it contains

- **Engine contract.** `SharedWalletApi`, the API every engine implements, and the optional extension interfaces (`RestartableWalletApi`, `FileBackupApi`, `BurnApi`, `ConsignmentApi` and others). `assertEngineContract()` checks an engine's `contractVersion`.
- **Errors.** `isEngineError(error, code?)` recognizes an engine error by its shape (`code`, `operation`, `protocol`), so it also works across copies of the SDK. `EngineContractError` reports a contract mismatch. `SDKError` and its subclasses (`ValidationError`, `CryptoError`, `NetworkError` and others) cover the core helpers.
- **Keys.** `generateKeys(network)`, `deriveKeysFromMnemonic()` and `deriveKeysFromMnemonicOrSeed()`, message signing (`signMessage`, `verifyMessage`), PSBT and VSS helpers.
- **Types and validation.** Wallet and transfer models, network constants and defaults, input validators.
- **LSP client.** `UtexoLSPClient` and the composed `UtexoLsp` flows (see below).
- **Conformance suite.** `@utexo/rgb-sdk-core/conformance` runs the engine contract checks against an engine implementation (`runEngineConformanceChecks`).

```typescript
import {
  generateKeys,
  isEngineError,
  type SharedWalletApi,
} from '@utexo/rgb-sdk-core';

const { mnemonic } = await generateKeys('utexo');

try {
  await engine.getBtcBalance();
} catch (error) {
  if (isEngineError(error, 'INVALID_PARAMS')) {
    // error.operation, error.protocol, error.cause
  }
}
```

`generateKeys()` needs a secure `crypto.getRandomValues` and a global `Buffer`. In React Native, install them before any SDK import (see the `@utexo/rgb-lib-rn` README).

### Writing an engine

An engine implements `SharedWalletApi` and declares `contractVersion: '1'`. Run the conformance suite in its tests:

```typescript
import { runEngineConformanceChecks } from '@utexo/rgb-sdk-core/conformance';

runEngineConformanceChecks({
  name: 'my engine',
  engineClass: MyEngine,
  createEngineSync: () => new MyEngine(params, keys),
  extensions: ['restartable', 'fileBackup'],
});
```

It uses the Jest or Vitest globals; with another runner, pass `describe`, `it` and `expect`.

## LSP flows

`UtexoLsp` composes the `utexo-lsp` HTTP API with a wallet into the flows apps
actually use — channel setup, receiving RGB over Lightning, Lightning
Addresses, and paying them. It depends on `ILspWallet`, a narrow structural
interface, so it lives here rather than in a platform package; every platform
Lightning wallet satisfies it by implementing `IUTEXOProtocol`.

The Lightning wallet in `@utexo/rgb-sdk-rn` exposes it as `wallet.createLsp()`.

| Method | What it does |
|--------|--------------|
| `connect()` / `waitForChannel()` | Peer with the LSP and wait until it has provisioned a usable asset channel |
| `receiveAsset()` / `awaitReceiveSettlement()` | Be paid on-chain in RGB and delivered over Lightning |
| `sendAsset()` | The reverse: pay over Lightning, LSP sends RGB on-chain |
| `enableLightningAddress()` / `refillHashPool()` | Register an APay hash batch and get an LSP-hosted Lightning Address |
| `payAddress()` / `quoteAddress()` | Pay a Lightning Address, or just quote the invoice |
| `discoverAddress()` / `listPayableAssets()` | What an address can be paid in, from LNURL discovery |
| `requestExternalInvoice()` | Quote a hosted BOLT11 for a payer that is not this wallet |
| `payExternalInvoice()` / `externalPaymentStatus()` | Pay a third party's plain BOLT11 out of an asset this wallet does not hold |

### Two assets

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

Worked examples, one file per flow:
[`rgb-sdk-rn/examples/lsp-two-assets`](https://github.com/UTEXO-Protocol/rgb-sdk-rn/tree/main/examples/lsp-two-assets).

## License

MIT
