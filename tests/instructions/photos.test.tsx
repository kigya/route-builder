import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { DeliveryPhoto } from '@/api/types';
import { DeliveryPhotos } from '@/features/instructions/delivery-photos';
import { createDraftStore } from '@/features/route/persistence';
import { deferred } from '../route/storageFixture';
import { almond, north, instructionApi, press, renderInstructions, savedDraft } from './fixtures';
jest.mock('expo-router', () => ({ router: { navigate: jest.fn(), dismissTo: jest.fn() } }));

test('null/empty photo URLs never render and image errors have a local fallback', async () => {
  const api = instructionApi();
  api.getPhotos.mockImplementation(() =>
    Promise.resolve([
      { id: 'null', url: null, tag: 'Null' },
      { id: 'empty', url: '', tag: 'Empty' },
      { id: 'ok', url: 'https://photos.test/1.jpg', tag: 'Entrance' },
    ] as unknown as DeliveryPhoto[])
  );
  render(<DeliveryPhotos api={api} stopId="north" visible />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.queryByLabelText('Previous delivery: Null')).toBeNull();
  expect(screen.queryByLabelText('Previous delivery: Empty')).toBeNull();
  fireEvent(screen.getByLabelText('Previous delivery: Entrance'), 'error');
  expect(screen.getByText('Photo unavailable')).toBeTruthy();
});
test('slow photos do not block typing or Finish; typing does not refetch', async () => {
  const api = instructionApi();
  const pending = deferred<DeliveryPhoto[]>();
  api.getPhotos.mockImplementation(() => pending.promise);
  await renderInstructions(savedDraft(), api);
  await act(async () => {
    fireEvent.changeText(screen.getByLabelText('Instructions for North Cafe'), 'Ring twice');
    await Promise.resolve();
  });
  await act(async () => {
    fireEvent.changeText(screen.getByLabelText('Instructions for North Cafe'), 'Ring three times');
    await Promise.resolve();
  });
  expect(api.getPhotos.mock.calls).toHaveLength(1);
  await press('Finish instructions');
  expect(api.createRoute.mock.calls).toHaveLength(1);
  expect(screen.getByText('Route created')).toBeTruthy();
});
test('independent retry failure stays in photo region and preserves text', async () => {
  const api = instructionApi();
  api.getPhotos.mockImplementation(() => Promise.reject(new Error('offline')));
  await renderInstructions(savedDraft(), api);
  expect(screen.getByText('Previous delivery photos could not be loaded.')).toBeTruthy();
  await press('Retry photos for north');
  expect(api.getPhotos.mock.calls).toHaveLength(2);
  expect(screen.getByLabelText('Instructions for North Cafe')).toHaveProp('value', 'Side door');
  await press('Finish instructions');
  expect(api.createRoute.mock.calls).toHaveLength(1);
});
test('visible and near-visible consumers share results; inactive cards stay lazy', async () => {
  const api = instructionApi();
  const view = render(
    <>
      <DeliveryPhotos api={api} stopId="north" visible />
      <DeliveryPhotos api={api} stopId="north" visible />
      <DeliveryPhotos api={api} stopId="far" visible={false} />
    </>
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(api.getPhotos.mock.calls).toHaveLength(1);
  view.unmount();
  render(<DeliveryPhotos api={api} stopId="north" visible />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(api.getPhotos.mock.calls).toHaveLength(1);
});
test('unmount aborts pending request, ignores completion, and schedules no fetch', async () => {
  const api = instructionApi();
  const pending = deferred<DeliveryPhoto[]>();
  api.getPhotos.mockImplementation(() => pending.promise);
  const view = render(<DeliveryPhotos api={api} stopId="north" visible />);
  const signal = api.getPhotos.mock.calls[0]?.[1];
  view.unmount();
  expect(signal?.aborted).toBe(true);
  await act(async () => {
    pending.resolve([{ id: 'old', url: 'https://photos.test/old.jpg', tag: 'Old' }]);
    await Promise.resolve();
  });
  expect(api.getPhotos.mock.calls).toHaveLength(1);
  expect(view.toJSON()).toBeNull();
});
test('removed card aborts request and late failure does not reappear or alter other text', async () => {
  const api = instructionApi();
  const pending = deferred<DeliveryPhoto[]>();
  api.getPhotos.mockImplementation((id) =>
    id === 'north' ? pending.promise : Promise.resolve([])
  );
  const survivor = { stop: almond, packages: 3, instructions: 'Keep the bakery entrance text' };
  const initial = savedDraft([{ stop: north, packages: 2, instructions: 'Side door' }, survivor]);
  initial.mode = 'multi';
  const { storage } = await renderInstructions(initial, api);
  const signal = api.getPhotos.mock.calls.find(([id]) => id === 'north')?.[1];
  await press('Remove North Cafe');
  expect(signal?.aborted).toBe(true);
  await act(async () => {
    pending.reject(new Error('late'));
    await Promise.resolve();
  });
  expect(api.getPhotos.mock.calls.filter(([id]) => id === 'north')).toHaveLength(1);
  expect(screen.queryByLabelText('Instructions for North Cafe')).toBeNull();
  expect(screen.queryByText('Previous delivery photos could not be loaded.')).toBeNull();
  expect(screen.getByLabelText('Instructions for Almond Patisserie')).toHaveProp(
    'value',
    survivor.instructions
  );
  expect(await createDraftStore(storage).load()).toEqual({
    status: 'loaded',
    draft: { ...initial, stops: [survivor] },
  });
});
