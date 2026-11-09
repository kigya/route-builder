import { createApi } from '@/api/client';
import { createDraftStore } from '@/features/route/persistence';
import { createSubmitter } from '@/features/route/submission';
import type { FetchImplementation } from '@/api/transport';
import type { RouteDraft } from '@/features/route/model';
import { draft } from './fixtures';
import { deferred, memoryStorage } from './storageFixture';

const items = [{ stop_id: 'north', packages: 2, instructions: 'Leave at reception' }];
const route = { id: 'route-12', status: 'draft', stops: items };
function response(status = 201, body: unknown = route) {
  return { status, headers: { get: () => null }, json: () => Promise.resolve(body) };
}
async function setup(fetch: FetchImplementation, source = draft()) {
  const storage = memoryStorage(JSON.stringify(source));
  const store = createDraftStore(storage);
  await store.load();
  const submitter = createSubmitter(createApi({ baseURL: 'http://test', fetch }), store, {
    createAttemptId: () => 'attempt-12',
  });
  return { storage, store, submitter };
}
test('two synchronous submits issue exactly one POST', async () => {
  let posts = 0;
  const pending = deferred<ReturnType<typeof response>>();
  const { submitter } = await setup(() => {
    posts++;
    return pending.promise;
  });
  const first = submitter.submit(draft());
  const second = submitter.submit(draft());
  expect(submitter.isSubmitting).toBe(true);
  pending.resolve(response());
  expect((await first).draft.submission).toEqual({ status: 'succeeded', route });
  expect(await second).toEqual(await first);
  expect(posts).toBe(1);
  expect(submitter.isSubmitting).toBe(false);
});
test('failed attempt-marker persistence prevents every POST', async () => {
  let posts = 0;
  const storage = memoryStorage();
  const store = createDraftStore({
    ...storage,
    setItem: () => Promise.reject(new Error('Disk full')),
  });
  await store.load();
  const submitter = createSubmitter(
    createApi({
      baseURL: 'http://test',
      fetch: () => {
        posts++;
        return Promise.resolve(response());
      },
    }),
    store
  );
  const result = await submitter.submit(draft());
  expect(posts).toBe(0);
  expect(result.draft).toEqual(draft());
  expect(result.storageError?.message).toBe('Disk full');
});
test('pending draft writes finish before the durable attempt and POST', async () => {
  const gate = deferred<void>();
  const started = deferred<void>();
  const storage = memoryStorage();
  let writes = 0;
  let posts = 0;
  const store = createDraftStore({
    ...storage,
    setItem: async (key, value) => {
      writes++;
      if (writes === 1) {
        started.resolve();
        await gate.promise;
      }
      await storage.setItem(key, value);
    },
  });
  await store.load();
  const save = store.save(draft());
  const submitter = createSubmitter(
    createApi({
      baseURL: 'http://test',
      fetch: () => {
        posts++;
        expect(storage.read()).toContain('"status":"attempting"');
        return Promise.resolve(response());
      },
    }),
    store
  );
  const result = submitter.submit(draft());
  await started.promise;
  expect(posts).toBe(0);
  gate.resolve();
  await save;
  await result;
  expect(posts).toBe(1);
});
test('an unresolved failed pending save blocks POST even before marker creation', async () => {
  let posts = 0;
  const storage = memoryStorage();
  const store = createDraftStore({
    ...storage,
    setItem: () => Promise.reject(new Error('Not durable')),
  });
  await store.load();
  await expect(store.save(draft())).rejects.toThrow('Not durable');
  const submitter = createSubmitter(
    createApi({
      baseURL: 'http://test',
      fetch: () => {
        posts++;
        return Promise.resolve(response());
      },
    }),
    store
  );
  expect((await submitter.submit(draft())).storageError?.message).toBe('Not durable');
  expect(posts).toBe(0);
});
test.each(['', '  ', 'a'.repeat(201), 'a'.repeat(199) + '\ud83d'])(
  'invalid instructions never POST: %s',
  async (instructions) => {
    let posts = 0;
    const { submitter } = await setup(() => {
      posts++;
      return Promise.resolve(response());
    });
    const result = await submitter.submit(draft(instructions));
    expect(result.error?.name).toBe('ApiError');
    expect(result.draft.stops).toEqual(draft(instructions).stops);
    expect(posts).toBe(0);
  }
);
test('caller mutations during marker persistence cannot change submitted snapshot', async () => {
  const marker = deferred<void>();
  const started = deferred<void>();
  const storage = memoryStorage();
  let writes = 0;
  let sent: string | undefined;
  const store = createDraftStore({
    ...storage,
    setItem: async (key, value) => {
      writes++;
      if (writes === 1) {
        started.resolve();
        await marker.promise;
      }
      await storage.setItem(key, value);
    },
  });
  await store.load();
  const submitter = createSubmitter(
    createApi({
      baseURL: 'http://test',
      fetch: (_url, init) => {
        sent = init.body;
        return Promise.resolve(response());
      },
    }),
    store
  );
  const source = draft();
  const result = submitter.submit(source);
  await started.promise;
  const entry = source.stops[0];
  if (!entry) throw new Error('Missing fixture');
  entry.instructions = 'Changed';
  entry.packages = 7;
  entry.stop.id = 'changed';
  source.stops.length = 0;
  marker.resolve();
  const confirmed = await result;
  expect(sent).toBe(JSON.stringify({ stops: items }));
  expect(confirmed.draft.stops).toEqual(draft().stops);
});
test('network failure persists uncertainty and retains all entries', async () => {
  const { submitter, store } = await setup(() => Promise.reject(new Error('Offline')));
  const result = await submitter.submit(draft());
  expect(result.draft).toEqual({
    ...draft(),
    submission: { status: 'uncertain', attemptId: 'attempt-12', items },
  });
  expect(result.error?.name).toBe('ApiError');
  expect(await store.load()).toEqual({ status: 'loaded', draft: result.draft });
});
test.each([400, 422, 429])('definitive HTTP %s persists editable idle draft', async (status) => {
  const { submitter, store } = await setup(() => Promise.resolve(response(status, {})));
  const result = await submitter.submit(draft());
  expect(result.draft).toEqual(draft());
  expect(result.error?.name).toBe('ApiError');
  expect(await store.load()).toEqual({ status: 'loaded', draft: draft() });
});
test.each([500, 503])('HTTP %s remains uncertain without automatic retry', async (status) => {
  let posts = 0;
  const { submitter } = await setup(() => {
    posts++;
    return Promise.resolve(response(status, {}));
  });
  const result = await submitter.submit(draft());
  expect(result.draft.submission.status).toBe('uncertain');
  expect(posts).toBe(1);
});
test('uncertain retry requires explicit duplicate-risk acknowledgment', async () => {
  let posts = 0;
  const { submitter } = await setup(() => {
    posts++;
    return posts === 1 ? Promise.reject(new Error('Offline')) : Promise.resolve(response());
  });
  const failed = await submitter.submit(draft());
  await submitter.submit(failed.draft);
  await submitter.submit(draft());
  expect(posts).toBe(1);
  const retried = await submitter.retryUncertain(failed.draft, { acknowledgeDuplicateRisk: true });
  expect(retried.draft.submission).toEqual({ status: 'succeeded', route });
  expect(posts).toBe(2);
});
test('a mismatched successful response keeps the original draft uncertain', async () => {
  const { submitter, store } = await setup(() =>
    Promise.resolve(
      response(201, { ...route, stops: [{ ...items[0], instructions: 'Lost text' }] })
    )
  );
  const result = await submitter.submit(draft());
  expect(result.draft.stops).toEqual(draft().stops);
  expect(result.draft.submission.status).toBe('uncertain');
  expect(await store.load()).toEqual({ status: 'loaded', draft: result.draft });
});
test('confirmed success persists its route ID and prevents POST after relaunch', async () => {
  let posts = 0;
  const fetch: FetchImplementation = () => {
    posts++;
    return Promise.resolve(response());
  };
  const { submitter, storage } = await setup(fetch);
  await submitter.submit(draft());
  await submitter.submit(draft());
  const relaunchedStore = createDraftStore(storage);
  const restored = await relaunchedStore.load();
  if (restored.status !== 'loaded') throw new Error('Expected draft');
  const relaunched = createSubmitter(createApi({ baseURL: 'http://test', fetch }), relaunchedStore);
  expect((await relaunched.submit(restored.draft)).draft.submission).toEqual({
    status: 'succeeded',
    route,
  });
  expect(posts).toBe(1);
});
test('success receipt write failure retains the confirmed route in memory and uncertainty on relaunch', async () => {
  const storage = memoryStorage();
  let writes = 0;
  const store = createDraftStore({
    ...storage,
    setItem: (key, value) => {
      writes++;
      return writes === 2
        ? Promise.reject(new Error('Receipt not saved'))
        : storage.setItem(key, value);
    },
  });
  await store.load();
  let posts = 0;
  const submitter = createSubmitter(
    createApi({
      baseURL: 'http://test',
      fetch: () => {
        posts++;
        return Promise.resolve(response());
      },
    }),
    store
  );
  const result = await submitter.submit(draft());
  expect(result.draft.submission).toEqual({ status: 'succeeded', route });
  expect(result.storageError?.message).toBe('Receipt not saved');
  await submitter.submit(draft());
  expect(posts).toBe(1);
  const restored = await createDraftStore(storage).load();
  if (restored.status !== 'loaded') throw new Error('Expected draft');
  expect(restored.draft.submission.status).toBe('uncertain');
});
test('failure-result persistence rejection conservatively blocks a casual retry', async () => {
  const storage = memoryStorage();
  let writes = 0;
  const store = createDraftStore({
    ...storage,
    setItem: (key, value) => {
      writes++;
      return writes === 2
        ? Promise.reject(new Error('Failure not saved'))
        : storage.setItem(key, value);
    },
  });
  await store.load();
  let posts = 0;
  const submitter = createSubmitter(
    createApi({
      baseURL: 'http://test',
      fetch: () => {
        posts++;
        return Promise.resolve(response(400, {}));
      },
    }),
    store
  );
  const result = await submitter.submit(draft());
  expect(result.storageError?.message).toBe('Failure not saved');
  expect(result.draft.submission.status).toBe('uncertain');
  await submitter.submit(draft());
  expect(posts).toBe(1);
});
test('restored uncertain attempt never sends on normal submit', async () => {
  const source: RouteDraft = {
    ...draft(),
    submission: { status: 'uncertain', attemptId: 'old-attempt', items },
  };
  let posts = 0;
  const { submitter } = await setup(() => {
    posts++;
    return Promise.resolve(response());
  }, source);
  expect((await submitter.submit(source)).draft).toEqual(source);
  expect(posts).toBe(0);
});
test('a failed acknowledged retry marker cannot reopen a stale idle draft for casual submission', async () => {
  const storage = memoryStorage();
  let writes = 0;
  let posts = 0;
  const store = createDraftStore({
    ...storage,
    setItem: (key, value) => {
      writes++;
      return writes === 3
        ? Promise.reject(new Error('Retry not durable'))
        : storage.setItem(key, value);
    },
  });
  await store.load();
  const submitter = createSubmitter(
    createApi({
      baseURL: 'http://test',
      fetch: () => {
        posts++;
        return Promise.reject(new Error('Offline'));
      },
    }),
    store
  );
  const uncertain = await submitter.submit(draft());
  expect(
    (await submitter.retryUncertain(uncertain.draft, { acknowledgeDuplicateRisk: true }))
      .storageError?.message
  ).toBe('Retry not durable');
  await store.save(uncertain.draft);
  expect((await submitter.submit(draft())).draft.submission.status).toBe('uncertain');
  expect(posts).toBe(1);
});

test.each([400, 422, 429])(
  'definitive HTTP %s on acknowledged retry preserves earlier uncertainty across relaunch',
  async (status) => {
    let posts = 0;
    const fetch: FetchImplementation = () => {
      posts++;
      return posts === 1
        ? Promise.reject(new Error('Lost response'))
        : Promise.resolve(response(status, {}));
    };
    const { submitter, storage } = await setup(fetch);
    const first = await submitter.submit(draft());
    const retried = await submitter.retryUncertain(first.draft, { acknowledgeDuplicateRisk: true });
    expect(retried.draft.submission).toEqual(first.draft.submission);
    await submitter.submit(retried.draft);
    expect(posts).toBe(2);
    const relaunchedStore = createDraftStore(storage);
    const restored = await relaunchedStore.load();
    if (restored.status !== 'loaded') throw new Error('Expected draft');
    expect(restored.draft.submission).toEqual(first.draft.submission);
    const relaunched = createSubmitter(
      createApi({ baseURL: 'http://test', fetch }),
      relaunchedStore
    );
    await relaunched.submit(restored.draft);
    expect(posts).toBe(2);
  }
);
