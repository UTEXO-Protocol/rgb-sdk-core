import {
  hostnameOf,
  isLoopbackHost,
  isSameLspHost,
  lnurlDiscoveryUrl,
  LOOPBACK_HOSTS,
} from '../dist/index.mjs';

describe('hostnameOf', () => {
  it('reads bare hosts, authorities and URLs', () => {
    expect(hostnameOf('example.com')).toBe('example.com');
    expect(hostnameOf('example.com:8080')).toBe('example.com');
    expect(hostnameOf('https://example.com/pay?x=1')).toBe('example.com');
    expect(hostnameOf('http://10.0.2.2:8080')).toBe('10.0.2.2');
  });

  it('unwraps IPv6 literals', () => {
    expect(hostnameOf('::1')).toBe('::1');
    expect(hostnameOf('[::1]:3000')).toBe('::1');
    expect(hostnameOf('http://[::1]:3000/x')).toBe('::1');
  });

  it('lowercases', () => {
    expect(hostnameOf('Example.COM:80')).toBe('example.com');
  });

  it('returns empty string for junk', () => {
    expect(hostnameOf('')).toBe('');
    expect(hostnameOf('   ')).toBe('');
    expect(hostnameOf(undefined as unknown as string)).toBe('');
  });
});

describe('isLoopbackHost', () => {
  it('covers every documented loopback alias', () => {
    for (const h of LOOPBACK_HOSTS) expect(isLoopbackHost(h)).toBe(true);
  });

  it('includes the Android emulator alias', () => {
    // The old ad-hoc regex missed this one.
    expect(isLoopbackHost('10.0.2.2:8080')).toBe(true);
    expect(isLoopbackHost('[::1]:3000')).toBe(true);
  });

  it('rejects public hosts', () => {
    expect(isLoopbackHost('example.com')).toBe(false);
    expect(isLoopbackHost('lsp-signet.utexo.com')).toBe(false);
  });
});

describe('isSameLspHost', () => {
  it('matches an address hosted on the configured LSP', () => {
    expect(isSameLspHost('lsp.utexo.com', 'https://lsp.utexo.com')).toBe(true);
  });

  it('ignores ports — one stack serves API and addresses on different ports', () => {
    expect(
      isSameLspHost('lsp.utexo.com:443', 'https://lsp.utexo.com:8080')
    ).toBe(true);
  });

  it('treats any two loopback hosts as the same local stack', () => {
    // Regtest: address says 127.0.0.1, baseUrl is the emulator alias.
    expect(isSameLspHost('localhost:3000', 'http://10.0.2.2:8080')).toBe(true);
    expect(isSameLspHost('127.0.0.1:3000', 'http://localhost:8080')).toBe(true);
  });

  it('treats a loopback address domain as ours even against a public baseUrl', () => {
    // An LSP may advertise addresses on a loopback domain while being reached
    // over a public host (LIGHTNING_ADDRESS_DOMAIN_URL defaults to 127.0.0.1).
    // Fetching that as a public host would hit the device itself.
    expect(
      isSameLspHost('127.0.0.1:8080', 'https://lsp-signet.utexo.com')
    ).toBe(true);
    expect(isSameLspHost('localhost:3000', 'https://lsp.utexo.com')).toBe(true);
  });

  it('does NOT treat a foreign domain as ours — the misdirected-payment guard', () => {
    expect(isSameLspHost('other.com', 'https://lsp.utexo.com')).toBe(false);
    // A foreign host must not be considered local just because we run locally.
    expect(isSameLspHost('other.com', 'http://localhost:8080')).toBe(false);
  });

  it('is false when either side is unparseable', () => {
    expect(isSameLspHost('', 'https://lsp.utexo.com')).toBe(false);
    expect(isSameLspHost('example.com', '')).toBe(false);
  });
});

describe('lnurlDiscoveryUrl', () => {
  it('forces https for public hosts', () => {
    expect(lnurlDiscoveryUrl('example.com', 'alice')).toBe(
      'https://example.com/.well-known/lnurlp/alice'
    );
  });

  it('uses plain http for loopback hosts, keeping the port', () => {
    expect(lnurlDiscoveryUrl('localhost:3000', 'bob')).toBe(
      'http://localhost:3000/.well-known/lnurlp/bob'
    );
    expect(lnurlDiscoveryUrl('10.0.2.2:8080', 'bob')).toBe(
      'http://10.0.2.2:8080/.well-known/lnurlp/bob'
    );
  });

  it('escapes the username', () => {
    expect(lnurlDiscoveryUrl('example.com', 'a+b')).toBe(
      'https://example.com/.well-known/lnurlp/a%2Bb'
    );
  });
});
