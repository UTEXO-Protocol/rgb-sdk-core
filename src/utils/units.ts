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

/**
 * Same conversion as `toUnitsNumber`, but returns a `bigint` instead of
 * throwing above `Number.MAX_SAFE_INTEGER`. Use for large-supply / high-
 * precision assets, where raw units routinely exceed 2^53.
 * @example toUnitsBigInt("123.456", 6) // 123456000n
 */
export function toUnitsBigInt(value: string, precision: number): bigint {
  const s = String(value).trim();
  const neg = s.startsWith('-');
  const [iRaw, fRaw = ''] = (neg ? s.slice(1) : s).split('.');
  const frac = (fRaw + '0'.repeat(precision)).slice(0, precision);
  const unitsStr = (iRaw || '0') + frac;

  let units: bigint;
  try {
    units = BigInt(unitsStr);
  } catch {
    throw new Error(`Invalid decimal amount: ${value}`);
  }

  return neg ? -units : units;
}

/**
 * Converts bigint units to a decimal amount string based on precision — the
 * counterpart to `toUnitsBigInt`. Returns a string (not `number`) since the
 * whole point of the bigint path is values that don't fit safely in one.
 * @example fromUnitsBigInt(123456000n, 6) // "123.456"
 */
export function fromUnitsBigInt(units: bigint, precision: number): string {
  const neg = units < 0n;
  const abs = neg ? -units : units;
  const s = abs.toString().padStart(precision + 1, '0');
  const i = s.slice(0, s.length - precision);
  const fracDigits = precision > 0 ? s.slice(s.length - precision) : '';
  const frac = fracDigits.replace(/0+$/, '');

  return (neg ? '-' : '') + i + (frac ? '.' + frac : '');
}
