import {
  toUnitsNumber,
  fromUnitsNumber,
  toUnitsBigInt,
  fromUnitsBigInt,
} from '../dist/index.mjs';

describe('toUnitsNumber', () => {
  it('converts integer string', () => {
    expect(toUnitsNumber('100', 0)).toBe(100);
  });

  it('converts decimal string with precision', () => {
    expect(toUnitsNumber('123.456', 6)).toBe(123456000);
    expect(toUnitsNumber('1.5', 8)).toBe(150000000);
    expect(toUnitsNumber('0.001', 3)).toBe(1);
  });

  it('handles zero', () => {
    expect(toUnitsNumber('0', 6)).toBe(0);
    expect(toUnitsNumber('0.000000', 6)).toBe(0);
  });

  it('handles negative values', () => {
    expect(toUnitsNumber('-1.5', 2)).toBe(-150);
  });

  it('truncates extra decimal places', () => {
    expect(toUnitsNumber('1.123456789', 6)).toBe(1123456);
  });
});

describe('fromUnitsNumber', () => {
  it('converts integer units to decimal', () => {
    expect(fromUnitsNumber(123456000, 6)).toBeCloseTo(123.456);
    expect(fromUnitsNumber(150000000, 8)).toBeCloseTo(1.5);
  });

  it('handles zero', () => {
    expect(fromUnitsNumber(0, 6)).toBe(0);
  });

  it('handles negative units', () => {
    expect(fromUnitsNumber(-150, 2)).toBeCloseTo(-1.5);
  });

  it('roundtrips', () => {
    const original = '42.5';
    const precision = 4;
    const units = toUnitsNumber(original, precision);
    const back = fromUnitsNumber(units, precision);
    expect(back).toBeCloseTo(42.5);
  });
});

describe('toUnitsBigInt', () => {
  it('converts integer string', () => {
    expect(toUnitsBigInt('100', 0)).toBe(100n);
  });

  it('converts decimal string with precision', () => {
    expect(toUnitsBigInt('123.456', 6)).toBe(123456000n);
    expect(toUnitsBigInt('1.5', 8)).toBe(150000000n);
    expect(toUnitsBigInt('0.001', 3)).toBe(1n);
  });

  it('handles zero', () => {
    expect(toUnitsBigInt('0', 6)).toBe(0n);
    expect(toUnitsBigInt('0.000000', 6)).toBe(0n);
  });

  it('handles negative values', () => {
    expect(toUnitsBigInt('-1.5', 2)).toBe(-150n);
  });

  it('truncates extra decimal places', () => {
    expect(toUnitsBigInt('1.123456789', 6)).toBe(1123456n);
  });

  it('survives values beyond MAX_SAFE_INTEGER', () => {
    // u64::MAX at precision 6 — well past 2^53, where toUnitsNumber throws.
    expect(toUnitsBigInt('18446744073709.551615', 6)).toBe(
      18446744073709551615n
    );
  });

  it('rejects a malformed amount', () => {
    expect(() => toUnitsBigInt('not-a-number', 6)).toThrow(
      'Invalid decimal amount'
    );
  });
});

describe('fromUnitsBigInt', () => {
  it('converts integer units to decimal string', () => {
    expect(fromUnitsBigInt(123456000n, 6)).toBe('123.456');
    expect(fromUnitsBigInt(150000000n, 8)).toBe('1.5');
  });

  it('handles zero', () => {
    expect(fromUnitsBigInt(0n, 6)).toBe('0');
  });

  it('handles negative units', () => {
    expect(fromUnitsBigInt(-150n, 2)).toBe('-1.5');
  });

  it('pads fractional units smaller than precision', () => {
    expect(fromUnitsBigInt(5n, 6)).toBe('0.000005');
  });

  it('survives values beyond MAX_SAFE_INTEGER', () => {
    expect(fromUnitsBigInt(18446744073709551615n, 6)).toBe(
      '18446744073709.551615'
    );
  });

  it('roundtrips', () => {
    const original = '42.5';
    const precision = 4;
    const units = toUnitsBigInt(original, precision);
    const back = fromUnitsBigInt(units, precision);
    expect(back).toBe(original);
  });
});
