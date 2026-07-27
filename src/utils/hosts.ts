/**
 * Host classification shared by LSP transport and LNURL discovery.
 *
 * Mirrors the `LOOPBACK_HOSTS` rule in `wdk-rgb-lightning/src/lsp-client.js`
 * so the two packages agree on what counts as a local stack.
 */

/**
 * Hostnames treated as a local development stack. `10.0.2.2` is the Android
 * emulator's host-loopback alias; `0.0.0.0` shows up when a daemon is bound to
 * all interfaces. These are the hosts allowed to speak plain HTTP.
 */
export const LOOPBACK_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '10.0.2.2',
]);

/**
 * Extract the bare hostname from a URL, an `host:port` authority, or a bare
 * host. IPv6 literals are unwrapped from their brackets. Returns `''` when the
 * input cannot be understood.
 */
export function hostnameOf(hostOrUrl: string): string {
  const raw = typeof hostOrUrl === 'string' ? hostOrUrl.trim() : '';
  if (!raw) return '';

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    try {
      return new URL(raw).hostname.replace(/^\[|\]$/g, '').toLowerCase();
    } catch {
      return '';
    }
  }

  if (raw.startsWith('[')) {
    const end = raw.indexOf(']');
    if (end > 0) return raw.slice(1, end).toLowerCase();
    return '';
  }

  const parts = raw.split(':');
  // 1 part → bare host; 2 → host:port; more → a bare IPv6 literal such as `::1`.
  if (parts.length === 2) return parts[0].toLowerCase();
  return raw.toLowerCase();
}

/** True when the host belongs to a local development stack. */
export function isLoopbackHost(hostOrUrl: string): boolean {
  return LOOPBACK_HOSTS.has(hostnameOf(hostOrUrl));
}

/**
 * Whether a Lightning Address domain points at the LSP we are configured
 * against — i.e. whether LNURL discovery should go through the LSP client
 * (which carries our bearer token and host rewriting) or out to the open
 * internet.
 *
 * Ports are deliberately ignored — one stack routinely serves the LSP API and
 * the address endpoint on different ports.
 *
 * A loopback *address domain* always counts as ours, whatever `baseUrl` says.
 * An LSP commonly advertises addresses on a loopback domain while being reached
 * over another host: regtest sets `LIGHTNING_ADDRESS_DOMAIN_URL=http://127.0.0.1:8080`
 * yet the Android emulator talks to `http://10.0.2.2:8080`. Such a domain can
 * only ever be served by the stack we are already pointed at — fetching it as a
 * public host would hit the device itself.
 */
export function isSameLspHost(domain: string, baseUrl: string): boolean {
  const a = hostnameOf(domain);
  const b = hostnameOf(baseUrl);
  if (!a || !b) return false;
  if (a === b) return true;
  return LOOPBACK_HOSTS.has(a);
}

/**
 * Build the LUD-16 discovery URL for an address hosted elsewhere. Loopback
 * hosts get plain HTTP; everything else is forced to HTTPS.
 */
export function lnurlDiscoveryUrl(domain: string, username: string): string {
  const scheme = isLoopbackHost(domain) ? 'http' : 'https';
  return `${scheme}://${domain}/.well-known/lnurlp/${encodeURIComponent(username)}`;
}
