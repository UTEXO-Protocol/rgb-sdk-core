/**
 * Engine errors, checked by shape rather than by class.
 *
 * An app can end up with two copies of core (or of an engine package), and
 * then `instanceof` fails across them. Every engine error therefore carries
 * own `code`, `operation` and `protocol` properties, and code across packages
 * checks them with `isEngineError()`.
 *
 * Not to be confused with core's older `WalletError` class, which has no
 * `operation` or `protocol`.
 */

import { SDKError } from '../errors';
import type { WalletProtocol } from '../types/engine-model';

/** Codes with the same meaning in every engine. Engines may add their own. */
export type SharedEngineErrorCode =
  /** The engine implements a contract version the caller does not accept. */
  | 'ENGINE_CONTRACT_MISMATCH'
  /** A valid input or operation this engine, build or wallet cannot perform. */
  | 'UNSUPPORTED_CAPABILITY'
  /** An invalid input value or combination. */
  | 'INVALID_PARAMS'
  /** The call is not allowed in the current lifecycle state. */
  | 'WALLET_INVALID_STATE'
  | 'WALLET_NOT_INITIALIZED'
  | 'WALLET_OFFLINE'
  | 'WALLET_DISPOSED';

export interface EngineError {
  readonly code: string;
  readonly message: string;
  /** Public operation name, e.g. `sendBtc`; `undefined` if not tied to one. */
  readonly operation: string | undefined;
  readonly protocol: WalletProtocol | undefined;
  readonly cause?: unknown;
}

const PROTOCOLS: readonly (WalletProtocol | undefined)[] = [
  'RGB_L1',
  'RGB_LN',
  undefined,
];

/**
 * True for any engine error, from any copy of core or an engine package.
 * With `code`, also requires that code.
 */
export function isEngineError(
  value: unknown,
  code?: string
): value is EngineError {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.code !== 'string' || typeof v.message !== 'string') return false;
  if (!('operation' in v) || !('protocol' in v)) return false;
  if (v.operation !== undefined && typeof v.operation !== 'string')
    return false;
  if (!PROTOCOLS.includes(v.protocol as WalletProtocol | undefined))
    return false;
  return code === undefined || v.code === code;
}

/** Raised by `assertEngineContract()`; also a valid `EngineError`. */
export class EngineContractError extends SDKError implements EngineError {
  readonly operation = 'contractCheck';
  readonly protocol: WalletProtocol | undefined;

  constructor(
    message: string,
    readonly contractVersion: unknown,
    protocol: WalletProtocol | undefined
  ) {
    super(message, 'ENGINE_CONTRACT_MISMATCH');
    this.protocol = protocol;
    this.name = 'EngineContractError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Checks an engine's embedded `contractVersion` against the versions the
 * caller accepts (exact match). Reads only `contractVersion` and `protocol`;
 * call it before `init()`, so a mismatch never opens wallet state.
 */
export function assertEngineContract(
  engine: unknown,
  accepted: readonly string[]
): asserts engine is { readonly contractVersion: string } {
  const e =
    typeof engine === 'object' && engine !== null
      ? (engine as Record<string, unknown>)
      : undefined;
  const version = e?.contractVersion;
  const protocol = PROTOCOLS.includes(e?.protocol as WalletProtocol)
    ? (e?.protocol as WalletProtocol | undefined)
    : undefined;
  if (typeof version !== 'string') {
    throw new EngineContractError(
      'The engine does not declare a contractVersion',
      version,
      protocol
    );
  }
  if (!accepted.includes(version)) {
    throw new EngineContractError(
      `Engine contract ${version} is not accepted; expected one of: ${accepted.join(', ')}`,
      version,
      protocol
    );
  }
}
