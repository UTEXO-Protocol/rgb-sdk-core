import {
  isUmaAddress,
  normalizeLightningAddress,
  parseLightningAddress,
  UMA_MAX_USERNAME_LENGTH,
  UMA_PREFIX,
  ValidationError,
} from '../dist/index.mjs';

describe('both address formats resolve identically', () => {
  // The whole point of the utility: a caller may paste either form.
  it('parses recipient@example.com and $recipient@example.com to the same parts', () => {
    const plain = parseLightningAddress('recipient@example.com');
    const uma = parseLightningAddress('$recipient@example.com');

    expect(plain.username).toBe('recipient');
    expect(uma.username).toBe('recipient');
    expect(plain.domain).toBe('example.com');
    expect(uma.domain).toBe('example.com');
    expect(plain.address).toBe('recipient@example.com');
    expect(uma.address).toBe('recipient@example.com');
  });

  it('still reports which form was given', () => {
    expect(parseLightningAddress('recipient@example.com').isUma).toBe(false);
    expect(parseLightningAddress('$recipient@example.com').isUma).toBe(true);
  });
});

describe('isUmaAddress', () => {
  it('detects the $ prefix', () => {
    expect(isUmaAddress('$bob@example.com')).toBe(true);
    expect(isUmaAddress('bob@example.com')).toBe(false);
  });

  it('tolerates surrounding whitespace', () => {
    expect(isUmaAddress('  $bob@example.com  ')).toBe(true);
  });

  it('does not throw on non-strings', () => {
    expect(isUmaAddress(undefined as unknown as string)).toBe(false);
    expect(isUmaAddress(null as unknown as string)).toBe(false);
  });
});

describe('normalizeLightningAddress', () => {
  it('strips the UMA prefix', () => {
    expect(normalizeLightningAddress('$bob@example.com')).toBe(
      'bob@example.com'
    );
  });

  it('is idempotent', () => {
    const once = normalizeLightningAddress('$bob@example.com');
    expect(normalizeLightningAddress(once)).toBe('bob@example.com');
  });

  it('passes plain addresses through untouched', () => {
    expect(normalizeLightningAddress('bob@example.com')).toBe(
      'bob@example.com'
    );
  });

  it('trims whitespace', () => {
    expect(normalizeLightningAddress('  $bob@example.com ')).toBe(
      'bob@example.com'
    );
  });

  it('lowercases UMA addresses (UMAD-01 case-insensitive)', () => {
    expect(normalizeLightningAddress('$Bob@Example.COM')).toBe(
      'bob@example.com'
    );
  });

  it('preserves case for plain addresses', () => {
    // No spec licenses folding these, and some providers are case-sensitive.
    expect(normalizeLightningAddress('Bob@Example.com')).toBe(
      'Bob@Example.com'
    );
  });

  it('throws on non-strings', () => {
    expect(() => normalizeLightningAddress(42 as unknown as string)).toThrow(
      ValidationError
    );
  });
});

describe('parseLightningAddress', () => {
  it('keeps the port in the domain', () => {
    // payAddress relies on this for regtest / Android emulator hosts.
    expect(parseLightningAddress('bob@localhost:3000').domain).toBe(
      'localhost:3000'
    );
    expect(parseLightningAddress('$bob@10.0.2.2:8080').domain).toBe(
      '10.0.2.2:8080'
    );
  });

  it('rejects empty and malformed input', () => {
    expect(() => parseLightningAddress('')).toThrow(ValidationError);
    expect(() => parseLightningAddress('   ')).toThrow(ValidationError);
    expect(() => parseLightningAddress('bob')).toThrow(ValidationError);
    expect(() => parseLightningAddress('@example.com')).toThrow(
      ValidationError
    );
    expect(() => parseLightningAddress('bob@')).toThrow(ValidationError);
    expect(() => parseLightningAddress('$@example.com')).toThrow(
      ValidationError
    );
    expect(() => parseLightningAddress(UMA_PREFIX)).toThrow(ValidationError);
  });

  it('rejects more than one @ instead of silently misparsing', () => {
    expect(() => parseLightningAddress('a@b@c')).toThrow(ValidationError);
  });

  it('rejects embedded whitespace', () => {
    expect(() => parseLightningAddress('bo b@example.com')).toThrow(
      ValidationError
    );
    expect(() => parseLightningAddress('bob@exa mple.com')).toThrow(
      ValidationError
    );
  });

  describe('UMAD-01 username rules — enforced only for $ addresses', () => {
    it('allows the documented character set, including +', () => {
      const a = parseLightningAddress('$a-b_c.d+e@example.com');
      expect(a.username).toBe('a-b_c.d+e');
    });

    it('rejects characters outside the set', () => {
      expect(() => parseLightningAddress('$bo b@example.com')).toThrow(
        ValidationError
      );
      expect(() => parseLightningAddress('$bob!@example.com')).toThrow(
        ValidationError
      );
    });

    it('caps the username at 64 chars INCLUDING the $', () => {
      const max = 'a'.repeat(UMA_MAX_USERNAME_LENGTH - 1); // 63 + '$' = 64
      expect(parseLightningAddress(`$${max}@example.com`).username).toBe(max);

      const tooLong = 'a'.repeat(UMA_MAX_USERNAME_LENGTH); // 64 + '$' = 65
      expect(() => parseLightningAddress(`$${tooLong}@example.com`)).toThrow(
        ValidationError
      );
    });

    it('does not apply those rules to plain addresses', () => {
      // A plain address that would violate UMA's rules must keep working —
      // this change has to stay non-breaking.
      const long = 'a'.repeat(UMA_MAX_USERNAME_LENGTH + 10);
      expect(parseLightningAddress(`${long}@example.com`).username).toBe(long);
      expect(parseLightningAddress('Bob~Smith@example.com').username).toBe(
        'Bob~Smith'
      );
    });
  });
});
