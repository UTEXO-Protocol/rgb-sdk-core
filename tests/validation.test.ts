import {
  validateNetwork,
  normalizeNetwork,
  validateMnemonic,
  validateBase64,
  validateHex,
  validateRequired,
  validateString,
  validateBurnParams,
  validateConsignmentLookup,
  ValidationError,
} from '../dist/index.mjs';

describe('normalizeNetwork', () => {
  it('normalizes string networks', () => {
    expect(normalizeNetwork('mainnet')).toBe('mainnet');
    expect(normalizeNetwork('testnet')).toBe('testnet');
    expect(normalizeNetwork('regtest')).toBe('regtest');
    expect(normalizeNetwork('signet')).toBe('signet');
    expect(normalizeNetwork('utexo')).toBe('utexo');
  });

  it('maps numeric networks', () => {
    // 0 = mainnet, 1 = testnet/regtest
    expect(['mainnet', 'testnet', 'regtest']).toContain(normalizeNetwork(0));
    expect(['mainnet', 'testnet', 'regtest']).toContain(normalizeNetwork(1));
  });

  it('throws for unknown/unsupported network strings', () => {
    expect(() => normalizeNetwork('Mainnet')).toThrow(ValidationError);
    expect(() => normalizeNetwork('TESTNET')).toThrow(ValidationError);
  });
});

describe('validateNetwork', () => {
  it('accepts valid network strings', () => {
    expect(() => validateNetwork('mainnet')).not.toThrow();
    expect(() => validateNetwork('testnet')).not.toThrow();
    expect(() => validateNetwork('regtest')).not.toThrow();
    expect(() => validateNetwork('signet')).not.toThrow();
    expect(() => validateNetwork('utexo')).not.toThrow();
  });

  it('throws ValidationError for truly invalid network', () => {
    expect(() => validateNetwork('bitcoin')).toThrow(ValidationError);
    expect(() => validateNetwork('')).toThrow(ValidationError);
    expect(() => validateNetwork('unknown')).toThrow(ValidationError);
  });
});

describe('validateMnemonic', () => {
  it('accepts valid mnemonic', () => {
    expect(() =>
      validateMnemonic(
        'flight seminar tray bulb level embody switch enhance august deny scene dismiss',
        'mnemonic'
      )
    ).not.toThrow();
  });

  it('throws for empty mnemonic', () => {
    expect(() => validateMnemonic('', 'mnemonic')).toThrow(ValidationError);
  });

  it('throws for non-string', () => {
    expect(() => validateMnemonic(null as any, 'mnemonic')).toThrow(
      ValidationError
    );
  });
});

describe('validateBase64', () => {
  it('accepts valid base64 string', () => {
    expect(() => validateBase64('aGVsbG8=', 'field')).not.toThrow();
  });

  it('throws for empty string', () => {
    expect(() => validateBase64('', 'field')).toThrow(ValidationError);
  });
});

describe('validateHex', () => {
  it('accepts valid hex string', () => {
    expect(() => validateHex('deadbeef', 'field')).not.toThrow();
    expect(() => validateHex('DEADBEEF', 'field')).not.toThrow();
  });

  it('throws for non-hex string', () => {
    expect(() => validateHex('zzzz', 'field')).toThrow(ValidationError);
  });

  it('throws for empty string', () => {
    expect(() => validateHex('', 'field')).toThrow(ValidationError);
  });
});

describe('validateRequired', () => {
  it('accepts non-null/undefined values', () => {
    expect(() => validateRequired('value', 'field')).not.toThrow();
    expect(() => validateRequired(0, 'field')).not.toThrow();
    expect(() => validateRequired(false, 'field')).not.toThrow();
  });

  it('throws for null', () => {
    expect(() => validateRequired(null, 'field')).toThrow(ValidationError);
  });

  it('throws for undefined', () => {
    expect(() => validateRequired(undefined, 'field')).toThrow(ValidationError);
  });
});

describe('validateString', () => {
  it('accepts non-empty string', () => {
    expect(() => validateString('hello', 'field')).not.toThrow();
  });

  it('throws for empty string', () => {
    expect(() => validateString('', 'field')).toThrow(ValidationError);
  });

  it('throws for non-string', () => {
    expect(() => validateString(123 as any, 'field')).toThrow(ValidationError);
  });
});

describe('validateBurnParams', () => {
  const valid = {
    assetId: 'rgb:asset',
    amount: '1',
    feeRate: 1,
    minConfirmations: 1,
  };
  const fieldOf = (params: unknown): string | undefined => {
    try {
      validateBurnParams(params as typeof valid);
      return undefined;
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      return (error as ValidationError).field;
    }
  };

  it('accepts a valid request, with and without burnRecipient', () => {
    expect(fieldOf(valid)).toBeUndefined();
    expect(
      fieldOf({ ...valid, burnRecipient: 'aB'.repeat(32) })
    ).toBeUndefined();
    expect(
      fieldOf({ ...valid, amount: '18446744073709551615' })
    ).toBeUndefined();
    expect(fieldOf({ ...valid, minConfirmations: 255 })).toBeUndefined();
  });

  it.each([
    [null, 'assetId'],
    [{ ...valid, assetId: 'asset' }, 'assetId'],
    [{ ...valid, assetId: 'rgb:' + 'a'.repeat(253) }, 'assetId'],
    [{ ...valid, amount: 1 }, 'amount'],
    [{ ...valid, amount: '0' }, 'amount'],
    [{ ...valid, amount: '01' }, 'amount'],
    [{ ...valid, amount: '-1' }, 'amount'],
    [{ ...valid, amount: '18446744073709551616' }, 'amount'],
    [{ ...valid, burnRecipient: '0x' + 'a'.repeat(62) }, 'burnRecipient'],
    [{ ...valid, burnRecipient: 'a'.repeat(63) }, 'burnRecipient'],
    [{ ...valid, feeRate: 0 }, 'feeRate'],
    [{ ...valid, feeRate: 1.5 }, 'feeRate'],
    [{ ...valid, feeRate: Number.MAX_SAFE_INTEGER + 1 }, 'feeRate'],
    [{ ...valid, minConfirmations: 0 }, 'minConfirmations'],
    [{ ...valid, minConfirmations: 256 }, 'minConfirmations'],
    [{ ...valid, minConfirmations: 1.5 }, 'minConfirmations'],
  ])('rejects %j with field %s', (params, field) => {
    expect(fieldOf(params)).toBe(field);
  });
});

describe('validateConsignmentLookup', () => {
  const txid = 'a'.repeat(64);

  it('accepts an asset id and a 64-hex txid', () => {
    expect(() => validateConsignmentLookup('rgb:asset', txid)).not.toThrow();
  });

  it.each([
    [['bad', txid], 'assetId'],
    [[undefined, txid], 'assetId'],
    [['rgb:asset', 'bad'], 'txid'],
    [['rgb:asset', 'g'.repeat(64)], 'txid'],
  ])('rejects %j with field %s', (args, field) => {
    expect(() =>
      validateConsignmentLookup(...(args as [string, string]))
    ).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR', field }));
  });
});
