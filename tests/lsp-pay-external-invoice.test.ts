import { jest } from '@jest/globals';
import { UtexoLsp, LspQuoteMismatchError } from '../dist/index.mjs';

const PEER = {
  baseUrl: 'https://lsp.example',
  peerPubkey: '03aabb',
  peerHost: 'lsp.example',
  peerPort: 9735,
};

const PAYOUT = 'rgb:lnusdt';
const BRIDGE = 'rgb:busdt';
const HASH = 'a'.repeat(64);
const UNITS = 500_000;
const MSAT = 3_000_000;

const TARGET_INVOICE = 'lnbcrt-external';
const HODL_INVOICE = 'lnbcrt-hodl';

/** What the third party signed: BUSDT out, and the hash both legs share. */
const TARGET_DECODED = {
  paymentHash: HASH,
  amtMsat: MSAT,
  assetId: BRIDGE,
  assetAmount: UNITS,
  payee: '03deadbeef',
};

/** What the LSP signs back: the same hash, denominated in what we hold. */
const HODL_DECODED = {
  paymentHash: HASH,
  amtMsat: MSAT,
  assetId: PAYOUT,
  assetAmount: UNITS,
  payee: PEER.peerPubkey,
};

const QUOTE_WIRE = {
  ln_invoice: HODL_INVOICE,
  payment_hash: HASH,
  inbound: { asset_id: PAYOUT, asset_amount: UNITS, amt_msat: MSAT },
  outbound: {
    asset_id: BRIDGE,
    asset_amount: UNITS,
    amt_msat: MSAT,
    payee_pubkey: '03deadbeef',
  },
  converted: true,
  fee_msat: 0,
  expires_at: 1_800_000_000,
};

function channel(assetId: string, assetLocalAmount: number) {
  return {
    channelId: `chan-${assetId}`,
    peerPubkey: PEER.peerPubkey,
    capacitySat: 200_000,
    ready: true,
    isPublic: false,
    isUsable: true,
    assetId,
    assetLocalAmount,
    outboundBalanceMsat: 50_000_000,
    inboundBalanceMsat: 20_000_000,
  };
}

function makeWallet(channels: unknown[], decoded: Record<string, unknown>) {
  return {
    connectPeer: jest.fn().mockResolvedValue(undefined),
    listChannels: jest.fn().mockResolvedValue(channels),
    getNodeInfo: jest.fn().mockResolvedValue({ pubkey: '02cafe' }),
    listPayments: jest.fn().mockResolvedValue([]),
    createLightningInvoice: jest.fn().mockResolvedValue({ lnInvoice: 'lnbc1' }),
    payLightningInvoice: jest
      .fn()
      .mockResolvedValue({ txid: 'tx1', status: 'Pending' }),
    claimHodlInvoice: jest.fn().mockResolvedValue({ changed: true }),
    apayNewWithAddress: jest.fn().mockResolvedValue({ unusedHashes: 10 }),
    syncWallet: jest.fn().mockResolvedValue(undefined),
    getLightningReceiveStatus: jest.fn().mockResolvedValue('Pending'),
    decodeLnInvoice: jest.fn(async (invoice: any) =>
      invoice === TARGET_INVOICE ? TARGET_DECODED : decoded
    ),
  } as any;
}

const origFetch = global.fetch;
afterEach(() => {
  global.fetch = origFetch;
});

function mockLsp(quote: unknown = QUOTE_WIRE) {
  const bodies: unknown[] = [];
  global.fetch = jest.fn(async (url: any, init: any) => {
    if (init?.body) bodies.push(JSON.parse(String(init.body)));
    const body = String(url).includes('/lightning_send') ? quote : {};
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(body),
      json: async () => body,
    };
  }) as any;
  return bodies;
}

describe('quoteExternalPayment', () => {
  it('quotes the relay and reports both legs', async () => {
    mockLsp();
    const lsp = new UtexoLsp(
      makeWallet([channel(PAYOUT, 1_000_000)], HODL_DECODED),
      PEER
    );

    const quote = await lsp.quoteExternalPayment({ invoice: TARGET_INVOICE });

    expect(quote.invoice).toBe(HODL_INVOICE);
    expect(quote.paymentHash).toBe(HASH);
    expect(quote.converted).toBe(true);
    expect(quote.inbound.assetId).toBe(PAYOUT);
    expect(quote.outbound.assetId).toBe(BRIDGE);
    expect(quote.verified).toBe(true);
  });

  it('asks to be invoiced in the channel that can cover the amount', async () => {
    const bodies = mockLsp();
    const lsp = new UtexoLsp(
      makeWallet([channel(PAYOUT, 1_000_000)], HODL_DECODED),
      PEER
    );

    await lsp.quoteExternalPayment({ invoice: TARGET_INVOICE });

    expect(bodies[0]).toEqual({
      invoice: TARGET_INVOICE,
      pay_with_asset_id: PAYOUT,
    });
  });

  // Holding the delivery asset makes this a plain relay: no conversion, so the
  // LSP is trusted for strictly less. It must win over any other candidate.
  it('prefers the delivery asset when this wallet holds enough of it', async () => {
    const bodies = mockLsp({
      ...QUOTE_WIRE,
      inbound: { asset_id: BRIDGE, asset_amount: UNITS, amt_msat: MSAT },
      converted: false,
    });
    const lsp = new UtexoLsp(
      makeWallet(
        [channel(BRIDGE, 1_000_000), channel(PAYOUT, 1_000_000)],
        { ...HODL_DECODED, assetId: BRIDGE }
      ),
      PEER
    );

    await lsp.quoteExternalPayment({ invoice: TARGET_INVOICE });

    expect((bodies[0] as any).pay_with_asset_id).toBe(BRIDGE);
  });

  // A channel that cannot cover the amount is not a candidate: there is no
  // cross-asset MPP, so the whole amount has to fit in one.
  it('leaves the choice to the LSP when no channel can cover the amount', async () => {
    const bodies = mockLsp();
    const lsp = new UtexoLsp(makeWallet([channel(PAYOUT, 1)], HODL_DECODED), PEER);

    await lsp.quoteExternalPayment({ invoice: TARGET_INVOICE });

    expect(bodies[0]).toEqual({ invoice: TARGET_INVOICE });
  });
});

describe('quoteExternalPayment verification', () => {
  // The load-bearing check. An inbound invoice on any other hash is one the LSP
  // can claim on its own, whatever it promised about delivering.
  it('refuses an invoice signed against a different payment hash', async () => {
    mockLsp();
    const lsp = new UtexoLsp(
      makeWallet([channel(PAYOUT, 1_000_000)], {
        ...HODL_DECODED,
        paymentHash: 'b'.repeat(64),
      }),
      PEER
    );

    await expect(
      lsp.quoteExternalPayment({ invoice: TARGET_INVOICE })
    ).rejects.toThrow(LspQuoteMismatchError);
  });

  // The LSP reporting one hash while signing another is the same attack wearing
  // a disguise, so it must be caught even though the signed hash is right.
  it('refuses when the reported hash disagrees with the signed one', async () => {
    mockLsp({ ...QUOTE_WIRE, payment_hash: 'c'.repeat(64) });
    const lsp = new UtexoLsp(
      makeWallet([channel(PAYOUT, 1_000_000)], HODL_DECODED),
      PEER
    );

    await expect(
      lsp.quoteExternalPayment({ invoice: TARGET_INVOICE })
    ).rejects.toThrow(/reported hash/);
  });

  it('refuses a relay that is not 1:1 in base units', async () => {
    mockLsp();
    const lsp = new UtexoLsp(
      makeWallet([channel(PAYOUT, 1_000_000)], {
        ...HODL_DECODED,
        assetAmount: UNITS * 2,
      }),
      PEER
    );

    await expect(
      lsp.quoteExternalPayment({ invoice: TARGET_INVOICE })
    ).rejects.toThrow(/not 1:1/);
  });

  it('refuses when the signed asset is not the one the LSP reported', async () => {
    mockLsp();
    const lsp = new UtexoLsp(
      makeWallet([channel(PAYOUT, 1_000_000)], {
        ...HODL_DECODED,
        assetId: 'rgb:something-else',
      }),
      PEER
    );

    await expect(
      lsp.quoteExternalPayment({ invoice: TARGET_INVOICE })
    ).rejects.toThrow(/inbound asset/);
  });

  it('refuses an outbound leg in an asset other than the invoice being relayed', async () => {
    mockLsp({
      ...QUOTE_WIRE,
      outbound: { ...QUOTE_WIRE.outbound, asset_id: 'rgb:not-the-invoice' },
    });
    const lsp = new UtexoLsp(
      makeWallet([channel(PAYOUT, 1_000_000)], HODL_DECODED),
      PEER
    );

    await expect(
      lsp.quoteExternalPayment({ invoice: TARGET_INVOICE })
    ).rejects.toThrow(/outbound asset/);
  });

  // Relaying is at cost unless the caller opts in, so an unrequested fee is a
  // refusal rather than a surprise on the bill.
  it('refuses a fee the caller did not allow', async () => {
    mockLsp({ ...QUOTE_WIRE, fee_msat: 1_000 });
    const lsp = new UtexoLsp(
      makeWallet([channel(PAYOUT, 1_000_000)], HODL_DECODED),
      PEER
    );

    await expect(
      lsp.quoteExternalPayment({ invoice: TARGET_INVOICE })
    ).rejects.toThrow(/above the 0 msat allowed/);
  });

  it('accepts a fee within maxFeeMsat', async () => {
    mockLsp({ ...QUOTE_WIRE, fee_msat: 1_000 });
    const lsp = new UtexoLsp(
      makeWallet([channel(PAYOUT, 1_000_000)], {
        ...HODL_DECODED,
        amtMsat: MSAT + 1_000,
      }),
      PEER
    );

    const quote = await lsp.quoteExternalPayment({
      invoice: TARGET_INVOICE,
      maxFeeMsat: 1_000,
    });
    expect(quote.feeMsat).toBe(1_000);
  });

  // fee_msat is what the LSP says it charges; the signed amount is what it
  // actually takes. The second is what the caller pays, so it is what is checked.
  it('refuses a signed amount above the delivery leg plus the allowed fee', async () => {
    mockLsp();
    const lsp = new UtexoLsp(
      makeWallet([channel(PAYOUT, 1_000_000)], {
        ...HODL_DECODED,
        amtMsat: MSAT + 5_000,
      }),
      PEER
    );

    await expect(
      lsp.quoteExternalPayment({ invoice: TARGET_INVOICE })
    ).rejects.toThrow(/more than the 0 msat fee allowed/);
  });
});

describe('payExternalInvoice', () => {
  it('pays the verified HODL invoice and returns the quote with it', async () => {
    mockLsp();
    const wallet = makeWallet([channel(PAYOUT, 1_000_000)], HODL_DECODED);
    const lsp = new UtexoLsp(wallet, PEER);

    const { quote, sendResult } = await lsp.payExternalInvoice({
      invoice: TARGET_INVOICE,
    });

    expect(wallet.payLightningInvoice).toHaveBeenCalledWith({
      lnInvoice: HODL_INVOICE,
    });
    expect(quote.paymentHash).toBe(HASH);
    expect(sendResult.status).toBe('Pending');
  });

  it('pays nothing when verification fails', async () => {
    mockLsp();
    const wallet = makeWallet([channel(PAYOUT, 1_000_000)], {
      ...HODL_DECODED,
      paymentHash: 'd'.repeat(64),
    });
    const lsp = new UtexoLsp(wallet, PEER);

    await expect(
      lsp.payExternalInvoice({ invoice: TARGET_INVOICE })
    ).rejects.toThrow(LspQuoteMismatchError);
    expect(wallet.payLightningInvoice).not.toHaveBeenCalled();
  });
});
