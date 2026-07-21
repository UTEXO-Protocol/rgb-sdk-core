import {
  expectFields,
  expectEach,
  expectNoWireKeys,
  report,
  HEX_32,
  HEX_PUBKEY,
} from '../dist/conformance/index.mjs';

/**
 * A verification helper that never fails is worse than no helper — it turns a
 * green suite into a lie. So each check here is asserted in both directions:
 * it accepts what it should, and it *rejects* what it should.
 */

const NODE_INFO = {
  pubkey: 'a'.repeat(66),
  blockHeight: 137,
  network: 'regtest',
  numChannels: 2,
  balance: { settled: 100, future: 0, spendable: 100 },
};

describe('expectFields — accepts valid shapes', () => {
  it('checks type, bounds, enum and pattern together', () => {
    expect(() =>
      expectFields(NODE_INFO, {
        'pubkey': { type: 'string', pattern: HEX_PUBKEY },
        'blockHeight': { type: 'number', min: 1 },
        'network': { oneOf: ['regtest', 'testnet', 'mainnet', 'utexo'] },
        'balance.settled': { type: 'number', min: 0 },
      })
    ).not.toThrow();
  });

  it('returns the value so calls can be inlined', () => {
    expect(expectFields(NODE_INFO, { pubkey: { type: 'string' } })).toBe(
      NODE_INFO
    );
  });

  it('allows an absent field only when optional', () => {
    expect(() =>
      expectFields(NODE_INFO, { alias: { type: 'string', optional: true } })
    ).not.toThrow();
  });
});

describe('expectFields — rejects invalid shapes', () => {
  it('rejects a missing required field', () => {
    expect(() =>
      expectFields(NODE_INFO, { alias: { type: 'string' } })
    ).toThrow(/alias: is required but missing/);
  });

  it('rejects a wrong type', () => {
    expect(() =>
      expectFields(NODE_INFO, { blockHeight: { type: 'string' } })
    ).toThrow(/blockHeight: expected string/);
  });

  it('rejects an empty string when nonEmpty', () => {
    expect(() =>
      expectFields({ pubkey: '' }, { pubkey: { nonEmpty: true } })
    ).toThrow(/must not be empty/);
  });

  it('rejects an empty array when nonEmpty', () => {
    expect(() =>
      expectFields({ items: [] }, { items: { nonEmpty: true } })
    ).toThrow(/must not be empty/);
  });

  it('rejects a value below min', () => {
    expect(() =>
      expectFields({ blockHeight: 0 }, { blockHeight: { min: 1 } })
    ).toThrow(/must be >= 1/);
  });

  it('rejects a value above max', () => {
    expect(() => expectFields({ n: 11 }, { n: { max: 10 } })).toThrow(
      /must be <= 10/
    );
  });

  it('rejects a value outside oneOf — the canonical-status case', () => {
    expect(() =>
      expectFields(
        { status: 'SUCCEEDED' },
        { status: { oneOf: ['Succeeded', 'Pending'] } }
      )
    ).toThrow(/must be one of/);
  });

  it('rejects a malformed txid', () => {
    expect(() =>
      expectFields({ txid: 'not-a-txid' }, { txid: { pattern: HEX_32 } })
    ).toThrow(/must match/);
  });

  it('names the failing field, not the whole object', () => {
    expect(() =>
      expectFields(NODE_INFO, { 'balance.settled': { type: 'string' } }, 'info')
    ).toThrow(/^info\.balance\.settled:/);
  });

  it('rejects a non-object target', () => {
    expect(() => expectFields(null, { a: { type: 'string' } })).toThrow(
      /expected an object/
    );
  });

  it('treats null as missing, not as a value', () => {
    expect(() =>
      expectFields({ alias: null }, { alias: { type: 'string' } })
    ).toThrow(/is required but missing/);
  });
});

describe('expectFields — nested and array specs', () => {
  it('validates each array element via `each`', () => {
    expect(() =>
      expectFields(
        { amounts: [1, 2, 3] },
        { amounts: { type: 'array', each: { type: 'number', min: 1 } } }
      )
    ).not.toThrow();
  });

  it('reports the failing index', () => {
    expect(() =>
      expectFields(
        { amounts: [1, 0] },
        { amounts: { each: { type: 'number', min: 1 } } }
      )
    ).toThrow(/amounts\[1\]: must be >= 1/);
  });

  it('expectEach validates a list of objects', () => {
    expect(() =>
      expectEach(
        [{ channelId: 'a' }, { channelId: '' }],
        { channelId: { type: 'string', nonEmpty: true } },
        'channels'
      )
    ).toThrow(/channels\[1\]\.channelId: must not be empty/);
  });
});

describe('expectNoWireKeys', () => {
  it('accepts a fully mapped domain object', () => {
    expect(() => expectNoWireKeys(NODE_INFO)).not.toThrow();
  });

  it('rejects a snake_case key without being told its name', () => {
    // The point of auto-detection: a *new* field that starts leaking is caught
    // even though no list mentions it.
    expect(() => expectNoWireKeys({ pub_key: 'a' })).toThrow(
      /pub_key: wire-shaped \(snake_case\) key survived/
    );
  });

  it('finds a leaked key nested inside an array', () => {
    expect(() =>
      expectNoWireKeys({ channels: [{ ok: 1 }, { short_channel_id: 7 }] })
    ).toThrow(/channels\[1\]\.short_channel_id/);
  });

  it('rejects named camelCase wire keys that snake-case detection cannot see', () => {
    // `LightningChannel.public` — the domain name is `isPublic`.
    expect(() =>
      expectNoWireKeys({ channelId: 'a', public: true }, ['public'])
    ).toThrow(/public' survived the mapper/);
  });

  it('does not choke on a cyclic object', () => {
    const a: Record<string, unknown> = { name: 'a' };
    a.self = a;
    expect(() => expectNoWireKeys(a)).not.toThrow();
  });

  it('ignores camelCase and single-word keys', () => {
    expect(() =>
      expectNoWireKeys({ blockHeight: 1, txid: 'x', a1: 2 })
    ).not.toThrow();
  });
});

describe('report', () => {
  const original = console.log;
  afterEach(() => {
    console.log = original;
    delete process.env.RGB_E2E_QUIET;
  });

  it('prints the payload', () => {
    let out = '';
    console.log = (s?: unknown) => {
      out += String(s);
    };
    report('getNodeInfo', NODE_INFO);
    expect(out).toContain('getNodeInfo');
    expect(out).toContain('blockHeight');
  });

  it('serialises bigint rather than throwing', () => {
    let out = '';
    console.log = (s?: unknown) => {
      out += String(s);
    };
    report('amounts', { amtMsat: 1000n });
    expect(out).toContain('1000n');
  });

  it('is silenced by RGB_E2E_QUIET', () => {
    let called = false;
    console.log = () => {
      called = true;
    };
    process.env.RGB_E2E_QUIET = '1';
    report('x', {});
    expect(called).toBe(false);
  });
});
