/**
 * Wire → domain mapping contract.
 *
 * Core deliberately does NOT ship shape mappers. The two bindings do not share
 * a wire format: in `rgb-lightning-node`, `bindings/uniffi-bindgen` generates
 * typed structs from `src/uniffi_api/types.rs`, while `bindings/wasm-sdk`
 * hand-serializes with serde behind an untyped `JsValue`. `pub struct Channel`
 * exists only on the UniFFI side. A single function cannot consume both
 * without degenerating into a union-typed mess.
 *
 * So the split is:
 *   - core owns the domain types, the canonical status vocabulary, and the
 *     platform-agnostic *value* normalizers (casing, units);
 *   - each platform owns its *shape* mappers, typed against `WireMapper` so
 *     the compiler enforces the domain output.
 *
 * A future platform adds mappers without any core change.
 */

/**
 * A platform-supplied mapper from a binding's wire type to a core domain type.
 *
 * @example
 * ```ts
 * // rgb-sdk-rn — knows RlnChannel (UniFFI)
 * const toChannel: WireMapper<RlnChannel, LightningChannel> = (w) => ({
 *   channelId: w.channelId,
 *   peerPubkey: w.peerPubkey,
 *   capacitySat: w.capacitySat,
 *   ready: w.ready,
 *   isPublic: w.public,
 *   status: w.status ? normalizeChannelStatus(w.status) : undefined,
 * });
 * ```
 */
export type WireMapper<TWire, TDomain> = (wire: TWire) => TDomain;

/** Maps a list with a `WireMapper`. */
export function mapAll<TWire, TDomain>(
  mapper: WireMapper<TWire, TDomain>,
  wire: readonly TWire[]
): TDomain[] {
  return wire.map((w) => mapper(w));
}

/** Maps a nullish wire value, preserving `null`/`undefined`. */
export function mapMaybe<TWire, TDomain>(
  mapper: WireMapper<TWire, TDomain>,
  wire: TWire | null | undefined
): TDomain | null {
  return wire == null ? null : mapper(wire);
}

// ─── Unit helpers ─────────────────────────────────────────────────────────────

const MSAT_PER_SAT = 1000;

/** Millisatoshis → satoshis (floor). Accepts `number` or `bigint`. */
export function msatToSat(msat: number | bigint): number {
  return Math.floor(Number(msat) / MSAT_PER_SAT);
}

/** Satoshis → millisatoshis. Accepts `number` or `bigint`. */
export function satToMsat(sat: number | bigint): number {
  return Number(sat) * MSAT_PER_SAT;
}

/**
 * Coerce a wire numeric to `number`.
 *
 * UniFFI emits `number`, wasm-bindgen often emits `bigint` for u64 fields.
 * Returns `undefined` for nullish input so optional domain fields stay unset.
 */
export function toNumber(
  value: number | bigint | null | undefined
): number | undefined {
  return value == null ? undefined : Number(value);
}

/**
 * Coerce a wire numeric to `bigint`.
 *
 * Mirror of {@link toNumber} for call sites that must pass u64 into a binding.
 */
export function toBigInt(
  value: number | bigint | null | undefined
): bigint | undefined {
  return value == null ? undefined : BigInt(value);
}
