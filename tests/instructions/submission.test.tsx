import { act, screen } from '@testing-library/react-native';
import { AccessibilityInfo, FlatList, Keyboard } from 'react-native';
import { router } from 'expo-router';
import { createApi } from '@/api/client';
import { ApiError, type CreatedRoute } from '@/api/types';
import type { RouteDraft } from '@/features/route/model';
import { deferred, memoryStorage } from '../route/storageFixture';
import { instructionApi, north, press, renderInstructions, savedDraft } from './fixtures';
jest.mock('expo-router', () => ({ router: { navigate: jest.fn(), dismissTo: jest.fn() } }));
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
});
const items = [{ stop_id: north.id, packages: 2, instructions: 'Side door' }];

test('sending locks edits, clear, removal and Finish; repeated taps send once', async () => {
  const pending = deferred<CreatedRoute>();
  const api = instructionApi();
  api.createRoute.mockImplementation(() => pending.promise);
  await renderInstructions(savedDraft(), api);
  await press('Finish instructions');
  expect(screen.getByText('Creating route…')).toBeTruthy();
  expect(screen.getByLabelText('Instructions for North Cafe')).toHaveProp('editable', false);
  expect(screen.getByLabelText('Remove North Cafe')).toBeDisabled();
  expect(screen.getByLabelText('Clear instructions for North Cafe')).toBeDisabled();
  await press('Finish instructions');
  expect(api.createRoute.mock.calls).toHaveLength(1);
  await act(async () => {
    pending.resolve({ id: 'confirmed', status: 'draft', stops: items });
    await Promise.resolve();
  });
  expect(screen.getByText('Route created')).toBeTruthy();
  expect(screen.getByText('confirmed')).toBeTruthy();
  expect(screen.queryByText(/driver notified/i)).toBeNull();
});
test('definitive rejection preserves text and offers explicit retry', async () => {
  const api = instructionApi();
  api.createRoute = jest
    .fn()
    .mockRejectedValueOnce(
      new ApiError('validation', 'rejected', { outcome: 'definitive', status: 400 })
    )
    .mockResolvedValue({ id: 'retry-ok', status: 'draft', stops: items });
  await renderInstructions(savedDraft(), api);
  await press('Finish instructions');
  expect(screen.getByText('Route was not created. Your instructions are preserved.')).toBeTruthy();
  expect(screen.getByLabelText('Instructions for North Cafe')).toHaveProp('value', 'Side door');
  expect(api.createRoute.mock.calls).toHaveLength(1);
  await press('Retry route creation');
  expect(screen.getByText('retry-ok')).toBeTruthy();
});
test('uncertain response never retries until duplicate-risk acknowledgment', async () => {
  const api = instructionApi();
  api.createRoute = jest
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ id: 'acknowledged', status: 'draft', stops: items });
  await renderInstructions(savedDraft(), api);
  await press('Finish instructions');
  expect(screen.getByText('Route creation could not be confirmed')).toBeTruthy();
  expect(screen.getByLabelText('Instructions for North Cafe')).toHaveProp('editable', false);
  await press('Review retry risk');
  expect(screen.getByLabelText('Retry and accept duplicate risk')).toBeDisabled();
  await press('I understand a retry may create a duplicate route');
  await press('Retry and accept duplicate risk');
  expect(api.createRoute.mock.calls).toHaveLength(2);
  expect(screen.getByText('acknowledged')).toBeTruthy();
});
test.each(['attempting', 'uncertain'] as const)(
  'restored %s is uncertain with no automatic POST',
  async (status) => {
    const draft = savedDraft();
    draft.submission = { status, attemptId: 'old', items };
    const { api } = await renderInstructions(draft);
    expect(screen.getByText('Route creation could not be confirmed')).toBeTruthy();
    expect(api.createRoute.mock.calls).toHaveLength(0);
    await press('Review retry risk');
    await press('Cancel');
    expect(api.createRoute.mock.calls).toHaveLength(0);
  }
);
test('restored success shows receipt and acknowledged reset preserves picker navigation', async () => {
  const draft = savedDraft();
  draft.submission = {
    status: 'succeeded',
    route: { id: 'restored-id', status: 'draft', stops: items },
  };
  const { api, storage } = await renderInstructions(draft);
  expect(screen.getByText('Route created')).toBeTruthy();
  expect(screen.getByText('restored-id')).toBeTruthy();
  await press('Start new route');
  await press('Cancel');
  expect(screen.getByText('restored-id')).toBeTruthy();
  await press('Start new route');
  await press('Clear and start new route');
  expect((JSON.parse(storage.read()!) as RouteDraft).stops).toEqual([]);
  expect(router.dismissTo).toHaveBeenCalledWith('/');
  expect(api.createRoute.mock.calls).toHaveLength(0);
});
test('HTTP 200 with mismatched items presents uncertainty, not success', async () => {
  const fetch = jest.fn(() =>
    Promise.resolve({
      status: 200,
      headers: { get: () => null },
      json: () =>
        Promise.resolve({
          id: 'bad',
          status: 'draft',
          stops: [{ ...items[0], instructions: 'Different text' }],
        }),
    })
  );
  const api = createApi({ baseURL: 'http://instructions.test', fetch });
  await renderInstructions(savedDraft(), api);
  await press('Finish instructions');
  expect(screen.getByText('Route creation could not be confirmed')).toBeTruthy();
  expect(screen.queryByText('Route created')).toBeNull();
});
test('failed receipt save shows current recovery state; retry saving clears historical error without POST', async () => {
  const base = memoryStorage(JSON.stringify(savedDraft()));
  let fail = true;
  const storage = {
    ...base,
    setItem: jest.fn(async (key: string, value: string) => {
      if (fail && (JSON.parse(value) as RouteDraft).submission.status === 'succeeded')
        throw new Error('disk full');
      await base.setItem(key, value);
    }),
  };
  const api = instructionApi();
  await renderInstructions(savedDraft(), api, storage);
  await press('Finish instructions');
  expect(screen.getByText('Route created')).toBeTruthy();
  expect(screen.getByText('Your changes could not be saved on this device.')).toBeTruthy();
  fail = false;
  await press('Retry saving');
  expect(screen.queryByText('Your changes could not be saved on this device.')).toBeNull();
  expect(api.createRoute.mock.calls).toHaveLength(1);
});

test('sending lock covers attempt-marker storage before the POST begins', async () => {
  const markerWrite = deferred<void>();
  const base = memoryStorage(JSON.stringify(savedDraft()));
  const storage = {
    ...base,
    setItem: async (key: string, value: string) => {
      if ((JSON.parse(value) as RouteDraft).submission.status === 'attempting')
        await markerWrite.promise;
      await base.setItem(key, value);
    },
  };
  const api = instructionApi();
  await renderInstructions(savedDraft(), api, storage);
  await press('Finish instructions');
  expect(screen.getByText('Creating route…')).toBeTruthy();
  expect(screen.getByLabelText('Instructions for North Cafe')).toHaveProp('editable', false);
  expect(api.createRoute.mock.calls).toHaveLength(0);
  await act(async () => {
    markerWrite.resolve();
    await Promise.resolve();
  });
  expect(api.createRoute.mock.calls).toHaveLength(1);
  expect(screen.getByText('Route created')).toBeTruthy();
});

test('a completed attempt dismisses the keyboard and reveals the result at the top of the feed', async () => {
  const scroll = jest.spyOn(FlatList.prototype, 'scrollToOffset').mockImplementation(() => {});
  const dismiss = jest.spyOn(Keyboard, 'dismiss');
  const motion = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  await renderInstructions(savedDraft());
  await press('Finish instructions');
  expect(dismiss.mock.calls.length).toBeGreaterThan(0);
  expect(scroll).toHaveBeenCalledWith({ offset: 0, animated: false });
  scroll.mockRestore();
  dismiss.mockRestore();
  motion.mockRestore();
});

test('rejected acknowledged retry keeps uncertain warning, locked edits and fresh acknowledgment after restore', async () => {
  const api = instructionApi();
  api.createRoute
    .mockRejectedValueOnce(new Error('Lost response'))
    .mockRejectedValueOnce(
      new ApiError('rate-limit', 'Too many requests', { outcome: 'definitive', status: 429 })
    );
  const view = await renderInstructions(savedDraft(), api);
  await press('Finish instructions');
  await press('Review retry risk');
  await press('I understand a retry may create a duplicate route');
  await press('Retry and accept duplicate risk');
  expect(screen.getByText('Route creation could not be confirmed')).toBeTruthy();
  expect(screen.queryByText('Route was not created. Your instructions are preserved.')).toBeNull();
  expect(screen.getByLabelText('Instructions for North Cafe')).toHaveProp('editable', false);
  expect(screen.queryByLabelText('Retry route creation')).toBeNull();
  await press('Review retry risk');
  expect(screen.getByLabelText('Retry and accept duplicate risk')).toBeDisabled();
  await press('Cancel');
  view.unmount();
  await renderInstructions(savedDraft(), api, view.storage);
  expect(screen.getByText('Route creation could not be confirmed')).toBeTruthy();
  expect(screen.getByLabelText('Instructions for North Cafe')).toHaveProp('editable', false);
  expect(api.createRoute.mock.calls).toHaveLength(2);
});
