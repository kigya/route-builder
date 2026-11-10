import { act, renderHook } from '@testing-library/react-native';
import { createApi } from '@/api/client';
import type { RouteApi, Stop } from '@/api/types';
import { useStopSearch } from '@/features/stops/useStopSearch';
import { deferred } from '../route/storageFixture';
import { stop } from '../route/fixtures';

function apiWith(listStops: RouteApi['listStops']): RouteApi {
  return {
    listStops,
    getPhotos: () => Promise.resolve([]),
    createRoute: () => Promise.reject(new Error('Unexpected POST')),
  };
}
async function advance(ms = 400) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('debounces for 400ms and passes the trimmed query with original case', async () => {
  const queries: string[] = [];
  const api = apiWith((q) => {
    queries.push(q);
    return Promise.resolve([stop(q)]);
  });
  const { result, rerender } = renderHook(
    ({ query }: { query: string }) => useStopSearch(api, query),
    { initialProps: { query: ' N ' } }
  );
  await advance(200);
  rerender({ query: ' North ' });
  await advance(399);
  expect(queries).toEqual([]);
  await advance(1);
  expect(queries).toEqual(['North']);
  expect(result.current.data).toEqual([stop('North')]);
  expect(result.current.loading).toBe(false);
});
test('ignores obsolete completion even when abort is ineffective', async () => {
  const old = deferred<Stop[]>();
  let oldSignal: AbortSignal | undefined;
  const api = apiWith((q, signal) => {
    if (q === 'old') {
      oldSignal = signal;
      return old.promise;
    }
    return Promise.resolve([stop('new')]);
  });
  const { result, rerender } = renderHook(
    ({ query }: { query: string }) => useStopSearch(api, query),
    { initialProps: { query: 'old' } }
  );
  await advance();
  rerender({ query: 'new' });
  expect(oldSignal?.aborted).toBe(true);
  await advance();
  await act(async () => {
    old.resolve([stop('old')]);
    await old.promise;
  });
  expect(result.current.data).toEqual([stop('new')]);
});
test('a new query cancels an explicitly retried request', async () => {
  const retry = deferred<Stop[]>();
  let calls = 0;
  let retrySignal: AbortSignal | undefined;
  const api = apiWith((q, signal) => {
    if (q === 'first') {
      calls++;
      if (calls === 1) return Promise.reject(new Error('Offline'));
      retrySignal = signal;
      return retry.promise;
    }
    return Promise.resolve([stop('second')]);
  });
  const { result, rerender } = renderHook(
    ({ query }: { query: string }) => useStopSearch(api, query),
    { initialProps: { query: 'first' } }
  );
  await advance();
  expect(result.current.error?.message).toBe('Offline');
  act(() => result.current.retry());
  await advance();
  rerender({ query: 'second' });
  expect(retrySignal?.aborted).toBe(true);
  await advance();
  await act(async () => {
    retry.resolve([stop('first')]);
    await retry.promise;
  });
  expect(result.current.data).toEqual([stop('second')]);
});
test('reuses successful queries for 30 seconds and refreshes expired data', async () => {
  let calls = 0;
  const api = apiWith((q) => {
    calls++;
    return Promise.resolve([stop(q)]);
  });
  const { result, rerender } = renderHook(
    ({ query }: { query: string }) => useStopSearch(api, query),
    { initialProps: { query: 'North' } }
  );
  await advance();
  rerender({ query: 'South' });
  await advance();
  rerender({ query: ' North ' });
  await advance();
  expect(calls).toBe(2);
  expect(result.current.data).toEqual([stop('North')]);
  rerender({ query: 'South' });
  await advance(30001);
  rerender({ query: 'North' });
  await advance();
  expect(calls).toBe(3);
});
test('reports errors and supports an explicit retry without caching failures', async () => {
  let offline = true;
  const api = apiWith(() =>
    offline ? Promise.reject(new Error('Page unavailable')) : Promise.resolve([stop()])
  );
  const { result } = renderHook(() => useStopSearch(api, ''));
  await advance();
  expect(result.current.error?.message).toBe('Page unavailable');
  expect(result.current.data).toEqual([]);
  offline = false;
  act(() => result.current.retry());
  await advance();
  expect(result.current.error).toBeUndefined();
  expect(result.current.data).toEqual([stop()]);
});

test('bounds the per-API cache and does not reuse evicted queries', async () => {
  const queries: string[] = [];
  const api = apiWith((q) => {
    queries.push(q);
    return Promise.resolve([stop(q)]);
  });
  const { rerender } = renderHook(({ query }: { query: string }) => useStopSearch(api, query), {
    initialProps: { query: 'original' },
  });
  await advance();
  for (let index = 0; index < 20; index++) {
    rerender({ query: `query-${index}` });
    await advance();
  }
  rerender({ query: 'original' });
  await advance();
  expect(queries.filter((query) => query === 'original')).toEqual(['original', 'original']);
});
test('unmount cancels the request and its obsolete result cannot seed the cache', async () => {
  const pending = deferred<Stop[]>();
  let calls = 0;
  let signal: AbortSignal | undefined;
  const api = apiWith((_q, requestSignal) => {
    calls++;
    signal = requestSignal;
    return calls === 1 ? pending.promise : Promise.resolve([stop('fresh')]);
  });
  const first = renderHook(() => useStopSearch(api, 'North'));
  await advance();
  first.unmount();
  expect(signal?.aborted).toBe(true);
  await act(async () => {
    pending.resolve([stop('old')]);
    await pending.promise;
  });
  const second = renderHook(() => useStopSearch(api, 'North'));
  await advance();
  expect(second.result.current.data).toEqual([stop('fresh')]);
});

test('changing query cancels API backoff before an automatic GET retry', async () => {
  const queries: string[] = [];
  const api = createApi({
    baseURL: 'http://search.test',
    fetch: (url) => {
      const params = new URL(url).searchParams;
      const query = params.get('q') ?? '';
      queries.push(query);
      const row = { ...stop('new'), packages_max: 9 };
      return Promise.resolve({
        status: query === 'old' ? 503 : 200,
        headers: { get: () => null },
        json: () => Promise.resolve({ items: params.get('page') === '1' ? [row] : [] }),
      });
    },
  });
  const { result, rerender } = renderHook(
    ({ query }: { query: string }) => useStopSearch(api, query),
    { initialProps: { query: 'old' } }
  );
  await advance();
  rerender({ query: 'new' });
  await advance(900);
  expect(queries).toEqual(['old', 'new', 'new']);
  expect(result.current.data).toEqual([stop('new')]);
});
