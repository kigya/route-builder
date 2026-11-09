import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';
import StopsRoute from '../app/index';
import InstructionsRoute from '../app/instructions';
import { RouteProvider } from '@/features/route/RouteProvider';
import { makeApi, savedDraft } from './stops/fixtures';
import { memoryStorage } from './route/storageFixture';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
async function setup(raw: string | null = null) {
  const api = makeApi();
  const storage = memoryStorage(raw);
  function Layout() {
    return (
      <RouteProvider api={api} storage={storage}>
        <Stack screenOptions={{ headerShown: false }} />
        <PortalHost />
      </RouteProvider>
    );
  }
  const navigation = renderRouter(
    { _layout: Layout, index: StopsRoute, instructions: InstructionsRoute },
    { initialUrl: '/' }
  );
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(400);
  });
  return { storage, navigation };
}
test('zero stops guard Continue and Instructions', async () => {
  const { navigation } = await setup();
  expect(screen.getByRole('button', { name: 'Continue (0 stops)' })).toBeDisabled();
  expect(screen.getByLabelText('Instructions')).toBeDisabled();
  fireEvent.press(screen.getByLabelText('Instructions'));
  expect(navigation.getPathname()).toBe('/');
});
test.each(['Continue (1 stop)', 'Instructions'])(
  '%s preserves query and draft on a round trip; active tabs are no-ops',
  async (entry) => {
    const { storage, navigation } = await setup(JSON.stringify(savedDraft()));
    const pickerList = screen.getByTestId('stops-list');
    fireEvent.changeText(screen.getByLabelText('Search stops'), 'North');
    fireEvent.press(screen.getByLabelText('Stops'));
    expect(screen.getByLabelText('Search stops')).toHaveDisplayValue('North');
    await act(async () => {
      fireEvent.press(screen.getByLabelText(entry));
      fireEvent.press(screen.getByLabelText(entry));
      await Promise.resolve();
    });
    await waitFor(() => expect(navigation.getPathname()).toBe('/instructions'));
    expect(
      navigation.getRouterState()?.routes[0]?.state?.routes.map((route) => route.name)
    ).toEqual(['index', 'instructions']);
    fireEvent.press(screen.getByLabelText('Instructions'));
    expect(navigation.getPathname()).toBe('/instructions');
    fireEvent.press(screen.getByLabelText('Stops'));
    await waitFor(() => expect(navigation.getPathname()).toBe('/'));
    expect(screen.getByLabelText('Search stops')).toHaveDisplayValue('North');
    expect(screen.getByTestId('stops-list')).toBe(pickerList);
    expect(
      navigation.getRouterState()?.routes[0]?.state?.routes.map((route) => route.name)
    ).toEqual(['index']);
    expect(screen.getByLabelText('Remove North Cafe')).toBeVisible();
    expect(storage.read()).toBe(JSON.stringify(savedDraft()));
  }
);
test('a restored uncertain draft remains viewable while editing is locked', async () => {
  const draft = savedDraft();
  draft.submission = {
    status: 'uncertain',
    attemptId: 'attempt-1',
    items: [{ stop_id: 'north', packages: 2, instructions: 'Side door' }],
  };
  const { navigation } = await setup(JSON.stringify(draft));
  expect(screen.getByLabelText('Instructions')).toBeEnabled();
  expect(screen.getByLabelText('Remove North Cafe')).toBeDisabled();
  fireEvent.press(screen.getByLabelText('Instructions'));
  await waitFor(() => expect(navigation.getPathname()).toBe('/instructions'));
});
