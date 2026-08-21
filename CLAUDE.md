## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

---

# CLAUDE.md — rgb-sdk-core

## Project Overview

`@utexo/rgb-sdk-core` is the platform-agnostic shared core for the UTEXO RGB SDK — no `fs`, no wasm, no JSI. It is consumed by `rgb-sdk-web` and `rgb-sdk-rn`. It provides the shared contract (`IUTEXOProtocolCore`), domain types, error hierarchy, key derivation, LSP flows, status normalization, and conformance test helpers. Platform-specific code lives in the consumers, never here.

## Stack

| Layer | Technology |
|---|---|
| Language | TypeScript 5, strict mode |
| Build | tsup (two entry points: `.` and `./conformance`) |
| Tests | Jest 29 + ts-jest (imports from `dist/`, not `src/`) |
| Linting | ESLint 9 flat config + Prettier |
| Crypto | `@noble/hashes`, `@noble/curves`, `@scure/bip32`, `@scure/bip39` — pure JS, no native |

## Build and Test

```bash
npm run build        # tsup → dist/
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run test         # Jest (always rebuilds first — tests import from dist/)
```

## Project Structure

```
src/
  index.ts                 Public entry point — re-exports everything
  conformance/             Conformance test helpers (separate entry point ./conformance)
  lsp/
    flows/                 8 composed LSP flows (utexoLsp.ts + individual flow files)
    types/                 LSP request/response wire types (Wire suffix)
    errors/                Typed LSP error hierarchy
  keys/
    derivation.ts          BIP86 Taproot key derivation (m/86'/<coinType>'/0')
                           RGB coin types: 827166 (mainnet), 827167 (testnet)
    keychains.ts           Vanilla vs colored keychains
  protocol/
    contract.ts            IUTEXOProtocolCore interface — the shared contract
    status.ts              Status normalization (PascalCase only, normalize*/tryNormalize*)
    types/                 Domain types shared across platforms
  errors/                  Base error classes with setPrototypeOf for instanceof
  network/                 Network config types and FetchClient interface
  utils/                   Shared pure utilities
```

## Code Conventions

**Platform purity** — no `fs`, `path`, `crypto` (Node), `window`, `document`, or native imports. Any code that imports a platform API is a bug.

**Interface contract** — `IUTEXOProtocolCore` is the single interface consumers program against. Every new capability must be added to the interface first; implementation comes second.

**No core shape mappers** — `src/` must not contain `map*` functions that convert wire types to domain types. Mappers live in consumers (`rgb-sdk-rn`, `rgb-sdk-web`). Core only defines the types.

**Status normalization at boundary** — all incoming status strings from the native layer must pass through `normalizeStatus()` or `tryNormalizeStatus()` before being stored or returned. Raw status strings must never cross the boundary into domain types.

**Wire suffix** — types that directly mirror the JSON shape returned by native/FFI layers are suffixed with `Wire` (e.g. `TransferWire`). Domain types have no suffix.

**Error hierarchy** — all errors extend `UTexoError` (which calls `Object.setPrototypeOf(this, new.target.prototype)` for correct `instanceof`). Never throw plain `Error` from public methods.

**Naming conventions**:
- `normalize*` — throws if input cannot be normalized
- `tryNormalize*` — returns `undefined` if input cannot be normalized
- `I*` — interfaces
- PascalCase for all status/enum values

**bigint for u64 LSP fields** — any amount field that can exceed `Number.MAX_SAFE_INTEGER` must use `bigint`, not `number`.

**FetchClient as sole HTTP transport** — network calls use the injected `FetchClient` interface, never `fetch` directly. This keeps the core platform-neutral and testable.

**Conformance helpers** — runners in `src/conformance/` must be framework-agnostic (no Jest globals). They return result objects; the consumer test file does the assertions.

## Code Review Focus Areas

### Security
- **Key material leakage**: `src/keys/` functions must never log, serialize to disk, or return mnemonic/seed/private key material outside the derivation result struct.
- **Relay atomicity**: `assertRelayBindsBothLegs` (or equivalent) must be called before accepting a relay quote. Removing or weakening this check allows the LSP to collect fees without completing both legs.
- **VSS keys**: any change to VSS key derivation paths must be reviewed against the VSS spec — incorrect derivation produces silently-wrong keys.

### Correctness
- **Status normalization at boundary**: every place that ingests a raw status string must call `normalizeStatus`. Adding a new flow that bypasses normalization is a bug.
- **Wire key leakage via `expectNoWireKeys`**: the conformance helper asserts that no `Wire`-suffixed properties exist on domain objects. New `map*` functions in consumers must strip all Wire keys.
- **LSP asset-selection contract**: `UtexoLsp` flows throw typed errors when the requested asset is not supported — they must never guess or default silently.
- **Exports in index.ts**: any new public type or function must be explicitly re-exported from `src/index.ts`; tree-shaking does not auto-include.
- **Test import paths**: tests must import from `dist/`, not `src/`. Importing from `src/` bypasses the build and hides type errors that only manifest after compilation.

### Performance
- **Avoid double syncWallet**: some flows call `syncWallet` implicitly. Callers that also call it explicitly will double-sync, causing unnecessary node load.
- **AbortSignal in polling loops**: any polling helper must accept and honour an `AbortSignal` to allow clean cancellation.
