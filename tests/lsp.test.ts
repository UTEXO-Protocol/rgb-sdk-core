import { jest } from '@jest/globals';
import {
  UtexoLsp,
  peerUri,
  normalizeReceiveStatus,
  LspChannelTimeoutError,
  LspSettlementError,
} from '../dist/index.mjs';

const PEER = {
  baseUrl: 'https://lsp.example',
  peerPubkey: '03aabb',
  peerHost: 'lsp.example',
  peerPort: 9735,
};

const ASSET = 'rgb:asset-1';

/** Minimal ILspWallet stub — overrides merge over sane defaults. */
function makeWallet(overrides = {}) {
  return {
    connectPeer: jest.fn().mockResolvedValue(undefined),
    listChannels: jest.fn().mockResolvedValue([]),
    getNodeInfo: jest.fn().mockResolvedValue({ pubkey: '02cafe' }),
    listPayments: jest.fn().mockResolvedValue([]),
    createLightningInvoice: jest
      .fn()
      .mockResolvedValue({ lnInvoice: 'lnbc1...' }),
    payLightningInvoice: jest.fn().mockResolvedValue({ txid: 'tx1' }),
    claimHodlInvoice: jest.fn().mockResolvedValue({ changed: true }),
    apayNewWithAddress: jest.fn().mockResolvedValue({
      unusedHashes: 10,
      nextIndexExpected: 11,
      refillBatchSize: 20,
    }),
    syncWallet: jest.fn().mockResolvedValue(undefined),
    getLightningReceiveStatus: jest.fn().mockResolvedValue('Pending'),
    ...overrides,
  };
}

function channel(over = {}) {
  return {
    channelId: 'chan-1',
    peerPubkey: PEER.peerPubkey,
    capacitySat: 100_000,
    ready: true,
    isPublic: false,
    isUsable: true,
    assetId: ASSET,
    outboundBalanceMsat: 50_000_000,
    inboundBalanceMsat: 20_000_000,
    ...over,
  };
}

describe('peerUri', () => {
  it('builds pubkey@host:port', () => {
    expect(peerUri(PEER)).toBe('03aabb@lsp.example:9735');
  });
});

describe('connect', () => {
  it('passes a single peerUri string to connectPeer', async () => {
    // Aligned signature — web previously passed (hostPort, pubkey) as two args.
    const wallet = makeWallet();
    await new UtexoLsp(wallet, PEER).connect();
    expect(wallet.connectPeer).toHaveBeenCalledWith('03aabb@lsp.example:9735');
  });

  it('is idempotent — swallows "already connected"', async () => {
    const wallet = makeWallet({
      connectPeer: jest
        .fn()
        .mockRejectedValue(new Error('Peer already connected')),
    });
    await expect(new UtexoLsp(wallet, PEER).connect()).resolves.toBeUndefined();
  });

  it('rethrows other connect errors', async () => {
    const wallet = makeWallet({
      connectPeer: jest.fn().mockRejectedValue(new Error('no route to host')),
    });
    await expect(new UtexoLsp(wallet, PEER).connect()).rejects.toThrow(
      'no route to host'
    );
  });
});

describe('waitForChannel', () => {
  it('returns ChannelReadyInfo when a usable RGB channel appears', async () => {
    const wallet = makeWallet({
      listChannels: jest.fn().mockResolvedValue([channel()]),
    });
    const info = await new UtexoLsp(wallet, PEER).waitForChannel(ASSET, {
      timeoutMs: 1000,
      pollIntervalMs: 10,
    });
    expect(info).toEqual({
      channelId: 'chan-1',
      peerPubkey: PEER.peerPubkey,
      capacitySat: 100_000,
      outboundBalanceMsat: 50_000_000,
      inboundBalanceMsat: 20_000_000,
    });
  });

  it('ignores channels for a different asset', async () => {
    const wallet = makeWallet({
      listChannels: jest
        .fn()
        .mockResolvedValue([channel({ assetId: 'other' })]),
    });
    await expect(
      new UtexoLsp(wallet, PEER).waitForChannel(ASSET, {
        timeoutMs: 60,
        pollIntervalMs: 10,
      })
    ).rejects.toThrow(LspChannelTimeoutError);
  });

  it('falls back to `ready` when isUsable is absent', async () => {
    const wallet = makeWallet({
      listChannels: jest
        .fn()
        .mockResolvedValue([channel({ isUsable: undefined, ready: true })]),
    });
    const info = await new UtexoLsp(wallet, PEER).waitForChannel(ASSET, {
      timeoutMs: 1000,
      pollIntervalMs: 10,
    });
    expect(info.channelId).toBe('chan-1');
  });

  it('throws LspChannelTimeoutError carrying the assetId', async () => {
    const wallet = makeWallet();
    await expect(
      new UtexoLsp(wallet, PEER).waitForChannel(ASSET, {
        timeoutMs: 60,
        pollIntervalMs: 10,
      })
    ).rejects.toMatchObject({
      name: 'LspChannelTimeoutError',
      assetId: ASSET,
    });
  });

  it('runs onEachPoll before checking (regtest block mining)', async () => {
    const onEachPoll = jest.fn().mockResolvedValue(undefined);
    const wallet = makeWallet({
      listChannels: jest.fn().mockResolvedValue([channel()]),
    });
    await new UtexoLsp(wallet, PEER).waitForChannel(ASSET, {
      timeoutMs: 1000,
      pollIntervalMs: 10,
      onEachPoll,
    });
    expect(onEachPoll).toHaveBeenCalled();
  });
});

describe('waitForOutboundLiquidity', () => {
  it('resolves once outbound balance meets the minimum', async () => {
    const wallet = makeWallet({
      listChannels: jest.fn().mockResolvedValue([channel()]),
    });
    await expect(
      new UtexoLsp(wallet, PEER).waitForOutboundLiquidity(1_000_000, {
        timeoutMs: 1000,
        pollIntervalMs: 10,
      })
    ).resolves.toBeUndefined();
  });

  it('throws LspLiquidityTimeoutError with the last seen balance', async () => {
    // RN's copy silently returned here; web threw. Throwing is correct — a
    // caller that proceeds without liquidity will fail at payment time.
    const wallet = makeWallet({
      listChannels: jest
        .fn()
        .mockResolvedValue([channel({ outboundBalanceMsat: 42 })]),
    });
    await expect(
      new UtexoLsp(wallet, PEER).waitForOutboundLiquidity(1_000_000, {
        timeoutMs: 60,
        pollIntervalMs: 10,
      })
    ).rejects.toMatchObject({
      name: 'LspLiquidityTimeoutError',
      minMsat: 1_000_000,
      lastOutboundMsat: 42,
    });
  });

  it('falls back to localBalanceMsat when outboundBalanceMsat is absent', async () => {
    const wallet = makeWallet({
      listChannels: jest.fn().mockResolvedValue([
        channel({
          outboundBalanceMsat: undefined,
          localBalanceMsat: 2_000_000,
        }),
      ]),
    });
    await expect(
      new UtexoLsp(wallet, PEER).waitForOutboundLiquidity(1_000_000, {
        timeoutMs: 1000,
        pollIntervalMs: 10,
      })
    ).resolves.toBeUndefined();
  });
});

describe('awaitReceiveSettlement', () => {
  it('returns "settled" on Succeeded', async () => {
    const wallet = makeWallet({
      getLightningReceiveStatus: jest.fn().mockResolvedValue('Succeeded'),
    });
    await expect(
      new UtexoLsp(wallet, PEER).awaitReceiveSettlement('lnbc1', {
        timeoutMs: 1000,
        pollIntervalMs: 10,
      })
    ).resolves.toBe('settled');
  });

  it.each([['Failed'], ['Expired'], ['Cancelled']])(
    'throws LspSettlementError on %s',
    async (status) => {
      const wallet = makeWallet({
        getLightningReceiveStatus: jest.fn().mockResolvedValue(status),
      });
      await expect(
        new UtexoLsp(wallet, PEER).awaitReceiveSettlement('lnbc1', {
          timeoutMs: 1000,
          pollIntervalMs: 10,
        })
      ).rejects.toThrow(LspSettlementError);
    }
  );

  it('returns "timed_out" when it stays Pending', async () => {
    const wallet = makeWallet();
    await expect(
      new UtexoLsp(wallet, PEER).awaitReceiveSettlement('lnbc1', {
        timeoutMs: 60,
        pollIntervalMs: 10,
      })
    ).resolves.toBe('timed_out');
  });
});

describe('claimPendingPayments', () => {
  it('claims payments in canonical Claimable/Claiming states', async () => {
    // Previously each SDK did its own String(status).toUpperCase() check
    // against a different field. Now it is the canonical vocabulary.
    const wallet = makeWallet({
      listPayments: jest.fn().mockResolvedValue([
        { paymentHash: 'h1', status: 'Claimable', preimage: 'p1' },
        { paymentHash: 'h2', status: 'Pending' },
        { paymentHash: 'h3', status: 'Claiming', preimage: 'p3' },
        { paymentHash: 'h4', status: 'Succeeded' },
      ]),
    });
    const results = await new UtexoLsp(wallet, PEER).claimPendingPayments();

    expect(results).toEqual([
      { paymentHash: 'h1', claimed: true },
      { paymentHash: 'h3', claimed: true },
    ]);
    expect(wallet.claimHodlInvoice).toHaveBeenCalledWith('h1', 'p1');
    expect(wallet.claimHodlInvoice).toHaveBeenCalledWith('h3', 'p3');
  });

  it('records per-payment failures without aborting the batch', async () => {
    const wallet = makeWallet({
      listPayments: jest.fn().mockResolvedValue([
        { paymentHash: 'h1', status: 'Claimable', preimage: 'p1' },
        { paymentHash: 'h2', status: 'Claimable', preimage: 'p2' },
      ]),
      claimHodlInvoice: jest
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({ changed: true }),
    });
    const results = await new UtexoLsp(wallet, PEER).claimPendingPayments();

    expect(results).toEqual([
      { paymentHash: 'h1', claimed: false, error: 'boom' },
      { paymentHash: 'h2', claimed: true },
    ]);
  });

  it('passes an empty preimage when none is known', async () => {
    const wallet = makeWallet({
      listPayments: jest
        .fn()
        .mockResolvedValue([{ paymentHash: 'h1', status: 'Claimable' }]),
    });
    await new UtexoLsp(wallet, PEER).claimPendingPayments();
    expect(wallet.claimHodlInvoice).toHaveBeenCalledWith('h1', '');
  });
});

describe('normalizeReceiveStatus', () => {
  it.each([
    ['SUCCEEDED', 'Succeeded'],
    ['Settled', 'Succeeded'],
    ['FAILED', 'Failed'],
    ['EXPIRED', 'Expired'],
    ['anything else', 'Pending'],
    [null, 'Pending'],
    [undefined, 'Pending'],
  ])('maps %p -> %s', (raw, expected) => {
    expect(normalizeReceiveStatus(raw)).toBe(expected);
  });
});

describe('abort signal', () => {
  it('aborts a poll loop', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const wallet = makeWallet();
    await expect(
      new UtexoLsp(wallet, PEER).waitForChannel(ASSET, {
        timeoutMs: 1000,
        pollIntervalMs: 10,
        signal: ctrl.signal,
      })
    ).rejects.toThrow(/aborted/i);
  });
});
