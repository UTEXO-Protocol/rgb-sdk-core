import { jest } from '@jest/globals';
import {
  UtexoLsp,
  LspInsufficientAssetLiquidityError,
} from '../dist/index.mjs';

const PEER = {
  baseUrl: 'https://lsp.example',
  peerPubkey: '03aabb',
  peerHost: 'lsp.example',
  peerPort: 9735,
};

const PAYOUT = 'rgb:lnusdt';
const BRIDGE = 'rgb:busdt';
const ADDRESS = 'alice@lsp.example';

const DISCOVERY_WIRE = {
  callback: 'https://lsp.example/pay/callback/alice',
  minSendable: 1000,
  maxSendable: 3_000_000,
  metadata: '[["text/plain","pay alice"]]',
  tag: 'payRequest',
  recipient_pubkey: '02cafe',
  payout_asset: {
    asset_id: PAYOUT,
    schema: 'Ifa',
    ticker: 'LNUSDT',
    name: 'LnUSDT',
    precision: 6,
  },
  accepted_assets: [
    {
      asset_id: PAYOUT,
      schema: 'Ifa',
      ticker: 'LNUSDT',
      name: 'LnUSDT',
      precision: 6,
    },
    {
      asset_id: BRIDGE,
      schema: 'Ifa',
      ticker: 'BUSDT',
      name: 'bridgeUSDT',
      precision: 6,
    },
  ],
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

function makeWallet(channels: unknown[]) {
  return {
    connectPeer: jest.fn().mockResolvedValue(undefined),
    listChannels: jest.fn().mockResolvedValue(channels),
    getNodeInfo: jest.fn().mockResolvedValue({ pubkey: '02cafe' }),
    listPayments: jest.fn().mockResolvedValue([]),
    createLightningInvoice: jest
      .fn()
      .mockResolvedValue({ lnInvoice: 'lnbc1...' }),
    payLightningInvoice: jest
      .fn()
      .mockResolvedValue({ txid: 'tx1', status: 'Succeeded' }),
    claimHodlInvoice: jest.fn().mockResolvedValue({ changed: true }),
    apayNewWithAddress: jest.fn().mockResolvedValue({ unusedHashes: 10 }),
    syncWallet: jest.fn().mockResolvedValue(undefined),
    getLightningReceiveStatus: jest.fn().mockResolvedValue('Pending'),
  } as any;
}

const origFetch = global.fetch;
afterEach(() => {
  global.fetch = origFetch;
});

/** Serves discovery for any `/.well-known/lnurlp/*`, an invoice for anything else. */
function mockLsp(discovery: unknown = DISCOVERY_WIRE) {
  const calls: string[] = [];
  global.fetch = jest.fn(async (url: any) => {
    calls.push(String(url));
    const body = String(url).includes('/.well-known/lnurlp/')
      ? discovery
      : { pr: 'lnbc-invoice' };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(body),
      json: async () => body,
    };
  }) as any;
  return calls;
}

describe('discoverAddress', () => {
  it('maps the snake_case asset fields', async () => {
    mockLsp();
    const lsp = new UtexoLsp(makeWallet([]), PEER);
    const meta = await lsp.discoverAddress(ADDRESS);

    expect(meta.callback).toBe(DISCOVERY_WIRE.callback);
    expect(meta.recipientPubkey).toBe('02cafe');
    expect(meta.payoutAsset).toEqual({
      assetId: PAYOUT,
      schema: 'Ifa',
      ticker: 'LNUSDT',
      name: 'LnUSDT',
      precision: 6,
    });
    expect(meta.acceptedAssets?.map((a: any) => a.assetId)).toEqual([
      PAYOUT,
      BRIDGE,
    ]);
  });

  it('leaves the asset fields undefined on an LSP that omits them', async () => {
    mockLsp({
      callback: DISCOVERY_WIRE.callback,
      minSendable: 1000,
      maxSendable: 3_000_000,
    });
    const lsp = new UtexoLsp(makeWallet([]), PEER);
    const meta = await lsp.discoverAddress(ADDRESS);

    expect(meta.payoutAsset).toBeUndefined();
    expect(meta.acceptedAssets).toBeUndefined();
  });
});

describe('selectPaymentAsset', () => {
  it('prefers the payout asset when its channel can cover the amount', async () => {
    mockLsp();
    const lsp = new UtexoLsp(
      makeWallet([channel(PAYOUT, 1_000_000), channel(BRIDGE, 2_000_000)]),
      PEER
    );
    const sel = await lsp.selectPaymentAsset({
      address: ADDRESS,
      assetAmount: 500_000,
    });

    expect(sel.assetId).toBe(PAYOUT);
    expect(sel.converted).toBe(false);
    expect(sel.localAssetAmount).toBe(1_000_000);
  });

  it('falls back to the linked asset when the payout channel is short', async () => {
    mockLsp();
    const lsp = new UtexoLsp(
      // Inbound-only payout channel — the shape the LSP cron leaves behind.
      makeWallet([channel(PAYOUT, 0), channel(BRIDGE, 2_000_000)]),
      PEER
    );
    const sel = await lsp.selectPaymentAsset({
      address: ADDRESS,
      assetAmount: 500_000,
    });

    expect(sel.assetId).toBe(BRIDGE);
    expect(sel.converted).toBe(true);
    expect(sel.payoutAsset?.assetId).toBe(PAYOUT);
  });

  it('does not sum channels — no cross-asset or cross-channel MPP', async () => {
    mockLsp();
    const lsp = new UtexoLsp(
      makeWallet([channel(BRIDGE, 300_000), channel(BRIDGE, 300_000)]),
      PEER
    );
    await expect(
      lsp.selectPaymentAsset({ address: ADDRESS, assetAmount: 500_000 })
    ).rejects.toBeInstanceOf(LspInsufficientAssetLiquidityError);
  });

  it('reports every asset it considered when none can pay', async () => {
    mockLsp();
    const lsp = new UtexoLsp(makeWallet([channel(BRIDGE, 1)]), PEER);
    const err = await lsp
      .selectPaymentAsset({ address: ADDRESS, assetAmount: 500_000 })
      .catch((e: any) => e);

    expect(err).toBeInstanceOf(LspInsufficientAssetLiquidityError);
    expect(err.required).toBe(500_000);
    expect(err.candidates).toEqual([
      { assetId: PAYOUT, localAmount: 0 },
      { assetId: BRIDGE, localAmount: 1 },
    ]);
  });

  it('ignores unusable channels', async () => {
    mockLsp();
    const lsp = new UtexoLsp(
      makeWallet([
        { ...channel(BRIDGE, 2_000_000), isUsable: false, ready: false },
      ]),
      PEER
    );
    await expect(
      lsp.selectPaymentAsset({ address: ADDRESS, assetAmount: 500_000 })
    ).rejects.toBeInstanceOf(LspInsufficientAssetLiquidityError);
  });

  it('refuses to guess when discovery advertises no assets', async () => {
    mockLsp({
      callback: DISCOVERY_WIRE.callback,
      minSendable: 1000,
      maxSendable: 3_000_000,
    });
    const lsp = new UtexoLsp(makeWallet([channel(BRIDGE, 2_000_000)]), PEER);
    await expect(
      lsp.selectPaymentAsset({ address: ADDRESS, assetAmount: 500_000 })
    ).rejects.toThrow(/pass asset.assetId explicitly/);
  });
});

describe('payAddress with an unnamed asset', () => {
  it('quotes the selected asset and reports the selection', async () => {
    const calls = mockLsp();
    const lsp = new UtexoLsp(
      makeWallet([channel(PAYOUT, 0), channel(BRIDGE, 2_000_000)]),
      PEER
    );

    const res = await lsp.payAddress({
      address: ADDRESS,
      amtMsat: 3_000_000,
      asset: { assetAmount: 500_000 },
    });

    expect(res.assetSelection?.assetId).toBe(BRIDGE);
    expect(res.assetSelection?.converted).toBe(true);
    const callback = calls.find((u) => u.includes('/pay/callback/'));
    expect(callback).toContain(`asset_id=${encodeURIComponent(BRIDGE)}`);
    expect(callback).toContain('asset_amount=500000');
  });

  it('leaves an explicitly named asset alone', async () => {
    const calls = mockLsp();
    const lsp = new UtexoLsp(makeWallet([channel(PAYOUT, 1_000_000)]), PEER);

    const res = await lsp.payAddress({
      address: ADDRESS,
      amtMsat: 3_000_000,
      asset: { assetId: PAYOUT, assetAmount: 500_000 },
    });

    expect(res.assetSelection).toBeUndefined();
    expect(calls.find((u) => u.includes('/pay/callback/'))).toContain(
      `asset_id=${encodeURIComponent(PAYOUT)}`
    );
  });
});
