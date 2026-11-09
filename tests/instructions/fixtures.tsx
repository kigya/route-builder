import { act, render } from '@testing-library/react-native';
import { PortalHost } from '@rn-primitives/portal';
import type { RouteApi } from '@/api/types';
import { RouteProvider } from '@/features/route/RouteProvider';
import type { RouteDraft } from '@/features/route/model';
import { InstructionsScreen } from '@/features/instructions/InstructionsScreen';
import { memoryStorage } from '../route/storageFixture';
export { north, almond, savedDraft, press } from '../stops/fixtures';

export function instructionApi(): jest.Mocked<RouteApi> {
  return {
    listStops: jest.fn<ReturnType<RouteApi['listStops']>, Parameters<RouteApi['listStops']>>(() =>
      Promise.resolve([])
    ),
    getPhotos: jest.fn<ReturnType<RouteApi['getPhotos']>, Parameters<RouteApi['getPhotos']>>(() =>
      Promise.resolve([])
    ),
    createRoute: jest.fn((stops) =>
      Promise.resolve({ id: 'route-123', status: 'draft' as const, stops })
    ),
  };
}
export async function renderInstructions(
  draft: RouteDraft,
  api: RouteApi = instructionApi(),
  storage = memoryStorage(JSON.stringify(draft))
) {
  const view = render(
    <RouteProvider api={api} storage={storage}>
      <InstructionsScreen />
      <PortalHost />
    </RouteProvider>
  );
  await act(async () => {
    await Promise.resolve();
  });
  return { ...view, api: jest.mocked(api), storage };
}
