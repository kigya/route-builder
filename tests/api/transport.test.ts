import { createTransport } from '@/api/transport';
import type { FetchImplementation, HttpResponse } from '@/api/transport';

function response(
  status: number,
  value: unknown = { items: [] },
  retryAfter: string | null = null
): HttpResponse {
  return { status, headers: { get: () => retryAfter }, json: () => Promise.resolve(value) };
}
function setup(replies: (HttpResponse | Error)[]) {
  let time = 1000;
  const calls: { url: string; time: number; method: string; signal: AbortSignal }[] = [];
  const fetch: FetchImplementation = (url, init) => {
    calls.push({ url, time, method: init.method, signal: init.signal });
    const reply = replies.shift();
    return reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply ?? response(200));
  };
  const waits: number[] = [];
  const transport = createTransport({
    baseURL: 'http://api.test/',
    fetch,
    clock: () => time,
    sleep: (ms) => {
      waits.push(ms);
      time += ms;
      return Promise.resolve();
    },
  });
  return { transport, calls, waits };
}

it('recovers a GET from 503 only after Retry-After', async () => {
  const { transport, calls, waits } = setup([response(503, {}, '2'), response(200, { ok: true })]);
  await expect(transport.request('GET', '/v1/stops')).resolves.toEqual({ ok: true });
  expect(calls.map((call) => call.time)).toEqual([1000, 3000]);
  expect(waits).toEqual([2000]);
});
it('uses HTTP-date Retry-After relative to the injected clock', async () => {
  const { transport, calls } = setup([
    response(503, {}, 'Thu, 01 Jan 1970 00:00:04 GMT'),
    response(200),
  ]);
  await transport.request('GET', '/v1/stops');
  expect(calls.map((call) => call.time)).toEqual([1000, 4000]);
});
it('exhausts a failing GET at three total attempts', async () => {
  const { transport, calls } = setup([response(500), response(500), response(500), response(200)]);
  await expect(transport.request('GET', '/v1/stops')).rejects.toMatchObject({
    kind: 'http',
    status: 500,
  });
  expect(calls).toHaveLength(3);
});
it('retries GET network failures within the same bound', async () => {
  const { transport, calls } = setup([
    new Error('offline'),
    new Error('offline'),
    new Error('offline'),
  ]);
  await expect(transport.request('GET', '/v1/stops')).rejects.toMatchObject({
    kind: 'transport',
    outcome: 'uncertain',
    reason: 'network',
  });
  expect(calls).toHaveLength(3);
});
it('shares a 429 cooldown with subsequent requests, including POST', async () => {
  const { transport, calls } = setup([response(429, {}, '4'), response(200, { ok: true })]);
  await expect(transport.request('GET', '/v1/stops')).rejects.toMatchObject({
    kind: 'rate-limit',
    outcome: 'definitive',
    retryAt: 5000,
  });
  await expect(transport.request('POST', '/v1/routes', { body: {} })).resolves.toEqual({
    ok: true,
  });
  expect(calls.map((call) => [call.method, call.time])).toEqual([
    ['GET', 1000],
    ['POST', 5000],
  ]);
});
it('cancels a delayed retry without making another request', async () => {
  const controller = new AbortController();
  let calls = 0;
  const transport = createTransport({
    baseURL: 'http://api.test',
    fetch: () => {
      calls++;
      return Promise.resolve(response(503));
    },
    sleep: (_ms, signal) => {
      controller.abort();
      return signal?.aborted ? Promise.reject(new Error('aborted')) : Promise.resolve();
    },
  });
  await expect(
    transport.request('GET', '/v1/stops', { signal: controller.signal })
  ).rejects.toMatchObject({ kind: 'cancelled' });
  expect(calls).toBe(1);
});
it('rejects already cancelled reads without sending', async () => {
  const controller = new AbortController();
  controller.abort();
  const { transport, calls } = setup([]);
  await expect(
    transport.request('GET', '/v1/stops', { signal: controller.signal })
  ).rejects.toMatchObject({ kind: 'cancelled' });
  expect(calls).toHaveLength(0);
});
it('makes exactly one POST attempt after a network error', async () => {
  const { transport, calls } = setup([new Error('connection lost'), response(201)]);
  await expect(
    transport.request('POST', '/v1/routes', { body: { stops: [] } })
  ).rejects.toMatchObject({
    kind: 'transport',
    outcome: 'uncertain',
  });
  expect(calls).toHaveLength(1);
});
it.each([500, 503])('does not retry POST HTTP %i outcomes', async (status) => {
  const { transport, calls } = setup([response(status), response(201)]);
  await expect(transport.request('POST', '/v1/routes', { body: {} })).rejects.toMatchObject({
    kind: 'http',
    outcome: 'uncertain',
    status,
  });
  expect(calls).toHaveLength(1);
});
it.each([400, 422])('reports HTTP %i as definitive validation rejection', async (status) => {
  const { transport, calls } = setup([response(status)]);
  await expect(transport.request('POST', '/v1/routes', { body: {} })).rejects.toMatchObject({
    kind: 'validation',
    outcome: 'definitive',
    status,
  });
  expect(calls).toHaveLength(1);
});
it('reports malformed successful JSON as uncertain without retrying POST', async () => {
  let calls = 0;
  const transport = createTransport({
    baseURL: 'http://api.test',
    fetch: () => {
      calls++;
      return Promise.resolve({
        ...response(201),
        json: () => Promise.reject(new SyntaxError('bad JSON')),
      });
    },
  });
  await expect(transport.request('POST', '/v1/routes', { body: {} })).rejects.toMatchObject({
    kind: 'invalid-response',
    outcome: 'uncertain',
  });
  expect(calls).toBe(1);
});
it('bounds an unresponsive POST at 15 seconds even when fetch ignores abort', async () => {
  jest.useFakeTimers();
  try {
    let requestSignal: AbortSignal | undefined;
    const transport = createTransport({
      baseURL: 'http://api.test',
      fetch: (_url, init) => {
        requestSignal = init.signal;
        return new Promise(() => undefined);
      },
    });
    const result = expect(
      transport.request('POST', '/v1/routes', { body: {} })
    ).rejects.toMatchObject({
      kind: 'transport',
      reason: 'timeout',
      outcome: 'uncertain',
    });
    await jest.advanceTimersByTimeAsync(14999);
    expect(requestSignal?.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await result;
    expect(requestSignal?.aborted).toBe(true);
  } finally {
    jest.useRealTimers();
  }
});
it('bounds slow JSON response bodies at 15 seconds too', async () => {
  jest.useFakeTimers();
  try {
    const transport = createTransport({
      baseURL: 'http://api.test',
      fetch: () => Promise.resolve({ ...response(201), json: () => new Promise(() => undefined) }),
    });
    const result = expect(
      transport.request('POST', '/v1/routes', { body: {} })
    ).rejects.toMatchObject({
      kind: 'transport',
      reason: 'timeout',
    });
    await jest.advanceTimersByTimeAsync(15000);
    await result;
  } finally {
    jest.useRealTimers();
  }
});
it('aborts an in-flight GET immediately when the caller cancels', async () => {
  const controller = new AbortController();
  let sent: (() => void) | undefined;
  const started = new Promise<void>((resolve) => {
    sent = resolve;
  });
  const fetch: FetchImplementation = () => {
    sent?.();
    return new Promise(() => undefined);
  };
  const transport = createTransport({ baseURL: 'http://api.test', fetch });
  const result = expect(
    transport.request('GET', '/v1/stops', { signal: controller.signal })
  ).rejects.toMatchObject({ kind: 'cancelled' });
  await started;
  controller.abort();
  await result;
});
