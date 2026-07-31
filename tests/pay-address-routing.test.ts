import { jest } from '@jest/globals';
import { UtexoLsp } from '../dist/index.mjs';

const PEER = {
  baseUrl: 'https://lsp.example',
  peerPubkey: '03aabb',
  peerHost: 'lsp.example',
  peerPort: 9735,
};

function makeWallet() {
  return {
    payLightningInvoice: jest.fn().mockResolvedValue({ status: 'Pending' }),
  } as any;
}

/** Two-hop LNURL: discovery returns a callback, callback returns the invoice. */
function makeFetch(invoice = 'lnbc-from-foreign-host') {
  return jest.fn(async (url: any) => ({
    json: async () =>
      String(url).includes('/.well-known/lnurlp/')
        ? { callback: 'https://other.com/pay/callback/alice' }
        : { pr: invoice },
  })) as any;
}

function makeLsp(peer = PEER, invoice = 'lnbc-from-lsp') {
  const lsp: any = new UtexoLsp(makeWallet(), peer);
  lsp.http.resolveAddress = jest.fn().mockResolvedValue({ pr: invoice });
  return lsp;
}

const origFetch = global.fetch;
afterEach(() => {
  global.fetch = origFetch;
});

describe('payAddress routes discovery by the address domain', () => {
  it('uses the LSP client for an address hosted on this LSP', async () => {
    const lsp = makeLsp();
    global.fetch = makeFetch();

    const { invoice } = await lsp.payAddress({
      address: 'alice@lsp.example',
      amtMsat: 1000,
    });

    expect(invoice).toBe('lnbc-from-lsp');
    expect(lsp.http.resolveAddress).toHaveBeenCalledWith(
      'alice',
      1000,
      undefined,
      undefined
    );
    // Must not leak out to the open internet for our own address.
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('never asks the LSP about a foreign address — the misdirected-payment guard', async () => {
    const lsp = makeLsp();
    global.fetch = makeFetch();

    const { invoice } = await lsp.payAddress({
      address: 'alice@other.com',
      amtMsat: 1000,
    });

    // Previously the LSP was tried first and, on a username collision, would
    // have answered with ITS OWN alice's invoice.
    expect(lsp.http.resolveAddress).not.toHaveBeenCalled();
    expect(invoice).toBe('lnbc-from-foreign-host');

    const firstUrl = String((global.fetch as any).mock.calls[0][0]);
    expect(firstUrl).toBe('https://other.com/.well-known/lnurlp/alice');
  });

  it('routes a UMA address by its domain too', async () => {
    const lsp = makeLsp();
    global.fetch = makeFetch();

    await lsp.payAddress({ address: '$alice@other.com', amtMsat: 1000 });

    expect(lsp.http.resolveAddress).not.toHaveBeenCalled();
    // `$` stripped before discovery.
    expect(String((global.fetch as any).mock.calls[0][0])).toBe(
      'https://other.com/.well-known/lnurlp/alice'
    );
  });

  it('treats a loopback address as local even when the ports differ', async () => {
    // Regtest: address says localhost:3000, the LSP baseUrl is the emulator alias.
    const lsp = makeLsp({ ...PEER, baseUrl: 'http://10.0.2.2:8080' });
    global.fetch = makeFetch();

    const { invoice } = await lsp.payAddress({
      address: 'bob@localhost:3000',
      amtMsat: 1000,
    });

    expect(invoice).toBe('lnbc-from-lsp');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('forwards asset params on both routes', async () => {
    const lsp = makeLsp();
    global.fetch = makeFetch();

    await lsp.payAddress({
      address: 'alice@lsp.example',
      amtMsat: 1000,
      asset: { assetId: 'rgb:a', assetAmount: 7 },
    });
    expect(lsp.http.resolveAddress).toHaveBeenCalledWith(
      'alice',
      1000,
      'rgb:a',
      7
    );

    await lsp.payAddress({
      address: 'alice@other.com',
      amtMsat: 1000,
      asset: { assetId: 'rgb:a', assetAmount: 7 },
    });
    const cbUrl = String((global.fetch as any).mock.calls[1][0]);
    expect(cbUrl).toContain('amount=1000');
    expect(cbUrl).toContain('asset_id=rgb%3Aa');
    expect(cbUrl).toContain('asset_amount=7');
  });

  it('surfaces the real LSP error for a local address instead of a fetch failure', async () => {
    const lsp = makeLsp();
    lsp.http.resolveAddress = jest
      .fn()
      .mockRejectedValue(new Error('404 no such account'));
    global.fetch = makeFetch();

    await expect(
      lsp.payAddress({ address: 'ghost@lsp.example', amtMsat: 1000 })
    ).rejects.toThrow('404 no such account');
    expect(global.fetch).not.toHaveBeenCalled();
  }, 15000);
});
