import { toUnitsNumber, fromUnitsNumber } from '../dist/index.mjs';

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
