# RGB SDK — Shared Contract in Core (UTEXOWallet parity plan)

> Scope: `rgb-sdk-core` · `rgb-sdk-web` · `rgb-sdk-rn`
> Status: **DRAFT — proposal for review**
> Date: 2026-07-14

---

## 1. Principle

**Core owns only what is shared. Platforms keep their specifics.**

- If a function exists on `UTEXOWallet` in **both** web and RN → its name, params
  and return type are defined **once in core**, and both packages implement that
  definition. TypeScript then enforces request/response parity forever.
- If a function is platform-specific (WASM begin/sign/end trios, RN
  unlock/shutdown, native signers, …) → it stays in its package as a documented
  extra. It is **not** forced into the shared interface.
- Shared infrastructure both packages copy today (LSP module, LSP/network
  defaults) → updated and maintained in core, re-exported by the packages.

This is NOT a full consolidation: no shared base class, no moving of platform
mappers, no monorepo change. Only the contract.

---

## 2. Work item A — fix outdated core models (rgb-lib leftovers)

These block both platforms from implementing the same interface today — each
one widens core types locally. All changes are additive/optional → non-breaking.

| Type | Fix |
|------|-----|
| `CreateLightningInvoiceRequestModel` | `asset` becomes **optional** (BTC-only invoices); add `paymentHash?: string \| null`, `minFinalCltvExpiryDelta?: number \| null`; asset amount accepts the `amount`/`assetAmount` alias pair (web behavior) |
| `OnchainReceiveRequestModel` | `amount?`, `assetId?` optional; add `witness?: boolean` (default `true`) |
| `OnchainReceiveResponse` | Full receive data: `invoice` + `recipientId?` + `expirationTimestamp?` + `batchTransferIdx?` (RN has this data and throws it away today) |
| `OnchainSendRequestModel` | Add `witnessData?`, `donation?`, `feeRate?`, `minConfirmations?`, `skipSync?` (≡ `SendAssetBeginRequestModel`) — kills `RlnOnchainSendRequestModel` (rn) and web's type bypass |
| `PayLightningInvoiceRequestModel` | Add `assetAmount?: number`; **remove** `maxFee` (unsupported by RLN — web throws, RN ignores) |
| `GetFeeEstimationResponse` | Replace with canonical `{ feeRate: number }` (RN already returns plain number and violates the current interface) |
| `TransactionType` | Add `'SendBtc' \| 'Incoming'` (RLN emits them; RN currently folds to `'User'`, losing data) |
| `IUTEXOProtocol` | **Remove** bridge-era members that throw on **both** platforms: `getOnchainSendStatus`, `getLightningSendFeeEstimate`, `payLightningInvoiceBegin/End`. **Remove** the `TransferStatus`-returning `getLightningReceiveRequest`/`getLightningSendRequest` in favor of the unfolded LN-status methods (work item B / §4) |

Also **delete outright** (no deprecation period — all packages are beta, clean
break with a migration table in the changelog): `IRgbLibBinding`,
`UTEXOWalletCore` (zero implementations remain), `WalletInitParams` (requires
xpubs; rgb-lib options), `RGBHTTPClientParams`, `Withdraw*` models,
`BindingTransactionType`, the `AssetIFA`-vs-`AssetIfa` duplicate.

---

## 3. Work item B — shared response types + status vocabulary in core

"Same func → aligned types" requires the **return types** of the common
Lightning surface to live in core (today web returns domain types from its local
`rln-model.ts`, RN returns raw `Rln*` wire types — same methods, different
shapes). Move/define in core:

- `LightningChannel` (merge: web's domain shape + RN's extra fields
  `shortChannelId`, `virtualOpenMode`, `nextOutboundHtlcLimitMsat`, … as optional)
- `LightningNodeInfo` (superset: web's thin shape + RN's `RlnNodeInfo` extras as optional)
- `LightningNetworkInfo`, `LightningPeer`, `LightningPayment`, `LightningInvoice`,
  `DecodedLnInvoice`, `SendPaymentResult`, `OpenChannelParams`
- `CreateHodlInvoiceParams` / `HodlInvoiceResult`
- `ApayNewResponse` / `ApayHashEntry` (already field-for-field identical in both repos)
- `LdkVssBackupInfo`

Canonical status vocabulary (bindings normalize casing at their boundary —
RN native SCREAMING_SNAKE → these):

```ts
export type RlnInvoiceStatus = 'Pending' | 'Paid' | 'Expired';
export type RlnPaymentStatus = 'Pending' | 'Claimable' | 'Claiming'
                             | 'Succeeded' | 'Cancelled' | 'Failed';
```

**Lightning statuses are NOT mapped to `TransferStatus`.** The current fold
(`Paid` → `Settled`, `Pending` → `WaitingCounterparty`, …) is an rgb-lib-era
contract artifact and is lossy/misleading: `WaitingCounterparty` is an RGB
consignment concept with no LN meaning, and HODL-relevant states
(`Claimable`/`Claiming`) plus failure causes (`Expired`/`Cancelled`/`Failed`)
collapse into single buckets — both SDKs even fold them differently today.
Instead:

- `TransferStatus` stays **on-chain only** (RGB transfers).
- The Lightning surface returns `RlnInvoiceStatus` / `RlnPaymentStatus`
  directly — identical values on web and RN, matched by the canonical vocab
  above; nothing more.
- Apps that want one unified status column can fold in their own UI layer;
  core may ship an optional `foldLnStatusForDisplay()` helper, but it is not
  part of any wallet method's return type.

RN keeps its `Rln*` wire types locally as the uniffi contract; they are the
binding's input, never the public return type.

---

## 4. Work item C — align signatures of functions that exist on both

The shared-interface methods where web and RN currently differ. Old signatures
are **removed**, not aliased — one breaking beta release per package, with a
migration table in the changelog.

| Method | web today | rn today | Aligned (core) |
|--------|-----------|----------|----------------|
| constructor | `new UTEXOWallet(params)` | `new UTEXOWallet(params, signer)` | `new UTEXOWallet(params)` — RN builds `PasswordRLNSigner` internally from `params.password`; optional `signer` stays as an RN param extra |
| HODL create | `createHodlLnInvoice(p): LightningInvoice` | `createHodlInvoice(p): HodlInvoice` | `createHodlInvoice(p): LightningInvoice` |
| `connectPeer` | `(peerAddr, peerPubkey)` | `(peerPubkeyAndAddr)` | `(peerUri: string)` — `pubkey@host:port` (existing `peerUri()` helper) |
| `closeChannel` | `(id, peerPubkey?, force=false): void` | `(id, peerPubkey, force): Promise<void>` | `(id, peerPubkey?, force=false): Promise<void>` |
| `openChannel` | `OpenChannelParams → string` (temp id) | raw native request → `RlnOpenChannelResponse` | `OpenChannelParams → Promise<{ temporaryChannelId: string }>`; RN keeps raw form as `openChannelRaw` extra |
| `keysend` | → `SendPaymentResult` | → `RlnKeysendResponse` | → `SendPaymentResult` |
| `getNodeInfo` | `LightningNodeInfo` (thin) | `RlnNodeInfo` (rich) | merged `LightningNodeInfo` superset |
| `estimateFeeRate` | `GetFeeEstimationResponse` | `number` | `{ feeRate: number }` |
| `onchainReceive` | full receive data | `{invoice}` only | full receive data (work item A) |
| LN status polling | `getLightningReceiveRequest`/`getLightningSendRequest` → `TransferStatus \| null` (lossy fold) | same names, same lossy fold with *different* bucket choices | `getLightningReceiveStatus(id): Promise<RlnInvoiceStatus>` and `getLightningSendStatus(id): Promise<RlnPaymentStatus \| null>` — raw canonical LN statuses, no mapping (work item B). Old `*Request` methods **removed** |
| numeric params | `bigint` in node params | `number` | `number \| bigint` in core types; bindings convert |

Result: one `IUTEXOWallet` contract in core (composed from the cleaned
`IWalletManager` common subset + `IUTEXOProtocol` + the Lightning-node surface
above). Both `UTEXOWallet` classes declare `implements IUTEXOWallet`.
Methods only one platform can support are NOT in it — they remain typed
platform extras (see §6).

Shared create-params (both platforms accept a superset):

```ts
export interface UTEXOWalletCreateParams {
  mnemonic: string;
  password: string;
  network?: BitcoinNetwork;        // default 'utexo'
  indexerUrl?: string;             // default from core defaults (work item D)
  transportEndpoint?: string;
  vssUrl?: string | null;          // null disables
  vssAutoRestore?: boolean;        // default true
  lspBaseUrl?: string | null;
  lspBearerToken?: string | null;
}
// web extends: proxyUrl, nodeRuntimeId, dataDir, supportedSchemas, …
// rn  extends: storageDirPath, ports, vssAllowHttp, signer?, …
```

---

## 5. Work item D — shared infra both packages copy today

1. **LSP defaults** — `DEFAULT_LSP_BASE_URLS`, `getDefaultLspBaseUrl`,
   `resolveLspBaseUrl` are literal copies (web `RlnDefaults.ts` ↔ rn
   `network-defaults.ts`) → move to core. `resolveUnlockParams` stays RN-local
   (platform-specific) but reads the core tables.
2. **Indexer defaults conflict** — web's local `DEFAULT_INDEXER_URLS`
   (esplora-*.utexo.com) silently shadows core's (electrum.iriswallet.com).
   Decide per network which is authoritative, fix core's table, delete web's copy.
   Web's `proxyUrl` WS table (`DEFAULT_RLN_URLS`) is web-only and stays.
3. **LSP module** (`UtexoLsp`, `UtexoLSPClient`, `IUtexoLSPClient`, `LspErrors`,
   `lsp-types`) — ~95% identical in both repos; RN files already say *"moves to
   @utexo/rgb-sdk-core next release"*. Take web's copy as baseline (has
   `LspLiquidityTimeoutError` + newer types), replace its `UTEXOWallet` import
   with a narrow `ILspWallet` interface (the ~10 methods `UtexoLsp` actually
   calls — all part of the shared contract from §4, so both wallets satisfy it
   structurally). Both packages re-export from core; local copies deleted.

---

## 6. Work item E — package-side changes required for aligned type defs

Core changes alone don't align anything: both packages carry local type
definitions that shadow, widen, or contradict the core ones. These must be
removed/redirected or the "shared contract" is fiction.

### rgb-sdk-web

| File | Change |
|------|--------|
| `src/types/rln-model.ts` | Delete; `src/rln` barrel re-exports the same names from core (the file header already promises this). Shapes were kept identical on purpose → mostly a mechanical swap |
| `src/interfaces/IRln{NodeBinding,WalletBinding,SdkBinding}.ts` | Delete after the promotion to core; barrel re-exports from core |
| `src/types/rgb-model.ts` | **Conflict — must reconcile, not just move.** It redefines `Unspent`/`Utxo`/`RgbAllocation` differently from core (`pendingBlinded` sits on `Utxo` here but on `Unspent` in core; `RgbAllocation.assignment` is `BindingAssignment` map vs core's `Assignment` union) and both are star-exported from `index.ts` today. Decide the canonical shape in core, delete the local file |
| `src/utexo/utexo-wallet.ts` | Drop the inline widenings — `createLightningInvoice(Omit<…> & { asset?; paymentHash? })` and `payLightningInvoice(params & { assetAmount? })` take the fixed core models directly; `onchainReceive` return type becomes core's enriched `OnchainReceiveResponse` (drop the `& InvoiceReceiveData` intersection); delete local `mapInvoiceStatus`/`mapPaymentStatus`; add `getLightningReceiveStatus`/`getLightningSendStatus`; §4 renames applied as replacements (`createHodlInvoice`, `connectPeer(peerUri)`, `closeChannel → Promise<void>`, `estimateFeeRate → { feeRate }`) — old names deleted |
| `src/wallet/rln-wallet-manager.ts` | `RlnWalletInitParams` extends core `UTEXOWalletCreateParams` instead of `Partial<WalletInitParams>` (keeps web-only extras: `proxyUrl`, `nodeRuntimeId`, `dataDir`, …) |
| `src/binding/RlnDefaults.ts` | Delete `DEFAULT_LSP_BASE_URLS`/`getDefaultLspBaseUrl`/`resolveLspBaseUrl` and the local `DEFAULT_INDEXER_URLS` (→ core, after the D2 decision); keep only the web-specific `DEFAULT_RLN_URLS` proxy/WS table |
| `src/lsp/*` | Delete; re-export from core (D3) |
| `src/index.ts` | Re-export the moved names from core so the public API of the package is unchanged |

### rgb-sdk-rn

| File | Change |
|------|--------|
| `src/binding/rln-types.ts` | Keep **only** the `Rln*` wire types (uniffi contract); remove the core re-export block at the top — consumers import core types from the package barrel, not from the wire-type module |
| `src/binding/Interfaces.ts` | `BitcoinNetwork` (+ `'signet_custom'`), `AssetSchema` const, `toNativeNetwork` move to core `utils/network`; file keeps only native-module-specific leftovers or is deleted |
| `src/wallet/utexo-wallet.ts` | Delete the local widening models — `RlnOnchainReceiveRequestModel`, `RlnSendAssetRequestModel`, `RlnOnchainSendRequestModel`, `RlnCreateLightningInvoiceRequestModel` — all folded into the fixed core models (work item A); `UTEXOWalletNodeParams` extends core `UTEXOWalletCreateParams` (keeps RN extras: `storageDirPath`, ports, `vssAllowHttp`, …); constructor takes `params` only, `signer` becomes an optional param field defaulting to `PasswordRLNSigner`; public methods return **core** types instead of raw wire types: `getNodeInfo → LightningNodeInfo`, `listChannels → LightningChannel[]`, `keysend → SendPaymentResult`, `openChannel(OpenChannelParams) → { temporaryChannelId }` (raw form renamed `openChannelRaw`), `decodeLnInvoice → DecodedLnInvoice`, `invoiceStatus` normalized to canonical casing; `createHodlInvoice → LightningInvoice`; `connectPeer(peerUri)`; `estimateFeeRate → { feeRate }`; `onchainReceive` returns full receive data (it already gets it from `RlnRgbInvoiceResponse`); delete local `mapInvoiceStatus` + the inline UPPERCASE map in `getLightningSendRequest`; add `getLightningReceiveStatus`/`getLightningSendStatus` |
| `src/wallet/network-defaults.ts` | Delete `DEFAULT_LSP_BASE_URLS`/`getDefaultLspBaseUrl`/`resolveLspBaseUrl` (→ core); keep `resolveUnlockParams`/`getNetworkDefaults` (RN-specific) reading core tables |
| `src/lsp/*` | Delete; re-export from core (D3). Local `CreateHodlInvoiceParams`/`HodlInvoice`/`ApayNewResponse`/`ApayHashEntry` in `lsp-types.ts` are superseded by the core RLN model |
| `src/index.ts` | Re-export moved names from core; keep exporting `IRLN`/wire types under their current names for binding-level consumers |

Rule of thumb for both packages: after adoption, `grep` for any locally-declared
`interface`/`type` whose name also exists in core — each hit is either a
platform extra (rename it so it can't be confused) or a leftover to delete.

---

## 7. Explicitly NOT shared (stays per package)

- **web (WASM):** `initRlnWasm`; begin/sign/end trios (`createUtxosBegin/End`,
  `sendBegin/End`, `sendBtcBegin/End`, `inflate*`); JS BDK PSBT signing
  (`signPsbt`, `estimateFee`); `signMessage`/`verifyMessage`/`getXpub`;
  wallet-stream VSS orchestration (`configureVssBackup`, `vssBackup`,
  `vssRestoreBackup`, `ldkVssBackupInfo`); `getLastBackupBytes`/
  `restoreFromBackupBytes`; `attachLightningNode`; `proxyUrl`.
- **rn (UniFFI/native):** `unlock`/`shutdown`/`reinit`/`destroy`; `IRLNSigner`
  family (`PasswordRLNSigner`, `NativeExternalRLNSigner`); node-internal VSS
  (`vssAllowHttp`, `vssAllowEmptyRestore`, `vssClearFence`); virtual-channel
  params baked at createNode; bitcoind RPC backend; `checkIndexerUrl`/
  `checkProxyEndpoint`; `getChannelId`; ports/`storageDirPath`.

Each SDK README documents its extras; core README carries the parity matrix
(which shared methods exist, which extras each platform adds).

---

## 8. Execution order

Each step leaves all three repos green (`build` + `test`); core publishes
first, platforms upgrade in their own PRs.

1. **core** — work items A + B + D1/D2 (types, statuses, defaults). All additive.
   Publish `1.0.0-beta.5`.
2. **core** — D3: LSP module in, behind `ILspWallet`. Publish beta.
3. **web** — adopt per the §6 web checklist: redirect `src/rln` barrel to core,
   reconcile `rgb-model.ts`, implement `IUTEXOWallet`, apply §4 renames (old
   names deleted), delete local `lsp/` + LSP defaults. One breaking beta.
4. **rn** — adopt per the §6 rn checklist: `RLNBinding`/`UTEXOWallet` normalize
   wire → core types at the boundary, implement `IUTEXOWallet`, apply §4
   signature changes (old names deleted), delete local `lsp/` + defaults
   duplication. One breaking beta.
5. **both** — add a shared parity test: a spec listing the `IUTEXOWallet`
   surface, run in both repos' CI against `dist/` (catches drift the compiler
   can't, e.g. runtime status values).

## 9. Risks

- **Hard break, no aliases** — apps (rgb-sdk-web-demo, rgb-sdk-rn-demo, wallet
  apps) must migrate in one step per package: LN status values change
  (`'Settled'` → `'Paid'`/`'Succeeded'`), removed methods
  (`getLightningReceiveRequest`, `payLightningInvoiceBegin/End`, …), renamed
  signatures (§4). Acceptable at beta; the changelog must carry a complete
  old→new mapping table, and both demo apps should be migrated in the same PR
  as their SDK to prove the table is complete.
- **Indexer default decision (D2)** — verify against deployed infra before
  publishing; a wrong table silently breaks `goOnline`.
- **Core release coupling** — platforms pin exact betas; upgrade each in its own
  PR right after the core publish so pins don't drift (web is on beta.3, rn on
  beta.4 already).

---

## 10. Architecture improvements (recommended, beyond type alignment)

Not required for this plan, but observed while auditing — each is independent
and can be picked up separately.

1. **Monorepo / npm workspaces for the three packages.** They are tightly
   coupled (every core interface change touches all three), and the pins have
   already drifted (web on core beta.3, rn on beta.4). A workspace makes a core
   change + both adaptations one atomic PR and turns publishing into a
   release-time concern (changesets). This is the single highest-leverage
   structural change; if repos must stay separate, the parity test (§8.5) is
   the minimum substitute.

2. **Capability flags instead of "throws not implemented".** Even after the
   shared contract, each wallet keeps extras and gaps. Expose a static
   `wallet.capabilities: { psbtSigning: boolean; beginEndFlows: boolean;
   vssWalletStream: boolean; messageSigning: boolean; … }` object in core so
   apps can feature-detect declaratively instead of try/catch. (Runtime
   `'method' in wallet` checks are fragile; TS interfaces are erased.)

3. **Unified error taxonomy at the binding boundary.** Core already ships the
   `SDKError` family, but the bindings surface raw strings/wasm panics (web)
   and `RgbError` (rn) — so app `catch` logic doesn't port even when the method
   signatures match. Rule: bindings translate every failure into core error
   classes (`WalletError`, `NetworkError`, `RgbNodeError`, + a new
   `LightningError` with a machine-readable `code`). Same input → same error
   type on both platforms; this is part of "aligned request/response" too, the
   response just happens to be a throw.

4. **Event/subscription API for status changes.** Both SDKs force apps into
   polling loops (`refreshWallet` + `listTransfers`, `getPayment` polls; the
   demos all hand-roll drive-beat polling). A core
   `wallet.on('payment' | 'transfer' | 'channel', cb)` contract — implemented
   over polling internally at first, over node events later — would remove the
   most-duplicated app-side code that exists on top of both SDKs.

5. **Generate the RLN model from the Rust source (long-term).** The true source
   of truth for the wire types is `rgb-lightning-node` — wasm-bindgen and
   UniFFI both derive from the same Rust structs. Hand-maintaining
   `rln-model.ts` in core is a pragmatic step, but generating it (ts-rs /
   typeshare on the Rust side, or from the UniFFI UDL) would make drift
   impossible instead of merely centralized.

6. **Package hygiene for the browser-first web SDK.** Core should declare
   `"sideEffects": false` and use subpath exports (`@utexo/rgb-sdk-core/lsp`,
   `/rln`, `/bridge`) so web bundles don't pull the bridge client and
   Node-leaning utilities they never call; keep the LSP client's `fetch`
   injectable (core's `FetchClient` already is) so future platforms aren't
   blocked.

7. **Delete truly dead surface while breaking anyway.** Since this plan already
   forces one migration, fold in the removals that would otherwise linger:
   `rotateVanillaAddress`/`rotateColoredAddress` (throw on both), RN's
   `wallet-manager.ts` `createWallet` (one-line wrapper around core
   `generateKeys`), and web's `SignPsbtOptions`/unused crypto re-exports.
   One break is cheaper than two.
