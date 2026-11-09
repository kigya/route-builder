import { ApiError } from './types';

export type HttpResponse = {
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
};
export type FetchImplementation = (
  url: string,
  init: {
    method: 'GET' | 'POST';
    signal: AbortSignal;
    headers?: Record<string, string>;
    body?: string;
  }
) => Promise<HttpResponse>;
export type CancellableSleep = (milliseconds: number, signal?: AbortSignal) => Promise<void>;
export type ApiOptions = {
  baseURL: string;
  fetch?: FetchImplementation;
  clock?: () => number;
  sleep?: CancellableSleep;
};
type RequestOptions = { body?: unknown; signal?: AbortSignal | undefined };
export type Transport = {
  request(method: 'GET' | 'POST', path: string, options?: RequestOptions): Promise<unknown>;
};

function cancelled() {
  return new ApiError('cancelled', 'The request was cancelled.', { outcome: 'definitive' });
}
function checkCancellation(signal?: AbortSignal) {
  if (signal?.aborted) throw cancelled();
}
function sleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    checkCancellation(signal);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(cancelled());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);
    signal?.addEventListener('abort', onAbort);
  });
}
function retryDelay(header: string | null, now: number, fallback: number) {
  if (header === null || !header.trim()) return fallback;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, date - now) : fallback;
}

type AttemptResult =
  { ok: true; value: unknown } | { ok: false; error: ApiError; retryAfter: string | null };

export function createTransport(options: ApiOptions): Transport {
  const fetchImplementation = options.fetch ?? globalThis.fetch;
  const clock = options.clock ?? Date.now;
  const delay = options.sleep ?? sleep;
  const baseURL = options.baseURL.replace(/\/+$/, '');
  let cooldownUntil = 0;

  async function wait(milliseconds: number, signal?: AbortSignal) {
    checkCancellation(signal);
    try {
      await delay(milliseconds, signal);
    } catch (error: unknown) {
      if (signal?.aborted) throw cancelled();
      throw error;
    }
    checkCancellation(signal);
  }
  async function waitForCooldown(signal?: AbortSignal) {
    checkCancellation(signal);
    while (cooldownUntil > clock()) await wait(cooldownUntil - clock(), signal);
  }
  async function attempt(
    method: 'GET' | 'POST',
    path: string,
    { body, signal }: RequestOptions
  ): Promise<AttemptResult> {
    checkCancellation(signal);
    const controller = new AbortController();
    let timedOut = false;
    let rejectInterruption: (error: ApiError) => void = () => undefined;
    const interruption = new Promise<never>((_resolve, reject) => {
      rejectInterruption = reject;
    });
    const onAbort = () => {
      rejectInterruption(cancelled());
      controller.abort();
    };
    signal?.addEventListener('abort', onAbort);
    const timer = setTimeout(() => {
      timedOut = true;
      rejectInterruption(
        new ApiError('transport', 'The request timed out.', {
          outcome: 'uncertain',
          reason: 'timeout',
        })
      );
      controller.abort();
    }, 15000);
    try {
      return await Promise.race([
        interruption,
        (async (): Promise<AttemptResult> => {
          let response: HttpResponse;
          try {
            response = await fetchImplementation(`${baseURL}${path}`, {
              method,
              signal: controller.signal,
              ...(body === undefined
                ? {}
                : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
            });
          } catch (error: unknown) {
            if (signal?.aborted) throw cancelled();
            if (timedOut)
              throw new ApiError('transport', 'The request timed out.', {
                outcome: 'uncertain',
                reason: 'timeout',
              });
            throw new ApiError(
              'transport',
              error instanceof Error ? error.message : 'The connection failed.',
              { outcome: 'uncertain', reason: 'network' }
            );
          }
          const retryAfter = response.headers.get('Retry-After');
          if (response.status === 429) {
            cooldownUntil = Math.max(
              cooldownUntil,
              clock() + retryDelay(retryAfter, clock(), 60000)
            );
            throw new ApiError(
              'rate-limit',
              'The service is busy. Please wait before trying again.',
              { outcome: 'definitive', status: 429, retryAt: cooldownUntil }
            );
          }
          if (response.status < 200 || response.status >= 300) {
            const kind = response.status === 400 || response.status === 422 ? 'validation' : 'http';
            const error = new ApiError(kind, `The service returned HTTP ${response.status}.`, {
              outcome: response.status >= 500 ? 'uncertain' : 'definitive',
              status: response.status,
            });
            return { ok: false, error, retryAfter };
          }
          try {
            return { ok: true, value: await response.json() };
          } catch {
            throw new ApiError('invalid-response', 'The service returned unreadable JSON.', {
              outcome: 'uncertain',
            });
          }
        })(),
      ]);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  return {
    async request(method, path, requestOptions = {}) {
      const { signal } = requestOptions;
      const attempts = method === 'GET' ? 3 : 1;
      for (let index = 0; index < attempts; index++) {
        await waitForCooldown(signal);
        let retryAfter: string | null = null;
        try {
          const result = await attempt(method, path, requestOptions);
          if (result.ok) return result.value;
          retryAfter = result.retryAfter;
          throw result.error;
        } catch (error: unknown) {
          const retryable =
            error instanceof ApiError &&
            (error.kind === 'transport' ||
              (error.kind === 'http' &&
                error.status !== undefined &&
                [500, 502, 503, 504].includes(error.status)));
          if (!retryable || index + 1 === attempts) throw error;
          await wait(retryDelay(retryAfter, clock(), 500 * 2 ** index), signal);
        }
      }
      throw new ApiError('transport', 'The request could not complete.', { outcome: 'uncertain' });
    },
  };
}
