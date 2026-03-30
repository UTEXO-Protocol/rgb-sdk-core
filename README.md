# @utexo/rgb-sdk-core

Shared core for RGB SDK — platform-agnostic interfaces, types, and business logic.

## Overview

This package provides the common foundation used by RGB SDK client libraries (`@utexo/rgb-sdk`, `@utexo/rgb-sdk-rn`, `@utexo/rgb-lib-wasm`). It includes:

- **Interfaces** — `IWalletManager`, `IRgbLibBinding`, `ISigner`, `IUTEXOProtocol`
- **Wallet logic** — `BaseWalletManager`, UTEXO wallet core
- **Crypto utilities** — key derivation, PSBT helpers, message signing, VSS
- **Types & validation** — wallet models, network constants, input validation
- **Error handling** — standardized error classes

## Installation

```bash
npm install @utexo/rgb-sdk-core
```

## Usage

```typescript
import { BaseWalletManager, IWalletManager } from '@utexo/rgb-sdk-core';
```

## License

MIT
