# @utexo/rgb-sdk-core

Shared core for RGB SDK — platform-agnostic interfaces, types, and business logic.

## Overview

This package provides the common foundation used by the RGB SDK client libraries (`@utexo/rgb-sdk`, `@utexo/rgb-sdk-rn`, `@utexo/rgb-sdk-web`). It includes:

- **Wallet contract** — `IUTEXOWallet` and its domain groups (`ILightningNode`, `ILightningPayments`, `IOnchainTransfers`, `IRgbAssets`, `IBitcoinWallet`, …) plus the optional carriers (`IPsbtSigning`, `IBeginEndFlows`)
- **Bindings & signing** — `IRgbLibBinding`, `ISigner`, and the RLN model/interfaces
- **Crypto utilities** — key derivation, PSBT helpers, message signing, VSS
- **Types & validation** — wallet models, network constants, input validation
- **Error handling** — standardized error classes

## Installation

```bash
npm install @utexo/rgb-sdk-core
```

## Usage

```typescript
import { generateKeys, type IUTEXOWallet } from '@utexo/rgb-sdk-core';
```

## License

MIT
