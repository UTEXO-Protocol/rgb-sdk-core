# @utexo/rgb-sdk-core

Shared core for RGB SDK — platform-agnostic interfaces, types, and business logic.

## Overview

This package provides the common foundation used by the RGB SDK client libraries (`@utexo/rgb-sdk`, `@utexo/rgb-sdk-rn`, `@utexo/rgb-sdk-web`). It includes:

- **Protocol contract** — `IUTEXOProtocol` and its domain groups (`ILightningNode`, `ILightningPayments`, `IAsyncPayments`, `IOnchainTransfers`, `IRgbAssets`, `IBitcoinWallet`) plus the optional carriers (`IPsbtSigning`, `IBeginEndFlows`)
- **Bindings & signing** — `IRgbLibBinding`, `ISigner`, and the RLN model/interfaces
- **LSP flows** — `UtexoLsp`, `UtexoLSPClient` and their types (see below)
- **Crypto utilities** — key derivation, PSBT helpers, message signing, VSS
- **Types & validation** — wallet models, network constants, input validation
- **Error handling** — standardized error classes

## Installation

```bash
npm install @utexo/rgb-sdk-core
```

## Usage

```typescript
import { generateKeys, type IUTEXOProtocol } from '@utexo/rgb-sdk-core';
```

## LSP flows

`UtexoLsp` composes the `utexo-lsp` HTTP API with a wallet into the flows apps
actually use — channel setup, receiving RGB over Lightning, Lightning
Addresses, and paying them. It depends on `ILspWallet`, a narrow structural
interface, so it lives here rather than in a platform package; every platform
wallet satisfies it by implementing `IUTEXOProtocol`.

Most apps reach it through their platform SDK (`wallet.createLsp()`) rather than
constructing it directly.

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
