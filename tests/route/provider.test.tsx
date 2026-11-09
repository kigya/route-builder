import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { createApi } from '@/api/client';
import { RouteProvider, useRouteDraft } from '@/features/route/RouteProvider';
import { createDraftStore } from '@/features/route/persistence';
import { draft, stop } from './fixtures';
import { deferred, memoryStorage } from './storageFixture';

const route = {
  id: 'route-12',
  status: 'draft',
  stops: [{ stop_id: 'north', packages: 2, instructions: 'Leave at reception' }],
};
function noNetwork() {
  return createApi({
    baseURL: 'http://test',
    fetch: () => Promise.reject(new Error('Unexpected request')),
  });
}
test('actions wait for restoration and expose the same retained API', async () => {
  const read = deferred<string | null>();
  const storage = { ...memoryStorage(), getItem: () => read.promise };
  const api = noNetwork();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RouteProvider api={api} storage={storage}>
      {children}
    </RouteProvider>
  );
  const { result, rerender } = renderHook(useRouteDraft, { wrapper });
  act(() => result.current.dispatch({ type: 'selectStop', stop: stop('south') }));
  expect(result.current.ready).toBe(false);
  expect(result.current.draft.stops).toEqual([]);
  await act(async () => {
    read.resolve(JSON.stringify(draft()));
    await read.promise;
  });
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.draft).toEqual(draft());
  rerender({});
  expect(result.current.api).toBe(api);
});
test('rapid instructions edits persist through provider unmount and restore', async () => {
  const storage = memoryStorage(JSON.stringify(draft()));
  const api = noNetwork();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RouteProvider api={api} storage={storage}>
      {children}
    </RouteProvider>
  );
  const first = renderHook(useRouteDraft, { wrapper });
  await waitFor(() => expect(first.result.current.ready).toBe(true));
  act(() => {
    first.result.current.dispatch({ type: 'setInstructions', id: 'north', text: 'First' });
    first.result.current.dispatch({ type: 'setInstructions', id: 'north', text: 'Latest' });
  });
  await waitFor(() => expect(first.result.current.saving).toBe(false));
  first.unmount();
  const next = renderHook(useRouteDraft, { wrapper });
  await waitFor(() => expect(next.result.current.ready).toBe(true));
  expect(next.result.current.draft.stops[0]?.instructions).toBe('Latest');
});
test('corrupt storage blocks editing until acknowledged discard', async () => {
  const storage = memoryStorage('{rescued');
  const api = noNetwork();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RouteProvider api={api} storage={storage}>
      {children}
    </RouteProvider>
  );
  const { result } = renderHook(useRouteDraft, { wrapper });
  await waitFor(() => expect(result.current.status).toBe('recovery'));
  act(() => result.current.dispatch({ type: 'selectStop', stop: stop() }));
  expect(storage.read()).toBe('{rescued');
  expect(result.current.canEdit).toBe(false);
  await act(async () => {
    await result.current.discardSavedDraft({ acknowledgeDataLoss: true });
  });
  expect(result.current.ready).toBe(true);
  expect(result.current.draft.stops).toEqual([]);
});
test('restore read failure is visible and a retry recovers the saved text', async () => {
  let fail = true;
  const memory = memoryStorage(JSON.stringify(draft()));
  const storage = {
    ...memory,
    getItem: (key: string) =>
      fail ? Promise.reject(new Error('Unavailable')) : memory.getItem(key),
  };
  const api = noNetwork();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RouteProvider api={api} storage={storage}>
      {children}
    </RouteProvider>
  );
  const { result } = renderHook(useRouteDraft, { wrapper });
  await waitFor(() => expect(result.current.status).toBe('restore-error'));
  expect(result.current.storageError?.message).toBe('Unavailable');
  fail = false;
  await act(async () => {
    await result.current.retryRestore();
  });
  expect(result.current.ready).toBe(true);
  expect(result.current.draft).toEqual(draft());
});
test('failed autosave surfaces an error and retry saves the current draft', async () => {
  let fail = true;
  const memory = memoryStorage(JSON.stringify(draft()));
  const storage = {
    ...memory,
    setItem: (key: string, value: string) =>
      fail ? Promise.reject(new Error('Full')) : memory.setItem(key, value),
  };
  const api = noNetwork();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RouteProvider api={api} storage={storage}>
      {children}
    </RouteProvider>
  );
  const { result } = renderHook(useRouteDraft, { wrapper });
  await waitFor(() => expect(result.current.ready).toBe(true));
  act(() => result.current.dispatch({ type: 'setInstructions', id: 'north', text: 'Keep me' }));
  await waitFor(() => expect(result.current.storageError?.message).toBe('Full'));
  fail = false;
  await act(async () => {
    expect(await result.current.retrySave()).toBe(true);
  });
  expect(result.current.storageError).toBeUndefined();
  expect(await createDraftStore(storage).load()).toEqual({
    status: 'loaded',
    draft: draft('Keep me'),
  });
});
test('submit freezes edits synchronously and keeps success until explicit new route', async () => {
  const network = deferred<ReturnType<typeof success>>();
  let posts = 0;
  function success() {
    return { status: 201, headers: { get: () => null }, json: () => Promise.resolve(route) };
  }
  const api = createApi({
    baseURL: 'http://test',
    fetch: () => {
      posts++;
      return network.promise;
    },
  });
  const storage = memoryStorage(JSON.stringify(draft()));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RouteProvider api={api} storage={storage}>
      {children}
    </RouteProvider>
  );
  const { result } = renderHook(useRouteDraft, { wrapper });
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(async () => {
    const first = result.current.submit();
    const second = result.current.submit();
    result.current.dispatch({ type: 'clearInstructions', id: 'north' });
    network.resolve(success());
    await Promise.all([first, second]);
  });
  expect(posts).toBe(1);
  expect(result.current.draft.stops).toEqual(draft().stops);
  expect(result.current.draft.submission).toEqual({ status: 'succeeded', route });
  expect(result.current.canEdit).toBe(false);
  await act(async () => {
    await result.current.reset({ acknowledgeDataLoss: true });
  });
  expect(result.current.draft.stops).toEqual([]);
  expect(result.current.canEdit).toBe(true);
});
