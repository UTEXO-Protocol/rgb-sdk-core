/**
 * requestExternalInvoice — quoting a BOLT11 for a payer that is not this wallet.
 *
 * The invoice is hosted (payee = the LSP), so nothing in it names the payer and
 * any RGB Lightning node with a channel in the quoted asset can settle it with a
 * plain `/sendpayment`. What this file pins down is the part the SDK owns: which
 * asset gets quoted, and that a rejected choice costs no APay hash.
 */

import { jest } from '@jest/globals';
import {
  UtexoLsp,
  LspAmbiguousPayableAssetError,
  LspNoPayableAssetError,
  LspUnknownPayableAssetError,
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

const PAYOUT_WIRE = {
  asset_id: PAYOUT,
  schema: 'Ifa',
  ticker: 'LNUSDT',
  name: 'LnUSDT',
  precision: 6,
};
const BRIDGE_WIRE = {
  asset_id: BRIDGE,
  schema: 'Ifa',
  ticker: 'BUSDT',
  name: 'bridgeUSDT',
  precision: 6,
};

const DISCOVERY_WIRE = {
  callback: 'https://lsp.example/pay/callback/alice',
  minSendable: 1000,
  maxSendable: 3_000_000,
  metadata: '[["text/plain","pay alice"]]',
  tag: 'payRequest',
  recipient_pubkey: '02cafe',
  payout_asset: PAYOUT_WIRE,
  accepted_assets: [PAYOUT_WIRE, BRIDGE_WIRE],
};

const CALLBACK_WIRE = {
  pr: 'lnbcrt-hosted-invoice',
  routes: [],
  proof: {
    version: 1,
    recipient_pubkey: '02cafe',
    host_pubkey: '03aabb',
    batch_id: 'batch-1',
    hash_index: 3,
    payment_hash: 'deadbeef',
    batch_root: 'root',
    batch_size: 10,
    merkle_proof: [{ sibling: 'aa', side: 'left' }],
    batch_sig: 'sig',
    created_at: 1,
    expires_at: 2,
  },
};

function makeWallet() {
  return {
    connectPeer: jest.fn().mockResolvedValue(undefined),
    listChannels: jest.fn().mockResolvedValue([]),
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

/**
 * Serves the three endpoints this flow touches: LNURL discovery, the pubkey →
 * address lookup, and the pay callback.
 */
function mockLsp(discovery: unknown = DISCOVERY_WIRE) {
  const calls: string[] = [];
  global.fetch = jest.fn(async (url: any) => {
    const u = String(url);
    calls.push(u);
    let body: unknown;
    if (u.includes('/.well-known/lnurlp/')) body = discovery;
    else if (u.includes('/lightning_address/by_pubkey/'))
      body = { username: 'alice', domain: 'lsp.example' };
    else body = CALLBACK_WIRE;
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(body),
      json: async () => body,
    };
  }) as any;
  return calls;
}

const callbackCalls = (calls: string[]) =>
  calls.filter((c) => c.includes('/pay/callback/'));

describe('requestExternalInvoice', () => {
  it('quotes the convertible asset by default and does not pay it', async () => {
    const calls = mockLsp();
    const wallet = makeWallet();
    const lsp = new UtexoLsp(wallet, PEER);

    const inv = await lsp.requestExternalInvoice({
      address: ADDRESS,
      amtMsat: 3_000_000,
      assetAmount: 500_000,
    });

    expect(inv.invoice).toBe('lnbcrt-hosted-invoice');
    expect(inv.assetId).toBe(BRIDGE);
    expect(inv.asset?.ticker).toBe('BUSDT');
    expect(inv.assetAmount).toBe(500_000);
    expect(inv.converted).toBe(true);
    expect(inv.address).toBe(ADDRESS);
    // Hosted invoice: quoting must never move money from this wallet.
    expect(wallet.payLightningInvoice).not.toHaveBeenCalled();

    const cb = callbackCalls(calls)[0];
    expect(cb).toContain(`asset_id=${encodeURIComponent(BRIDGE)}`);
    expect(cb).toContain('asset_amount=500000');
    expect(cb).toContain('amount=3000000');
  });

  it('surfaces the APay proof payment hash', async () => {
    mockLsp();
    const lsp = new UtexoLsp(makeWallet(), PEER);
    const inv = await lsp.requestExternalInvoice({
      address: ADDRESS,
      amtMsat: 3_000_000,
      assetAmount: 500_000,
    });

    expect(inv.paymentHash).toBe('deadbeef');
    expect(inv.proof?.hashIndex).toBe(3);
  });

  it('accepts a ticker instead of a contract id, case-insensitively', async () => {
    const calls = mockLsp();
    const lsp = new UtexoLsp(makeWallet(), PEER);

    const inv = await lsp.requestExternalInvoice({
      address: ADDRESS,
      amtMsat: 3_000_000,
      assetAmount: 500_000,
      asset: 'lnusdt',
    });

    expect(inv.assetId).toBe(PAYOUT);
    expect(inv.converted).toBe(false);
    expect(callbackCalls(calls)[0]).toContain(
      `asset_id=${encodeURIComponent(PAYOUT)}`
    );
  });

  it('honours prefer:"payout"', async () => {
    mockLsp();
    const lsp = new UtexoLsp(makeWallet(), PEER);
    const inv = await lsp.requestExternalInvoice({
      address: ADDRESS,
      amtMsat: 3_000_000,
      assetAmount: 500_000,
      prefer: 'payout',
    });

    expect(inv.assetId).toBe(PAYOUT);
    expect(inv.converted).toBe(false);
  });

  it('rejects an unknown asset without burning a hash', async () => {
    const calls = mockLsp();
    const lsp = new UtexoLsp(makeWallet(), PEER);

    const err = await lsp
      .requestExternalInvoice({
        address: ADDRESS,
        amtMsat: 3_000_000,
        assetAmount: 500_000,
        asset: 'USDT',
      })
      .catch((e: any) => e);

    expect(err).toBeInstanceOf(LspUnknownPayableAssetError);
    expect(err.accepted.map((a: any) => a.ticker)).toEqual(['LNUSDT', 'BUSDT']);
    // The reservation happens in the callback — it must not have been reached.
    expect(callbackCalls(calls)).toHaveLength(0);
  });

  it('refuses to guess between two convertible assets', async () => {
    const third = { ...BRIDGE_WIRE, asset_id: 'rgb:xusdt', ticker: 'XUSDT' };
    const calls = mockLsp({
      ...DISCOVERY_WIRE,
      accepted_assets: [PAYOUT_WIRE, BRIDGE_WIRE, third],
    });
    const lsp = new UtexoLsp(makeWallet(), PEER);

    const err = await lsp
      .requestExternalInvoice({
        address: ADDRESS,
        amtMsat: 3_000_000,
        assetAmount: 500_000,
      })
      .catch((e: any) => e);

    expect(err).toBeInstanceOf(LspAmbiguousPayableAssetError);
    expect(err.candidates.map((a: any) => a.ticker)).toEqual([
      'BUSDT',
      'XUSDT',
    ]);
    expect(callbackCalls(calls)).toHaveLength(0);
  });

  it('falls back to the payout asset when nothing is convertible', async () => {
    mockLsp({ ...DISCOVERY_WIRE, accepted_assets: [PAYOUT_WIRE] });
    const lsp = new UtexoLsp(makeWallet(), PEER);

    const inv = await lsp.requestExternalInvoice({
      address: ADDRESS,
      amtMsat: 3_000_000,
      assetAmount: 500_000,
    });

    expect(inv.assetId).toBe(PAYOUT);
    expect(inv.converted).toBe(false);
  });

  it('reports an address with no payable asset as such', async () => {
    mockLsp({
      callback: DISCOVERY_WIRE.callback,
      minSendable: 1000,
      maxSendable: 3_000_000,
    });
    const lsp = new UtexoLsp(makeWallet(), PEER);

    await expect(
      lsp.requestExternalInvoice({
        address: ADDRESS,
        amtMsat: 3_000_000,
        assetAmount: 500_000,
      })
    ).rejects.toBeInstanceOf(LspNoPayableAssetError);
  });

  it('defaults to this wallet’s own address', async () => {
    const calls = mockLsp();
    const lsp = new UtexoLsp(makeWallet(), PEER);

    const inv = await lsp.requestExternalInvoice({
      amtMsat: 3_000_000,
      assetAmount: 500_000,
    });

    expect(inv.address).toBe(ADDRESS);
    expect(inv.username).toBe('alice');
    expect(
      calls.some((c) => c.includes('/lightning_address/by_pubkey/02cafe'))
    ).toBe(true);
  });

  it('rejects a non-positive assetAmount before any network call', async () => {
    const calls = mockLsp();
    const lsp = new UtexoLsp(makeWallet(), PEER);

    await expect(
      lsp.requestExternalInvoice({
        address: ADDRESS,
        amtMsat: 3_000_000,
        assetAmount: 0,
      })
    ).rejects.toThrow(/positive/);
    expect(calls).toHaveLength(0);
  });
});

describe('listPayableAssets', () => {
  it('splits discovery into payout and convertible', async () => {
    mockLsp();
    const lsp = new UtexoLsp(makeWallet(), PEER);
    const menu = await lsp.listPayableAssets(ADDRESS);

    expect(menu.payoutAsset?.assetId).toBe(PAYOUT);
    expect(menu.accepted.map((a: any) => a.assetId)).toEqual([PAYOUT, BRIDGE]);
    expect(menu.convertible.map((a: any) => a.assetId)).toEqual([BRIDGE]);
  });
});

describe('quoteAddress', () => {
  it('returns the invoice without paying, unlike payAddress', async () => {
    mockLsp();
    const wallet = makeWallet();
    const lsp = new UtexoLsp(wallet, PEER);

    const quote = await lsp.quoteAddress({
      address: ADDRESS,
      amtMsat: 3_000_000,
      asset: { assetId: BRIDGE, assetAmount: 500_000 },
    });
    expect(quote.invoice).toBe('lnbcrt-hosted-invoice');
    expect(quote.amtMsat).toBe(3_000_000);
    expect(wallet.payLightningInvoice).not.toHaveBeenCalled();

    await lsp.payAddress({
      address: ADDRESS,
      amtMsat: 3_000_000,
      asset: { assetId: BRIDGE, assetAmount: 500_000 },
    });
    expect(wallet.payLightningInvoice).toHaveBeenCalledWith({
      lnInvoice: 'lnbcrt-hosted-invoice',
    });
  });
});

// ── receiveAsset: the on-chain leg's asset is the LSP's to resolve ───────────
//
// The receiver names only what it is paid in over Lightning. Asking for the
// canonical asset a sender actually holds means omitting asset_id, not
// configuring its contract id here.

const RECEIVE_WIRE = {
  ln_invoice: 'lnbcrt-user-invoice',
  rgb_invoice: 'rgb:invoice-from-lsp',
  mapping_id: 42,
  rgb_asset_id: BRIDGE,
  converted: true,
};

function mockReceiveLsp() {
  const bodies: any[] = [];
  global.fetch = jest.fn(async (url: any, init: any) => {
    if (init?.body) bodies.push(JSON.parse(String(init.body)));
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(RECEIVE_WIRE),
      json: async () => RECEIVE_WIRE,
    };
  }) as any;
  return bodies;
}

describe('receiveAsset', () => {
  it('omits asset_id by default so the LSP picks the on-chain asset', async () => {
    const bodies = mockReceiveLsp();
    const lsp = new UtexoLsp(makeWallet(), PEER);

    const res = await lsp.receiveAsset({
      assetId: PAYOUT,
      amountSats: 3000,
      amountRgb: 500_000,
    });

    expect(bodies[0].rgb_invoice).not.toHaveProperty('asset_id');
    expect(res.onchainAssetId).toBe(BRIDGE);
    expect(res.converted).toBe(true);
    expect(res.rgbInvoice).toBe('rgb:invoice-from-lsp');
    expect(res.mappingId).toBe('42');
  });

  it('sends asset_id when the caller asks for one asset end to end', async () => {
    const bodies = mockReceiveLsp();
    const lsp = new UtexoLsp(makeWallet(), PEER);

    await lsp.receiveAsset({
      assetId: PAYOUT,
      amountSats: 3000,
      amountRgb: 500_000,
      onchainAsset: 'payout',
    });

    expect(bodies[0].rgb_invoice.asset_id).toBe(PAYOUT);
  });

  it('defaults converted to false on an LSP that omits the field', async () => {
    global.fetch = jest.fn(async () => {
      const body = { ln_invoice: 'ln', rgb_invoice: 'rgb', mapping_id: 1 };
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(body),
        json: async () => body,
      };
    }) as any;
    const lsp = new UtexoLsp(makeWallet(), PEER);

    const res = await lsp.receiveAsset({
      assetId: PAYOUT,
      amountSats: 3000,
      amountRgb: 500_000,
    });

    expect(res.converted).toBe(false);
    expect(res.onchainAssetId).toBeUndefined();
  });
});

// ── onEachPoll is honoured by every wait loop ────────────────────────────────
//
// WaitOptions documents it as "called at the start of each poll iteration", and
// regtest flows use it to mine and to refresh a counterparty. A loop that skips
// it does not just miss a callback: it waits for chain work that nothing is
// doing, and reports a timeout that no amount of waiting would have fixed.

describe('WaitOptions.onEachPoll', () => {
  it('runs on every poll of awaitReceiveSettlement', async () => {
    const wallet = makeWallet();
    let settleAfter = 3;
    wallet.getLightningReceiveStatus = jest.fn(async () =>
      --settleAfter > 0 ? 'Pending' : 'Succeeded'
    );
    const lsp = new UtexoLsp(wallet, PEER);

    const ticks: number[] = [];
    const outcome = await lsp.awaitReceiveSettlement('lnbcrt1', {
      pollIntervalMs: 1,
      timeoutMs: 5_000,
      onEachPoll: async () => {
        ticks.push(Date.now());
      },
    });

    expect(outcome).toBe('settled');
    expect(ticks.length).toBeGreaterThanOrEqual(2);
  });

  it('runs on every poll of waitForOutboundLiquidity', async () => {
    const wallet = makeWallet();
    let ready = false;
    wallet.listChannels = jest.fn(async () =>
      ready
        ? [
            {
              channelId: 'c1',
              peerPubkey: PEER.peerPubkey,
              isUsable: true,
              outboundBalanceMsat: 10_000,
            },
          ]
        : []
    );
    const lsp = new UtexoLsp(wallet, PEER);

    let ticks = 0;
    await lsp.waitForOutboundLiquidity(5_000, {
      pollIntervalMs: 1,
      timeoutMs: 5_000,
      onEachPoll: async () => {
        ticks++;
        ready = true;
      },
    });

    expect(ticks).toBeGreaterThanOrEqual(1);
  });
});
