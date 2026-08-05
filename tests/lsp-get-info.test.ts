import { jest } from '@jest/globals';
import { UtexoLSPClient, LspError } from '../dist/index.mjs';

const WIRE = {
  api_version: 1,
  pubkey: '0312c36f',
  network: 'signet',
  host: 'lsp-signet.utexo.com',
  port: 9735,
  supported_assets: [
    {
      asset_id: 'rgb:asset-1',
      schema: 'Ifa',
      ticker: 'UTIF',
      name: 'UTEXO Test IFA',
      precision: 8,
    },
  ],
  min_payment_size_msat: '1000',
  max_payment_size_msat: '20000000',
  min_channel_balance_sat: '200000',
  max_channel_balance_sat: '200000',
  min_initial_client_balance_msat: '0',
  max_initial_client_balance_msat: '0',
  min_channel_asset_amount: '1',
  // u64::MAX — the value that silently corrupts when parsed as a JSON number.
  max_channel_asset_amount: '18446744073709551615',
  virtual_channel_mode: 'trusted_no_broadcast',
  lightning_address_min_sendable_msat: '1000',
  lightning_address_max_sendable_msat: '3000000',
};

const origFetch = global.fetch;
afterEach(() => {
  global.fetch = origFetch;
});

function mockGetInfo(body: unknown) {
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  })) as any;
}

function client() {
  return new UtexoLSPClient({ baseUrl: 'https://lsp.example' });
}

describe('getInfo', () => {
  it('maps the wire shape to camelCase', async () => {
    mockGetInfo(WIRE);
    const info = await client().getInfo();

    expect(info.apiVersion).toBe(1);
    expect(info.pubkey).toBe('0312c36f');
    expect(info.network).toBe('signet');
    expect(info.host).toBe('lsp-signet.utexo.com');
    expect(info.port).toBe(9735);
    expect(info.virtualChannelMode).toBe('trusted_no_broadcast');
    expect(info.supportedAssets).toEqual([
      {
        assetId: 'rgb:asset-1',
        schema: 'Ifa',
        ticker: 'UTIF',
        name: 'UTEXO Test IFA',
        precision: 8,
      },
    ]);
  });

  it('parses u64 strings as bigint without precision loss', async () => {
    mockGetInfo(WIRE);
    const info = await client().getInfo();

    expect(info.minPaymentSizeMsat).toBe(1000n);
    expect(info.maxPaymentSizeMsat).toBe(20_000_000n);
    expect(info.minChannelBalanceSat).toBe(200_000n);
    expect(info.lightningAddressMaxSendableMsat).toBe(3_000_000n);
    // Number() would yield 18446744073709552000 here.
    expect(info.maxChannelAssetAmount).toBe(18446744073709551615n);
  });

  it('builds the connectPeer URI without parsing anything', async () => {
    mockGetInfo(WIRE);
    const info = await client().getInfo();
    expect(`${info.pubkey}@${info.host}:${info.port}`).toBe(
      '0312c36f@lsp-signet.utexo.com:9735'
    );
  });

  it('tolerates an LSP that publishes no address', async () => {
    mockGetInfo({ ...WIRE, host: undefined, port: undefined });
    const info = await client().getInfo();
    expect(info.host).toBeUndefined();
    expect(info.port).toBeUndefined();
  });

  it('reports a malformed amount as an LspError, not a SyntaxError', async () => {
    mockGetInfo({ ...WIRE, min_payment_size_msat: 'not-a-number' });
    await expect(client().getInfo()).rejects.toBeInstanceOf(LspError);
    await expect(client().getInfo()).rejects.toThrow('min_payment_size_msat');
  });
});
