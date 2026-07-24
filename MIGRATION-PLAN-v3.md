# RGB SDK — Contract Decomposition Plan (v3)

**Status:** steps 0–7b complete (contract, conformance, both e2e suites, VSS
reshape, cleanup, demo migration). Only step 8 (v4 `IRlnNode`) remains, and it
was always a separate plan.
**Supersedes:** step 5c of `MIGRATION-PLAN-v2.md` (`IUTEXOWallet` as a single flat contract)
**Does not supersede:** v2 steps 1–5b (done) or step 6 (conformance + version lock, still wanted)

---

## ⏱️ Resume here

**Last verified green (all three repos):**

| | `tsc` | tests |
|---|---|---|
| rgb-sdk-core | ✅ | 195 (11 suites) |
| rgb-sdk-web | ✅ | 245 (5 suites) |
| rgb-sdk-rn | ✅ | 81 contract-conformance checks (`npm run check:contract`) |

Plus: RLN version lock green (`0.9.0-beta.3` across web wasm, rn iOS, rn
Android); `npm run check:params` green (§6.0r); **iOS builds** (a real
`xcodebuild`, not just codegen — §6.0q); **both demos migrated to v3** and
compiling, the web one building (§7b.5).

**e2e:** web **8 passed / 1 pending** (`rgb-sdk-web/tests/e2e/`; the pending one
is the upstream IFA-in-`listAssets` gap, §6.0r), rn **6 scenarios green
including H** (`rgb-sdk-rn-demo/e2e/`).

**Done:** steps 0 · 1 · 1b · 2 · 3 · 4a · 4b · 5 · 6 · 6c · 6b.0 · 6b.1 · 6b.2
· 6b.3 · 6b.4 · 6b.5 · **7** · **7b** — see §6.0–§6.0r and §7b. Every numbered
step except **8** (v4 `IRlnNode`) is complete.

Each e2e suite has its own README with the exact commands. Both need a
provisioned stack, and **the two stacks cannot run at once** (both claim :3000,
:18443, :50001):

- web — `rgb-sdk-web-demo/scripts/start-lsp-web.sh` (add `VSS=1`; needed by
  the F-vss and G specs), then `cd rgb-sdk-web && npm run test:e2e`
- rn — `rgb-sdk-rn-demo/scripts/start-lsp-regtest.sh` (starts the regtest
  docker services itself; `VSS=1` adds vss-server on **:8181**, since Metro
  owns :8081), an emulator with the demo installed, then `yarn test:e2e`

**Next up — step 8 (v4 `IRlnNode`)**, always scoped as its own plan. Smaller
things left behind, none blocking:

1. **⏸️ RESUME HERE — scenario I stopped reproducing; verify it (§6.0s.1).**
   Three green wallet-funded opens on 2026-07-23, cold and warm, each verified
   on-chain. The reason it looked unrepeatable: the spec's "the funding tx must
   be broadcast" assertion **could never fail** (esplora answers
   `/tx/<txid>/status` with 200 for a txid that never existed) — now fixed in
   `i-funding.spec.ts` and in the demo. Not declared fixed: no failure has yet
   been seen with correct instrumentation. Next is §6.0s.2 — run
   `i-funding.spec.ts`, then the **full suite**, where H and I both failed while
   H passes alone (still undiagnosed).
2. **Upstream, not ours:** an IFA issued on web is invisible to `listAssets()`
   (parked as a `test.fixme`, §6.0r); the wasm `openChannel` takes no
   anchors/push/fee arguments (§6.0r); uniffi has only `vss_backup` and
   `vss_clear_fence` — no `vss_backup_info`, which is why `backupStatus()` could
   not join the contract (§6.0p, re-verified).
3. **`IRgbLibBinding`** (98 lines) dies with step 8, not before (§7b.3).
4. **README coverage** for the 14 exported-but-undocumented core symbols
   (§7b.2), and rn's ~374 pre-existing lint errors (§7b.4).
5. rn e2e is **Android-only** — the flow runner is portable, the host runner is
   `adb`-shaped (§6.0m).

### Cold-start orientation

If you are picking this up with no prior context, read §0 (why), then §2.7a (the
single fact that explains most platform differences: **web runs two engines, rn
runs one**), then §3 (target shape). Everything else is detail.

**Where things live now:**

| What | Path |
|---|---|
| The contract | `rgb-sdk-core/src/interfaces/wallet/` — domain groups + `optional-groups.ts` (carriers) + `IUTEXOWallet.ts` (composition root) |
| Runtime drift detector | `rgb-sdk-core/src/conformance/index.ts` |
| Field-verification helpers | `rgb-sdk-core/src/conformance/field-checks.ts` |
| Type-level contract checks | `rgb-sdk-{web,rn}/src/contract-conformance.ts` — compiled, never bundled |
| web wallet | `rgb-sdk-web/src/utexo/utexo-wallet.ts` + `wallet/rln-wallet-manager.ts` |
| rn wallet | `rgb-sdk-rn/src/wallet/utexo-wallet.ts` |
| rn conformance runner | `rgb-sdk-rn/scripts/check-contract.mjs` (+ `rn-stub-loader.mjs`) |
| web e2e suite | `rgb-sdk-web/tests/e2e/` — harness + specs A–C, F, G (`npm run test:e2e`) |
| rn e2e suite | `rgb-sdk-rn-demo/e2e/` + `app/e2e.tsx` + `scripts/run-e2e-android.mjs` (`yarn test:e2e`) |
| Parameter-drop check | `rgb-sdk-core/scripts/check-param-usage.mjs` (`npm run check:params`) |
| e2e stack fixture | `rgb-sdk-{web,rn}-demo/e2e-fixtures.json`, written by the demo start scripts |

**Verify everything is still green:**

```bash
cd rgb-sdk-core && npx tsc --noEmit && npm test && npm run build
cd ../rgb-sdk-web && npx tsc --noEmit && npm test
cd ../rgb-sdk-rn  && npx tsc --noEmit && npm run check:contract
cd ../rgb-sdk-core && node scripts/check-rln-versions.mjs
```

**Invariants that must not be broken** — the whole plan exists to establish
these:

1. A method may appear on the always-present surface **only if every platform
   actually performs it**. If one platform would throw, it belongs on a carrier.
2. Carriers are optional properties; `capabilities` is **derived** from their
   presence, never stored independently.
3. A parameter may be optional only if every platform accepts its absence **and**
   honours its presence (§2.5 found five violations of this).
4. Every public method on `RlnWalletManager` is `async` — dropping it turns
   rejections into synchronous throws and breaks `.catch()` (§6.0g).

**Hard-won lesson, worth repeating:** a "dead code" list is a hypothesis, not a
verdict. Four separate entries turned out to be load-bearing (`inflate`,
`createBackup`/`syncWallet`, `UtxoNetworkPreset`, `createWallet`). Before any
deletion, grep implementations **and the demo apps** — `createWallet` was only
saved by checking `rgb-sdk-rn-demo`.

### Environment state to be aware of

- **web and rn are symlinked to local core** via `file:../rgb-sdk-core`. Core
  must be rebuilt (`npm run build`) for changes to reach them — `file:` deps
  resolve `dist/`, not `src/`.
- **rn uses yarn**; a stray `npm install` earlier rewrote `yarn.lock` and was
  reverted. The symlink survives; prefer yarn there.
- E2E will be a **local** gate first: the demo scripts hard-code
  `RGBLN_REPO=/Users/…/utexo/rgb-lightning-node`, which will not exist in CI
  (§7a.6).

---

## 0. Why v3 exists

v2 step 5c shipped `IUTEXOWallet` and declared the contract closed. It isn't.
The interface's own docblock claims:

> *"every method here exists on **both** rgb-sdk-web and rgb-sdk-rn with a
> compatible signature… from here on the compiler — not review — is what keeps
> them aligned."*

Measured against the implementations, that is false:

| Fact | Value |
|---|---|
| Methods declared on `IUTEXOWallet` | **67** |
| Implemented on both platforms | **49** |
| Throwing stubs on rgb-sdk-rn | **18** |
| Throwing on *both* platforms (dead surface) | **2** (`rotateVanillaAddress`, `rotateColoredAddress`) |
| Optional-param signature lies (invisible to stub scanning) | **5** — see §2.5 |
| Occurrences of `capabilities` in all three repos | **1** — a code comment in `IUTEXOWallet.ts:13` |

> **Counting method.** Derived by scanning for `throw new Error(… not
> implemented)` **inside method bodies, excluding comment lines**. An earlier
> pass that did not exclude comments produced 47/20 — section headers like
> `// ── VSS Backup (not implemented) ──` were mis-attributed to the preceding
> method, falsely flagging `createBackup` (`rn:748`, calls `rlnBackup`) and
> `syncWallet` (`rn:713`, calls `rlnSync`). Both are genuinely implemented.
> Step 1 of §6 still confirms by reading — a stub worded differently would
> evade even the corrected scan.

`IUTEXOWallet` is an intersection of **signatures**, not of **capabilities**. A
method that throws still satisfies `implements`, so the compiler certifies a
contract that is 30% untrue at runtime. Line 13 of that file names the intended
fix — `capabilities` — which was never built.

**The v3 thesis:** decompose the contract into capability groups, so an
unsupported operation is a *compile error on a narrowed type* rather than a
runtime throw. `IWalletManager` and `IRgbLibBinding` disappear as a byproduct —
their methods were always the optional groups.

---

## 1. Principles (carried from v2 §9, unchanged)

1. Interfaces + composition, not inheritance. **No base classes.**
2. Core imports no platform code, in either direction.
3. A third platform must be addable without editing core.
4. Data over code for configuration.
5. **Capability flags over "throws not implemented".** ← v3 delivers this one.
6. Unified error taxonomy at the binding boundary.
7. Subpath exports + `sideEffects: false`.
8. Delete dead surface while breaking anyway.

v3 additionally asserts:

9. **An interface may only declare a method that every implementor actually
   performs.** If one platform throws, the method belongs in an optional group,
   not the core contract. This is the rule v2 step 5c violated.

---

## 2. Audit — the measured split

### 2.1 The honest shared core (49 methods, both platforms implement)

Grouped by domain. Ungrouped alphabetical ordering is what let the fossils hide.

**Lightning — node, peers, channels (8)**
`getNodeInfo` `getNetworkInfo` `listPeers` `connectPeer` `disconnectPeer`
`listChannels` `openChannel` `closeChannel`

**Lightning — payments & invoices (12)**
`createLightningInvoice` `payLightningInvoice` `listLightningPayments`
`listPayments` `decodeLnInvoice` `invoiceStatus` `getLightningReceiveStatus`
`getLightningSendStatus` `keysend` `createHodlInvoice` `cancelHodlInvoice`
`claimHodlInvoice`

**Lightning — address (apay) (2)**
`apayNew` `apayNewWithAddress`

**On-chain transfer (3)**
`onchainReceive` `onchainSend` `listOnchainTransfers`

**RGB assets (10)**
`listAssets` `getAssetBalance` `issueAssetNia` `issueAssetIfa` `blindReceive`
`witnessReceive` `decodeRGBInvoice` `failTransfers` `listTransfers`
`listTransactions`

**BTC & UTXO (6)**
`getBtcBalance` `getAddress` `listUnspents` `sendBtc` `createUtxos`
`estimateFeeRate`

**Wallet meta (7)**
`getNetwork` `refreshWallet` `syncWallet` `signMessage` `verifyMessage`
`createBackup` `vssClearFence`

> ✅ **Resolved (was an open question).** `vssClearFence` is genuinely
> implemented on RN (`rn:1193` → `rlnVssClearFence`) and on web (`web:614` →
> `clearLdkVssFence`). It is not a stub — but it exposes a *different* defect,
> see §2.5.
>
> `createBackup` is **local** wallet backup (RN `rlnBackup`, web
> `manager.createBackup`) and is implemented on both. It does **not** belong in
> the VSS group — see §2.4.

### 2.2 rgb-sdk-rn throwing stubs (18) — these become optional groups

| Proposed group | Methods | Intended lifetime |
|---|---|---|
| `IBeginEndFlows` | `createUtxosBegin` `createUtxosEnd` `onchainSendBegin` `onchainSendEnd` `sendBtcBegin` `sendBtcEnd` **`inflateBegin` `inflateEnd`** | permanent — genuine platform difference |
| `IPsbtSigning` | `signPsbt` `estimateFee` | permanent |
| `IVssBackup` | `configureVssBackup` `disableVssAutoBackup` `vssBackup` `vssBackupInfo` | **temporary — web-specific, see §2.7** |
| **→ core contract** | `inflate` | RN *can* do this — bridge wiring only (§2.6) |
| **Delete** (§2.3) | `getXpub` `goOnline` `rotateColoredAddress` | — |

Verified spot-checks: `utexo-wallet.ts:480` (`getXpub`), `:1049`
(`onchainSendBegin`), `:1055` (`onchainSendEnd`).

**Note the two lifetimes.** `IBeginEndFlows` and `IPsbtSigning` describe
differences that are real and lasting — an RLN node signs internally, so
begin/end PSBT flows will never exist there. `IVssBackup` describes work that is
simply *unfinished*. Both kinds need a capability flag today, but only the first
kind should still have one in a year. The plan must not blur them, or
"temporary" becomes permanent by default.

**A stub is not evidence of a platform limit.** `inflate` was drafted as a
capability group on the strength of RN throwing — but the node supports it and
only the JS bridge was missing (§2.6). Before any method is granted a capability
flag, step 1 must check the UniFFI/wasm surface underneath. A flag added for
work that was merely unwired is a limitation invented in TypeScript.

### 2.3 Dead surface to delete outright

- **`rotateVanillaAddress` / `rotateColoredAddress`** — throw on **both**
  platforms (web `utexo-wallet.ts:373-382`, rn `:511`). Already listed for
  deletion in v2 §9.8; still present. Note `rotateVanillaAddress` appears in the
  47-method "shared" list only because RN implements it while web throws — it is
  not genuinely shared.
- **`getXpub`** — rgb-lib wallet concept. RN throws. An RLN node has a node
  pubkey, not a wallet xpub; `getNodeInfo` already covers the real need.
- **`goOnline`** — rgb-lib lifecycle. RN throws with *"use unlock(params)
  instead"*, which is the actual lifecycle. Folded into §4 lifecycle.
**Not deleted** (corrected from the first draft): `syncWallet` is implemented on
both (`rn:713` → `rlnSync`).

**Resolved:** `syncWallet` and `refreshWallet` **stay distinct**. They are
separate operations in the node API — `rlnSync` (chain/wallet sync) and
`rlnRefresh` (RGB transfer state refresh) are not interchangeable. Collapsing
them in the SDK would hide a distinction the node itself makes. Both stay in the
core contract.

### 2.4 Type-level defects

- `issueAssetIfa(params): Promise<any>` (`IUTEXOWallet.ts:172`). `IRgbLibBinding.ts:60`
  has the correct `Promise<AssetIfa>`. Fix to `AssetIfa`.
- No lifecycle in the contract at all — see §4.
- `createBackup` is grouped with **wallet meta**, not VSS. It is local,
  file-path-based backup and works on both platforms; VSS is remote replication.
  Conflating them is what made the first draft propose an `IVssBackup` that
  would have wrongly hidden a working method behind a capability flag.

### 2.5 A third defect class: optional params that are mandatory per-platform

`vssClearFence(password?: string)` is implemented on both, so no scan flags it —
yet the contract is still untrue:

```ts
// rn:1185 — optional in the contract, REQUIRED here
vssClearFence(password?: string): Promise<void> {
  if (password == null) {
    throw new Error('vssClearFence: password is required on React Native');
  }
  return this.rln.rlnVssClearFence(password);
}

// web:614 — accepted and IGNORED; identity comes from init()
vssClearFence(_password?: string): Promise<void> {
  return this.clearLdkVssFence();
}
```

`wallet.vssClearFence()` type-checks and works on web, throws on RN. The `?` was
chosen as a lowest common denominator, so the signature is a lie in *both*
directions — RN cannot honour the optionality, web cannot honour the parameter.

**Rule:** a parameter may be optional in the contract only if every platform
accepts its absence **and** every platform honours its presence.

#### Sweep results — 5 violations, in 3 distinct flavours

The sweep is done (was "unknown until step 1"). Of the 15 shared methods with
optional params, **5 are lies** — and they fail in three different ways, which
matters because only one of them is loud:

| Method | Flavour | Evidence |
|---|---|---|
| `vssClearFence(password?)` | **throws when absent** | rn:1188 requires it; web:614 ignores it |
| `closeChannel(channelId, peerPubkey?, force?)` | **silently mistyped** | rn:1131 declares them **required** (`peerPubkey: string`); web:903 has a real default |
| `verifyMessage(msg, sig, accountXpub?)` | **throws when present** | rn:779 throws `accountXpub is not supported`; web:676 passes it through |
| `onchainSend(params, mnemonic?)` | **silently ignored** ⚠️ | rn:1058 has **no `mnemonic` param at all** — JS drops the extra arg; web:813 uses it |

**`onchainSend` is the dangerous one.** RN does not throw, does not warn — the
mnemonic is discarded by JS argument handling. A caller passing a mnemonic
expecting it to sign gets silently different behaviour per platform. No test
that checks a return value will catch this.

**`closeChannel` shows why the compiler cannot save us here.** RN declares
`(channelId: string, peerPubkey: string, force: boolean)` — all required —
against an interface declaring the last two optional. TypeScript accepts this:
method parameters are **bivariant**, so a stricter implementation satisfies a
looser signature. `wallet.closeChannel(id)` type-checks and then passes
`undefined` into a native call expecting a string.

Verified clean: `keysend`, `listTransfers`, `listOnchainTransfers`,
`createUtxos` — both platforms normalise optionals identically (`?? null`,
`?? ''`, `?? 1.5`).

#### `createLightningInvoice` — a 5th violation, and the worst of them

Initially filed as "model divergence, not a §2.5 lie". That was wrong. Reading
the native surfaces:

```ts
// RN — rn:801, SEVEN arguments
rlnLnInvoice(amtMsat, expirySec, assetId, assetAmount,
             paymentHash, minFinalCltvExpiryDelta, descriptionHash)

// web — RlnNodeBinding.ts:348, FOUR arguments
nodeHandle.createLnInvoiceLiveJson(amtMsat, expirySec, assetId, assetAmount)
```

| Field | core model | RN | web |
|---|---|---|---|
| `amountSats` `asset` `expirySeconds` | ✓ | ✓ | ✓ |
| `paymentHash` | ✓ `:462` | ✓ passed | ❌ **declared, silently dropped** |
| `minFinalCltvExpiryDelta` | ✓ `:463` | ✓ passed | ❌ not supported natively |
| `descriptionHash` | ✗ | ✓ RN-only | ✗ |

**`paymentHash` is the severe one.** Core declares it, web's wallet re-declares
it in the params type (`web:697`) — and then never passes it to the node. A
caller supplying `paymentHash` to make a **HODL invoice** gets a **plain
invoice** on web, with no error. Funds behave differently from what the caller
asked for, silently. This is the same silent-ignore flavour as `onchainSend` but
with worse consequences.

Not a web bug to fix, though: the wasm live-invoice API genuinely takes four
arguments. Web's HODL support lives in a **separate** `createHodlInvoice`
(`web:949` → node's own HODL API), which both platforms already expose.

**Decision — narrow the core model to the true intersection:**

```ts
export interface CreateLightningInvoiceRequestModel {
  amountSats?: number;
  asset?: LightningAsset;
  expirySeconds?: number;
}
```

1. **Remove `paymentHash`.** A HODL invoice is a distinct product concept and
   both platforms already have `createHodlInvoice`. Expressing it as "plain
   invoice + a hash field" is precisely what let web declare-and-drop it. One
   concept, one method.
2. **Remove `minFinalCltvExpiryDelta`** from core → RN platform extra.
3. **`descriptionHash`** stays an RN platform extra (LNURL-pay BOLT11 `h` tag).
4. **Delete the `asset.assetAmount` alias** and `LightningAssetParam`. Web-only
   sugar that makes one concept expressible two ways; both platforms use
   `LightningAsset`. This also deletes web's runtime throw at `:704` — with a
   single required field the *type* enforces it.

Net: the shared signature becomes identical on both platforms with no `Omit<>`,
no intersection widening, and no silently-dropped field.

#### Consequence for step 3

This is no longer speculative work. Four fixes land with the interfaces:

- `vssClearFence(password: string)` — required; web ignores it harmlessly.
- `closeChannel(channelId: string, peerPubkey: string, force: boolean)` —
  required; web already defaults `force`, RN already demands both.
- `verifyMessage(message, signature)` — **drop `accountXpub` from the shared
  contract**. It is meaningless on an RLN node (verification is always against
  the node key). Web may keep it as a platform extra.
- `onchainSend(params)` — **drop `mnemonic` from the shared contract.** Web's
  mnemonic path belongs behind `IPsbtSigning`, not in a signature RN silently
  ignores.

### 2.6 IFA / inflation — RN can implement it today; no capability group needed

**Decision:** IFA is a product requirement on both platforms.

**Finding (verified against the UniFFI surface):** RN is not blocked. The
rgb-lightning-node UniFFI layer **already exposes inflation**:

```swift
// rgb-sdk-rn/ios/RGBLightningNode.swift:1251 (uniffi-generated)
open func inflate(request: InflateRequest) throws -> InflateResponse

// :3679
public struct InflateRequest {
    public var assetId: ContractId
    public var inflationAmounts: [UInt64]
    public var feeRate: UInt64
    public var minConfirmations: UInt8
}
public struct InflateResponse { public var txid: Txid }   // :3756
```

FFI symbols confirmed in `ios/RGBLightningNodeFFI.h:396` and `:1100`. IFA
*issuance* is already wired end-to-end on RN (`RgbModule.kt:1681` →
`node.issueassetifa`), so only inflation is missing.

`InflateRequest` maps **field-for-field** onto core's
`InflateAssetIfaRequestModel` (`wallet-model.ts:147`) — `assetId`,
`inflationAmounts`, `feeRate`, `minConfirmations`. No model change needed.

**Where it is actually blocked:** the RN **bridge**, not the node.
`grep -i inflate` over `android/.../RgbModule.kt`, `ios/Rgb.mm`, and
`ios/RgbSwiftHelper.swift` returns **nothing** — the UniFFI method is simply not
surfaced to JS. Work required:

1. Add `rlnInflate` to the native bridges (`RgbModule.kt`, `Rgb.mm` +
   `RgbSwiftHelper.swift`).
2. Thread it through `NativeRgb.ts` → `IRLN.ts` → `RLNBinding.ts`.
3. Implement `inflate()` in `rn/src/wallet/utexo-wallet.ts`, replacing the stub.

#### This splits the group — `IAssetInflation` is dropped

UniFFI's `inflate` is **atomic** (request → txid). There is no
`inflateBegin`/`inflateEnd` at the node level, and there never will be — an RLN
node signs internally. So the three methods have *different* fates:

| Method | Destination | Why |
|---|---|---|
| `inflate` | **core contract** | Both platforms can perform it; RN needs bridge wiring only |
| `inflateBegin` | `IBeginEndFlows` | PSBT flow — permanent platform difference |
| `inflateEnd` | `IBeginEndFlows` | PSBT flow — permanent platform difference |

**`IAssetInflation` is removed from this plan.** It was an artifact of treating
three methods as one concern. This drops the capability count back to three, all
of them describing real, lasting differences.

#### Two mismatches to resolve when wiring

- **Return type.** UniFFI gives `InflateResponse { txid }`; core's
  `OperationResult` is `{ txid, batchTransferIdx }` (`wallet-model.ts:130`). RN
  cannot supply `batchTransferIdx`. Either make it optional or return a narrower
  shared type. **Do not** have RN invent a placeholder value.
- **Optionality.** Core marks `feeRate?` and `minConfirmations?` optional;
  UniFFI requires both. This is the §2.5 pattern again — decide whether core
  makes them required or RN supplies documented defaults.

`issueAssetIfa` returning `Promise<any>` (§2.4) also rises in priority — IFA is
live surface on both platforms, not a corner case.

### 2.7 VSS is a temporary, web-shaped grouping

**Decision:** the VSS split reflects today's implementations, not a target
architecture:

- **RN** handles VSS largely **automatically** inside the node — hence no
  imperative `vssBackup`/`configureVssBackup` surface to expose.
- **Web** has **two distinct flows**: an automatic backup flow for RLN
  (`triggerAutoVssBackup`/`withVssBackup`, `web:153-167`) and a **manual**
  backup flow for the wallet.

So `IVssBackup` is not a clean capability — it is web's manual flow leaking into
the shared contract because RN automated the same concern. This should be solved
soon and properly.

**Recommended target:** the contract should express *intent* (`backupNow()`,
`backupStatus()`) and let each platform satisfy it automatically or manually,
rather than exporting web's four-method imperative VSS API as the standard.

**Done in step 7 (§6.0p)** — with one correction: `backupStatus()` did *not*
join the contract. rn's uniffi has no `vss_backup_info`, so a shared status
method could not be answered honestly on both platforms (invariant 1). Only
`backupNow()` is shared; web's status/config methods stay platform extras.

---

### 2.7a Root cause — web runs two engines, RN runs one

This is the single fact that explains most of the divergence in this document,
and it was not identified in v2.

| | rgb-sdk-web | rgb-sdk-rn |
|---|---|---|
| RLN node | ✅ `RlnNodeBinding` → wasm node handle | ✅ UniFFI `SdkNode` |
| rgb-lib **wallet** | ✅ `RlnWasmBinding` → `this.wallet.*` | ❌ **absent** |

Verified: `RlnWasmBinding.ts` calls `this.wallet.createUtxosBegin` (:729),
`inflateBegin` (:810), `sendBegin` (:867), `sendBtcBegin` (:906) — a full
rgb-lib wallet with PSBT begin/end flows. The RN UniFFI surface has **zero**
begin/end methods (`grep 'func.*[Bb]egin'` over `RGBLightningNode.swift`
returns nothing but a `keysend` substring match).

Three "platform differences" collapse into this one cause:

- **`IBeginEndFlows`** — web's rgb-lib wallet exposes PSBT begin/end; RN's node
  performs the same operations atomically and signs internally.
- **`IPsbtSigning`** — same reason; there is no PSBT to hand out on RN.
- **`IVssBackup` (§2.7)** — web must back up **two** state stores (the rgb-lib
  wallet *and* the node), which is exactly why it has an automatic RLN flow plus
  a manual wallet flow. RN has one store, so the node backs itself up.

**Consequence for the plan:** these are architectural, not unfinished work.
`IBeginEndFlows` and `IPsbtSigning` are confirmed permanent (question 3 in §9 is
now closed). `IVssBackup`'s reshape (§2.7) should be framed as *"express backup
intent, let each platform cover its own number of stores"* — not as RN catching
up to a web API.

---

### 2.8 Two different things are called "signer"

A naming collision that hides a real architectural distinction:

| | `ISigner` (core) | `IRLNSigner` (`rn/src/wallet/rln-signers.ts`) |
|---|---|---|
| Concern | PSBT / message signing | **node lifecycle & key custody** |
| Methods | `signPsbtWithMnemonic` `signPsbtWithSeed` `signMessage` `estimateFee` | `initNode` `unlockNode` `dispose?` |
| Delivered by | — | **constructor injection**: `new UTEXOWallet(params, signer)` |
| Implementations | `RNSigner`, web's `RlnSigner` | `PasswordRLNSigner`, `NativeExternalRLNSigner` |

**The external signer is not a capability.** `NativeExternalRLNSigner` keeps
keys outside the node and is injected at construction (`rn:405`); it is
orthogonal to §3.1 narrowing and survives this migration untouched.

**It also does not restore `signPsbt`.** The error text in
`rn/src/crypto/signer.ts` — *"Use NativeExternalRLNSigner for PSBT signing"* —
is misleading: that signer handles channel/LDK operations **inside the node**,
not arbitrary PSBTs handed in from JS. So `IPsbtSigning` is a **genuine**
permanent capability gap on RN, not an unwired one (contrast §2.6).

Follow-on cleanups:

- `rn/src/crypto/signer.ts` (35 lines, three functions, all pure `throw`) →
  **delete**, along with `SignPsbtOptions` (already flagged in v2 §9.8).
- `RNSigner implements ISigner` throws in 3 of 5 methods — the same stub
  antipattern one layer down. It goes with `IPsbtSigning` becoming a carrier.
- **Rename into three distinct names — decided.** The collision is not two
  concepts sharing a name, it is *three* concepts sharing two names:

  | Concept | Today | Target | Where |
  |---|---|---|---|
  | Node unlock & key custody | `IRLNSigner` | **`INodeUnlocker`** | rn, constructor-injected |
  | Message signing (both platforms) | part of `ISigner` | **`IMessageSigner`** | core, always present |
  | PSBT signing (web only) | part of `ISigner` | **`IPsbtSigner`** | core, feeds the `psbt` carrier |

  Splitting `ISigner` is not extra work — it *is* the `IPsbtSigning` carrier
  (§3.1) seen from the signer side. Doing them together avoids touching the same
  files twice.

  **Rename now, not later:** it is mechanical, there are no releases to break
  (§6.1), and every doc or comment written before the rename entrenches the
  confusing name further.
- `IWalletLifecycle<TUnlockParams>` (§4) must accommodate **both** the unlock
  params *and* signer injection, or the external-signer flow breaks.

---

## 3. Target shape

```ts
// ── Always present ───────────────────────────────────────────────────────────

interface ILightningNode {
  getNodeInfo(): Promise<LightningNodeInfo>;
  getNetworkInfo(): Promise<LightningNetworkInfo>;
  listPeers(): Promise<LightningPeer[]>;
  connectPeer(peerUri: string): Promise<void>;
  disconnectPeer(peerPubkey: string): Promise<void>;
  listChannels(): Promise<LightningChannel[]>;
  openChannel(params: OpenChannelParams): Promise<OpenChannelResult>;
  closeChannel(channelId: string, peerPubkey?: string, force?: boolean): Promise<void>;
}

interface ILightningPayments { /* the 12 from §2.1 */ }
interface ILightningAddress  { apayNew(…); apayNewWithAddress(…); }
interface IOnchainProtocol   { /* existing — trimmed to the 3 non-begin/end */ }
interface IRgbAssets         { /* the 10 from §2.1; issueAssetIfa → AssetIfa */ }
interface IBitcoinWallet     { /* the 6 from §2.1 */ }

interface IUTEXOWalletCore
  extends ILightningNode, ILightningPayments, ILightningAddress,
          IOnchainProtocol, IRgbAssets, IBitcoinWallet {
  getNetwork(): Network;
  refreshWallet(): Promise<void>;
  syncWallet(): Promise<void>;
  signMessage(message: string): Promise<string>;
  verifyMessage(message: string, signature: string, accountXpub?: string): Promise<boolean>;
  createBackup(params: { backupPath: string; password: string }): Promise<WalletBackupResponse>;
  vssClearFence(password: string): Promise<void>;   // ⚠️ see §2.5 — not `password?`
}

// ── Optional — declared via capabilities, never stubbed ──────────────────────

interface IBeginEndFlows  { /* §2.2 — permanent; includes inflateBegin/End */ }
interface IPsbtSigning    { /* §2.2 — permanent */ }
interface IVssBackup      { /* §2.2 — TEMPORARY, web-shaped (§2.7) */ }

// ── Lifecycle — generic absorbs the platform split ───────────────────────────

interface IWalletLifecycle<TUnlockParams = void> {
  unlock(params: TUnlockParams): Promise<void>;
  dispose(): Promise<void>;
  isDisposed(): boolean;
}

// ── The contract ─────────────────────────────────────────────────────────────

interface WalletCapabilities {
  readonly beginEndFlows: boolean;
  readonly psbtSigning: boolean;
  /** @deprecated Temporary — reshape to intent-based backup (§2.7). */
  readonly vssBackup: boolean;
}

interface IUTEXOWallet<TUnlockParams = void>
  extends IUTEXOWalletCore, IWalletLifecycle<TUnlockParams> {
  readonly capabilities: Readonly<WalletCapabilities>;
}
```

### 3.1 Narrowing — DECIDED: optional-property carriers

Optional groups are exposed as **sub-objects that are present or absent**, not as
flat methods behind a boolean flag:

```ts
interface IUTEXOWallet<TUnlockParams = void>
  extends IUTEXOWalletCore, IWalletLifecycle<TUnlockParams> {
  readonly psbt?: IPsbtSigning;
  readonly beginEnd?: IBeginEndFlows;
  /** @deprecated Temporary — reshape to intent-based backup (§2.7). */
  readonly vss?: IVssBackup;
}
```

```ts
await wallet.vss?.backup();                       // no-op where unsupported
if (!wallet.psbt) throw new Error('PSBT signing unavailable on this platform');
await wallet.psbt.signPsbt(psbt);                 // ✅ narrowed by the check itself
```

**Why carriers over type guards.** A guard (`w is T & IVssBackup`) is an
**unchecked assertion** — if the capability flag and the real methods disagree,
TypeScript believes the flag. That reproduces the exact defect this plan exists
to remove, relocated from `implements` into a predicate. With carriers, presence
*is* the type: there is no second source of truth to drift.

The cost is call-site churn, and §6.1 (no releases, `file:` linking) makes that
cost near-zero **now** and expensive later. This is the cheapest moment to take
the stricter option.

#### `capabilities` becomes derived, not authoritative

Keep it for ergonomics and telemetry, but it must be computed from the carriers,
never stored independently:

```ts
get capabilities() {
  return {
    psbtSigning:   this.psbt     !== undefined,
    beginEndFlows: this.beginEnd !== undefined,
    vssBackup:     this.vss      !== undefined,
  } as const;
}
```

This keeps the §7 conformance test trivial: `('vss' in wallet) === capabilities.vssBackup`.

#### External signers are unaffected

`IRLNSigner` (RN's `PasswordRLNSigner` / `NativeExternalRLNSigner`) is
**constructor-injected node lifecycle**, not an optional method group — see
§2.8. `new UTEXOWallet(params, signer)` is unchanged by this decision.

---

## 4. Lifecycle — the gap v2 documented but did not close

v2 excluded `init`/`unlock`/`dispose` because *"RN's `unlock` takes native
params, web's takes none. Shared naming here would be a lie."* Correct diagnosis,
wrong remedy: the consequence is that **no platform-agnostic consumer can be
written**, because it cannot construct, dispose, or liveness-check a wallet.
That forces `if (platform === 'rn')` back into app code — the exact thing the
contract exists to prevent.

The generic parameter resolves it without lying:

```ts
// rgb-sdk-rn
class UTEXOWallet implements IUTEXOWallet<RnUnlockParams> { … }
// rgb-sdk-web
class UTEXOWallet implements IUTEXOWallet<void> { … }
```

`goOnline` (§2.3) folds in here and is deleted.

---

## 5. Relationship to the binding layer

Left deliberately for a follow-up plan, but recorded so it isn't lost:

`IRgbLibBinding` models an **rgb-lib wallet**. Both platforms actually wrap an
**RLN node**, so each re-invents that contract privately:

| | interfaces | implementation |
|---|---|---|
| web | `IRlnNodeBinding` (116) + `IRlnWalletBinding` (25) + `IRlnSdkBinding` (46) | `RlnWasmBinding` (1191) + `RlnNodeBinding` (688) |
| rn | `IRLN` (311) + `Interfaces.ts` (443) | `RLNBinding` (951) + `rln-manager` (501) |

~2,900 lines per platform describing the same Rust node, both pinned to RLN
`0.9.0-beta.3`, with **no shared contract**. Core constrains the part that
already agrees (domain types in `src/rln/` — this part is right) and leaves the
part that drifts ungoverned.

Only one implementor extends `IRgbLibBinding` (web, via `IRlnWalletBinding`); RN
merely re-exports the symbol. **Proposal for v4: replace `IRgbLibBinding` with
`IRlnNode`, derived from the intersection of web's `IRlnNodeBinding` and RN's
`IRLN`.**

`BaseWalletManager` (498 lines, ~350 of them one-line
`this.requireBinding().x()` delegations, one consumer: web's
`RlnWalletManager`; RN never extends it) contradicts principle 1 and goes with
it. Its `binding?`/`signer?` optional-with-runtime-throw pattern is the same
defect as the stubs, one layer down.

---

## 6. Execution order

| # | Step | Blocks | Risk |
|---|------|--------|------|
| 0 | ✅ **DONE** — web + rn symlinked to local core via `file:../rgb-sdk-core`. web was on published `1.0.0-beta.3`; rn had the `file:` spec but a stale copy installed | all | — |
| 1 | ✅ **DONE** — signature diff, §2.5 sweep, native-surface checks. Results in §6.0 | all | — |
| 1b | ✅ **DONE** — RN `inflate` wired through all five layers; stub deleted (§6.0c) | 4 | — |
| 2 | ✅ **DONE** — carriers over type guards (§3.1); lifecycle generic `IUTEXOWallet<TUnlockParams>` (§4) | 3 | — |
| 3 | ✅ **DONE** — split interfaces landed in `src/interfaces/wallet/` (`tsc` + eslint clean, not yet root-exported) | 4 | — |
| 4a | ✅ **DONE (web)** — `implements IUTEXOWallet<void>`, carriers, `capabilities`, conformance check. Results in §6.0b | 5 | — |
| 4b | ✅ **DONE (rn)** — `implements IUTEXOWallet<IRLNUnlockParams>`, all stubs deleted, redundant intersections dropped (§6.0d) | 5 | — |
| 5 | ✅ **DONE** — `IWalletManager`, `WalletInitParams`, `BaseWalletManager`, `IUTEXOWalletLegacy` deleted (§6.0e) | 6 | — |
| 6 | ✅ **DONE** — capability honesty enforced at runtime on both platforms (§6.0f) | — | — |
| 6b.0 | ✅ **DONE** — field helpers in core, 26 tests (§6.0j) | 6b.2, 6b.3 | — |
| 6b.1 | ✅ **DONE** — `e2e-fixtures.json` emitted by both demo scripts (§6.0k) | 6b.2, 6b.3 | — |
| 6b.2 | ✅ **DONE** — Playwright suite in `rgb-sdk-web/tests/e2e/`, scenarios A–C + F, all green (§6.0l) | 6b.4 | — |
| 6b.3 | ✅ **DONE** — flow-runner suite in `rgb-sdk-rn-demo/e2e/`, scenarios A–E, 5/5 green on the emulator; **scenario D proves `rlnInflate` runs**, and the suite found 3 real defects (§6.0m) | — | — |
| 6b.4 | ✅ **DONE** — scenario G green: backup → mutate → restore into a fresh wallet, state equality asserted (§6.0o). **Step 7 is unblocked** | **7** | — |
| 6c | ✅ **DONE** — protocol layer + UTEXO config table deleted, 8 files (§6.0h) | — | — |
| 7b | ✅ **DONE** — dead surface re-measured: 249 exports, 14 unused-but-internal, **0 orphans**; 4 more dead models deleted; **both demos migrated to v3** (§7b, §7b.5) | — | — |
| 7 | ✅ **DONE** — `backupNow()` on the shared contract, `IVssBackup` + `vssBackup` flag deleted, rn's uniffi `vss_backup` wired through 5 layers (§6.0p) | — | — |
| 6b.5 | ✅ **DONE** — scenario H green on **both** platforms: a device killed with a channel open restores wallet + channel, reconnects and closes it (§6.0q). Contract fallout in §6.0r | — | — |
| 8 | *(v4)* `IRlnNode` replaces `IRgbLibBinding` | — | high — separate plan |

### 6.0 Step 1 results — signature diff (DONE)

Both `UTEXOWallet` classes were parsed (multi-line signatures balanced, comments
stripped) and diffed against the v3 interfaces in `src/interfaces/wallet/`.
rn exposes 87 members, web 96.

**Headline: the contract holds. 48 of 53 always-present methods match on both
platforms with no divergence in parameters or return types.**

#### The 5 arity diffs are all intended §2.5 fixes, not new findings

| Method | contract | rn | web | Status |
|---|---|---|---|---|
| `closeChannel` | `(channelId, peerPubkey, force)` | ✅ matches | `(channelId, peerPubkey?, force=)` | web migrates |
| `onchainSend` | `(params)` | ✅ matches | `(params, mnemonic?)` | web migrates |
| `verifyMessage` | `(message, signature)` | `(…, accountXpub?)` | `(…, accountXpub?)` | both migrate |
| `inflate` | `(params)` | `(params, mnemonic?)` | `(params, mnemonic?)` | both migrate |
| `unlock` | `(params: T)` | `(params)` | `()` | ✅ **generic already resolves this** |

`unlock` is not a defect: `IUTEXOWalletV3<void>` makes `unlock(params: void)`
callable as `unlock()`, so web's zero-arg signature satisfies it. The generic
in §4 does the job it was designed for.

For `inflate`, both platforms currently take `mnemonic?` — but rn's is a
throwing stub, and web falls back to its stored mnemonic when the argument is
omitted. So `inflate(params)` works on web unchanged.

#### 4 type-level divergences the arity check missed

Parameter *names* and *types* were compared separately — this is where the
remaining divergence hid:

| Method | Finding | Severity |
|---|---|---|
| `payLightningInvoice` | rn widens with `& { assetAmount?: number }` — **core's model already has `assetAmount`** (`wallet-model.ts:487`). 100% redundant. | noise |
| `createLightningInvoice` | rn widens with 3 fields; **2 already exist in core** (`paymentHash` :462, `minFinalCltvExpiryDelta` :463). Only `descriptionHash` is real. | noise + §2.5 |
| `createHodlInvoice` | rn widens with `descriptionHash` — genuinely absent from `CreateHodlInvoiceParams`. | real rn extra |
| `connectPeer` | param named `peerPubkeyAndAddr` on rn, `peerUri` on web. Types match; TS ignores names. | cosmetic |

**New pattern worth naming: rn re-declares fields core already models.** Three
of the four findings are this. Harmless to the compiler, but it inflated the
apparent divergence and made the `createLightningInvoice` analysis harder than
it needed to be — the intersection *looked* like three platform extras when it
was one. **Delete these redundant intersections during step 4.**

Related: `descriptionHash` and `minFinalCltvExpiryDelta` already exist in core's
LSP types (`lsp-types.ts:45,47`). So the field names have precedent in core —
worth reusing if web's node ever gains support, rather than inventing new ones.

`connectPeer`: standardise on **`peerUri`** — the value may be a bare pubkey or
`pubkey@host:port`, which "uri" describes and "pubkeyAndAddr" over-specifies.

#### Platform extras (stay per package, not in core)

- **rn-only (13):** `reinit` `shutdown` `destroy` `listTransactionsByTxid`
  `listTransfersByTxid` `enableVirtualChannelsForPeer` `getChannelId`
  `checkIndexerUrl` `checkProxyEndpoint` — plus `sendBegin` `sendEnd` `send`
  and the private `buildNodeParams`.
- **web-only (22):** `issueAssetCfa` `sendRgbFromGroups` `restoreFromVss`
  `getLastBackupBytes` `restoreFromBackupBytes` `ldkVssBackupInfo`
  `clearLdkVssFence` `disableLdkVssReplication` `vssRestoreBackup` `isOnline`
  `getNodePubkey` `getPayment` `attachLightningNode` `getLightningNode`
  `create` — the remainder (`manager`, `requireNode`, `withVssBackup`,
  `initInternal`, `unlockInternal`, `triggerAutoVssBackup`,
  `warnIfUnrestoredBackupExists`) are private helpers, not API.

**Delete candidate:** the `sendBegin`/`sendEnd`/`send` trio is rn-only **and**
`sendBegin`/`sendEnd` are throwing stubs; web dropped the names in favour of
`onchainSend*`. Dead surface on both — remove in step 5.

#### Carrier membership confirmed

All 14 carrier methods exist syntactically on both platforms — but every rn
occurrence is a throwing stub, which is precisely why they are carriers. Step 4
deletes the stubs rather than implementing them (except where §2.6 applies).

---

### 6.0b Step 4 (web) results — DONE

web now declares `implements IUTEXOWallet<void>`. All three repos green:
core `tsc` + 195 tests, web `tsc` + eslint + 219 tests, rn `tsc`.

**web needed far fewer changes than expected.** The v3 contract is *narrower*
than web's methods, and TypeScript's bivariant method parameters mean a wider
implementation satisfies a narrower contract. So `closeChannel(id, peer?, force?)`,
`onchainSend(params, mnemonic?)`, `verifyMessage(m, s, xpub?)` and
`inflate(params, mnemonic?)` all satisfy their trimmed contract signatures
**without edits** — the extra parameters simply become platform extras,
invisible to anyone programming against `IUTEXOWallet`. That is the design
working as intended, not a loophole.

What actually changed:

1. **Carriers added** — `psbt`, `beginEnd`, `vss` as readonly properties built
   from arrow functions, so `this.manager` stays untouched until a carrier
   method is called (construction remains sync and cheap).
2. **`capabilities` getter** — derived from carrier presence, not stored.
3. **`createLightningInvoice` narrowed** to `CreateLnInvoiceRequest`. This was
   the one behavioural fix: the old signature accepted `paymentHash` and
   dropped it, silently returning a plain invoice where a HODL invoice was
   requested. Also removed the `asset.assetAmount` alias and, with it, web's
   runtime throw for a missing amount — the type enforces it now.
4. **`Omit<IWalletManager, 'send' | 'sendBegin' | 'sendEnd'>` deleted.** Having
   to subtract from a contract to implement it was the original smell (§0).

#### Type-level conformance check

`rgb-sdk-web/src/contract-conformance.ts` — compiled by `tsc` (tsconfig
includes `src`), never bundled (tsup entry is only `src/index.ts`), no runtime
exports. It asserts with `@ts-expect-error` that each of these is **illegal**
against the contract:

```ts
w.verifyMessage('m', 's', 'xpub');                    // accountXpub removed
w.createLightningInvoice({ amountSats: 1, paymentHash: 'h' });  // silently dropped before
w.onchainSend({ invoice: 'i' }, 'mnemonic');          // web platform extra
w.vssBackup();                                        // carrier-only
w.signPsbt('psbt');                                   // carrier-only
```

All five directives are satisfied — the calls are compile errors, and the build
fails if any becomes legal again. This is the v3 thesis made executable: what
used to throw at runtime now cannot be written.

It cannot check the reverse (that a *present* carrier actually works). That
needs the runtime suite in §7.

#### Naming resolved — no `V3` in the API

The transitional `IUTEXOWalletV3` name is **gone**; the contract is
`IUTEXOWallet`. The superseded v2 shape was renamed `IUTEXOWalletLegacy` and
survives only until rn migrates (step 5 deletes it). Cost: two lines in rn.

Rationale: a version suffix in a public type name is scaffolding, and this plan
warns twice about scaffolding that outlives its purpose (§2.2, §8). Shipping
`V3` would have leaked it into demo apps and docs, making the eventual rename
expensive — the exact trap the plan exists to avoid.

---

### 6.0c Step 1b results — RN `inflate` wired (DONE)

The first stub deleted rather than moved to a carrier. Five layers, following the
`rlnIssueAssetIfa` template exactly:

| Layer | File | Change |
|---|---|---|
| Wire types | `binding/rln-types.ts` | `RlnInflateResponse { txid }` |
| TurboModule spec | `binding/NativeRgb.ts` | `rlnInflate(nodeId, assetId, inflationAmounts, feeRate, minConfirmations)` |
| Binding contract | `binding/IRLN.ts` | same, minus `nodeId` |
| Binding impl | `binding/RLNBinding.ts` | `withNodeOperation` wrapper |
| Manager | `wallet/rln-manager.ts` | delegation |
| Android | `RgbModule.kt` | `node.inflate(InflateRequest(…))` |
| iOS | `Rgb.mm` + `RgbSwiftHelper.swift` | `_rlnInflate` |
| Wallet | `wallet/utexo-wallet.ts` | stub → real call |

**The type system caught the §2.6 mismatch on its own.** Returning `{ txid }`
failed to compile against `IWalletManager`/`IUTEXOWalletLegacy`, both of which
demanded `OperationResult { txid, batchTransferIdx }` — a field the uniffi
`InflateResponse` does not carry. Resolved by narrowing **both legacy
interfaces** to return `InflateResult` (with `batchTransferIdx` optional), not
by having rn invent a placeholder index. web still returns the full
`OperationResult`, which satisfies the wider type.

That is the plan's §2.6 rule enforced by the compiler rather than by review —
and a small vindication of doing the interface work before the wiring, since the
mismatch surfaced as a build error instead of a runtime surprise.

Two deliberate carry-overs of existing convention:

- **`feeRate` truncation.** `InflateRequest.feeRate` is a `UInt64`, so
  fractional rates truncate. `rlnSendRgb` already behaves this way
  (`feeRate.toULong()`), so the behaviour is consistent rather than novel —
  documented at each layer. Fixing it properly is a Rust-side change.
- **`inflateBegin`/`inflateEnd` remain unimplemented on rn** and stay on the
  `beginEnd` carrier. Correct per §2.7a: rn's node has no PSBT to hand out.

Verification: core/web/rn all `tsc` clean; core 195 tests, web 219 tests; the new
rn code is prettier-clean (rn's ~374 pre-existing `no-unused-vars` errors are
unrelated and unchanged). **Native code is not compile-verified** — see §8.

---

### 6.0d Step 4b (rn) results — DONE

`rgb-sdk-rn`'s `UTEXOWallet` now declares
`implements IUTEXOWallet<IRLNUnlockParams>`. **Zero occurrences of
`not implemented` remain in the file** (was 18).

What happened to each stub — note that *none* were implemented to make the
contract fit; each was either already real, or genuinely belonged elsewhere:

| Stubs | Outcome |
|---|---|
| `signPsbt` `estimateFee` | → `psbt` carrier (absent here) |
| `createUtxosBegin/End` `sendBtcBegin/End` `inflateBegin/End` `onchainSendBegin/End` | → `beginEnd` carrier (absent) |
| `configureVssBackup` `disableVssAutoBackup` `vssBackup` `vssBackupInfo` | → `vss` carrier (absent) |
| `goOnline` `getXpub` `rotateColoredAddress` | deleted — rgb-lib concepts (§2.3) |
| `sendBegin` `sendEnd` (+ `send`) | deleted — dead on both platforms (§6.0) |
| `inflate` | **implemented** in step 1b (§6.0c) |

Carriers are declared `readonly psbt = undefined` (and `beginEnd`, `vss`), with
`capabilities` derived from their presence — same pattern as web, opposite
result.

Also applied here: the two §2.5 fixes rn owned (`verifyMessage` lost
`accountXpub`; `createLightningInvoice` lost `paymentHash` and narrowed to
`CreateLnInvoiceRequest`, keeping `minFinalCltvExpiryDelta` and
`descriptionHash` as documented rn extras), plus removal of the redundant
intersections found in §6.0 — `payLightningInvoice`'s
`& { assetAmount?: number }` duplicated a field core already declares.

#### Both conformance checks now exist, and they prove opposite things

`rgb-sdk-rn/src/contract-conformance.ts` mirrors the web file. web's asserts the
carriers are **present and reachable**; rn's asserts they are **absent** —
`w.psbt.signPsbt(…)` is a compile error while `w.psbt?.signPsbt(…)` is fine —
and that every deleted stub stays unreachable:

```ts
w.signPsbt('psbt');            w.createUtxosBegin({ num: 1 });
w.vssBackup();                 w.goOnline('…');
w.getXpub();                   w.sendBegin({ invoice: 'i' });
w.verifyMessage('m','s','x');  w.createLightningInvoice({ amountSats: 1, paymentHash: 'h' });
w.onchainSend({ invoice:'i' }, 'mnemonic');
```

All are `@ts-expect-error`-guarded, so reinstating any of them breaks the build.
The same file also pins the lifecycle generic by calling
`w.unlock({ indexerUrl: … })` — rn's native params flowing through
`IUTEXOWallet<IRLNUnlockParams>`, which is the mechanism §4 was designed around.

Verification: core/web/rn all `tsc` clean, core 195 tests, web 219 tests, new
and touched rn files prettier-clean.

**Still unverified:** iOS native compile (§8), and the runtime conformance suite
(§7) — types cannot prove a *present* carrier actually works.

---

### 6.0e Step 5 results — dead surface deleted (DONE)

| Deleted | Was |
|---|---|
| `interfaces/IUTEXOWallet.ts` (`IUTEXOWalletLegacy`) | 222-line v2 contract, 18 of whose methods threw on rn |
| `interfaces/IWalletManager.ts` (`IWalletManager` + `WalletInitParams`) | 154-line rgb-lib-shaped contract |
| `wallet/BaseWalletManager.ts` | 498-line abstract base, one consumer |
| `tests/base-wallet-manager.test.ts` | 33 tests for the above |

`UTEXOWalletCreateParams` was **kept** — both platforms use it — and moved to
`interfaces/wallet/params.ts`, the one piece of the v2 file worth saving.

`IRgbLibBinding` is deliberately **not** deleted: replacing it with `IRlnNode`
is v4 work (§5), and web's `IRlnWalletBinding` still extends it.

#### web absorbed the base class

`RlnWalletManager` no longer extends anything. It gained ~36 delegating methods
plus the state the base held (xpubs, mnemonic, seed, network, disposed).
Two things improved in the process:

- **`binding` and `signer` are now required and non-null.** The base took them
  as optional constructor args and threw from `requireBinding()` at call time —
  a fully type-checked object that blew up on use. That is the same "declared
  but not really there" defect the contract migration removed one layer up, and
  it is now structurally impossible here.
- **`RlnWalletInitParams` stopped inheriting `Partial<WalletInitParams>`.** It
  had been pulling in the entire rgb-lib parameter bag to obtain five fields.
  Those five (`xpubVan`, `xpubCol`, `masterFingerprint`,
  `maxAllocationsPerUtxo`, `vanillaKeychain`) are now declared explicitly; the
  rest (`dataDir`, `reuseAddresses`, `seed`, `xpub`, …) turned out to be read
  nowhere.

#### Two honest notes on what this cost

**1. A validation check was dropped.** `BaseWalletManager` threw
`ValidationError` when `masterFingerprint` was missing. `RlnWalletManager` does
not — it validates `xpubVan`/`xpubCol` only. The field was stored but never read
by the base, and web's `create()` always populates it from `binding.getKeys()`,
so this is judged cargo rather than a safety net. Flagged rather than left
silent; restoring it is one line if wanted.

**2. Real test coverage is now unhomed.** Of the 33 deleted tests, roughly a
third were testing the nullable-binding defect itself (`getBtcBalance throws
when no binding`) — genuinely obsolete, since that state cannot be constructed
any more. But the rest covered behaviour that *moved* rather than vanished:
delegation, `estimateFeeRate` blocks validation, `signPsbt` mnemonic/seed
fallback, seed derivation, dispose idempotency, seed zeroing on dispose. **That
logic now lives in `rgb-sdk-web/src/wallet/rln-wallet-manager.ts` and is
untested.** Core dropped from 195 to 162 tests. Porting those cases to web is
the obvious follow-up and belongs with §7.

Verification: core/web/rn all `tsc` clean; core 162 tests (9 suites), web 219
tests; eslint and prettier clean.

---

### 6.0f Step 6 results — conformance suite (DONE)

**The suite had itself drifted.** `IUTEXO_WALLET_METHODS` still required
`goOnline`, `createUtxosBegin`, `inflateBegin`, `vssBackup` — methods now either
deleted or carrier-only. The drift detector was asserting the pre-migration
contract. Rewritten to the 53 always-present members (49 domain + 4 lifecycle).

#### The check types cannot make

New `CARRIER_GROUPS` table plus a capability block asserting, per group:

1. `capabilities.<flag>` is a boolean;
2. **`capabilities.<flag> === (wallet.<carrier> !== undefined)`** — the flag and
   the carrier cannot disagree;
3. a present carrier exposes every method in its group;
4. **a present carrier contains no stubs** — each method is called and the
   rejection must not match `/not implemented/i`.

Check 4 is the one that closes the loop. Types prove unsupported surface is
*unreachable*; only execution proves supported surface is *real*.

`createWalletSync` was added for this: carriers and `capabilities` are instance
state, not prototype members, so an object is required — but not a working one.
Construction on both platforms only stores params, so no wasm, node or network
is involved.

`REMOVED_METHODS` gained the `send`/`sendBegin`/`sendEnd` trio. It deliberately
does **not** list `signPsbt`/`vssBackup`/`goOnline`/`getXpub`: web still exposes
those flat because it genuinely performs them, while rn deleted them. Asserting
their absence globally would be false. Carrier semantics cover the real
guarantee.

#### Wiring

| | How | Result |
|---|---|---|
| web | `tests/conformance.test.ts` under Jest | 228 tests (was 219) |
| rn | `scripts/check-contract.mjs` + `npm run check:contract` | 84 checks |

**rn had no test toolchain at all** — no jest, no babel, no `test` script. Rather
than install one, the suite's runner-agnostic design was used as intended: the
script supplies its own `describe`/`it`/`expect` (~60 lines, zero new
dependencies). A `scripts/rn-stub-loader.mjs` ESM hook stubs `react-native`,
whose Flow-typed entry point Node cannot parse and whose
`TurboModuleRegistry.getEnforcing` runs at import. rn also gained
`npm test` = `typecheck && check:contract`, which it previously lacked entirely.

#### The detector was verified to actually fail

A check that never fires is decoration. A stub was deliberately reinstated —
`readonly psbt = { signPsbt: async () => { throw new Error('… not
implemented'); } }` — and the suite failed exactly as intended:

```
✗ rgb-sdk-rn — IUTEXOWallet conformance › capabilities › .psbt, when present, contains no stubs
      expected false, got true
```

then passed again once reverted. **This is the single most valuable artefact of
the migration**: the specific defect that started this work — a declared method
that throws — is now caught mechanically rather than by review.

#### RLN version lock (v2 §10) confirmed green

`node scripts/check-rln-versions.mjs` — web `@utexo/rln-wasm`, rn iOS
xcframework and rn Android AAR all at `0.9.0-beta.3`.

---

### 6.0g Follow-ups closed — iOS verified, tests re-homed

#### iOS native compile — verified

The last unverified piece of step 1b. `rlnInflate` is present in the Xcode
codegen output (`RgbSpecJSI.h`, `RgbSpecJSI-generated.cpp`, `RgbSpec.h`) and the
generated protocol declaration matches `ios/Rgb.mm` exactly:

```objc
- (void)rlnInflate:(double)nodeId assetId:(NSString *)assetId
  inflationAmounts:(NSArray *)inflationAmounts feeRate:(double)feeRate
  minConfirmations:(double)minConfirmations
           resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject;
```

Both platforms now compile the wiring. §8's native risk is closed.

#### The step 5 coverage gap — closed, and it caught a regression immediately

`rgb-sdk-web/tests/rln-wallet-manager.test.ts` re-homes the surviving cases from
the deleted `base-wallet-manager.test.ts`: constructor validation, network
default, seed derivation, binding delegation, `estimateFeeRate` validation,
`signPsbt` fallback, and the full dispose contract. web: 228 → **248 tests**.

Not ported, because they covered a state that can no longer exist: "constructs
without binding or signer", "throws when no binding", "throws when no signer".
`binding` and `signer` are required now. Also dropped: the `WalletInitParams`
optional-field acceptance tests — those fields are plain optional properties
with no constructor behaviour left to assert.

**On their first run the ported tests failed — and they were right.** Rewriting
the delegations without `async` had changed error semantics: `ensureNotDisposed()`
and the validation guards threw **synchronously** instead of rejecting, so
`wallet.getBtcBalance().catch(…)` would no longer catch a disposed-wallet error.
Every public method on `RlnWalletManager` is `async` again, and the class
docblock now says why.

This is the clearest argument for having re-homed the tests rather than
accepting the gap: the regression was introduced by the refactor in step 5,
type-checked cleanly, passed 228 other tests, and would have reached callers as
an uncatchable throw.

#### Remaining honest gaps

- The runtime conformance suite still runs against an **un-initialised** wallet.
  Carrier presence and stub-freedom are real checks; end-to-end behaviour
  (`createWallet`) still belongs to an e2e suite that does not exist here.
- rn's `check-contract.mjs` exercises the contract, not the bindings. Native
  correctness of `rlnInflate` is proven only by compilation, not by an
  inflation actually succeeding on a node.

---

### 6.0h Step 6c results — dead surface deleted (DONE)

Eight files removed from core:

| File | Lines | Why |
|---|---|---|
| `interfaces/IUTEXOProtocol.ts` | 65 | nothing implemented it after both wallets moved to `IUTEXOWallet` |
| `utexo/utexo-protocol.ts` | 123 | base classes nothing extended; also violated §1.1 |
| `utexo/config/utexo-presets.ts` | 142 | UTEXO network config table |
| `utexo/utils/network.ts` | 119 | ″ |
| `utexo/config/options.ts` | 32 | `ConfigOptions`, unused |
| `utexo/config/index.ts`, `utexo/utils/index.ts`, `utexo/utils/helpers.ts` | ~10 | barrels for the above; imported by nothing |

**One survivor rescued.** `restore.ts` — which stays, web uses it — imported
`UtxoNetworkPreset` from the doomed `utils/network.ts`. It is a one-line union
(`'mainnet' | 'testnet'`), now inlined in `restore.ts` and re-exported from the
package root. Deleting the file blind would have broken `buildVssConfigFromMnemonic`.

**Every compile error landed in an `index.ts`.** Both SDKs failed only on
re-export lines — no implementation file referenced any of it, which is exactly
what the audit predicted. The UTEXO config table in particular was re-exported
by both packages and used by neither; endpoint resolution lives in web's
`binding/RlnDefaults.ts` and rn's `wallet/network-defaults.ts`.

Verification: core/web/rn `tsc` clean; core 162 tests, web 248 tests, rn 84
conformance checks — all unchanged, which is the point: deleting genuinely dead
code should move no other number. Core is now 51 files / 5,822 lines.

---

### 6.0i Step 6c continued — rn signer cluster deleted

| Deleted from rn | Lines | Why |
|---|---|---|
| `src/crypto/signer.ts` | 35 | `signPsbt`/`signPsbtFromSeed`/`estimatePsbt` — three functions that only threw, plus an empty `SignPsbtOptions` (`// Reserved for future options`) |
| `src/signer/RNSigner.ts` | 49 | `implements ISigner` while throwing in 3 of 5 methods — the stub antipattern one layer below the wallet |
| `ISigner` re-export | 1 | rn has no implementation left; re-exporting the type advertised a capability that does not exist |

Both directories are now empty and gone. This is the §2.8 conclusion applied:
bdk-rn was removed, the node signs internally, and
`NativeExternalRLNSigner` does not restore JS-side PSBT signing — it signs
channel/LDK operations *inside* the node.

#### Two items from the audit list were NOT deleted — the list was wrong

**`rn/src/wallet/wallet-manager.ts` stays.** v2 §9.8 called it "a one-line
wrapper around core `generateKeys`" and listed it for removal. It has a live
consumer: `rgb-sdk-rn-demo/app/(tabs)/utexo.tsx:326` imports and calls
`createWallet`, and the wrapper does real work — `toNativeNetwork()`
normalisation before delegating. Deleting it would break the demo to save nine
lines.

**web's `SignPsbtOptions` stays.** Also on v2 §9.8's list, but web's version is
not rn's: it carries `signOptions?: BDKSignOptions`, a functional pass-through
to BDK. rn's was an empty placeholder. Nobody passes it today, but removing it
would delete capability rather than dead code. web's `crypto/signer.ts` as a
whole is live — `RlnSigner` imports from it.

**Pattern worth naming.** Four times now an entry on a "dead code" list turned
out to be load-bearing: `inflate` (the node supported it), `createBackup` and
`syncWallet` (scan false positives), `UtxoNetworkPreset` (§6.0h), and now these
two. A deletion list is a hypothesis; the consumer check is the verdict. Every
removal in steps 5, 6c and 6.0i was preceded by grepping implementations **and**
demos, not just the SDK sources.

Verification: core/web/rn `tsc` clean; 162 / 248 tests and 84 conformance checks
unchanged.

---

### 6.0j Step 6b.0 results — field helpers (DONE)

`src/conformance/field-checks.ts`, exported from
`@utexo/rgb-sdk-core/conformance`. 26 tests, core 162 → **188**.

| Helper | Purpose |
|---|---|
| `report(label, value)` | prints the full payload; `RGB_E2E_QUIET=1` silences it without touching scenarios |
| `expectFields(obj, spec, label?)` | presence, type, `nonEmpty`, `min`/`max`, `oneOf`, `pattern`, `each`; dot paths (`balance.settled`); returns the object so it inlines |
| `expectEach(arr, spec, label?)` | the same spec across every element, reporting the index |
| `expectNoWireKeys(obj, extra?, label?)` | wire-shape leak detection, recursive, cycle-safe |
| `HEX_32` / `HEX_PUBKEY` | txid and node-pubkey patterns |

**Runner-agnostic by design.** They throw plain `Error`s instead of using
Jest/Vitest matchers, because the same checks must run under Playwright (6b.2),
a bare Node script (rn), and a flow-runner screen in the RN demo (6b.3). Every
runner treats a throw as failure. Verified by importing the built subpath from
`rgb-sdk-web` and catching real failures.

#### One design change from §7a.2

`expectNoWireKeys` **auto-detects any snake_case key** rather than only checking
a supplied list. A fixed list cannot catch a *new* field that starts leaking —
which is precisely the regression this is meant to find. The named-key mode
remains for camelCase wire names that pattern-matching cannot see, such as
`LightningChannel.public` (domain name: `isPublic`).

```ts
expectNoWireKeys(channel);              // any snake_case, at any depth
expectNoWireKeys(channel, ['public']);  // plus named camelCase wire keys
```

#### Tests assert both directions

A verification helper that never fails is worse than none — it turns a green
suite into a lie. So every check is tested for what it **rejects**, not only
what it accepts: missing field, wrong type, empty string/array, out-of-bounds
number, non-canonical status (`'SUCCEEDED'` vs `'Succeeded'`), malformed txid,
leaked `pub_key` nested inside an array, and a cyclic object that must not hang
the walker.

---

### 6.0k Step 6b.1 results — e2e fixtures (DONE)

Both provisioning scripts now emit **`e2e-fixtures.json`** into their demo-app
root, next to `.env.local`:

- `rgb-sdk-web-demo/scripts/start-lsp-web.sh` → `rgb-sdk-web-demo/e2e-fixtures.json`
- `rgb-sdk-rn-demo/scripts/start-lsp-regtest.sh` → `rgb-sdk-rn-demo/e2e-fixtures.json`

**Separate JSON file, not more env vars — decided.** The env writers filter
stale entries by key prefix on every run, and the web script's own comments
document two bugs that filtering already caused (BSD-grep alternation, oldest-
duplicate-wins). Adding e2e keys would grow that surface; a JSON file is
`JSON.parse`-able by Playwright and the rn flow runner directly, and leaves both
`.env.local` writers byte-for-byte untouched (the additive constraint).

**Shared shape** (`platform` distinguishes the tracks):

| Key | web | rn |
|---|---|---|
| `generatedAt`, `platform`, `ASSET_ID`, `LSP_PUBKEY`, `FAUCET_PUBKEY` | ✓ | ✓ |
| `LSP_URL` / `FAUCET_URL` / `UTEXO_LSP_URL` | :3105 / :3108 / :8080 | :3005 / :3008 / :8080 |
| `LSP_PEER_PORT` / `FAUCET_PEER_PORT` (numbers) | 9745 / 9748 | 9737 / 9740 |
| `INDEXER_URL` | `http://127.0.0.1:3002` (esplora) | `127.0.0.1:50001` (electrs, no scheme — matches what `/unlock` takes) |
| `GATEWAY_URL`, `GATEWAY_WS_URL`, `TRANSPORT_URL` | ✓ | — (no gateway; node is in-process) |
| `VSS_URL` | only under `VSS=1` — **absent, not empty, otherwise** | — |
| `BRIDGE_URL` (:5000), `PROXY_ENDPOINT` (`rpc://…:3000/json-rpc`) | — | ✓ |

Implementation notes:

- **`FAUCET_PUBKEY` was not previously captured** by either script — both now
  fetch it from `/nodeinfo` after unlock (needed by scenario E, pay-from-Faucet).
- JSON is emitted via `jq -n --arg` (both scripts already hard-require jq), so
  values are escaped correctly by construction; the web block was dry-run with
  and without `VSS=1`.
- `stop` mode **deletes the fixture** in both scripts — a fixture describing a
  torn-down stack would point e2e at dead endpoints and produce confusing
  connection failures instead of a clear "run the script first".
- rn URLs stay `127.0.0.1` on purpose: the script's `adb reverse` forwards make
  them valid from inside the emulator unchanged.

~~Not run end-to-end: emitting the file requires bringing up the full docker +
cargo stack.~~ **Verified during 6b.2**: both a plain and a `VSS=1` provisioning
run produced the exact designed shape (`VSS_URL` present only in the latter).

---

### 6.0l Step 6b.2 results — web e2e (DONE)

`rgb-sdk-web/tests/e2e/` — Playwright + a minimal Vite harness page, run with
`npm run test:e2e` (`npm test` stays docker-free; jest ignores the directory).
**5 specs, all green in a single 37 s run** against the provisioned stack:
A (lifecycle + live conformance), B (on-chain/UTXO), C (RGB assets),
F (psbt/beginEnd carriers), F-vss (real backup, `VSS=1`).

#### Shape

- The harness aliases `@utexo/rgb-sdk-web` → **`dist/index.mjs`** — the suite
  tests the built artifact, not `src/`. Specs drive it through three generic
  page entry points (`boot` / `call` / `get` / `conformance`); every result
  crosses the page boundary as JSON in an `{ ok, value | error }` envelope, so
  page-side failures arrive with their message.
- Dot-path calls (`'psbt.signPsbt'`, `'beginEnd.createUtxosEnd'`) reach the
  carriers with no per-method glue.
- Port **5173 is load-bearing**: the gateway's CORS allowlist contains only
  that origin. `reuseExistingServer: false`, so a demo dev server on the port
  is an explicit error, not a silently wrong page.
- Funding/mining goes through the gateway's `POST /dev/regtest/fund` **from
  Node** — no docker exec, no CORS (§7a.1 held up).
- The §6.0f gap is closed: `runConformanceChecks` runs **in the page** with a
  collector `describe/it/expect` and `createWallet: () => liveWallet`, so
  `invoiceStatus` / `listChannels` / `listPayments` / `estimateFeeRate` are
  checked against live data. `createWalletSync` deliberately still gets a
  fresh un-initialised instance — the no-stub probes call carrier methods with
  no args, and on a live wallet `createUtxosBegin()` (all-optional params)
  would do real work.

#### The suite caught a real bug on its first run — §7a.2's exact prediction

**web `decodeRGBInvoice` returned the raw wire object** (`recipient_id`,
`asset_id`, `network: "Regtest"`) cast to `InvoiceData` — both branches ended
in `return raw as unknown as InvoiceData`. Type-level checks, §6.0f, and 248
unit tests all passed over it; the first live field assertion failed on it.
Fixed with `normalizeInvoiceData()` in `RlnWasmBinding.ts` (snake→camel,
network normalized to canonical lowercase, `assignment` through
`parseAssignment`, invoice string echoed from the request since the wire
payload does not include it).

#### Other findings

- **`estimateFeeRate` cannot estimate on fresh regtest** (no fee history), and
  the core conformance check treated any throw as failure. Relaxed in
  `core/src/conformance/index.ts` to the same contract as the invoiceStatus
  probe: a throw is acceptable, a malformed *result* is not. Core: 188 tests
  still green.
- **A single `syncWallet` after mining is a race** — esplora indexes the block
  asynchronously, so a PSBT built right after can select already-spent inputs
  (`bad-txns-inputs-missingorspent`). The helper `waitForColorable()`
  sync-polls until the wallet actually sees the expected colorable unspents;
  used by every on-chain scenario.
- **The wasm HTTP client needs an absolute VSS URL** — the vite-proxied
  `/vss` must be resolved against `location.origin` before it reaches the
  wallet (`HTTP error: builder error` otherwise). The demo's `resolveVssUrl`
  already knew this; the harness now does the same.
- `AssetBalance.future` is the projected **total**, not a pending delta — a
  fresh issuance reports `settled = future = spendable = issuedSupply`. (A
  first spec draft assumed `settled + future = supply` and was wrong.)

#### Environment notes

- The web stack and the rn regtest stack **cannot run simultaneously** — both
  claim :3000 (rgb proxy), :18443, :50001; an unrelated `cors-anywhere`
  container also sat on the gateway's :3001. Resolved with `docker stop`
  (state preserved) of `rgb-lightning-node-{proxy,electrs,bitcoind}-1` +
  `cors-anywhere`; `docker start` brings them back.
- New rgb-sdk-web devDeps: `@playwright/test`, `vite` + wasm/top-level-await/
  node-polyfills plugins (same major versions as the demo). Chromium installed
  via `npx playwright install chromium`.

---

### 6.0m Step 6b.3 results — rn e2e (DONE)

`rgb-sdk-rn-demo/e2e/` — scenarios A–E, **5/5 green in a 42 s run** against the
regtest stack on an Android emulator (`yarn test:e2e`, README in that
directory). The suite found **three real defects on its first run**, all fixed
below.

#### Shape

The §7a.5-recommended option: a **flow-runner screen** (`app/e2e.tsx`, outside
the tabs, reached by deep link) executes the scenarios in-app, and a host
script (`scripts/run-e2e-android.mjs`) turns the result into an exit code.
One wallet is shared across A–E — booting an RLN node and funding it is most of
the wall clock, and the later scenarios need what the earlier ones produce.
Assertions come from `@utexo/rgb-sdk-core/conformance`, so both tracks agree on
what a valid response is. Scenario A also runs `runConformanceChecks` against
the **live** rn wallet with the web harness's collector-runner pattern, closing
the §6.0f gap on this platform too.

#### Two design decisions from §6.0m recon did not survive contact

- **Markers travel over HTTP, not `adb logcat`.** Under the New Architecture
  (bridgeless, RN 0.81) `console.log` goes to the Metro dev server; only RN's
  own startup line reaches the `ReactNativeJS` tag. Verified empirically: a
  full run produced exactly one logcat line. The runner now serves a one-route
  sink on `:8099` which the app POSTs to at `10.0.2.2:8099` — which also
  removes logcat's ~4 kB per-line truncation and behaves the same in dev and
  release builds.
- **Fixtures travel in the deep link, not `EXPO_PUBLIC_*`.** Env vars are
  inlined into the bundle at build time, so a re-provisioned stack would need
  an app rebuild before the suite could see the new asset id and pubkeys. The
  host runner reads `e2e-fixtures.json` and passes it as a URI-encoded
  parameter; §6.0k's planned `FAUCET_PUBKEY` env addition is therefore not
  needed, and both `.env.local` writers stay untouched.

The rest of the recon held: the wallet lifecycle copied from
`runRLNUtexoPaymentFlow.ts`, the bridge for mine/send, `buildRegtestConfig()`,
and scenario E as a direct channel to the Faucet (`10.0.2.2:9740`) with
`pushMsat` so the Faucet can pay back over its REST API. URLs are rewritten to
`10.0.2.2` in-app rather than `adb reverse`d, which is what makes the peer
ports work unchanged.

#### The three defects — all the same class, all fixed

| # | Defect | Fix |
|---|---|---|
| 1 | `getNetworkInfo().network` returned the wire value `'Regtest'`, not the domain `'regtest'` | normalize in `toLightningNetworkInfo` |
| 2 | `decodeRGBInvoice().network` — same, and reached through a `r.network as BitcoinNetwork` cast over a value that never matched the type. `decodeLnInvoice().network` had it too (scenario E showed it; nothing asserted it yet) | normalize in `mapInvoiceData` + `toDecodedLnInvoice` |
| 3 | `issueAssetIfa` returned `Promise<any>` straight from the binding, while `listAssets().ifa` mapped the same asset through `mapAssetIfa` — one asset, two shapes | return `Promise<AssetIfa>` via the existing mapper |

Defects 1 and 2 are the §6.0l bug again: a cast where a normalizer belonged,
invisible to the compiler because both sides are `string`. The fix is a new
core helper — **`normalizeRlnNetwork` / `tryNormalizeRlnNetwork`**
(`src/rln/network.ts`, 7 tests), deliberately separate from
`normalizeNetwork` in `utils/validation`:

> `normalizeNetwork` validates **caller input**, where a mis-cased `'Mainnet'`
> is a config typo that must fail loudly (a test pins that). `normalizeRlnNetwork`
> normalizes **binding output**, where casing is just the binding's spelling
> convention — and it folds `SignetCustom → utexo`, `Bitcoin → mainnet`.

**web got the same normalization** (`RlnWasmBinding.normalizeInvoiceData`,
`RlnNodeBinding.normalizeNetworkInfo`). web was not visibly broken — its wasm
runtime happens to emit lowercase — but it was relying on that, and scenario A
asserts the value. Verified by `tsc` + 248 unit tests only; the web e2e could
not re-run because the rn stack holds the shared ports.

#### Scenario D — step 1b is finally proven

`issueAssetIfa` → `inflate` → mine → balance. `inflate` returned a real 64-hex
txid, settled balance went **500 → 750 (exactly the inflation amount)**, and
`listTransfers` reported `["Issuance", "Inflation"]`. §6.0c wired `rlnInflate`
and §6.0g proved it *compiles* on Android and iOS; this is the first time it
has *run*. The scenario also asserts `inflate` invents no `batchTransferIdx`
(the uniffi response carries none) and cross-checks the issued asset against
its `listAssets().ifa` entry — that cross-check is what pins defect 3.

#### One failure was the suite's own fault, not the SDK's

The first run asserted `issuedSupply` on the IFA response. IFA has no such
field — it models supply as `initialSupply` / `maxSupply` /
`knownCirculatingSupply` — so the assertion was wrong even though it pointed at
a real missing mapper. Worth stating plainly: **a red scenario is a hypothesis
about the SDK, not a verdict on it**, the same lesson §6.0e recorded for dead-code
lists.

#### Environment notes

- `start-lsp-regtest.sh` now **starts the regtest docker services itself** when
  they are down, instead of demanding `./regtest.sh start` first. It only does
  so when docker positively reports them down — `regtest.sh start` begins with
  `down -v`, so a false negative would throw away the chain and every wallet on
  it; an unreachable docker is an error, not a "probably not running".
- **`VSS=1` on the rn stack publishes vss-server on :8181, not :8081** —
  Metro owns :8081 here, so the container cannot bind and `regtest.sh`'s own
  VSS path fails with `address already in use`. Done with a compose overlay
  (`scripts/compose.vss-rn.yaml`, `ports: !override`) so the shared
  `rgb-lightning-node/compose.yaml` is untouched and web keeps :8081. `VSS_URL`
  lands in `e2e-fixtures.json` only when `VSS=1`, matching §6.0k.
- **The demo app does not typecheck** — 10 pre-existing errors, all
  `Property 'send' does not exist on type 'UTEXOWallet'` in
  `flows/**` and `app/(tabs)/utexo.tsx`. §2.3/§6.0 deleted the `send` trio and
  the demo was never migrated to `onchainSend`. Metro strips types so the app
  runs, and the e2e screen imports none of those files — but those flows will
  throw if a human taps them. Not fixed here: out of 6b.3's scope, and worth
  its own pass.
- iOS is not covered. The flow runner is platform-agnostic, but the host runner
  is `adb`-shaped; an iOS runner would need `xcrun simctl` and a different
  launch path.

#### Original recon (kept — still accurate for the parts that held)

What the implementation was built from, kept because it is where the pieces
live rather than a record of what was planned:

**Wallet lifecycle on rn** (copied from
`flows/payments/runRLNUtexoPaymentFlow.ts:44`):

```ts
const w = new UTEXOWallet(
  { storageDirPath,            // expo-file-system documentDirectory + suffix, strip 'file://'
    daemonListeningPort, ldkPeerListeningPort,
    network: 'regtest', enableVirtualChannelsV0: false },
  new PasswordRLNSigner(password, mnemonic)
);
await w.init();
await w.unlock(buildRegtestConfig().unlockParams);  // utils/env.ts
```

Fresh `storageDirPath` per run (timestamp suffix) is the demo's own trick —
same reason as web's fresh `dataDir`.

**Reusable demo plumbing — do not reinvent:**

| What | Where |
|---|---|
| mine / sendToAddress via bridge :5000 | `utils/bitcoin-node.ts` (`10.0.2.2` from Android — outbound to host needs no adb reverse) |
| regtest unlock params (indexer `…:50001`, proxy `rpc://…:3000/json-rpc`) | `utils/env.ts` `buildRegtestConfig()` |
| esplora-lag balance polling (`waitForAssetSpendable`) | `utils/flow-core.ts` — **esplora REST tip lags; single sync after mine is the same race web hit (§6.0l)** |
| step/result plumbing | `utils/flow-core.ts` (`createFlowResults`, exclusive-flow guard) |

**rn `UTEXOWallet` surface confirmed** (`src/wallet/utexo-wallet.ts`): `inflate`
(:586) and `issueAssetIfa` (:562) exist for scenario D; `connectPeer` /
`openChannel` / `createLightningInvoice` / `getLightningReceiveStatus` /
`listPayments` / `listChannels` for E; `getNodeInfo` / `getNetworkInfo` for A.

**Scenario E:** skip the utexo-lsp order flow — open a
**direct channel to the Faucet RLN** (`10.0.2.2:9740` from the emulator, pubkey
= fixture `FAUCET_PUBKEY`) with enough `push_msat` for the Faucet to have
outbound liquidity, then `createLightningInvoice` and have the Faucet pay it
via its REST API (`:3008`). Poll `getLightningReceiveStatus` → `Succeeded`.
Peer ports (9737/9740) are **not** adb-reversed and don't need to be —
`10.0.2.2` reaches the host directly.

---

### 6.0o Step 6b.4 results — scenario G, VSS round-trip (DONE)

`rgb-sdk-web/tests/e2e/g-vss.spec.ts`, `VSS=1`. Full web suite: **6 specs green
in 50 s**. **Step 7's prerequisite is met** — the restore half is now proven,
not assumed.

#### What it asserts

Issue asset → backup → issue a second asset → backup → dispose → **fresh
wallet, same mnemonic, empty `dataDir`** → `restoreFromVss()` in the
init→unlock gap → `listAssets` equals the pre-backup list, `getAssetBalance`
matches, and `ldkVssBackupInfo()` does not report the channel stream as still
owned elsewhere (the fence takeover the restore performs by default).

Observed: server version 1 → 2 across the two mutations, `restoreFromVss()`
returning `{ walletRestored: true, serverVersion: 3 }`, both asset ids back in
a wallet whose local storage never held them.

The harness gained one option — `boot({ restore: true })` inserts
`restoreFromVss()` between `init()` and `unlock()`, the only window the wallet
accepts a restore in.

#### Two findings for step 7 to reshape around

1. **`vssBackup()` races the automatic backup.** Every state-changing op calls
   `triggerAutoVssBackup()` fire-and-forget; an explicit `vssBackup()` right
   after a mutation fails with `VSS version conflict: Transaction could not be
   completed due to a possible conflict`. The Readme documents `vssBackup()` as
   "force an upload now" with no mention of the race, and the caller has no way
   to await the in-flight backup. Scenario G therefore observes the automatic
   backups through `vssBackupInfo` instead; F-vss still covers explicit backup,
   on a wallet that is not mutating.
2. **`disableVssAutoBackup()` disables explicit backup too.** It sets
   `vssAutoConfig = null`, and `vssBackup(config?)` falls back to exactly that
   field — so after disabling auto-backup, `vssBackup()` throws "VSS is not
   configured" unless the caller passes a config it has no public way to build
   (the derived config is private). The two carrier methods are mutually
   exclusive in practice.

Both are contract-shape problems, not crashes, which is precisely step 7's
subject — recorded here rather than patched, so the reshape can decide the
semantics deliberately.

#### One flake fixed, not papered over

Scenario F failed once mid-session on `beginEnd.sendBtcEnd` with
`bad-txns-inputs-missingorspent` — esplora's tip lag again (§6.0l). The
begin→sign→end round-trip now retries with a `syncWallet` before each attempt,
turning a race into a bounded wait; a genuine breakage still fails. The same
lag made the second issuance in G panic the wasm runtime (`RuntimeError:
unreachable` rather than a clean error — worth an upstream report), fixed by
confirming a block and waiting for the wallet's view between issuances.

---

### 6.0p Step 7 results — VSS reshaped to intent (DONE)

`IVssBackup` is gone. The contract now expresses **intent**, per §2.7:

```ts
// always-present, both platforms
backupNow(): Promise<number>;      // replicate now, returns the new version

capabilities = { psbtSigning, beginEndFlows }   // vssBackup flag deleted
```

Each platform covers however many state stores it has (§2.7a): web uploads its
rgb-lib wallet snapshot while the node's channel stream replicates on its own;
rn's node backs up its single store.

#### rn gained the surface it always could have had

`vss_backup()` was already in the uniffi API on both platforms and simply not
wired — the same situation `inflate` was in before step 1b. It now runs through
all five layers: `RgbModule.kt` · `RgbSwiftHelper.swift` + `Rgb.mm` ·
`NativeRgb.ts` → `IRLN.ts` → `RLNBinding.ts` → `rln-manager.ts` →
`backupNow()`. Verified on the emulator: **version 1 returned by the native
node**, first time `vss_backup` has ever executed from this SDK.

#### web keeps its extra VSS surface, off the contract

`vssBackupInfo`, `configureVssBackup`, `disableVssAutoBackup`,
`restoreFromVss`, `ldkVssBackupInfo`, `clearLdkVssFence` remain **web platform
extras** rather than carrier members. A carrier needs a capability flag
(invariant 2), and the flag is what this step deleted; `backupStatus()` cannot
join the always-present surface either, because rn's uniffi has no
`vss_backup_info` equivalent to answer it honestly. Parity there is an upstream
`rgb-lightning-node` change, not an SDK one.

#### Four defects fixed, all found by asserting instead of assuming

1. **`vssBackup()` on web always returned `0`.** `vssBackupJson()` serializes a
   bare number; the binding read `.version` off it and fell back to `0`. Every
   version this SDK ever reported was fabricated — invisible until scenario G
   compared the return value against `vssBackupInfo().serverVersion`. The
   fallback is now an error, not a zero.
2. **Explicit backup raced the automatic one** (`VSS version conflict`):
   mutations fire `triggerAutoVssBackup()` un-awaited. All backups now queue
   through one chain.
3. **`disableVssAutoBackup()` disabled explicit backup too** — and deeper than
   the SDK: it clears the *runtime's* VSS config, so `backupNow()` reconfigures
   before uploading. Disabling the schedule is not disabling backup.
4. Scenario F's begin/sign/end round-trips now retry with a resync — the
   esplora tip lag of §6.0l, hit twice more.

Green after the reshape: core 195 tests · web 245 unit + **6/6 e2e** · rn 81
contract checks + **5/5 e2e**.

---

### 6.0q Step 6b.5 results — scenario H, device loss (DONE, both platforms)

The scenario that proves backup is real: a wallet killed **mid-life, with a
channel open**, restored elsewhere, and the restored channel then closed.

| | rn (`e2e/scenarios/h-restore.ts`) | web (`tests/e2e/h-restore.spec.ts`) |
|---|---|---|
| the "device" | `shutdown()` + delete the storage dir | close the **browser context** (empty IndexedDB, fence still held) |
| the restore | implicit — the node pulls from VSS when the wallet dir is absent | `init()` → `restoreFromVss()` → `unlock()` |
| runtime | 83 s | 46 s |

**rn, measured:** node pubkey identical, btc spendable identical
(99 736 634), asset 400 → 400, transfers 1 → 1, transactions 3 → 3, channel
`8268b4…03b6` back with the same capacity **and the same 52 013 000 msat local
balance** — the channel opened at 49 013 000 and an invoice moved 3 000 sats in,
so a restore that dropped the last HTLC would still have looked plausible. The
restored channel was then closed and the funds returned on-chain (99 736 634 →
99 786 602).

**web, measured:** same pubkey, btc 100 162 715 identical, asset 400, channel
`53e948…e460` back with 46 000 000 msat local (50 000 000 pushed by the Faucet
minus a 3 000-sat payment out and fees), reconnected, closed, funds back
on-chain. Full web suite: **7/7**.

Three things this scenario forced into the open:

- **The restored wallet must dial the peer itself.** It has the channel but not
  the peer's *address* — that lived in the dead device's peer store. Without an
  explicit `connectPeer`, the channel never becomes `isUsable` and a
  cooperative close fails (`conflict with current node state` on rn).
- **Storage identity is part of the restore.** The web harness minted a fresh
  `dataDir`/`nodeRuntimeId` per boot, so the "restored" wallet came up as a
  *different node*. Restoring means the same app on a new device: same mnemonic
  **and** same storage identity, empty profile.
- **`vssAllowEmptyRestore` must be `false`** on the restoring node — `true`
  turns a failed restore into a silent fresh start, which would let the whole
  scenario pass with an empty wallet.

---

### 6.0r `openChannel` and the declared-but-dropped parameter class

Scenario H could not open a channel from the browser at all. Two causes, both
worth recording because they are permanent platform facts, not bugs:

1. **The wasm node's `openChannel` takes five arguments** — peer pubkey,
   capacity, public, asset id, asset amount. There is no `push_msat`,
   `with_anchors`, fee override or `temporary_channel_id`; `virtual_open_mode`
   exists only on an `…WithOptions` variant and is in any case a **node-wide**
   setting on web (`enableVirtualChannels` at init), not a per-channel one.
   The contract declared all of them and web silently dropped six — a §2.5
   violation the original sweep missed because it compared *signatures*, not
   what the bodies do with them.
2. **`openChannel` on web is only phase one of a two-phase flow — and our SDK
   never exposed phase two.** The wasm node *can* open channels (upstream's own
   `bindings/wasm-sdk/e2e-specs/helpers/flow.js` does it), but it does not fund
   them for you:

   ```
   connectPeer → openChannel → listPendingFundingRequests   // FundingGenerationReady
               → buildLightningFundingTx (BDK builds + signs)
               → submitFundingTransaction  → FundingCreated → ready
   ```

   `rgb-sdk-web` wired **none** of the last three, so `wallet.openChannel()`
   started a channel that could never complete — it sat at `ready: false,
   localBalanceMsat: 0`, which is exactly what scenario H first hit.
   **Now wired; the end-to-end open passed three times on 2026-07-23 but is
   not yet declared fixed — see §6.0s.1/§6.0s.2 before relying on it.**
   (`RlnWasmBinding` → `RlnWalletManager` → `UTEXOWallet`), with
   `PendingFundingRequest` / `BuildFundingTxParams` / `FundingTx` /
   `SubmitFundingParams` as **web-local** types — rn's node funds internally and
   needs none of it. `listPendingFundingRequests` also drives the runtime
   (`chainSyncTick` + `processNativeRuntimeQueue`) the way `listChannels`
   already does: the wasm node has no background executor, so a read path that
   does not pump never sees the event.

3. **Who opens the channel is a property of the stack, not the SDK.** With the
   handshake wired, a wallet-initiated open still fails here — the Faucet logs
   `Rejected inbound channel … unsupported_scid_alias`. Both RLN daemons in
   `start-lsp-web.sh` run with `--enable-virtual-channels-v0` (line 242), and
   such a node requires an SCID alias the wasm open does not negotiate.
   Upstream's wasm e2e works because it runs against a **regular** RLN.

   So scenario H keeps the Faucet-opens topology (`POST /openchannel`), which
   is also what `rgb-sdk-web-demo`'s regular-channel flow does — the gateway
   relay is outbound-only, so the browser dials first and the native side opens
   over that session. A peer without virtual channels now exists in the stack
   (`regular_web`, §6.0s) and scenario I opens against it — **green three times
   on 2026-07-23, but see §6.0s.1/§6.0s.2 before relying on it.**

   *(An earlier draft of this section said "the counterparty must open" as if it
   were a platform limit — wrong on two counts, and worth recording: the wasm
   can open channels, and what actually blocks it here is a node **flag**. The
   claim came from one failed attempt plus a comment in the demo, without
   looking for a positive example. There was one, upstream.)*

**Fix:** `OpenChannelParams` in core now holds only the five fields both
platforms honour. rn widens it **locally** with its own extras
(`pushMsat`, `withAnchors`, the fee overrides, `temporaryChannelId`,
`pushAssetAmount`, `virtualOpenMode`) — core keeps the intersection, each SDK
expands it, the same rule §6.0 set for platform extras.

#### The class, swept — and the sweep corrected itself

A first pass compared every params interface in core against both SDKs' sources
and flagged 15 fields. **Six were the checker's fault**, and finding that out
mattered more than the list:

- `LspLnParams.descriptionHash` / `.minFinalCltvExpiryDelta` **are** honoured —
  by `snakeCaseLnParams` in **core itself** (`UtexoLSPClient.ts`). The sweep
  only read the SDKs. A field consumed by core is honoured for both platforms.
- `LightningReceiveRequest.expiresAt`, `LightningSendRequest.consignmentEndpoint`,
  `RestoreWalletRequestModel.backupFilePath`, `UTEXOWalletCreateParams.*` are
  **response or construction models**, caught only because their names end in
  `Request`/`Params`. Response models are supersets by design (§ `model.ts`
  header) — a platform not populating an optional field is not a defect.

The check now walks `src/interfaces/` for types actually used **as a parameter**
on the contract (22 of them) and counts a core-side reference as honoured.

#### The four real findings, resolved

| Field | Verdict |
|---|---|
| `OpenChannelParams` ×6 | **moved to rn-local extras** — no wasm argument exists |
| `IssueAssetIfaRequestModel.replaceRightsNum` | **deleted — superseded upstream.** rgb-lib **v0.3.0-beta.2** took `replace_rights_num: u8` and no reject list; the node builds against **tag v0.3.0-beta.27**, where that parameter is gone and `reject_list_url` took its place. REST (`IssueAssetIFARequest`), uniffi and wasm all take the same six: ticker/name/precision/amounts/inflation_amounts/reject_list_url. The field could not be honoured by any layer of this stack |
| `VssBackupConfig.encryptionEnabled`, `.autoBackup` | **deleted** — never set, never read; encryption is always on in the runtime and the schedule is the SDK's own concern |
| `VssBackupConfig.backupMode` (+ `VssBackupMode`) | **deleted** — core *set* it in `buildVssConfigFromMnemonic` and no binding ever read it; a unit test was pinning the dead value |

`rejectListUrl` stays on the shared model, because the fix below made web
honour it.

#### The finding underneath: web's `issueAssetIfa` was issuing a CFA

Chasing `rejectListUrl` turned up something worse. `RlnWasmBinding.issueAssetIfa`
called **`issueAssetCfaValue`** and reshaped the result into an `AssetIfa`
("best-effort mapping"), silently dropping `ticker`, `inflationAmounts` and
`rejectListUrl` — and producing an asset with **no inflation rights**, which
`inflateBegin` could never inflate. The wasm node has had `issueAssetIfaValue`
all along, taking the same six arguments as rn's uniffi call.

This is the §6.0f blind spot made concrete: a method that exists, resolves,
returns a plausibly-shaped object, and is wrong. No stub probe catches it,
because nothing throws.

Fixed to call `issueAssetIfaValue`, with a real `RlnRawAssetIfa` mapper. Proven
live — a new spec in `c-assets.spec.ts` issues an IFA on web and asserts
`initialSupply: 500`, **`maxSupply: 1000`** (i.e. the inflation rights were
requested), `knownCirculatingSupply: 500`. A CFA has none of those fields.

**`listAssets` now maps IFA too** (`normalizeListAssets` hard-coded `ifa: []`,
while the call already asks the wasm for `['Nia','Ifa']`). That fix is correct
but **does not surface the asset**: an IFA issued through the node stays
invisible to `listAssets()` on web — every schema array comes back empty, and
`syncWallet` + `refreshWallet` do not change it — while a NIA issued through
the *same* node handle appears immediately. That asymmetry is below the SDK
(rgb-lib/wasm), so the cross-check rn's scenario D performs is parked as a
`test.fixme` in `c-assets.spec.ts`: visible as pending in every run, never a
silent pass. rn has no such gap.

#### iOS — compiled, not just codegen-checked

§6.0g verified `rlnInflate` on iOS by matching the codegen output against
`Rgb.mm`. The `vssBackup` wiring from step 7 got a **real build**:
`xcodebuild -workspace myapp.xcworkspace -scheme myapp -sdk iphonesimulator`
→ **BUILD SUCCEEDED**, with `rlnVssBackup` present in `RgbSpecJSI.h`,
`RgbSpecJSI-generated.cpp` and the method map. The Swift helper and the
ObjC bridge both compile.

#### The demos were not evidence of the current API

At the time of this finding, `rgb-sdk-web-demo` depended on the **published**
`@utexo/rgb-sdk-web@1.0.0-beta.10` rather than the local source, so it compiled
against the pre-v3 API — which is why its `connectPeer(addr, pubkey)` looked
authoritative and was not. `rgb-sdk-rn-demo` linked locally but carried 10
`wallet.send(...)` type errors from the §2.3 deletion. **Both have since been
migrated — §7b.5.** What the web demo proved even while stale is *stack*
behaviour (relay direction, who opens a channel), which is independent of the
SDK version.

---

### 6.0s scenario I (wallet-funded channel) — did not reproduce; the instrument was broken

**Read this before touching `i-funding.spec.ts` or the funding methods.**

> **2026-07-23 update.** Scenario I passed **three times in a row** from the
> demo (cold wallet and warm, two different chains), each verified on-chain.
> The reason it looked unrepeatable is recorded in §6.0s.1: the assertion that
> was supposed to prove the funding tx had been broadcast **could never fail**,
> so the original diagnosis rested on a measurement that did not measure. The
> "what was tried" list below is kept as history — but read §6.0s.1 first,
> because parts of it were reasoning from a broken instrument. Not yet declared
> fixed: see §6.0s.2 for what would settle it.

#### What is done and green

- **Third daemon added to the web stack.** `start-lsp-web.sh` now takes
  `VIRTUAL_CHANNELS=0` per call and starts `regular_web` — REST **:3110**,
  peer **:9750**, *without* `--enable-virtual-channels-v0` — because a node
  with that flag rejects a wasm-initiated open (`unsupported_scid_alias`).
  Its `REGULAR_PUBKEY` / `REGULAR_URL` / `REGULAR_PEER_PORT` are in
  `e2e-fixtures.json`; `stop` kills it. Verified working.
- **The funding handshake is wired** in `rgb-sdk-web` (binding → manager →
  wallet): `listPendingFundingRequests`, `buildLightningFundingTx`,
  `submitFundingTransaction`, with web-local types in `src/rln/index.ts`.
- Everything else in the suite is green: **7 specs pass**, 1 skipped
  (the IFA-`listAssets` upstream gap).

#### What is NOT working — the open issue

`tests/e2e/i-funding.spec.ts` **passed exactly once** (fresh stack, 17:08) and
has failed every run since. The failure is always the same:

```
regular_web log:  Accepted inbound channel …
                  Channel … is pending awaiting funding lock-in!     ← stops here
spec:             Error: the funded channel must become ready
```

**These parts work on every run** (do not re-debug them):

| Step | Evidence |
|---|---|
| `openChannel` | returns a `temporaryChannelId` |
| `listPendingFundingRequests` | correct `outputScriptHex`, `channelValueSat: 100000`, right counterparty |
| `buildLightningFundingTx` | valid signed tx + well-formed txid |
| `submitFundingTransaction` | peer logs `Accepted inbound channel` → FundingCreated/FundingSigned completed |

**The failure is the funding transaction never confirming.** In the runs before
the broadcast fix, esplora returned `Transaction not found` for the txid — not
even in the mempool.

#### What was tried

1. **Pumping the runtime in the new read path** — `listPendingFundingRequests`
   calls `chainSyncTick` + `processNativeRuntimeQueue` (upstream's
   `pumpRuntime` does both). Necessary, not sufficient.
2. **Draining the native runtime queue in the shared drive beat** —
   `RlnNodeBinding.driveRgbWorkBestEffort` now also calls
   `processNativeRuntimeQueueValue()`, so every `listChannels` flushes it.
   Did not fix it.
3. **Explicit broadcast** — the wasm docs are explicit that
   `buildLightningFundingTx` *builds but does not broadcast*, and that the
   caller must "trigger a broadcast (LDK's chain interface, or an out-of-band
   relay)". `submitFundingTransaction` now also calls
   `chainSyncEnqueueRebroadcastTx(txid, hex)` when a `txid` is supplied.
   Still fails.

#### Where to start tomorrow

- **Prove the broadcast independently.** Take the `funding_tx_hex` from a failed
  run and POST it to esplora (`:3002/tx`) or bitcoind directly. If it is
  accepted, the tx is valid and only the broadcast path is broken; if it is
  rejected, the tx itself is wrong (most likely stale-view input selection —
  the §6.0l race, which would also explain why the one passing run was on a
  freshly provisioned chain).
- **Compare against upstream's working flow**
  (`bindings/wasm-sdk/e2e-specs/helpers/flow.js::fundChannelAndWaitForReady`).
  It broadcasts via its **regtest controller**, not through the SDK — so the
  simplest green path may be for the spec to broadcast out-of-band (the gateway
  has `dev/regtest/*` helpers) and keep the in-SDK enqueue as a convenience.
- **Also unexplained:** in a *full-suite* run both H and I failed, while H
  passes alone and in an H+I pair. H's full-suite failure has not been
  diagnosed at all — check it separately before assuming the two are related.

#### Honest note on the earlier claim

§6.0r was updated mid-session to say the wallet-initiated path "works, verified
live". That was based on **one** passing run and was overstated — corrected
here. The three methods do what they say; the end-to-end channel open is not
yet repeatable.

---

### 6.0s.1 What the 2026-07-23 session found

A repro was built into `rgb-sdk-web-demo` — **"Wallet-funded open"** on the
regular-channel page (`useRegularChannelFlow.runWalletFundedOpen`) — so the
scenario can be driven by hand, in a browser, without Playwright. It runs the
same sequence as `i-funding.spec.ts` against `regular_web`, and when the funding
tx does not reach the indexer it POSTs the identical hex straight to esplora to
split "invalid tx" from "broken broadcast".

**The broadcast assertion never asserted anything.** `i-funding.spec.ts` polled
`GET /tx/<txid>/status` and treated `r.ok` as "the tx exists". Esplora answers
that endpoint with **HTTP 200 `{"confirmed":false}` for a txid that has never
existed** — verified directly against the regtest indexer with 64 zeros as the
txid. So the poll labelled *"the funding tx must be broadcast"* passed instantly
on every run, broadcast or not. Presence must be read from `GET /tx/<txid>`,
which 404s on an unknown txid. Fixed in the spec and in the demo helper
(`indexerTxSeen`), both of which now also distinguish mempool from confirmed.

This matters for the history above: the note that esplora "returned
`Transaction not found` … not even in the mempool" cannot have come from that
assertion, and the failures attributed to a missing broadcast were diagnosed
with an instrument that always read "present".

**Three green runs, verified on-chain, not from the log:**

| run | wallet | funding tx | result |
|---|---|---|---|
| 11:55 | warm (after the full flow) | block 192, 2 inputs, 312 B | ready ✓ |
| 12:07 | cold (create → fund → open) | block 172, 1 input, 205 B | ready ✓ |
| 12:13 A | cold | block 196, 2 inputs, 312 B | ready ✓ |

Each confirmed against `regular_web`'s `/listchannels` **and** the indexer, so
the pass does not depend on the demo's own reporting.

**The cold/warm experiment was confounded — and that is worth remembering.**
The point of a cold run was to test the stale-view input-selection theory
(§6.0l): cold fails + warm passes would have confirmed it. But the stack was
restarted between the warm and cold runs (to pick up the new `VITE_REGULAR_*`
env), which reset the chain — tip went *backwards* 198 → 179 and the warm run's
txid started returning 404. So the cold run landed on a freshly provisioned
chain, exactly the condition §6.0s says has always passed. Cold wallet and
fresh chain moved together; the run cannot separate them. **Any future
cold/warm comparison must not restart the stack**, or it proves nothing.

**Every failure observed in the session was in the repro code, not the SDK:**

1. *"peer handshake did not complete within timeout"* on a second run —
   `runWalletFundedOpen` called `connectPeer` unconditionally. Dialling an
   already-connected peer does not no-op, it hangs. Every other flow in that
   file already routes through an `ensureXConnected` guard that checks
   `listPeers` first; this one did not. Now `ensureRegularConnected`.
2. *A run reporting "ready ✓" after a single poll* — `waitFundedChannelReady`
   matched on `peerPubkey`, so a second run latched onto the **first** run's
   already-ready channel. Now matches on `fundingTxid`
   (`LightningChannel.fundingTxid`), falling back to pubkey only when absent.
3. The `/status` assertion above.

**One channel left `ready: false`, and it is not evidence of a stall.** Run B's
funding tx confirmed (block 196) and still showed `ready: false` at 7
confirmations. That run had exited early on bug 2 — and once the flow stops
polling, nothing drives the wasm node, which has no background executor and so
never notices the confirmations or sends its `channel_ready`. Starvation, not a
stall. The general rule this reinforces: **on web, a channel that is not being
polled is a channel that is not progressing** — the same fact §2.7a states about
two engines, showing up in the funding path.

#### 6.0s.2 What would actually settle it

Three greens are not a fix, and this section should not be closed on them:

- All three ran on chains younger than ~200 blocks. Not one failure has yet been
  observed *with correct instrumentation*, so there is no confirmed cause — only
  a scenario that stopped reproducing.
- **Run `i-funding.spec.ts` now that its assertion is real.** Until this session
  the spec could pass its broadcast check while the tx was absent; whatever it
  reports now is the first trustworthy signal from the suite.
- **Run the full suite.** §6.0s records that H and I both failed in a full-suite
  run while H passes alone and in an H+I pair. That is still undiagnosed, and it
  is the most likely place a real defect is hiding.
- If a cold/warm comparison is repeated, do it **without restarting the stack**,
  and use "Clear wallets & reload" to reset the wallet while keeping the chain.

The demo button is the cheap path for all of this: `rgb-sdk-web-demo` →
regular-channel page → **Wallet-funded open**, labelled `COLD` on a fresh tab
and `warm` once a wallet exists. Each poll logs the full `listChannels` with the
tracked channel starred, so which channel moved is visible rather than inferred.

---

### 6.1 No releases until verified — local linking

**Decision:** nothing is published while this lands. All three SDKs consume each
other from disk:

```jsonc
// rgb-sdk-web/package.json, rgb-sdk-rn/package.json
"dependencies": {
  "@utexo/rgb-sdk-core": "file:../rgb-sdk-core"
}
```

Consequences that make this plan *cheaper* than the first draft assumed:

- **No deprecated alias needed.** Step 3 originally kept the old `IUTEXOWallet`
  for one release of overlap. With no releases there is no external consumer to
  protect — make the break clean and delete in the same pass. (Removed from
  step 3 above.)
- **No semver pressure.** At `0.1.0` with local linking, steps 3–5 can be one
  atomic change across three repos.
- **Verification gate:** publish only when core `tsc` + tests, web, RN, and the
  conformance suite (§7) all pass against the linked build. Run `npm run build`
  in core first — `file:` deps resolve `dist/`, not `src/`, so a stale `dist`
  silently tests old code. Consider `npm run dev` (tsup watch) during the work.

---

## 7. Conformance — make the rule enforceable

v2 step 6 is still outstanding and v3 gives it a sharper job. The suite must
assert **capability honesty**, since types alone cannot:

> For every method on every optional group: if `capabilities.<group>` is `true`,
> calling the method must not throw `not implemented`. If `false`, the method
> must be absent from the object.

That test is what actually prevents a regression to stubs. Without it, v3 is a
convention; with it, it's enforced.

Also fold in the RLN version lock from v2 §10 — fail CI if web's `rln-wasm` and
RN's bindings versions diverge.

---

## 7a. E2E proposal — flows + field verification

The type layer and the runtime conformance suite (§6.0f) both stop at the same
wall: they check *shape*, never *behaviour against a real node*. Two gaps remain
open because of it — `runConformanceChecks` runs on an un-initialised wallet,
and `rlnInflate` is proven by compilation only.

### 7a.1 The stack already exists — this is cheaper than it looks

An earlier assessment in this plan assumed the WebSocket gateway web needs was
missing. **It is not.** The demo scripts bring up a complete provisioned
regtest environment:

| Provided by `rgb-sdk-web-demo/scripts/start-lsp-web.sh` | Port |
|---|---|
| bitcoind · electrs · rgb-proxy · esplora (`compose.wasm.yaml`) | 18443 · 50001 · 3000 · 3002 |
| **`wasm-proxy-gateway`** — LN P2P over WS + RGB JSON-RPC + regtest funding | 3001 |
| RLN node “LSP” (peer 9745) | 3105 |
| RLN node “Faucet” (peer 9748) | 3108 |
| `utexo-lsp` | 8080 |
| `vss-server` + postgres — **opt-in with `VSS=1`** | 8081 |

It does not merely start services: it funds both nodes, creates UTXOs, issues an
RGB asset, seeds the LSP with it, and writes the resulting IDs to `.env.local`.
That is a **provisioned fixture**, which is normally the expensive half of an
e2e harness.

`rgb-sdk-rn-demo/scripts/start-lsp-regtest.sh` and `start-lsp-local.sh` do the
equivalent for rn, which needs no gateway — its node runs in-process via UniFFI
(§2.7a).

The gateway exposes `POST /dev/regtest/funding-tx`, so tests can fund and mine
over **HTTP** rather than shelling into docker — the test stays ordinary JS.

Prior art to copy rather than invent: `rgb-lightning-node/bindings/wasm-sdk/`
already ships `e2e-specs/*.spec.js` (native channel, page reload, websocket
disconnect) driven by `scripts/ci/wasm_regular_rln_e2e.sh`. Same pattern,
pointed at the raw wasm SDK instead of our `UTEXOWallet`.

### 7a.2 Field verification is the point, not a side effect

**Every assertion must check the response's fields, not just that the call
resolved.** This is the class of bug the whole migration was about: a method
that exists, returns, and is wrong. `listChannels()` returning `[]` proves
nothing; `listChannels()` returning objects with a wire-shaped `public` key
instead of `isPublic` is exactly the drift §6.0f's `listChannels` check was
written to catch — and it only fires when a channel actually exists.

Minimum bar for every scenario:

```ts
// Not enough:
const info = await wallet.getNodeInfo();
expect(info).toBeDefined();

// Required — every field named, typed, and non-empty where it must be:
const info = await wallet.getNodeInfo();
report('getNodeInfo', info);              // always console.log the payload
expectFields(info, {
  pubkey:          { type: 'string', nonEmpty: true },
  numChannels:     { type: 'number' },
  blockHeight:     { type: 'number', min: 1 },
  network:         { oneOf: ['regtest', 'testnet', 'mainnet', 'utexo'] },
});
expectNoWireKeys(info, ['pub_key', 'num_channels', 'block_height']);
```

Three helpers carry this, and should live in core so both SDKs share them:

- `report(label, value)` — pretty-prints the full payload. Even where an
  assertion is not yet written, the log makes an unexpected shape visible in CI
  output. This satisfies the “at minimum console.log” bar.
- `expectFields(obj, spec)` — presence, type, non-emptiness, ranges, enums.
  Fails with the field name, not a diff dump.
- `expectNoWireKeys(obj, keys)` — asserts snake_case/wire leftovers are absent.
  A mapper that silently passes through raw binding output is the single most
  likely regression, and it is invisible to `toBeDefined()`.

### 7a.3 Scenarios — modelled on the rn demo, headless

`rgb-sdk-rn-demo` already enumerates the flows worth covering
(`app/(tabs)/flows.tsx`, `utexo.tsx`, `lsp.tsx`). Headless is fine; these are
SDK-level, not UI.

**A. Lifecycle & node** (`flows.tsx`: Create/Init/Unlock Node, Node Info,
Network Info)
`init` → `unlock` → `getNodeInfo` → `getNetworkInfo` → `isDisposed` → `dispose`.
Verify: `pubkey` non-empty, `blockHeight` > 0, network matches config.
**Also asserts `capabilities` against the live object** — closing the
`createWallet` gap §6.0f left open.

**B. On-chain & UTXO** (`flows.tsx`: Address, Fund Address, BTC Balance, Create
UTXOs; `utexo.tsx`: Fund, UTXOs)
`getAddress` → fund via gateway → mine → `getBtcBalance` → `createUtxos` →
`listUnspents`.
Verify: address non-empty and network-correct; `vanilla`/`colored` each with
`settled`/`future`/`spendable` as numbers; balance actually increases; unspents
carry a parsed `utxo.outpoint.txid` + numeric `vout` — **not** the raw
`"txid:vout"` string the binding returns.

**C. RGB assets** (`flows.tsx`: Asset Balance, Decode RGB Invoice, Fail
Transfers)
`issueAssetNia` → `listAssets` → `getAssetBalance` → `blindReceive` →
`decodeRGBInvoice` → `listTransfers`.
Verify: `assetId`, `ticker`, `precision`, `balance.*`; invoice decodes back to
the same `assetId`; transfer `status` is in the canonical vocabulary and `kind`
is a known `TransferKind`.

**D. IFA + inflation** — *the scenario that closes step 1b*
`issueAssetIfa` → `inflate({ assetId, inflationAmounts })` → mine →
`getAssetBalance`.
Verify: `txid` non-empty and 64 hex chars; balance rises by exactly the
inflation amount. **This is the only proof that `rlnInflate` works rather than
merely compiles**, and it must run on rn — web reaches inflation through the
`beginEnd` carrier instead.

**E. Lightning** (`flows.tsx`: List/Connect/Disconnect Peer, Open/Close Channel,
List Payments; `utexo.tsx`: Channel, Payments)
`connectPeer(LSP)` → `openChannel` → mine → `listChannels` →
`createLightningInvoice` → pay from Faucet → `getLightningReceiveStatus`.
Verify: channel `channelId`, `capacitySat`, `ready`, `isPublic` — and **no
`public`/`isActive` wire keys**; status values are canonical
(`Succeeded`, not `SUCCEEDED` or `Paid`).

**F. Carrier reality** — web only
`wallet.psbt.signPsbt(...)`, `wallet.beginEnd.createUtxosBegin(...)`,
`wallet.vss.vssBackup(...)` each perform real work. §6.0f proves they are not
stubs; this proves they succeed.

**G. VSS round-trip** — web, requires `VSS=1`. **Prerequisite for step 7.**
`configureVssBackup` → mutate state → `vssBackup` → `vssBackupInfo` → fresh
wallet → `restoreFromVss` → assert state returned.
Verify: `backupExists`, `serverVersion` increments, restored asset list equals
the pre-backup list. Reshaping VSS to an intent-based contract without this
is changing backup semantics blind.

**H. Backup survives device loss** — *the scenario that proves backup is real*
— web (`VSS=1`) and rn.

G proves a round-trip on a quiet wallet. H proves it on a wallet in the middle
of its life, and destroys the device **while a channel is open** — the case
where a lost backup costs money rather than convenience.

1. Fund on-chain from the Faucet, `createUtxos`, issue an asset — verify fields
   as scenarios B/C do.
2. `connectPeer(Faucet)` → `openChannel` with `pushMsat` → wait ready → verify
   channel fields; settle at least one invoice so value has actually moved
   **off-chain** and the channel balance is not the opening balance.
3. Snapshot everything a user would notice: btc balance, asset balances,
   `listTransfers`, `listTransactions`, `listChannels`.
4. **Destroy the wallet with the channel still open, without a clean
   shutdown.** web: close the browser *context* — a new context is a new
   profile with empty IndexedDB, and the dead tab still holds the VSS fence,
   which is exactly the state a lost device leaves behind. rn: `destroy()` and
   boot the next node on a **fresh `storageDirPath`**.
5. Restore. web: `init()` → `restoreFromVss()` (takes the fence over) →
   `unlock()`, which is where channel state comes back. rn: nothing to call —
   the node restores automatically when the local wallet dir is absent and VSS
   has a backup (`maybe_restore_rgb_from_vss`, `ldk.rs`). **`vssAllowEmptyRestore`
   must be `false` here**: it turns a failed restore into a silent fresh start,
   which would make this scenario pass with an empty wallet.
6. Verify the snapshot matches — balances, transfers, transactions, and
   **`listChannels`: same `channelId`, capacity, and the balances that were
   moved off-chain**.
7. Close the channel from the restored wallet and assert the funds come back
   on-chain. A restored channel that cannot be closed is not a restored
   channel.

### 7a.4 Runtime feasibility — checked, and it splits the work in two

Before planning sub-steps, two facts were verified rather than assumed. They
decide the shape of the whole suite.

**web cannot run headless in Node.** `@utexo/rln-wasm` is a wasm-bindgen **web**
target, and its snippets call `indexedDB` directly as a global
(`snippets/…/inline1.js` → `indexedDB.open("rln_wasm_sdk_runtime", 1)`), plus
`new WebSocket`. There is no injection point. Running it under Node would mean
polyfilling IndexedDB and fighting the build target on every upgrade.
**→ web e2e runs in a real browser, driven by Playwright** — which is also what
`rgb-lightning-node/bindings/wasm-sdk/e2e-specs/` already does.

**rn cannot run headless in Node either, for the opposite reason.** Its wallet
talks to a TurboModule; the `react-native` stub in `scripts/rn-stub-loader.mjs`
is enough to inspect carriers and `capabilities` (§6.0f) but by construction
cannot execute a single native call. **→ rn e2e needs an emulator or device.**
Encouragingly, `rgb-sdk-rn-demo`'s android script already runs
`adb reverse tcp:3000 … tcp:3005 … tcp:5000`, so reaching a host-side regtest
stack from the emulator is already solved.

So 6b is **two tracks with different costs**, not one suite. The shared part —
the field-verification helpers — is platform-agnostic and can be built first,
independently of either.

### 7a.5 Sub-steps

| # | Deliverable | Depends on | Cost |
|---|---|---|---|
| **6b.0** | Field helpers in core + unit tests | — | low |
| **6b.1** | Machine-readable fixtures from the demo scripts | — | low |
| **6b.2** | web e2e — Playwright, scenarios A–C, F | 6b.0, 6b.1 | medium |
| **6b.3** | rn e2e — emulator, scenarios A–E incl. **D (inflate)** | 6b.0, 6b.1 | medium-high |
| **6b.4** | Scenario G (VSS round-trip), `VSS=1` | 6b.2 | medium |
| **6b.5** | Scenario H (device loss with channels open), both tracks | 6b.3, 6b.4 | medium-high |

**6b.0 — field helpers.** `report`, `expectFields`, `expectNoWireKeys` (§7a.2)
in `@utexo/rgb-sdk-core/conformance`, with their own unit tests in core. Pure
functions, no stack required. Do this first: it is the piece both tracks share,
it is cheap, and writing it early forces the assertion vocabulary to be decided
before any scenario is written.

**6b.1 — fixtures.** The scripts currently log for humans. Emit a stable
`.env.local` (or `--json`) with `ASSET_ID`, `LSP_PUBKEY`, `FAUCET_PUBKEY`, node
URLs, gateway URL and ports. Small change to
`rgb-sdk-web-demo/scripts/start-lsp-web.sh` and
`rgb-sdk-rn-demo/scripts/start-lsp-regtest.sh`. Both tracks read the same shape.

**6b.2 — web track.** Playwright drives a minimal harness page that imports the
**built** `rgb-sdk-web` and exposes the wallet on `window`; specs then call
through it and assert with the 6b.0 helpers. Model on
`bindings/wasm-sdk/e2e-specs/*.spec.js`. Scenario F (carrier reality) belongs
here — web is the platform that has all three carriers. Feeds `createWallet`
into `runConformanceChecks`, closing the §6.0f gap.

**6b.3 — rn track.** Needs a device/emulator. Two options, and the choice is a
real decision, not a detail:
- *Detox/Maestro* driving `rgb-sdk-rn-demo` — heavier setup, but tests the SDK
  exactly as an app uses it.
- *A headless "flow runner" screen* in the demo that executes a scenario list
  and prints structured JSON, scraped by the CI. Much cheaper; the demo's
  `flows.tsx` is already 90% this.

The second is recommended for the first pass. **Scenario D belongs here and
only here** — it is the sole proof `rlnInflate` works rather than merely
compiles, and web reaches inflation through the `beginEnd` carrier instead.
*(Built as the second option — §6.0m, with markers over HTTP rather than
logcat.)*

**6b.4 — VSS.** Requires `VSS=1` and a second wallet instance. This is the
prerequisite for step 7, and the reason step 7 is sequenced after 6b rather
than before.

### 7a.6 Wiring

1. **Machine-readable output from the scripts.** They currently log for humans.
   Emit a stable `.env.local` (or `--json`) carrying `ASSET_ID`, `LSP_PUBKEY`,
   node URLs and ports, so tests read fixtures instead of scraping logs. Small
   change, unblocks everything else.
2. **`rgb-sdk-web/tests/e2e/` behind its own config** and an `npm run test:e2e`,
   so `npm test` stays fast and docker-free. Same for rn via `check-contract`'s
   loader trick — no new toolchain needed there.
3. **Share the field helpers from core** (`@utexo/rgb-sdk-core/conformance`), so
   `report`/`expectFields`/`expectNoWireKeys` cannot drift between the two SDKs.
4. **Feed `createWallet` into `runConformanceChecks`.** The existing runtime
   block already checks `invoiceStatus`, `listChannels`, `listPayments` and
   `estimateFeeRate` against live data — it is written and currently skipped.

**Known limitation, stated up front:** the demo scripts hard-code
`RGBLN_REPO=/Users/…/utexo/rgb-lightning-node`. The variable is overridable, but
those repos will not exist in CI, so e2e is a **local pre-commit gate** first.
Making it CI-runnable means publishing node/gateway images — a separate piece of
work, and not a reason to delay the local suite.

---

## 7b. Remaining cleanup — measured dead surface

**Re-measured (this pass).** Every export in core's built `index.d.ts` was
checked against `rgb-sdk-{web,rn}/src`, both demos and all three test suites:

| | then (first audit) | now |
|---|---|---|
| exports | 105 | **249** |
| unused outside core | 52 | **14** |
| used by nobody at all | — | **0** |

The jump in export count is the contract split (§3) — domain groups, carriers
and their models are all exported now. What matters is the second row: nothing
in core is orphaned.

### 7b.1 Dead — superseded by v3 — ✅ **DONE**

All five targets (`interfaces/IUTEXOProtocol.ts`, `utexo/utexo-protocol.ts`,
`utexo/config/utexo-presets.ts`, `utexo/utils/network.ts`,
`utexo/config/options.ts`, ~480 lines) were deleted in **step 6c (§6.0h)**;
this section had not been updated to say so.

**Four more deleted this pass** — declaration-only models with no field, no
signature and no consumer anywhere:

| Deleted | Was |
|---|---|
| `RestoreWalletRequestModel` | file-backup restore request; no SDK implements a restore-from-file call |
| `WalletRestoreResponse` | its response half |
| `GetFeeEstimationRequestModel` | `estimateFeeRate(blocks: number)` takes a number, not a model |
| `IssueAssetNIAResponse` | `issueAssetNia` returns `AssetNIA` directly |

(Plus `VssBackupMode` and three `VssBackupConfig` fields in §6.0r.)

### 7b.2 Keep — genuine public API

The 14 exports unused by our consumers but referenced inside core are all
legitimate: the key-derivation family (`accountDerivationPath`, `SeedInput`,
`toNetworkName`, `BIP32Factory`), `FetchClient`, `Logger`,
`resolveTransportEndpoint`, `getVssConfigs`, the message-signing param models,
and domain types reachable through other types (`AssetIface`, `BlockTime`,
`LightningAsset`, `InflateResult`). Keep — but they still deserve README
coverage: an exported symbol nobody documents is one nobody knows to use.

### 7b.3 Blocked on v4

`IRgbLibBinding` (98 lines) still has one real consumer:
`rgb-sdk-web/src/interfaces/IRlnWalletBinding.ts extends IRgbLibBinding`. It
dies with step 8, not before.

### 7b.4 Per-package leftovers

- **rn** — ✅ **DONE** (§6.0i): `src/crypto/signer.ts` and `signer/RNSigner.ts`
  deleted along with the `ISigner` re-export.
- **rn** — ~~`wallet/wallet-manager.ts`~~ **keep**: v2 §9.8 was wrong, the demo
  calls `createWallet` and the wrapper does network normalisation (§6.0i).
- **web** — ~~`SignPsbtOptions`~~ **keep**: unlike rn's empty placeholder, web's
  carries `signOptions?: BDKSignOptions` and its `crypto/signer.ts` is live
  (§6.0i).
- **web-demo** — the `replaceRightsNum` input and its state were deleted with
  the field itself (§6.0r); the demo's own staleness is below.
- **rn** — ~374 pre-existing `no-unused-vars` lint errors, unrelated to this
  work and worth their own pass.

### 7b.5 Demo migration — ✅ **DONE**

Neither demo's UI exercised the v3 contract. Both do now.

**`rgb-sdk-rn-demo` — 10 `tsc` errors → 0.** `wallet.send({...})` →
`onchainSend({...})` at 10 call sites across five `flows/*` files and
`app/(tabs)/utexo.tsx`. A pure rename: every call already passed exactly
`OnchainSendRequestModel`'s fields. Two `wChanValidate` labels were updated too,
so the flow log does not report `send(...)` for a call that no longer exists.

**`rgb-sdk-web-demo` — 21 `tsc` errors → 0, and it builds.** The demo resolved
`@utexo/rgb-sdk-web` from the **published** `1.0.0-beta.10`; only core was
aliased to local source. The same "local sibling if it exists, else npm"
pattern the repo already used for core now covers the SDK as well
(`vite.config.ts` + `tsconfig.json`), so CI/Docker still falls back to the
package. `npx vite build` succeeds against local source (4.6 s;
`RlnNodeBinding` chunk present, proving the alias resolved).

Pointing it at v3 surfaced 21 errors — **several semantic, not just renames**:

| Drift | v3 |
|---|---|
| `getLightningSendRequest` / `getLightningReceiveRequest` (11 sites) | `getLightningSendStatus` / `getLightningReceiveStatus` |
| `payLightningInvoiceBegin` → `signPsbt` → `payLightningInvoiceEnd` | atomic `payLightningInvoice`; the three-step UI and its PSBT state deleted |
| `getOnchainSendStatus(invoice)` | gone — a send's state *is* its transfer's state; rewritten as `listOnchainTransfers()` filtered by `invoiceString` |
| `LightningPayment.rawStatus` (4 sites) | `status` — the raw passthrough field no longer exists |
| `connectPeer(addr, pubkey)` (2 sites) | `connectPeer('pubkey@host:port')` |
| two `=== 'Settled'` comparisons | `'Succeeded'` — the canonical vocabulary |

The last row is worth keeping in mind: one of those comparisons only became a
**compile error after** the method rename (`RlnPaymentStatus` and `"Settled"`
have no overlap). A demo pinned to an old SDK hides exactly the drift the
normalizers exist to prevent.

---

## 8. Risks

- **App-visible breakage** is contained: no releases, local `file:` linking
  (§6.1), so breakage is confined to the demo apps (`rgb-sdk-web-demo`,
  `rgb-sdk-rn-demo`) which move in the same pass.
- **Capability explosion.** Three groups, one already marked temporary.
  **Hold the line at three — if a fourth is proposed, first check the native
  surface (§2.6) and prefer finishing the implementation or deleting the
  surface.**
- **Inventing limits that don't exist.** `inflate` nearly became a permanent
  capability flag because a stub was read as a platform limit; the node
  supported it all along. Every proposed flag must be justified against the
  UniFFI/wasm surface, not against the TypeScript stub.
- **"Temporary" flags becoming permanent** — `vssBackup` is `@deprecated` from
  birth and owned by step 7. If it survives past this milestone, the plan has
  failed at its own thesis.
- **Static scanning has known blind spots.** The corrected 49/18 counts come
  from grepping method bodies for `not implemented`. Differently-worded stubs
  evade it, and §2.5-style signature lies are invisible to it entirely. The
  first pass of this plan was wrong by exactly this mechanism (comment-line
  pollution → two false stubs). **Step 1 confirms by reading.**
- **Stale `dist/` under `file:` linking** silently validates old code — see
  §6.1.
- **Native code in §6.0c: Android verified, iOS still pending.**
  A Gradle build produced `RgbModule$rlnInflate$1.class`, which clears the two
  risks flagged when it was written — the Kotlin import
  (`org.utexo.rgblightningnode.InflateRequest`, *without* the `Sdk` prefix that
  `SdkIssueAssetIfaRequest` carries) and TurboModule codegen for the new spec
  method. **iOS is not yet compiled** (no `ios/build` artifacts); the
  Swift/Obj-C mirrors the verified Kotlin closely, but `_rlnInflate`'s `@objc`
  selector and the `Rgb.mm` signature are unproven until an Xcode build runs.

---

## 9. Decisions

### Resolved

| # | Question | Resolution |
|---|---|---|
| 2 | Is `vssClearFence` implemented on RN? | **Yes** (`rn:1193`). Not a stub — but it is a §2.5 signature lie. Stays in core with a **required** `password`. |
| 3 | Does `createBackup` belong in `IVssBackup`? | **No.** Local backup, implemented on both → core (wallet meta). VSS is remote replication; grouping them was a first-draft error. |
| 4 | Keep `inflate*`? | **Yes — and RN is not blocked.** UniFFI already exposes atomic `inflate` (`RGBLightningNode.swift:1251`); only the JS bridge is missing. `inflate` → core contract; `inflateBegin`/`inflateEnd` → `IBeginEndFlows`. `IAssetInflation` dropped (§2.6). |
| 5 | Deprecation window? | **None needed.** No releases until verified; local `file:` linking (§6.1). Clean break. |
| — | VSS grouping | Temporary and web-shaped; reshape to intent-based backup soon (§2.7). |

| 6 | Narrowing style (§3.1)? | **Optional-property carriers.** Presence is the type; `capabilities` becomes derived, not authoritative. Guards were rejected — `w is T & IGroup` is an unchecked assertion and reintroduces two sources of truth. |
| 7 | `syncWallet` vs `refreshWallet` — collapse? | **No, keep distinct.** They are separate node API operations (`rlnSync` vs `rlnRefresh`); collapsing hides a distinction the node makes. Both in core. |
| 8 | More §2.5 optional-param lies? | **Yes — sweep done, 4 found** in 3 flavours (§2.5): `vssClearFence`, `closeChannel`, `verifyMessage`, `onchainSend`. Fixes now scoped into step 3. |

| 9 | `createLightningInvoice` divergence? | **Narrow core to the 4-field intersection** (§2.5). It was a 5th §2.5 violation, not a model question: web declares `paymentHash` and silently drops it, turning a requested HODL invoice into a plain one. HODL belongs to `createHodlInvoice`; `minFinalCltvExpiryDelta`/`descriptionHash` → RN extras; `assetAmount` alias deleted. |
| 10 | `ISigner` / `IRLNSigner` naming? | **Split into three, rename now** (§2.8): `INodeUnlocker`, `IMessageSigner`, `IPsbtSigner`. Falls out of the `psbt` carrier work anyway. |
| 11 | Do `IBeginEndFlows` / `IPsbtSigning` survive a native check? | **Yes — both confirmed permanent** (§2.7a). Web bundles an rgb-lib wallet in wasm *plus* the node; RN has only the node. RN's UniFFI exposes no begin/end at all. Architectural, not unfinished. |

### Still open

*(none blocking step 3 — all decisions above are settled)*

Deferred, non-blocking:

1. Should `descriptionHash` eventually reach web? Requires the wasm live-invoice
   API to grow parameters — an upstream rgb-lightning-node question, not an SDK
   one.
2. §2.7 VSS reshape — now better framed by §2.7a ("cover each platform's number
   of state stores"), still owned by step 7.
