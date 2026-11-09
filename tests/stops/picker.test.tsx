import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { memoryStorage } from '../route/storageFixture';
import { groupStops } from '@/features/stops/groupStops';
import { almond, makeApi, north, numeric, press, renderPicker, savedDraft } from './fixtures';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
test('groups by A–Z then # and sorts names deterministically without mutating input', () => {
  const stops = [numeric, north, almond];
  expect(groupStops(stops)).toEqual([
    { title: 'A', data: [almond] },
    { title: 'N', data: [north] },
    { title: '#', data: [numeric] },
  ]);
  expect(stops).toEqual([numeric, north, almond]);
});
test('shows initials, address and phone, multi-select chips, live totals and chip removal', async () => {
  await renderPicker();
  expect(screen.getByText('NC')).toBeVisible();
  expect(screen.getByText(north.address)).toBeVisible();
  expect(screen.getByText(north.phone)).toBeVisible();
  await press('Multi-stop route');
  await press('Select North Cafe');
  await press('Select Almond Patisserie');
  expect(screen.getByRole('button', { name: 'Continue (2 stops)' })).toBeEnabled();
  expect(screen.getByText('2 packages · 2 stops')).toBeVisible();
  expect(screen.getByLabelText('Remove North Cafe')).toBeVisible();
  await press('Remove North Cafe');
  expect(screen.getByText('1 package · 1 stop')).toBeVisible();
});
test('one-stop selection replaces a stop with no instruction without confirmation', async () => {
  const { storage } = await renderPicker();
  await press('Select North Cafe');
  await press('Select Almond Patisserie');
  expect(screen.queryByLabelText('Remove North Cafe')).toBeNull();
  expect(screen.getByLabelText('Remove Almond Patisserie')).toBeVisible();
  expect(storage.read()).toContain('"id":"almond"');
});
test('instruction loss requires explicit replacement confirmation; cancel keeps the original', async () => {
  const { storage } = await renderPicker(JSON.stringify(savedDraft()));
  await press('Select Almond Patisserie');
  expect(screen.getByText('Replace North Cafe?')).toBeVisible();
  await press('Cancel');
  expect(screen.getByLabelText('Remove North Cafe')).toBeVisible();
  await press('Select Almond Patisserie');
  await press('Replace stop');
  expect(screen.queryByLabelText('Remove North Cafe')).toBeNull();
  expect(storage.read()).toContain('"id":"almond"');
});
test('switching to One stop names and retains the first stop only after confirmation', async () => {
  const draft = {
    ...savedDraft([
      { stop: north, packages: 2, instructions: 'Side door' },
      { stop: almond, packages: 3, instructions: 'Ring bell' },
    ]),
    mode: 'multi',
  };
  const { storage } = await renderPicker(JSON.stringify(draft));
  await press('One stop');
  expect(screen.getByText('Keep North Cafe?')).toBeVisible();
  await press('Cancel');
  expect(screen.getByLabelText('Remove Almond Patisserie')).toBeVisible();
  await press('One stop');
  await press('Keep first stop');
  expect(screen.queryByLabelText('Remove Almond Patisserie')).toBeNull();
  expect(storage.read()).toContain('"packages":2,"instructions":"Side door"');
});
test('empty results offer a search hint without manual entry', async () => {
  await renderPicker(null, makeApi({ empty: true }));
  expect(screen.getByText('No stops found')).toBeVisible();
  expect(screen.getByText(/capitalization/)).toBeVisible();
  expect(screen.queryByText(/manually|add address/i)).toBeNull();
});
test('search failure and explicit retry preserve the selected draft and entered query', async () => {
  let fail = false;
  const { storage } = await renderPicker(
    JSON.stringify(savedDraft()),
    makeApi({ fail: () => fail })
  );
  fail = true;
  fireEvent.changeText(screen.getByLabelText('Search stops'), 'North');
  await act(async () => {
    await jest.advanceTimersByTimeAsync(400);
  });
  expect(screen.getByText('Stops could not be loaded. Please try again.')).toBeVisible();
  expect(screen.getByLabelText('Remove North Cafe')).toBeVisible();
  fail = false;
  await press('Retry stops');
  await act(async () => {
    await jest.advanceTimersByTimeAsync(400);
  });
  expect(screen.getByText(north.address)).toBeVisible();
  expect(screen.getByLabelText('Search stops')).toHaveDisplayValue('North');
  expect(storage.read()).toBe(JSON.stringify(savedDraft()));
});
test('corrupt storage offers friendly retry and acknowledged discard without exposing the data', async () => {
  const { storage } = await renderPicker('{private-broken-data');
  expect(screen.getByText('Your saved route could not be restored.')).toBeVisible();
  expect(screen.queryByText(/private-broken-data/)).toBeNull();
  expect(screen.getByLabelText('Select North Cafe')).toBeDisabled();
  await press('Discard saved route');
  await press('Cancel');
  expect(storage.read()).toBe('{private-broken-data');
  await press('Discard saved route');
  await press('Discard route');
  await waitFor(() => expect(screen.getByLabelText('Select North Cafe')).toBeEnabled());
  expect(storage.read()).toContain('"stops":[]');
});
test('a checked stop can be deselected with its checkbox', async () => {
  await renderPicker(JSON.stringify(savedDraft()));
  await press('Selected North Cafe');
  expect(screen.queryByLabelText('Remove North Cafe')).toBeNull();
  expect(screen.getByRole('button', { name: 'Continue (0 stops)' })).toBeDisabled();
});

test('a restore read error can be retried without discarding saved instructions', async () => {
  const raw = JSON.stringify(savedDraft());
  const memory = memoryStorage(raw);
  let unavailable = true;
  await renderPicker(null, makeApi(), {
    ...memory,
    getItem: (key) =>
      unavailable ? Promise.reject(new Error('Private storage details')) : memory.getItem(key),
  });
  expect(screen.getByText('Your saved route could not be restored.')).toBeVisible();
  expect(screen.queryByText('Private storage details')).toBeNull();
  unavailable = false;
  await press('Retry saved route');
  expect(screen.getByLabelText('Remove North Cafe')).toBeEnabled();
  expect(memory.read()).toBe(raw);
});
test('a failed autosave can be retried while keeping the current selection', async () => {
  const memory = memoryStorage();
  let unavailable = true;
  await renderPicker(null, makeApi(), {
    ...memory,
    setItem: (key, value) =>
      unavailable ? Promise.reject(new Error('Private write failure')) : memory.setItem(key, value),
  });
  await press('Select North Cafe');
  expect(screen.getByText('Your changes could not be saved on this device.')).toBeVisible();
  expect(screen.getByLabelText('Remove North Cafe')).toBeVisible();
  unavailable = false;
  await press('Retry saving');
  expect(screen.queryByText('Your changes could not be saved on this device.')).toBeNull();
  expect(memory.read()).toContain('"id":"north"');
});
