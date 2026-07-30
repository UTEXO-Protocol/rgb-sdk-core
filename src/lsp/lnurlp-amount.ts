import { ValidationError } from '../errors';
import { LspAmountOutOfRangeError } from './LspErrors';

/**
 * Assert `amtMsat` is a finite positive integer.
 *
 * LNURL-pay and utexo-lsp both expect whole millisatoshis; fractional or
 * non-positive values would otherwise surface as opaque HTTP 400s.
 */
export function assertValidAmtMsat(
  amtMsat: number,
  field: string = 'amtMsat'
): void {
  if (
    typeof amtMsat !== 'number' ||
    !Number.isFinite(amtMsat) ||
    !Number.isInteger(amtMsat) ||
    amtMsat <= 0
  ) {
    throw new ValidationError(
      `${field} must be a finite positive integer (msat)`,
      field
    );
  }
}

/**
 * Assert `amtMsat` lies in the LNURL-pay discovery sendable range.
 *
 * Call after discovery so the server-advertised `minSendable` / `maxSendable`
 * are the source of truth (utexo-lsp defaults both to 3_000_000).
 */
export function assertAmtMsatInSendableRange(
  amtMsat: number,
  minSendable: number,
  maxSendable: number
): void {
  assertValidAmtMsat(amtMsat);
  if (amtMsat < minSendable || amtMsat > maxSendable) {
    throw new LspAmountOutOfRangeError(amtMsat, minSendable, maxSendable);
  }
}
