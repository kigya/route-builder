import { createDraftStore, DraftStorageError } from '@/features/route/persistence';
import { initialDraft } from '@/features/route/model';
import { validateDraft } from '@/features/route/validation';
import { draft } from './fixtures';
import { deferred, memoryStorage } from './storageFixture';

test('empty storage restores initial draft without writing', async () => {
  const storage = memoryStorage();
  expect(await createDraftStore(storage).load()).toEqual({ status: 'loaded', draft: initialDraft });
  expect(storage.read()).toBeNull();
});
test('serialized writes retain latest text even if later I/O is ready first', async () => {
  const first = deferred<void>();
  const second = deferred<void>();
  const firstStarted = deferred<void>();
  let writes = 0;
  let raw: string | null = null;
  const store = createDraftStore({
    getItem: () => Promise.resolve(raw),
    setItem: async (_key, value) => {
      writes++;
      if (writes === 1) {
        firstStarted.resolve();
        await first.promise;
      } else {
        await second.promise;
      }
      raw = value;
    },
  });
  await store.load();
  const early = store.save(draft('Early'));
  const latest = store.save(draft('Latest'));
  await firstStarted.promise;
  second.resolve();
  await Promise.resolve();
  expect(raw).toBeNull();
  first.resolve();
  await Promise.all([early, latest]);
  await store.flush();
  expect(await store.load()).toEqual({ status: 'loaded', draft: draft('Latest') });
});
test('save snapshots caller data before entering the queue', async () => {
  const storage = memoryStorage();
  const store = createDraftStore(storage);
  await store.load();
  const source = draft('Original');
  const save = store.save(source);
  const entry = source.stops[0];
  if (!entry) throw new Error('Missing fixture');
  entry.instructions = 'Mutated';
  await save;
  expect(await store.load()).toEqual({ status: 'loaded', draft: draft('Original') });
});
test('storage rejection is visible to save and flush and can be explicitly retried', async () => {
  const storage = memoryStorage();
  let shouldFail = true;
  const store = createDraftStore({
    ...storage,
    setItem: (key, value) =>
      shouldFail ? Promise.reject(new Error('Disk full')) : storage.setItem(key, value),
  });
  await store.load();
  await expect(store.save(draft())).rejects.toThrow(DraftStorageError);
  await expect(store.flush()).rejects.toThrow('Disk full');
  shouldFail = false;
  await store.save(draft());
  await store.flush();
  expect(await store.load()).toEqual({ status: 'loaded', draft: draft() });
});
test('read rejection does not enable saves', async () => {
  const storage = memoryStorage('rescuable');
  const store = createDraftStore({
    ...storage,
    getItem: () => Promise.reject(new Error('Read failed')),
  });
  await expect(store.load()).rejects.toThrow('Read failed');
  await expect(store.save(initialDraft)).rejects.toThrow(DraftStorageError);
  expect(storage.read()).toBe('rescuable');
});
test.each([
  ['{broken', 'invalid'],
  [JSON.stringify({ ...draft(), version: 2 }), 'version'],
  [JSON.stringify({ ...draft(), mode: 'oops' }), 'invalid'],
  [
    JSON.stringify({
      ...draft(),
      submission: { status: 'succeeded', route: { id: 'route', status: 'draft', stops: [] } },
    }),
    'invalid',
  ],
])('unrecognized storage stays untouched: %s', async (raw, reason) => {
  const storage = memoryStorage(raw);
  const store = createDraftStore(storage);
  expect(await store.load()).toEqual({ status: 'recovery', raw, reason });
  await expect(store.save(initialDraft)).rejects.toThrow(DraftStorageError);
  expect(storage.read()).toBe(raw);
});
test('acknowledged discard is the only operation that replaces corrupt storage', async () => {
  const storage = memoryStorage('{rescue');
  const store = createDraftStore(storage);
  await store.load();
  expect(await store.discardAndReset({ acknowledgeDataLoss: true })).toEqual(initialDraft);
  expect(await store.load()).toEqual({ status: 'loaded', draft: initialDraft });
});
test.each(['a'.repeat(201), 'a'.repeat(199) + '\ud83d'])(
  'restoration preserves and flags invalid instruction text',
  async (text) => {
    const store = createDraftStore(memoryStorage(JSON.stringify(draft(text))));
    const loaded = await store.load();
    expect(loaded).toEqual({ status: 'loaded', draft: draft(text) });
    if (loaded.status !== 'loaded') throw new Error('Expected restored draft');
    expect(validateDraft(loaded.draft)['north.instructions']).toBeDefined();
  }
);
test('an interrupted attempting marker restores uncertain with its exact snapshot', async () => {
  const source = {
    ...draft(),
    submission: {
      status: 'attempting' as const,
      attemptId: 'attempt-12',
      items: [{ stop_id: 'north', packages: 2, instructions: 'Leave at reception' }],
    },
  };
  const store = createDraftStore(memoryStorage(JSON.stringify(source)));
  expect(await store.load()).toEqual({
    status: 'loaded',
    draft: { ...source, submission: { ...source.submission, status: 'uncertain' } },
  });
});
