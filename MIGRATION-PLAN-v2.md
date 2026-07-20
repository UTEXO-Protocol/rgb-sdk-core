# RGB SDK — Aligned Migration Plan (v2)

> Scope: `rgb-sdk-core` · `rgb-sdk-web` · `rgb-sdk-rn`
> Supersedes: `Migration.md` (2026-07-14 draft)
> Date: 2026-07-20 · rev 2
> Status: **revised after code audit + review feedback**

---

## 0. Audit summary

The v1 plan's diagnosis is correct and its work-item structure is sound. Nothing
in it has been implemented yet: core still exports `IRgbLibBinding`,
`UTEXOWalletCore`, and `WalletInitParams`; there is no `rln-model.ts`, no
lightning types, and no `lsp/` directory in core. All work items A–E are open.

Findings from the audit:

| # | Finding | Effect |
|---|---------|--------|
| **C1** | **LSP divergence is larger than v1 states.** v1 says "~95% identical". Actual: `UtexoLsp.ts` 353 changed lines of ~490; `UtexoLSPClient.ts` 118; `lsp-types.ts` 71. RN landed two LSP PRs (#40, #41) after the shared baseline; web landed `Feat/rln wasm` (#9). Web has `LspLiquidityTimeoutError`, RN does not. | "Take web's copy as baseline" is unsafe. 3-way reconciliation — §5 |
| **C2** | **Shared surface is 77 methods, not ~11.** `UTEXOWallet`: web 93, rn 90, 77 names in common. | Signature audit must be mechanical — §4 |
| **C3** | **Divergences missing from v1's table:** `listChannels` → `LightningChannel[]` vs `RlnChannel[]`; `decodeLnInvoice` → `DecodedLnInvoice` vs `RlnDecodeLnInvoiceResponse`; `invoiceStatus` → `InvoiceStatus` vs `RlnInvoiceStatus`; `openChannel` → `Promise<string>` on web (v1 assumed the temp-id object). | Extends §4 |
| **C4** | **Wire shapes are NOT identical across platforms.** RN's `RLNBinding` canonicalizes native enums to `SCREAMING_SNAKE` (`RGB_SEND`, `SUCCEEDED`); web's wasm-bindgen emits PascalCase (`Pending`, `Paid`, `Succeeded`). | A single shared shape-mapper is **not** viable. Corrected design — §3a |
| **G1** | **RLN bindings are aligned:** web `@utexo/rln-wasm@0.9.0-beta.3`, RN bindings `v0.9.0-beta.3`. | Precondition for the whole plan. Lock it — §9 |
| **N1** | **Bridge is dead surface** (~464 LOC in core + RN re-exports). Its only interface consumer, `getOnchainSendStatus`, already throws on both platforms. | Full removal — new §2 |

Branch state at audit: core on `feat/rln-wasm-v1`, web and rn both on `feat/core`.

### Release line — note, not a blocker

Core's `package.json` says `0.1.0`; npm has `1.0.0-beta.1..4` plus `1.0.6-test`,
`1.0.6-test1`, `1.0.7-test`, which outrank every real beta in semver order.

**Decision: not addressed in this plan.** Development proceeds with core linked
locally (`npm link` / `file:../rgb-sdk-core`); production versions are published
and pinned manually. Recorded here only so it is not rediscovered later — if
publishing is ever automated, the `-test` tags need deprecating and
`package.json` needs syncing to the true published version first.

---

## 1. Principle

**Core owns the contract and everything platform-agnostic. Platforms own their
wire format.**

- A method on `UTEXOWallet` in **both** web and RN → its name, params and return
  type are defined **once in core**; both packages implement that definition and
  declare `implements IUTEXOWallet`. TypeScript enforces parity from then on.
- A method only one platform can support → stays in its package as a documented
  extra, **not** forced into the shared interface.
- Infrastructure both packages copy today (LSP module, LSP/network/indexer
  defaults) → lives in core, re-exported by the packages.
- **Wire→domain translation stays platform-side** (see §3a) — core defines the
  *target* and the platform-agnostic *value* normalizers, not the shape mapping.

---

## 2. Work item 0 — remove the bridge entirely (NEW)

The UTEXO bridge is no longer part of the product. Remove it rather than
migrating it.

**Core — delete:**

| Path | LOC |
|------|-----|
| `src/utexo/bridge/api.ts` (`getBridgeAPI`, `encodeTransferStatus`) | 255 |
| `src/utexo/bridge/types.ts` (`NetworkAddress`, `TransferType`, `Estimation`, `BridgeIn*`, `SubmitTransaction*`, `VerifyBridgeInRequest`, `ReceiverInvoiceResponse`, `TokenInfo`, `TransactionHash`, `TransferByMainnetInvoiceResponse`, `ApiError`, `TransferStatuses`) | 207 |
| `src/utexo/bridge/index.ts` | 2 |
| `src/utexo/utils/helpers.ts` → `decodeBridgeInvoice` | — |
| `src/types/wallet-model.ts` → `BridgeTransferStatus`, `OnchainSendStatus` | — |
| `src/index.ts` → the whole bridge export block (lines ~100–124) | — |

**`FetchClient` is the one exception** — it lives in `bridge/api.ts` but is a
generic injectable fetch wrapper used by the LSP client. Move it to
`src/utils/fetch-client.ts` **before** deleting the directory, and keep it
exported.

**Cascade — this is a clean cut, not a wide one.** `OnchainSendStatus`'s only
consumer is `getOnchainSendStatus` in `utexo-protocol.ts`, which throws
`'not implemented'` on both platforms and is already slated for removal in
work item A. Bridge removal and that removal are the same edit.

**rgb-sdk-rn** — `src/index.ts` publicly re-exports `getBridgeAPI`,
`BridgeInSignatureRequest`, `BridgeInSignatureResponse`. Remove them. This is a
breaking change for any RN consumer still importing them; list it in the
changelog migration table.

**rgb-sdk-web** — no references. No change.

---

## 3. Work item A — fix outdated core models

| Type | Fix |
|------|-----|
| `CreateLightningInvoiceRequestModel` | `asset` optional (BTC-only invoices); add `paymentHash?`, `minFinalCltvExpiryDelta?`; accept the `amount`/`assetAmount` alias pair |
| `OnchainReceiveRequestModel` | `amount?`, `assetId?` optional; add `witness?: boolean` (default `true`) |
| `OnchainReceiveResponse` | Full receive data: `invoice` + `recipientId?` + `expirationTimestamp?` + `batchTransferIdx?` (RN has this and discards it) |
| `OnchainSendRequestModel` | Add `witnessData?`, `donation?`, `feeRate?`, `minConfirmations?`, `skipSync?` — kills `RlnOnchainSendRequestModel` (rn) and web's type bypass |
| `PayLightningInvoiceRequestModel` | Add `assetAmount?`; **remove** `maxFee` (unsupported by RLN — web throws, RN ignores) |
| `GetFeeEstimationResponse` | Replace `Record<string, number> \| number` with canonical `{ feeRate: number }` |
| `TransactionType` | Add `'SendBtc' \| 'Incoming'` (RLN emits them; RN folds both to `'User'`, losing data) |
| `IUTEXOProtocol` | **Remove** members that throw on both platforms: `getOnchainSendStatus` (also §2), `getLightningSendFeeEstimate`, `payLightningInvoiceBegin/End`. **Remove** the `TransferStatus`-returning `getLightningReceiveRequest`/`getLightningSendRequest` (replaced in §4) |

**Delete outright** (all packages are beta — clean break, migration table in the
changelog): `IRgbLibBinding`, `UTEXOWalletCore`, `WalletInitParams`,
`RGBHTTPClientParams`, `Withdraw*` models, `BindingTransactionType`, the
`AssetIFA`-vs-`AssetIfa` duplicate, and everything in §2.

---

## 4. Work item B — shared domain types + status vocabulary

Define in core: `LightningChannel` (web's domain shape + RN's `shortChannelId`,
`virtualOpenMode`, `nextOutboundHtlcLimitMsat` as optional), `LightningNodeInfo`
(superset), `LightningNetworkInfo`, `LightningPeer`, `LightningPayment`,
`LightningInvoice`, `DecodedLnInvoice`, `SendPaymentResult`, `OpenChannelParams`,
`CreateHodlInvoiceParams`/`HodlInvoiceResult`, `ApayNewResponse`/`ApayHashEntry`
(already field-identical), `LdkVssBackupInfo`.

Canonical status vocabulary:

```ts
export type RlnInvoiceStatus = 'Pending' | 'Paid' | 'Expired';
export type RlnPaymentStatus = 'Pending' | 'Claimable' | 'Claiming'
                             | 'Succeeded' | 'Cancelled' | 'Failed';
```

**Lightning statuses are NOT folded into `TransferStatus`.** That fold is an
rgb-lib-era artifact and is lossy: `WaitingCounterparty` is an RGB consignment
concept with no LN meaning, and `Claimable`/`Claiming`/`Expired`/`Cancelled`/
`Failed` collapse into single buckets — the two SDKs even fold them
*differently* today (`SUCCEEDED → 'Settled'` in RN vs web's own mapping).
`TransferStatus` stays on-chain only. Apps wanting one status column fold it in
their UI layer; core may ship an optional `foldLnStatusForDisplay()` helper that
is not part of any return type.

RN keeps its `Rln*` wire types locally as the uniffi contract — binding input,
never a public return type.

### 4a. Where translation lives — corrected

An earlier revision proposed core exporting full wire→domain shape mappers
(`toLightningChannel(raw)`), on the assumption that wasm-bindgen and UniFFI
produce the same wire shape because they derive from the same Rust structs.

**That assumption is wrong, and the upstream source proves it.** In
`rgb-lightning-node` the two bindings are separate crates (both `exclude`d from
the root workspace) that share no binding-facing type module:

| Binding | Mechanism | Evidence |
|---------|-----------|----------|
| `bindings/uniffi-bindgen` | Typed Rust structs → generated typed bindings | `src/uniffi_api/types.rs` defines `pub struct Channel { channel_id, peer_pubkey, status, … }` and `pub enum ChannelStatus { Opening, Opened, Closing }` |
| `bindings/wasm-sdk` | Ad-hoc serde serialization → untyped JS boundary | **No `Channel` struct exists.** `sdk_facade.rs` returns `Result<JsValue, JsValue>` / `Result<String, JsValue>` via `serde_json::to_string(&data)` |

`pub struct Channel` appears exactly once in the entire repo — in
`uniffi_api/types.rs`. The wasm SDK never sees it. So the two SDKs are not two
views of one type; they are two independently-shaped surfaces that happen to
describe the same domain.

Observable downstream: RN's `RLNBinding` canonicalizes native enums to
`SCREAMING_SNAKE` (`RGB_SEND`, `CREATE_UTXOS`, `SUCCEEDED`); web's JSON path
yields PascalCase (`Pending`, `Paid`, `Succeeded`). Option/null handling and
numeric types (`bigint` vs `number`) differ too. A single function cannot take
both inputs without becoming a union-typed mess worse than two clear mappers.

**Corrected split:**

| Layer | Owner | Why |
|-------|-------|-----|
| Domain types (`LightningChannel`, …) | **core** | The shared target — this is the contract |
| Canonical vocabularies (`RlnInvoiceStatus`, …) | **core** | The allowed output values |
| **Value normalizers** — casing/format helpers whose input is a plain scalar | **core** | Genuinely platform-agnostic |
| **Shape mappers** — `wire object → domain object` | **platform** | Input type is generator-specific; only the platform knows it |

Core exports value normalizers plus the *signature* every platform mapper must
satisfy:

```ts
// core — platform-agnostic: accepts any casing, returns canonical or throws
export function normalizeInvoiceStatus(raw: string): RlnInvoiceStatus;
export function normalizePaymentStatus(raw: string): RlnPaymentStatus;
export function normalizeTransactionType(raw: string): TransactionType;
export function msatToSat(msat: number | bigint): number;

// core — the contract each platform mapper implements
export type WireMapper<TWire, TDomain> = (wire: TWire) => TDomain;
```

Platforms then write:

```ts
// rn — knows RlnChannel
const toChannel: WireMapper<RlnChannel, LightningChannel> = (w) => ({ … });
// web — knows the wasm shape
const toChannel: WireMapper<WasmChannel, LightningChannel> = (w) => ({ … });
```

The return type is enforced by the compiler; the runtime *values* are enforced
by the core normalizers plus the conformance suite (§11). This gets the same
anti-drift guarantee without pretending the two wire formats are one.

Delete web's `mapInvoiceStatus`/`mapPaymentStatus` and RN's inline
`SCREAMING_SNAKE` maps — both are replaced by the core normalizers.

---

## 5. Work item C — align signatures (mechanical, all 77 shared methods)

v1's table lists the divergences that were known, not all that exist. Replace
the hand-audit with a mechanical one: extract the public surface from both
`utexo-wallet.ts` files, diff the name sets, and place every shared name in one
of three buckets — **aligned** (in `IUTEXOWallet`), **to align** (fix per below),
or **rename** (platform-specific despite the shared name → `openChannelRaw`,
`listPaymentsRaw`).

| Method | web today | rn today | Aligned (core) |
|--------|-----------|----------|----------------|
| constructor | `new UTEXOWallet(params)` | `new UTEXOWallet(params, signer)` | `new UTEXOWallet(params, signer?)` — signer stays a **separate positional collaborator**, optional; each platform defaults it internally (RN → `PasswordRLNSigner` from `params.password`; web → `RlnSigner`). See §5a |
| HODL create | `createHodlLnInvoice(p): LightningInvoice` | `createHodlInvoice(p): HodlInvoice` | `createHodlInvoice(p): LightningInvoice` |
| `connectPeer` | `(peerAddr, peerPubkey)` | `(peerPubkeyAndAddr)` | `(peerUri: string)` — `pubkey@host:port`, existing `peerUri()` helper |
| `closeChannel` | `(id, peerPubkey?, force=false): void` | `(id, peerPubkey, force): Promise<void>` | `(id, peerPubkey?, force=false): Promise<void>` |
| `openChannel` | `OpenChannelParams → Promise<string>` *(C3)* | raw native → `RlnOpenChannelResponse` | `OpenChannelParams → Promise<{ temporaryChannelId: string }>`; RN keeps raw as `openChannelRaw` |
| `keysend` | → `SendPaymentResult` | → `RlnKeysendResponse` | → `SendPaymentResult` |
| `getNodeInfo` | `LightningNodeInfo` (thin) | `RlnNodeInfo` (rich) | merged `LightningNodeInfo` superset |
| `listChannels` *(C3)* | `LightningChannel[]` | `RlnChannel[]` | `LightningChannel[]` |
| `decodeLnInvoice` *(C3)* | `DecodedLnInvoice` | `RlnDecodeLnInvoiceResponse` | `DecodedLnInvoice` |
| `invoiceStatus` *(C3)* | `InvoiceStatus` | `RlnInvoiceStatus` | `RlnInvoiceStatus` (canonical casing via core normalizer) |
| `estimateFeeRate` | `GetFeeEstimationResponse` | `number` | `{ feeRate: number }` |
| `onchainReceive` | full receive data | `{invoice}` only | full receive data (work item A) |
| LN status polling | `getLightningReceiveRequest`/`getLightningSendRequest` → `TransferStatus \| null` (lossy) | same names, *different* buckets | `getLightningReceiveStatus(id): Promise<RlnInvoiceStatus>` / `getLightningSendStatus(id): Promise<RlnPaymentStatus \| null>`. Old `*Request` methods **removed** |
| numeric params | `bigint` in node params | `number` | `number \| bigint` in core types; bindings convert |

Result: one `IUTEXOWallet` in core (cleaned `IWalletManager` common subset +
`IUTEXOProtocol` + the Lightning surface). Platform-only methods are **not** in
it (§7).

Shared create-params — plain serializable config only, no live objects.
Everything optional except the two credentials, so platforms extend without
redeclaring:

```ts
export interface UTEXOWalletCreateParams {
  mnemonic: string;
  password: string;
  network?: BitcoinNetwork;        // default 'utexo'
  indexerUrl?: string;             // default from core (§6)
  transportEndpoint?: string;
  vssUrl?: string | null;          // null disables
  vssAutoRestore?: boolean;        // default true
  lspBaseUrl?: string | null;
  lspBearerToken?: string | null;
}
// web extends: proxyUrl, nodeRuntimeId, dataDir, supportedSchemas, …
// rn  extends: storageDirPath, ports, vssAllowHttp, …
```

### 5a. Signer injection — `(params, signer?)`, and the interface it needs

**Decision: the signer stays a separate positional argument, not a `params`
field.** Rationale:

- `params` is **configuration** — plain, serializable, loggable, storable. A
  signer is a **collaborator** — a live object with behavior and lifecycle.
  Mixing them makes `params` non-serializable and couples signer swapping to
  config construction.
- It matches core's existing precedent: `BaseWalletManager` already takes
  `constructor(params: WalletInitParams, binding?: IRgbLibBinding, signer?: ISigner)`.
- It is the testable form — inject a mock signer without fabricating config.
- **It costs nothing in enforcement.** TypeScript `implements` checks *instance*
  members only; a class's constructor signature is never verified against an
  implemented interface. Constructor alignment is a convention in both designs,
  so choose the one with better ergonomics. (If it must be enforced, that needs
  an explicit `interface UTEXOWalletConstructor { new (params: UTEXOWalletCreateParams,
  signer?: IWalletSigner): IUTEXOWallet }` applied at the call site — optional.)

**Open design item — the second parameter needs a type both platforms satisfy.**
Today the two "signers" are unrelated concepts that share a name:

| | Interface | Members | Concern |
|---|---|---|---|
| core / web | `ISigner` | `signPsbtWithMnemonic`, `signPsbtWithSeed`, `signMessage`, `verifyMessage`, `estimateFee` | PSBT + message **crypto** |
| rn | `IRLNSigner` | `initNode(rln)`, … | Node **bootstrap / key custody** |

Web's `RlnSigner` does not satisfy `IRLNSigner`; RN's `PasswordRLNSigner` does
not satisfy `ISigner`. So `signer` cannot simply be typed `ISigner` in the
shared contract.

Resolve as part of work item B — do **not** merge them into one fat interface
with stubs (that reintroduces the "throws not implemented" pattern §9.5
removes). Split by concern and let each platform narrow:

```ts
// core — two distinct, independently implementable capabilities
export interface ISigner { /* crypto: psbt + message, as today */ }
export interface INodeSigner { /* lifecycle: initNode, custody */ }

// the constructor's collaborator slot — platform narrows to what it needs
export type IWalletSigner = ISigner | INodeSigner;
```

Each platform declares the concrete type in its own class
(`constructor(params: UTEXOWalletNodeParams, signer?: IRLNSigner)` on RN;
`constructor(params: RlnWalletInitParams, signer?: ISigner)` on web). The shared
contract fixes the **arity and position**; the type is platform-narrowed. Both
capabilities are surfaced through `wallet.capabilities` (§9.5) so apps can
feature-detect `messageSigning` rather than probing the signer.

If a future platform implements both, it passes an object satisfying both
interfaces — no core change required, which is the §9.3 flexibility test.

---

## 6. Work item D — all defaults in core

**All default tables move to core — one location, no per-package copies.**

1. **LSP defaults** — `DEFAULT_LSP_BASE_URLS`, `getDefaultLspBaseUrl`,
   `resolveLspBaseUrl` are literal copies (web `RlnDefaults.ts` ↔ rn
   `network-defaults.ts`) → core. `resolveUnlockParams` stays RN-local
   (platform-specific) but reads the core tables.

2. **Indexer defaults** — web's local `DEFAULT_INDEXER_URLS`
   (`esplora-*.utexo.com`) currently shadows core's
   (`electrum.iriswallet.com`). These are the same table maintained twice, so:
   **keep one table in core, populate it with the currently-correct endpoints,
   delete web's copy.** If an endpoint changes (electrum ↔ esplora, host move),
   it is a one-line edit in core rather than a reconciliation. Web's
   `DEFAULT_RLN_URLS` proxy/WS table is genuinely web-only and stays.

3. **Overridable, not hardcoded** — every default is a plain exported table plus
   a resolver that accepts an override, so an app can point at its own infra
   without patching the SDK:

   ```ts
   export const DEFAULT_INDEXER_URLS: Record<BitcoinNetwork, string>;
   export function resolveIndexerUrl(net: BitcoinNetwork, override?: string): string;
   ```

   The explicit param in `UTEXOWalletCreateParams` always wins over the table.

4. **LSP module** (`UtexoLsp`, `UtexoLSPClient`, `IUtexoLSPClient`, `LspErrors`,
   `lsp-types`) → core. **Revised procedure** — v1's "take web's copy as
   baseline" assumed ~95% overlap; the real deltas are:

   | File | changed lines | notes |
   |------|--------------:|-------|
   | `UtexoLsp.ts` | 353 / ~490 | RN carries LSP UX work from PRs #40/#41 |
   | `UtexoLSPClient.ts` | 118 / ~290 | |
   | `lsp-types.ts` | 71 / ~230 | RN has local `CreateHodlInvoiceParams`/`HodlInvoice`/`ApayNewResponse` |
   | `LspErrors.ts` | 22 / ~37 | web has `LspLiquidityTimeoutError`, RN does not |

   A large share is cosmetic (comment reflow, import paths), but not all — and
   the public method surface is **11 methods, identical on both sides**, which
   is what keeps unification worthwhile.

   1. Land the method surface in core as `ILspClient` + `ILspWallet` (the ~10
      wallet methods `UtexoLsp` actually calls — all in the §5 shared contract,
      so both wallets satisfy it structurally). No implementation yet.
   2. Line-by-line 3-way reconciliation of `UtexoLsp.ts` — do not pick a winner
      file. Record each decision in the PR: `LspLiquidityTimeoutError`
      (web-only) → **keep**; RN's #40/#41 UX/apay changes → **keep**;
      comment/import deltas → normalize.
   3. Port the reconciled module into core, unit-tested against a mocked
      `ILspWallet`, with `fetch` injected via `FetchClient` (rescued in §2).
   4. Delete both local copies; re-export from core.

   Own PR — largest diff in the plan and the most likely to regress live LSP
   behavior.

---

## 7. Work item E — package-side changes

### rgb-sdk-web

| File | Change |
|------|--------|
| `src/types/rln-model.ts` | Delete; `src/rln` barrel re-exports from core (the file header already promises this) |
| `src/interfaces/IRln{NodeBinding,WalletBinding,SdkBinding}.ts` | Delete after promotion to core; barrel re-exports |
| `src/types/rgb-model.ts` | **Conflict — reconcile, don't move.** Redefines `Unspent`/`Utxo`/`RgbAllocation` differently from core (`pendingBlinded` on `Utxo` here vs `Unspent` in core; `RgbAllocation.assignment` is a `BindingAssignment` map vs core's `Assignment` union), and both are star-exported from `index.ts` today. Decide canonical shape in core, delete local |
| `src/utexo/utexo-wallet.ts` | Drop inline widenings (`createLightningInvoice(Omit<…> & {asset?; paymentHash?})`, `payLightningInvoice(params & {assetAmount?})`) — take fixed core models directly; `onchainReceive` returns core's enriched `OnchainReceiveResponse` (drop the `& InvoiceReceiveData` intersection); delete `mapInvoiceStatus`/`mapPaymentStatus` → core normalizers (§4a); keep local shape mappers typed as `WireMapper<…>`; add `getLightningReceiveStatus`/`getLightningSendStatus`; **constructor gains the optional second arg `(params, signer?: ISigner)`**, defaulting to the existing internally-built `RlnSigner` (§5a); apply §5 renames as **replacements** |
| `src/wallet/rln-wallet-manager.ts` | `RlnWalletInitParams extends UTEXOWalletCreateParams` instead of `Partial<WalletInitParams>` |
| `src/binding/RlnDefaults.ts` | Delete LSP defaults + local `DEFAULT_INDEXER_URLS` (→ core §6); keep web-only `DEFAULT_RLN_URLS` |
| `src/lsp/*` | Delete; re-export from core |
| `src/index.ts` | Re-export moved names so the package's public API is unchanged |

### rgb-sdk-rn

| File | Change |
|------|--------|
| `src/index.ts` | **Remove bridge re-exports** (`getBridgeAPI`, `BridgeInSignatureRequest/Response`) — §2. Re-export moved core names; keep `IRLN`/wire types for binding-level consumers |
| `src/binding/rln-types.ts` | Keep **only** `Rln*` wire types (uniffi contract); remove the core re-export block at the top |
| `src/binding/Interfaces.ts` | `BitcoinNetwork` (+ `'signet_custom'`), `AssetSchema` const, `toNativeNetwork` → core `utils/network`; file keeps native-only leftovers or is deleted |
| `src/wallet/utexo-wallet.ts` | Delete local widening models (`RlnOnchainReceiveRequestModel`, `RlnSendAssetRequestModel`, `RlnOnchainSendRequestModel`, `RlnCreateLightningInvoiceRequestModel`) → folded into core (§3); `UTEXOWalletNodeParams extends UTEXOWalletCreateParams`; **constructor keeps `(params, signer?)` — `signer` becomes optional**, defaulting to `PasswordRLNSigner` built from `params.password` (§5a); public methods return **core** types via local `WireMapper` implementations: `getNodeInfo → LightningNodeInfo`, `listChannels → LightningChannel[]`, `keysend → SendPaymentResult`, `decodeLnInvoice → DecodedLnInvoice`, `openChannel → {temporaryChannelId}` (raw → `openChannelRaw`), `createHodlInvoice → LightningInvoice`, `connectPeer(peerUri)`, `estimateFeeRate → {feeRate}`, `onchainReceive` full data; delete `mapInvoiceStatus` + the inline `SCREAMING_SNAKE` maps → core normalizers; add the two `*Status` methods |
| `src/wallet/network-defaults.ts` | Delete LSP defaults (→ core); keep `resolveUnlockParams`/`getNetworkDefaults` reading core tables |
| `src/lsp/*` | Delete; re-export from core. Local `CreateHodlInvoiceParams`/`HodlInvoice`/`ApayNewResponse`/`ApayHashEntry` superseded by the core RLN model |

**Rule of thumb (both):** after adoption, `grep` for any locally-declared
`interface`/`type` whose name also exists in core — each hit is either a
platform extra (rename it) or a leftover (delete it).

---

## 8. Explicitly NOT shared

- **web (WASM):** `initRlnWasm`; begin/sign/end trios (`createUtxosBegin/End`,
  `sendBegin/End`, `sendBtcBegin/End`, `inflate*`); JS BDK PSBT signing
  (`signPsbt`, `estimateFee`); `signMessage`/`verifyMessage`/`getXpub`;
  wallet-stream VSS (`configureVssBackup`, `vssBackup`, `vssRestoreBackup`,
  `ldkVssBackupInfo`); `getLastBackupBytes`/`restoreFromBackupBytes`;
  `attachLightningNode`; `proxyUrl`.
- **rn (UniFFI/native):** `unlock`/`shutdown`/`reinit`/`destroy`; `IRLNSigner`
  family (`PasswordRLNSigner`, `NativeExternalRLNSigner`); node-internal VSS
  (`vssAllowHttp`, `vssAllowEmptyRestore`, `vssClearFence`); virtual-channel
  params at createNode; bitcoind RPC backend; `checkIndexerUrl`/
  `checkProxyEndpoint`; `getChannelId`; ports/`storageDirPath`.

Each SDK README documents its extras; core README carries the parity matrix.

---

## 9. Core architecture — keep it flexible

Constraints the core design should satisfy, so this migration is the last one of
its kind:

1. **Interfaces + composition, not inheritance.** `UTEXOWalletCore` (an abstract
   base with zero implementations) is being deleted for good reason — it forced
   a shape neither platform wanted. `IUTEXOWallet` is a structural contract;
   each platform composes its own class. Do not reintroduce a base class.

2. **Core must not import platform code — in either direction.** No `fetch`
   assumption (inject via `FetchClient`), no `fs`, no wasm, no react-native.
   Everything in core must run unmodified in Node, browser, and RN. The current
   crypto layer (`@scure/*`, `@noble/*`) already meets this bar; keep it as the
   dependency policy.

3. **A third platform must be addable without editing core.** The design test:
   could a Node/desktop SDK be written against core today? With §4a's split
   (core owns domain types + normalizers, platform owns its `WireMapper`s) the
   answer is yes — a new platform writes mappers and implements
   `IUTEXOWallet`. With shape mappers baked into core, every new wire format
   would require a core release.

4. **Data over code for configuration.** Defaults are exported tables plus
   resolvers accepting overrides (§6.3) — never hardcoded literals inside
   functions. Endpoint changes stay one-line edits.

5. **Capability flags over "throws not implemented".** 16 web-only and 13
   rn-only methods will remain after alignment. Expose
   `wallet.capabilities: { psbtSigning, beginEndFlows, vssWalletStream,
   messageSigning, … }` so apps feature-detect declaratively — runtime
   `'method' in wallet` is fragile and TS interfaces are erased. Replaces the
   current pattern of stub methods that throw.

6. **Unified error taxonomy at the binding boundary.** Core ships `SDKError`
   already, but bindings surface raw strings/wasm panics (web) and `RgbError`
   (rn), so app `catch` logic doesn't port even when signatures match. Rule:
   bindings translate every failure into core error classes (`WalletError`,
   `NetworkError`, `RgbNodeError`, plus a new `LightningError` with a
   machine-readable `code`). Same input → same error type on both platforms.
   This is part of "aligned request/response" — the response is just a throw.

7. **Subpath exports + `sideEffects: false`.** Core should expose
   `@utexo/rgb-sdk-core/lsp`, `/rln`, `/crypto` so the browser SDK doesn't pull
   Node-leaning utilities it never calls. Cheap to do while the export surface
   is already being rewritten; expensive to retrofit later.

8. **Delete dead surface while breaking anyway.** Since this plan forces one
   migration, fold in the removals that would otherwise linger: the bridge (§2),
   `rotateVanillaAddress`/`rotateColoredAddress` (throw on both), RN's
   `wallet-manager.ts` `createWallet` (a one-line wrapper around core
   `generateKeys`), web's `SignPsbtOptions` and unused crypto re-exports. One
   break is cheaper than two.

---

## 10. Keep RLN binding versions locked

The fact that makes this plan work is that web and RN are both on RLN
`0.9.0-beta.3`. Every past divergence traces to the two SDKs adapting to the
same Rust structs at different times.

Add to both CIs: **fail the build if the web `rln-wasm` version and the RN
bindings version differ.** Bump them in a coordinated PR pair, never
independently. Without this, the platform mappers silently go wrong on one side
with no compile error.

---

## 11. Conformance suite

v1 proposed "a spec listing the `IUTEXOWallet` surface". Make it a real artifact:

- Core publishes `@utexo/rgb-sdk-conformance` — a suite parameterized over a
  wallet factory.
- Both repos run it in CI against their built `dist/`, passing their own
  constructor.
- It asserts what the compiler cannot: **runtime status string values** (the
  §4a normalizer output), error *types* thrown for known-bad input (§9.6),
  presence/absence of every `IUTEXOWallet` method, and `capabilities` accuracy
  (§9.5).

Since the packages stay in separate repos for now, this is the primary drift
detector — it is what catches the class of bug that produced this migration.

---

## 12. Execution order

Every step leaves all three repos green (`build` + `test`). Core is consumed
locally (`npm link` / `file:`) during development; production publishes are
manual.

| # | Repo | Work |
|---|------|------|
| 1 | core | §2 bridge removal + §3 work item A (types) — rescue `FetchClient` first |
| 2 | core | §4 domain types + status vocabulary + §4a normalizers; §6.1–6.3 defaults |
| 3 | core | §6.4 LSP reconciliation behind `ILspWallet` (own PR — largest diff) |
| 4 | web | §7 web checklist |
| 5 | rn | §7 rn checklist (incl. bridge re-export removal) |
| 6 | both | §11 conformance suite + §10 RLN version lock in CI |

Steps 4 and 5 are independent and can run in parallel once step 3 lands.

---

## 13. Risks

- **Hard break, no aliases.** Apps migrate in one step per package: LN status
  values change (`'Settled'` → `'Paid'`/`'Succeeded'`), methods removed
  (bridge exports, `getLightningReceiveRequest`, `payLightningInvoiceBegin/End`),
  signatures renamed (§5). Acceptable at beta. **The changelog must carry a
  complete old→new mapping table, and both demo apps migrate in the same PR as
  their SDK — that is what proves the table is complete.**
- **LSP reconciliation (§6.4) is the highest-regression-risk item.** 353 changed
  lines across two live feature branches. Own PR, explicit decision log per
  delta, exercised against a real LSP on regtest before merge.
- **Indexer defaults (§6.2)** — verify the consolidated table against deployed
  infra; a wrong entry silently breaks `goOnline`.
- **RLN binding drift** — see §10. If the versions separate again, platform
  mappers become wrong on one side with no compile error.
- **Local linking hides pin drift.** With core linked locally, the packages
  cannot drift during development — but they can at publish time. Verify both
  packages pin the same core version before any production release.

---

## 14. Future work (not in this plan)

- **Monorepo with npm workspaces + changesets.** The three packages are one
  product with one release cadence; a workspace would make "core change + both
  adaptations" a single atomic PR and remove the pin-drift and duplicate-file
  classes of problem at the root. Deferred deliberately — the contract work
  above is the prerequisite and delivers most of the benefit. Revisit once
  steps 1–6 have landed.
- **Event/subscription API.** Both SDKs force apps into polling (`refreshWallet`
  + `listTransfers`, `getPayment` loops; every demo hand-rolls a drive-beat).
  A core `wallet.on('payment' | 'transfer' | 'channel', cb)` contract — over
  polling internally at first, node events later — would remove the
  most-duplicated app-side code in the ecosystem.
- **Fix the drift at its upstream root: a shared binding-facing type module in
  `rgb-lightning-node`.** The audit in §4a found that the two bindings share no
  types — `bindings/uniffi-bindgen` has typed structs in `src/uniffi_api/types.rs`,
  while `bindings/wasm-sdk` hand-serializes with `serde_json` behind
  `JsValue`. **That, not the SDK layer, is where the divergence originates.**
  Everything in this plan is downstream compensation for it.

  The durable fix is upstream: promote the `uniffi_api/types.rs` structs into a
  shared, binding-neutral module that *both* crates derive from (`serde` for
  wasm, UniFFI for native). Then the wire shapes are identical by construction,
  and the §4a split collapses — one shared mapper genuinely becomes correct for
  both, and `rln-model.ts` can be generated (ts-rs / typeshare, or from the UDL)
  rather than hand-maintained.

  This is a change to `rgb-lightning-node`, not the SDKs, and it is the highest-
  leverage item on this list — but it is out of scope here and should not block
  the contract work. Worth raising with whoever owns the Rust side; if it lands
  later, the SDK-side mappers become generated and this plan's §4a becomes
  vestigial in a good way.
