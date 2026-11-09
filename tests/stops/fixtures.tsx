import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { PortalHost } from '@rn-primitives/portal';
import { createApi } from '@/api/client';
import type { RouteApi, Stop } from '@/api/types';
import { RouteProvider } from '@/features/route/RouteProvider';
import type { RouteDraft } from '@/features/route/model';
import { StopsScreen } from '@/features/stops/StopsScreen';
import { memoryStorage } from '../route/storageFixture';

export const north: Stop = {
  id: 'north',
  name: 'North Cafe',
  address: '12 North Rd, Northbridge',
  phone: '07700 900321',
  packagesMax: 5,
};
export const almond: Stop = {
  id: 'almond',
  name: 'Almond Patisserie',
  address: '3 Elm Street',
  phone: '07700 900123',
  packagesMax: null,
};
export const numeric: Stop = {
  id: '42',
  name: '42 Bakery',
  address: '42 Baker St',
  phone: '07700 900042',
  packagesMax: 120,
};
export function savedDraft(
  stops = [{ stop: north, packages: 2, instructions: 'Side door' }]
): RouteDraft {
  return { version: 1, mode: 'single', stops, submission: { status: 'idle' } };
}
export function makeApi(options: { empty?: boolean; fail?: () => boolean } = {}): RouteApi {
  return createApi({
    baseURL: 'http://picker.test',
    sleep: () => Promise.resolve(),
    fetch: (url) => {
      const parsed = new URL(url);
      const q = parsed.searchParams.get('q') ?? '';
      const page = parsed.searchParams.get('page');
      const rows =
        options.empty || page !== '1'
          ? []
          : [north, almond, numeric]
              .filter((stop) => !q || stop.name.includes(q))
              .map(({ packagesMax, ...stop }) => ({ ...stop, packages_max: packagesMax }));
      return Promise.resolve({
        status: options.fail?.() ? 400 : 200,
        headers: { get: () => null },
        json: () => Promise.resolve({ items: rows }),
      });
    },
  });
}
export async function renderPicker(
  raw: string | null = null,
  api = makeApi(),
  storage = memoryStorage(raw)
): Promise<ReturnType<typeof render> & { storage: ReturnType<typeof memoryStorage> }> {
  const view = render(
    <RouteProvider api={api} storage={storage}>
      <StopsScreen />
      <PortalHost />
    </RouteProvider>
  );
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(400);
  });
  return { ...view, storage };
}
export async function press(label: string): Promise<void> {
  await act(async () => {
    fireEvent.press(screen.getByLabelText(label));
    await Promise.resolve();
  });
}
