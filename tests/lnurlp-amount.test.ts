import {
  assertValidAmtMsat,
  assertAmtMsatInSendableRange,
  LspAmountOutOfRangeError,
  ValidationError,
  DEFAULT_LSP_MIN_AMT_MSAT,
} from '../dist/index.mjs';

describe('assertValidAmtMsat', () => {
  it('accepts a finite positive integer', () => {
    expect(() => assertValidAmtMsat(1)).not.toThrow();
    expect(() => assertValidAmtMsat(DEFAULT_LSP_MIN_AMT_MSAT)).not.toThrow();
  });

  it.each([0, -1, 1.5, NaN, Infinity, -Infinity, '1000' as unknown as number])(
    'rejects %p',
    (value) => {
      expect(() => assertValidAmtMsat(value)).toThrow(ValidationError);
    }
  );
});

describe('assertAmtMsatInSendableRange', () => {
  const min = DEFAULT_LSP_MIN_AMT_MSAT;
  const max = DEFAULT_LSP_MIN_AMT_MSAT;

  it('accepts an amount inside the range', () => {
    expect(() => assertAmtMsatInSendableRange(min, min, max)).not.toThrow();
  });

  it('rejects below minSendable', () => {
    expect(() => assertAmtMsatInSendableRange(1000, min, max)).toThrow(
      LspAmountOutOfRangeError
    );
    try {
      assertAmtMsatInSendableRange(1000, min, max);
    } catch (err) {
      expect(err).toMatchObject({
        name: 'LspAmountOutOfRangeError',
        amtMsat: 1000,
        minSendable: min,
        maxSendable: max,
      });
      expect((err as Error).message).toContain(
        `outside LNURL sendable range [${min}, ${max}]`
      );
    }
  });

  it('rejects above maxSendable', () => {
    expect(() => assertAmtMsatInSendableRange(max + 1, min, max)).toThrow(
      LspAmountOutOfRangeError
    );
  });

  it('rejects non-integer amounts before range check', () => {
    expect(() => assertAmtMsatInSendableRange(1.5, min, max)).toThrow(
      ValidationError
    );
  });
});
