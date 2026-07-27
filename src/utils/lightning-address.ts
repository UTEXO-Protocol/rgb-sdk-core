import { ValidationError } from '../errors';

/**
 * Lightning Address / UMA address helpers.
 *
 * UMA (https://www.uma.me) addresses are Lightning Addresses carrying a leading
 * `$` — see UMAD-01. Per that spec they "are valid Lightning Addresses when the
 * leading $ is stripped", so accepting both formats is a normalization concern
 * rather than a protocol one, and it lets callers paste either form.
 *
 * Scope: this is address-format compatibility only, NOT UMA protocol support.
 * Signed LNURLP requests (`signature` / `nonce` / `timestamp` / `vasp_domain`),
 * payer identity and compliance data, the `/.well-known/lnurlpubkey` key
 * exchange and currency negotiation are all out of scope. A `$` address only
 * resolves here if its provider also serves plain LNURL-pay.
 */

/** The prefix that distinguishes a UMA address from a plain Lightning Address. */
export const UMA_PREFIX = '$';

/**
 * Maximum length of a UMA username *including* the `$`, per UMAD-01. The bare
 * username therefore has one character less to work with.
 */
export const UMA_MAX_USERNAME_LENGTH = 64;

/** Character set UMAD-01 permits in a username. Note `+` is allowed. */
const UMA_USERNAME_RE = /^[a-z0-9\-_.+]+$/;

export interface ParsedLightningAddress {
  /** Local part, with any `$` stripped. */
  username: string;
  /** Host part. May carry a port, e.g. `localhost:3000` or `10.0.2.2:8080`. */
  domain: string;
  /** Whether the input carried the UMA `$` prefix. */
  isUma: boolean;
  /** Canonical `username@domain` — never has the `$`. */
  address: string;
}

/** True when `address` carries the UMA `$` prefix. */
export function isUmaAddress(address: string): boolean {
  return typeof address === 'string' && address.trim().startsWith(UMA_PREFIX);
}

/**
 * Convert a UMA address to its Lightning Address form: `$bob@x.com` →
 * `bob@x.com`. Idempotent — a plain Lightning Address is returned trimmed and
 * otherwise untouched.
 *
 * UMA addresses are lowercased because UMAD-01 defines them as case-insensitive
 * (and our LSP lowercases handles server-side). Plain Lightning Addresses keep
 * their case, since nothing licenses us to fold it and some providers are
 * case-sensitive.
 *
 * Purely textual: use {@link parseLightningAddress} when you also want the
 * structure validated.
 */
export function normalizeLightningAddress(address: string): string {
  if (typeof address !== 'string') {
    throw new ValidationError('Lightning Address must be a string', 'address');
  }

  const trimmed = address.trim();
  if (!trimmed.startsWith(UMA_PREFIX)) return trimmed;

  return trimmed.slice(UMA_PREFIX.length).toLowerCase();
}

/**
 * Split a Lightning Address (or UMA address) into its parts, validating as it
 * goes.
 *
 * UMAD-01's username rules (character set, 64-char cap including the `$`) are
 * enforced only for `$`-prefixed input. Plain Lightning Addresses are left to
 * their own provider's rules so that an address which worked before cannot
 * start failing here.
 */
export function parseLightningAddress(address: string): ParsedLightningAddress {
  if (typeof address !== 'string' || address.trim().length === 0) {
    throw new ValidationError(
      'Lightning Address must be a non-empty string',
      'address'
    );
  }

  const trimmed = address.trim();
  const isUma = trimmed.startsWith(UMA_PREFIX);
  const bare = normalizeLightningAddress(trimmed);

  const parts = bare.split('@');
  if (parts.length !== 2) {
    throw new ValidationError(
      `Invalid Lightning Address: "${address}"`,
      'address'
    );
  }

  const [username, domain] = parts;
  if (!username || !domain || /\s/.test(username) || /[\s/]/.test(domain)) {
    throw new ValidationError(
      `Invalid Lightning Address: "${address}"`,
      'address'
    );
  }

  if (isUma) {
    if (username.length + UMA_PREFIX.length > UMA_MAX_USERNAME_LENGTH) {
      throw new ValidationError(
        `UMA username exceeds ${UMA_MAX_USERNAME_LENGTH} characters ` +
          `(including the "${UMA_PREFIX}"): "${address}"`,
        'address'
      );
    }
    if (!UMA_USERNAME_RE.test(username)) {
      throw new ValidationError(
        `UMA username may only contain a-z 0-9 - _ . + — got "${username}"`,
        'address'
      );
    }
  }

  return { username, domain, isUma, address: `${username}@${domain}` };
}
