/**
 * Converts a decimal amount string to integer units based on precision.
 * @example toUnitsNumber("123.456", 6) // 123456000
 */
export function toUnitsNumber(value: string, precision: number): number {
  const s = String(value).trim();
  const neg = s.startsWith('-');
  const [iRaw, fRaw = ''] = (neg ? s.slice(1) : s).split('.');
  const frac = (fRaw + '0'.repeat(precision)).slice(0, precision);

  const unitsStr = (iRaw || '0') + frac;
  const units = Number(unitsStr);

  if (!Number.isSafeInteger(units)) {
    throw new Error(
      `Amount exceeds MAX_SAFE_INTEGER. Use BigInt instead. got=${unitsStr}`
    );
  }

  return neg ? -units : units;
}

/**
 * Converts integer units to a decimal amount based on precision.
 * @example fromUnitsNumber(123456000, 6) // 123.456
 */
export function fromUnitsNumber(units: number, precision: number): number {
  const neg = units < 0;
  const base = 10 ** precision;
  const value = Math.abs(units) / base;
  return neg ? -value : value;
}
