# Changelog

## 1.0.0-beta.5

### Breaking

The shared surface consolidates on a single wallet contract so the client
packages (`@utexo/rgb-sdk`, `@utexo/rgb-sdk-rn`, `@utexo/rgb-sdk-web`) all
implement the same interface.

- **`IUTEXOWallet` is the single wallet contract** — the old
  `IWalletManager` / `IUTEXOProtocol` interface family is removed.
  `IUTEXOWallet` composes the domain groups `IBitcoinWallet`, `ILightningNode`,
  `ILightningPayments`, `IAsyncPayments`, `IOnchainTransfers`, and `IRgbAssets`,
  with platform-specific surface exposed through the optional carriers
  `IPsbtSigning` / `IBeginEndFlows`. Migration: implement/consume `IUTEXOWallet`
  in place of `IWalletManager` and `IUTEXOProtocol`.
- **`BaseWalletManager` removed** — the shared abstract base class (and its
  test suite) is gone. Client wallets are now standalone and implement
  `IUTEXOWallet` directly rather than extending a base.
- **`ILightningAddress` renamed to `IAsyncPayments`** — the async-payment (APay)
  contract now lives under its own name; update imports accordingly.
- **`utexo/config` presets and `utexo/utils/network` removed** — network
  presets (`utexo-presets.ts`, `config/options.ts`) and the old per-network
  helpers moved out of `src/utexo/`. Use the normalized RLN network helpers in
  `src/rln/network.ts` instead.

### Added

- **LSP moved to core** — `UtexoLsp` / `UtexoLSPClient` and the LSP types
  (`LspPeer`, `LspChannel`, `LspAssetConfig`, `ILspWallet`) are now exported
  from `@utexo/rgb-sdk-core` (`src/lsp/`); client packages re-export them.
- **Conformance harness** — `@utexo/rgb-sdk-core/conformance` exposes
  field-level checks (`src/conformance/field-checks.ts`) so client packages can
  assert their wallet implements the full `IUTEXOWallet` surface.
- **Normalized RLN network helpers** — `src/rln/network.ts` provides canonical
  network parsing/normalization, re-exported from the `rln` barrel.
- Vendored RLN model and interfaces (`src/rln/model.ts`, `src/rln/*`) shared
  across the RLN-backed client packages.

### Changed

- Wallet params cleaned up (`src/interfaces/wallet/params.ts`,
  `src/types/wallet-model.ts`) — unused fields dropped.
- Source comments and JSDoc trimmed to state contracts and invariants only.

### Removed

- `IWalletManager`, `IUTEXOProtocol` (old), `BaseWalletManager`,
  `utexo/utexo-protocol.ts`, `utexo/config/`, and `utexo/utils/network.ts`,
  along with the `base-wallet-manager.test.ts` suite.

## 0.1.0

Initial release of `@utexo/rgb-sdk-core` — the platform-agnostic foundation
shared by the RGB SDK client libraries.

### Added

- **Protocol contract** — `IUTEXOProtocol` and its domain groups, plus the
  optional carriers `IPsbtSigning` / `IBeginEndFlows`
- **Bindings & signing** — `IRgbLibBinding`, `ISigner`, and the RLN
  model/interfaces
- **Crypto utilities** — key derivation, PSBT helpers, message signing, VSS
  (`defaultVssConfig` helper for the default VSS server)
- **Types & validation** — wallet models, network constants (including the
  `utexo` network), input validation, and `reuseAddresses` support
- **Error handling** — standardized error class hierarchy
- Bare-runtime compatibility — default export and `fetch`-based transport
  (no `axios` dependency)
- ESM + CJS build via `tsup` (`dist/index.mjs` / `dist/index.cjs` /
  `dist/index.d.ts`)
