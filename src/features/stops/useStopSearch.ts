import { useCallback, useEffect, useState } from 'react';
import type { RouteApi, Stop } from '@/api/types';

const DEBOUNCE_MS = 400;
const CACHE_MS = 30000;
const CACHE_ENTRIES = 20;
type CachedStops = { data: Stop[]; savedAt: number };
const caches = new WeakMap<RouteApi, Map<string, CachedStops>>();
type SearchState =
  | { status: 'loading'; data: Stop[] }
  | { status: 'success'; data: Stop[] }
  | { status: 'error'; data: Stop[]; error: Error };
type SearchResult = { api: RouteApi; key: string; revision: number; state: SearchState };
export type StopSearch = {
  data: Stop[];
  loading: boolean;
  error: Error | undefined;
  retry: () => void;
};

export function useStopSearch(api: RouteApi, query: string): StopSearch {
  const key = query.trim();
  const [result, setResult] = useState<SearchResult>();
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => {
    caches.get(api)?.delete(key);
    setRevision((value) => value + 1);
  }, [api, key]);
  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    let cache = caches.get(api);
    if (!cache) {
      cache = new Map();
      caches.set(api, cache);
    }
    const retainedCache = cache;
    for (const [cachedKey, cached] of retainedCache) {
      if (Date.now() - cached.savedAt >= CACHE_MS) retainedCache.delete(cachedKey);
    }
    const update = (state: SearchState) => {
      if (current) setResult({ api, key, revision, state });
    };
    const cached = retainedCache.get(key);
    if (cached) {
      void Promise.resolve().then(() => update({ status: 'success', data: cached.data }));
      return () => {
        current = false;
      };
    }
    const timer = setTimeout(() => {
      void api
        .listStops(key, controller.signal)
        .then((data) => {
          if (!current) return;
          retainedCache.set(key, { data, savedAt: Date.now() });
          while (retainedCache.size > CACHE_ENTRIES) {
            const oldest = retainedCache.keys().next().value;
            if (oldest === undefined) break;
            retainedCache.delete(oldest);
          }
          update({ status: 'success', data });
        })
        .catch((error: unknown) => {
          if (current)
            update({
              status: 'error',
              data: [],
              error: error instanceof Error ? error : new Error('Stops could not be loaded.'),
            });
        });
    }, DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [api, key, revision]);
  const state: SearchState =
    result?.api === api && result.key === key && result.revision === revision
      ? result.state
      : { status: 'loading', data: [] };
  return {
    data: state.data,
    loading: state.status === 'loading',
    error: state.status === 'error' ? state.error : undefined,
    retry,
  };
}
