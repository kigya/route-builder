import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApi } from '@/api/client';
import type { FetchImplementation } from '@/api/transport';
import { nodeFetch, startMockServer } from '../helpers/mockServer';
import type { MockServer } from '../helpers/mockServer';

let server: MockServer;
beforeEach(async () => {
  server = await startMockServer();
});
afterEach(async () => {
  await server?.stop();
});

async function raw(path: string, body?: unknown) {
  return nodeFetch(`${server.baseURL}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    signal: new AbortController().signal,
    ...(body === undefined
      ? {}
      : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
}
async function primeRequests(count: number) {
  await Promise.all(Array.from({ length: count }, () => raw('/health')));
}
function trackedFetch(statuses: number[], delays: number[] = []): FetchImplementation {
  return async (url, init) => {
    const response = await nodeFetch(url, init);
    statuses.push(response.status);
    if (response.headers.get('Retry-After'))
      delays.push(Number(response.headers.get('Retry-After')));
    return response;
  };
}

it('preserves the supplied service bytes', () => {
  expect(
    createHash('sha256')
      .update(readFileSync(resolve(__dirname, '../../mock/server.js')))
      .digest('hex')
  ).toBe('d213029e846a69065ff847e71875acbb6024122b1aa829851cf0351ae1a96abb');
});
it('browses exactly 24 distinct IDs including the Eastvale pharmacy', async () => {
  const api = createApi({ baseURL: server.baseURL, fetch: nodeFetch });
  const stops = await api.listStops('');
  expect(stops).toHaveLength(24);
  expect(new Set(stops.map((stop) => stop.id)).size).toBe(24);
  expect(stops.find((stop) => stop.id === 'stp_1019')).toEqual({
    id: 'stp_1019',
    name: '24/7 Pharmacy',
    address: '12 Trade St, Eastvale',
    phone: '020-7946-0808',
    packagesMax: 9,
  });
});
it('returns empty for the actual no-match search', async () => {
  const api = createApi({ baseURL: server.baseURL, fetch: nodeFetch });
  await expect(api.listStops('zzzzzzz')).resolves.toEqual([]);
});
it('preserves distinct server results for North and north', async () => {
  const api = createApi({ baseURL: server.baseURL, fetch: nodeFetch });
  const upper = await api.listStops('North');
  const lower = await api.listStops('north');
  expect(upper).toHaveLength(21);
  expect(lower.map((stop) => stop.id)).toEqual(['stp_1016']);
  expect(upper.find((stop) => stop.id === 'stp_1001')?.name).toBe('North Cafe');
});
it('round-trips valid 200 UTF-16 units including a final surrogate pair', async () => {
  const api = createApi({ baseURL: server.baseURL, fetch: nodeFetch });
  const instructions = 'a'.repeat(198) + '🚚';
  const route = await api.createRoute([{ stop_id: 'stp_1019', packages: 2, instructions }]);
  expect(route).toEqual({
    id: 'rt_2000',
    status: 'draft',
    stops: [{ stop_id: 'stp_1019', packages: 2, instructions }],
  });
  expect(route.stops[0]?.instructions.length).toBe(200);
});
it('characterizes raw oversized server truncation at 200 units', async () => {
  const response = await raw('/v1/routes', {
    stops: [{ stop_id: 'stp_1001', packages: 1, instructions: 'a'.repeat(199) + '🚚tail' }],
  });
  expect(response.status).toBe(201);
  await expect(response.json()).resolves.toEqual({
    id: 'rt_2000',
    status: 'draft',
    stops: [{ stop_id: 'stp_1001', packages: 1, instructions: 'a'.repeat(199) + '\ud83d' }],
  });
});
it('recovers the deterministic ninth-request 500 within bounded GET attempts', async () => {
  await primeRequests(8);
  const statuses: number[] = [];
  const api = createApi({
    baseURL: server.baseURL,
    fetch: trackedFetch(statuses),
    sleep: () => Promise.resolve(),
  });
  expect(await api.listStops('')).toHaveLength(24);
  expect(statuses).toEqual([500, 200, 200]);
});
it('recovers the deterministic fourteenth-request 503 and honors Retry-After', async () => {
  await primeRequests(13);
  const statuses: number[] = [];
  const advertised: number[] = [];
  const waits: number[] = [];
  const api = createApi({
    baseURL: server.baseURL,
    fetch: trackedFetch(statuses, advertised),
    sleep: (ms) => {
      waits.push(ms);
      return Promise.resolve();
    },
  });
  expect(await api.listStops('')).toHaveLength(24);
  expect(statuses).toEqual([503, 200, 200]);
  expect(advertised).toEqual([2]);
  expect(waits).toEqual([2000]);
});
it('surfaces the real rate-limit response without retrying it', async () => {
  await primeRequests(30);
  const statuses: number[] = [];
  const api = createApi({ baseURL: server.baseURL, fetch: trackedFetch(statuses) });
  await expect(api.listStops('')).rejects.toMatchObject({
    kind: 'rate-limit',
    outcome: 'definitive',
    status: 429,
  });
  expect(statuses).toEqual([429]);
});
