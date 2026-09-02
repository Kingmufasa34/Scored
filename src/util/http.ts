import { log } from '../logger.js';

export interface FetchJsonOptions {
  headers?: Record<string, string>;
  /** Number of retries on network error / 5xx. */
  retries?: number;
  /** Base backoff in ms (doubles each attempt). */
  backoffMs?: number;
  timeoutMs?: number;
}

/** HTTP Basic auth header value. */
export function basicAuth(username: string, password: string): string {
  return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
}

/**
 * Fetch JSON with retry/backoff. Throws `HttpError` on non-2xx after retries.
 * 4xx responses are not retried (they won't get better).
 */
export async function fetchJson<T>(url: string, opts: FetchJsonOptions = {}): Promise<T> {
  const retries = opts.retries ?? 3;
  const backoffMs = opts.backoffMs ?? 500;
  const timeoutMs = opts.timeoutMs ?? 15_000;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', ...opts.headers },
        signal: controller.signal,
      });
      if (res.ok) {
        return (await res.json()) as T;
      }
      const body = await res.text().catch(() => '');
      // Client errors are terminal.
      if (res.status >= 400 && res.status < 500) {
        throw new HttpError(res.status, url, body);
      }
      lastErr = new HttpError(res.status, url, body);
    } catch (err) {
      lastErr = err;
      if (err instanceof HttpError && err.status >= 400 && err.status < 500) {
        throw err;
      }
    } finally {
      clearTimeout(timer);
    }

    if (attempt < retries) {
      const wait = backoffMs * 2 ** attempt;
      log.debug(`fetch retry ${attempt + 1}/${retries} for ${url} in ${wait}ms`);
      await sleep(wait);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    public readonly body: string,
  ) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'HttpError';
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
