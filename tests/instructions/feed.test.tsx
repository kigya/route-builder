import { act, fireEvent, screen } from '@testing-library/react-native';
import type { FlatListProps } from 'react-native';
import type { DraftStop, RouteDraft } from '@/features/route/model';
import { AccessibilityInfo, Animated, FlatList, KeyboardAvoidingView } from 'react-native';
import { AppShell } from '@/components/AppShell';
import { router } from 'expo-router';
import { almond, north, press, renderInstructions, savedDraft } from './fixtures';
jest.mock('expo-router', () => ({ router: { navigate: jest.fn(), dismissTo: jest.fn() } }));
beforeEach(() => jest.clearAllMocks());
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('selected data, UTF-16 counting, persisted typing and per-card clear', async () => {
  const draft = savedDraft([
    { stop: north, packages: 2, instructions: 'Side door' },
    { stop: almond, packages: 1, instructions: 'Ring bell' },
  ]);
  draft.mode = 'multi';
  const { storage } = await renderInstructions(draft);
  expect(screen.getByText(north.address)).toBeTruthy();
  expect(screen.getByText('2×')).toBeTruthy();
  await act(async () => {
    fireEvent.changeText(screen.getByLabelText('Instructions for North Cafe'), 'Call 😀');
    await Promise.resolve();
  });
  expect(screen.getByText('7/200 UTF-16 units')).toBeTruthy();
  expect((JSON.parse(storage.read()!) as RouteDraft).stops[0]?.instructions).toBe('Call 😀');
  await press('Clear instructions for North Cafe');
  expect(screen.getByLabelText('Instructions for North Cafe')).toHaveProp('value', '');
  expect(screen.getByLabelText('Instructions for Almond Patisserie')).toHaveProp(
    'value',
    'Ring bell'
  );
});
test('Finish reveals all blank errors and targets first invalid card', async () => {
  const draft = savedDraft([
    { stop: north, packages: 2, instructions: ' ' },
    { stop: almond, packages: 1, instructions: '' },
  ]);
  draft.mode = 'multi';
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  const { api } = await renderInstructions(draft);
  await press('Finish instructions');
  expect(screen.getAllByText('Add delivery instructions.')).toHaveLength(2);
  expect(announce).toHaveBeenCalledWith('North Cafe: Add delivery instructions.');
  expect(screen.getByTestId('instruction-card-north')).toHaveProp('accessibilityState', {
    selected: true,
  });
  expect(api.createRoute.mock.calls).toHaveLength(0);
});
test('pasted emoji boundary is safe and restored oversized text remains repairable', async () => {
  await renderInstructions(savedDraft());
  await act(async () => {
    fireEvent.changeText(
      screen.getByLabelText('Instructions for North Cafe'),
      'a'.repeat(199) + '😀'
    );
    await Promise.resolve();
  });
  expect(screen.getByLabelText('Instructions for North Cafe')).toHaveProp('value', 'a'.repeat(199));
});
test('restored oversized text is shown with an error and deletion keeps unseen tail', async () => {
  await renderInstructions(
    savedDraft([{ stop: north, packages: 2, instructions: 'a'.repeat(250) }])
  );
  expect(screen.getByText('Use up to 200 characters without incomplete emoji.')).toBeTruthy();
  const input = screen.getByLabelText('Instructions for North Cafe');
  expect(input.props.maxLength).toBeUndefined();
  await act(async () => {
    fireEvent.changeText(input, 'a'.repeat(249));
    await Promise.resolve();
  });
  expect(screen.getByLabelText('Instructions for North Cafe')).toHaveProp('value', 'a'.repeat(249));
});
test('explicit removal excludes payload and last removal returns through shared picker navigation', async () => {
  const draft = savedDraft([
    { stop: north, packages: 2, instructions: 'Side door' },
    { stop: almond, packages: 1, instructions: 'Ring bell' },
  ]);
  draft.mode = 'multi';
  const { api } = await renderInstructions(draft);
  await press('Remove North Cafe');
  expect(screen.queryByLabelText('Instructions for North Cafe')).toBeNull();
  await press('Finish instructions');
  expect(api.createRoute.mock.calls).toEqual([
    [[{ stop_id: almond.id, packages: 1, instructions: 'Ring bell' }]],
  ]);
});
test('last removal dismisses to existing Stops', async () => {
  await renderInstructions(savedDraft());
  await press('Remove North Cafe');
  expect(router.dismissTo).toHaveBeenCalledWith('/');
});
test('reduced motion keeps focus scale/opacity without timing animation', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  const timing = jest.spyOn(Animated, 'timing');
  const draft = savedDraft([
    { stop: north, packages: 2, instructions: 'Side door' },
    { stop: almond, packages: 1, instructions: '' },
  ]);
  draft.mode = 'multi';
  await renderInstructions(draft);
  expect(timing.mock.calls).toHaveLength(0);
  expect(screen.getByTestId('instruction-card-almond')).toHaveStyle({
    opacity: 0.76,
    transform: [{ scale: 0.96 }],
  });
  expect(screen.getByTestId('instruction-card-north')).toHaveStyle({
    opacity: 1,
    transform: [{ scale: 1 }],
  });
});

test('unmeasured first-invalid card retries exact scrolling and cleans up on unmount', async () => {
  jest.useFakeTimers();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  const scroll = jest.spyOn(FlatList.prototype, 'scrollToIndex').mockImplementation(() => {});
  const draft = savedDraft([
    { stop: north, packages: 2, instructions: 'Side door' },
    { stop: almond, packages: 1, instructions: '' },
  ]);
  draft.mode = 'multi';
  const view = await renderInstructions(draft);
  await press('Finish instructions');
  const feed = view.UNSAFE_getByType(FlatList).props as FlatListProps<DraftStop>;
  await act(async () => {
    feed.onScrollToIndexFailed?.({
      index: 1,
      averageItemLength: 450,
      highestMeasuredFrameIndex: 0,
    });
    await Promise.resolve();
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(100);
  });
  expect(scroll).toHaveBeenCalledTimes(2);
  expect(scroll).toHaveBeenLastCalledWith({ index: 1, animated: false, viewPosition: 0 });
  await act(async () => {
    feed.onScrollToIndexFailed?.({
      index: 1,
      averageItemLength: 450,
      highestMeasuredFrameIndex: 0,
    });
    await Promise.resolve();
  });
  view.unmount();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(100);
  });
  expect(scroll).toHaveBeenCalledTimes(2);
  scroll.mockRestore();
  jest.useRealTimers();
});

test('keyboard avoidance includes the shell header and footer in the screen coordinate space', async () => {
  const view = await renderInstructions(savedDraft());
  const avoider = view.UNSAFE_getByType(KeyboardAvoidingView);
  // Native keyboard metrics use screen coordinates. A nested avoider under the shell
  // measures local y=0 below the header and undercounts the overlap on Android.
  expect(avoider.findByType(AppShell)).toBeTruthy();
});
