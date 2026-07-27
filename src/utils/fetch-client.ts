/**
 * Minimal HTTP client wrapping the native fetch API.
 * Works in Node.js 18+, browsers, React Native, and Bare runtime.
 *
 * Injectable transport for core clients (e.g. the LSP client) so platforms
 * are never forced onto a specific HTTP stack.
 */
export class FetchClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL.replace(/\/+$/, '');
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<{ data: T }> {
    const res = await fetch(`${this.baseURL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const errorBody = await res.text().catch(() => '');
      const error = new Error(errorBody || `HTTP ${res.status}`) as Error & {
        response?: { status: number; data: string };
      };
      error.response = { status: res.status, data: errorBody };
      throw error;
    }
    const data = (await res.json()) as T;
    return { data };
  }

  async get<T = unknown>(
    path: string,
    options?: { params?: Record<string, string | number> }
  ): Promise<{ data: T }> {
    let url = `${this.baseURL}${path}`;
    if (options?.params) {
      const qs = new URLSearchParams(
        Object.entries(options.params).map(([k, v]) => [k, String(v)])
      ).toString();
      url += `?${qs}`;
    }
    const res = await fetch(url);
    if (!res.ok) {
      const errorBody = await res.text().catch(() => '');
      const error = new Error(errorBody || `HTTP ${res.status}`) as Error & {
        response?: { status: number; data: string };
      };
      error.response = { status: res.status, data: errorBody };
      throw error;
    }
    const data = (await res.json()) as T;
    return { data };
  }
}
