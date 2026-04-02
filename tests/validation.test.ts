import {
  validateNetwork,
  normalizeNetwork,
  validateMnemonic,
  validateBase64,
  validateHex,
  validateRequired,
  validateString,
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
