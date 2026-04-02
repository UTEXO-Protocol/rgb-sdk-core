import {
  NETWORK_MAP,
  BIP32_VERSIONS,
  DEFAULT_TRANSPORT_ENDPOINTS,
  DEFAULT_INDEXER_URLS,
  isNetwork,
  normalizeNetwork,
} from '../dist/index.mjs';

describe('NETWORK_MAP', () => {
  it('contains utexo entry', () => {
    expect(NETWORK_MAP['utexo']).toBe('utexo');
  });

  it('contains all expected networks', () => {
    expect(NETWORK_MAP['mainnet']).toBe('mainnet');
    expect(NETWORK_MAP['testnet']).toBe('testnet');
    expect(NETWORK_MAP['testnet4']).toBe('testnet4');
    expect(NETWORK_MAP['signet']).toBe('signet');
    expect(NETWORK_MAP['utexo']).toBe('utexo');
    expect(NETWORK_MAP['regtest']).toBe('regtest');
  });
});

describe('BIP32_VERSIONS', () => {
  it('utexo uses testnet BIP32 versions (same as signet)', () => {
    expect(BIP32_VERSIONS.utexo.public).toBe(BIP32_VERSIONS.signet.public);
    expect(BIP32_VERSIONS.utexo.private).toBe(BIP32_VERSIONS.signet.private);
  });

  it('utexo uses testnet-family versions (not mainnet)', () => {
    expect(BIP32_VERSIONS.utexo.public).not.toBe(BIP32_VERSIONS.mainnet.public);
    expect(BIP32_VERSIONS.utexo.private).not.toBe(BIP32_VERSIONS.mainnet.private);
  });
});

describe('isNetwork', () => {
  it('returns true for all valid networks including utexo', () => {
    expect(isNetwork('mainnet')).toBe(true);
    expect(isNetwork('testnet')).toBe(true);
    expect(isNetwork('testnet4')).toBe(true);
    expect(isNetwork('signet')).toBe(true);
    expect(isNetwork('utexo')).toBe(true);
    expect(isNetwork('regtest')).toBe(true);
  });

  it('returns false for invalid values', () => {
    expect(isNetwork('bitcoin')).toBe(false);
    expect(isNetwork('')).toBe(false);
    expect(isNetwork(42)).toBe(false);
    expect(isNetwork(null)).toBe(false);
  });
});

describe('normalizeNetwork', () => {
  it('round-trips utexo', () => {
    expect(normalizeNetwork('utexo')).toBe('utexo');
  });

  it('round-trips signet', () => {
    expect(normalizeNetwork('signet')).toBe('signet');
  });

  it('utexo and signet normalize to different values', () => {
    expect(normalizeNetwork('utexo')).not.toBe(normalizeNetwork('signet'));
  });
});

describe('DEFAULT_TRANSPORT_ENDPOINTS', () => {
  it('utexo has a transport endpoint', () => {
    expect(DEFAULT_TRANSPORT_ENDPOINTS.utexo).toBeTruthy();
    expect(typeof DEFAULT_TRANSPORT_ENDPOINTS.utexo).toBe('string');
  });

  it('signet has a transport endpoint', () => {
    expect(DEFAULT_TRANSPORT_ENDPOINTS.signet).toBeTruthy();
    expect(typeof DEFAULT_TRANSPORT_ENDPOINTS.signet).toBe('string');
  });

  it('utexo and signet transport endpoints are different', () => {
    expect(DEFAULT_TRANSPORT_ENDPOINTS.utexo).not.toBe(DEFAULT_TRANSPORT_ENDPOINTS.signet);
  });
});

describe('DEFAULT_INDEXER_URLS', () => {
  it('utexo has an indexer URL', () => {
    expect(DEFAULT_INDEXER_URLS.utexo).toBeTruthy();
    expect(typeof DEFAULT_INDEXER_URLS.utexo).toBe('string');
  });

  it('signet has an indexer URL', () => {
    expect(DEFAULT_INDEXER_URLS.signet).toBeTruthy();
    expect(typeof DEFAULT_INDEXER_URLS.signet).toBe('string');
  });

  it('signet uses electrum SSL endpoint', () => {
    expect(DEFAULT_INDEXER_URLS.signet).toMatch(/^ssl:\/\//);
  });

  it('utexo uses esplora HTTP endpoint', () => {
    expect(DEFAULT_INDEXER_URLS.utexo).toMatch(/^https:\/\//);
  });

  it('utexo and signet indexer URLs are different', () => {
    expect(DEFAULT_INDEXER_URLS.utexo).not.toBe(DEFAULT_INDEXER_URLS.signet);
  });
});
