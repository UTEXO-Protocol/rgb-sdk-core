import {
  normalizeRlnNetwork,
  tryNormalizeRlnNetwork,
  normalizeNetwork,
  ValidationError,
} from '../dist/index.mjs';

describe('normalizeRlnNetwork', () => {
  it('accepts the PascalCase spellings UniFFI emits', () => {
    // The exact values rn e2e caught being returned raw (§6.0m).
    expect(normalizeRlnNetwork('Regtest')).toBe('regtest');
    expect(normalizeRlnNetwork('Mainnet')).toBe('mainnet');
    expect(normalizeRlnNetwork('Testnet4')).toBe('testnet4');
  });

  it('accepts the lowercase spellings the wasm runtime emits', () => {
    expect(normalizeRlnNetwork('regtest')).toBe('regtest');
    expect(normalizeRlnNetwork('signet')).toBe('signet');
  });

  it('maps SignetCustom to utexo, in any casing', () => {
    expect(normalizeRlnNetwork('SignetCustom')).toBe('utexo');
    expect(normalizeRlnNetwork('SIGNET_CUSTOM')).toBe('utexo');
    expect(normalizeRlnNetwork('signetcustom')).toBe('utexo');
  });

  it("maps rust-bitcoin's own 'Bitcoin' onto mainnet", () => {
    expect(normalizeRlnNetwork('Bitcoin')).toBe('mainnet');
  });

  it('throws on an unknown network rather than passing it through', () => {
    expect(() => normalizeRlnNetwork('liquid')).toThrow(ValidationError);
    expect(() => normalizeRlnNetwork('')).toThrow(ValidationError);
    expect(() => normalizeRlnNetwork(undefined)).toThrow(ValidationError);
  });

  it('has a non-throwing variant', () => {
    expect(tryNormalizeRlnNetwork('Regtest')).toBe('regtest');
    expect(tryNormalizeRlnNetwork('liquid')).toBeNull();
    expect(tryNormalizeRlnNetwork(42)).toBeNull();
  });

  it('stays distinct from the input validator, which must reject mis-casing', () => {
    // `normalizeNetwork` guards caller input, where 'Mainnet' is a typo worth
    // failing on; this one normalizes binding output, where it is not.
    expect(() => normalizeNetwork('Mainnet')).toThrow(ValidationError);
    expect(normalizeRlnNetwork('Mainnet')).toBe('mainnet');
  });
});
