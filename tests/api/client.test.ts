import { createApi } from '@/api/client';
import type { ApiOptions, HttpResponse } from '@/api/transport';
import type { RouteItem } from '@/api/types';

function stop(id = 'stp_1001') {
  return { id, name: 'North Cafe', address: '12 North Rd', phone: '020', packages_max: '5' };
}
function setup(pages: unknown[]) {
  const urls: string[] = [];
  const bodies: (string | undefined)[] = [];
  const options: ApiOptions = {
    baseURL: 'http://api.test',
    fetch: (url, init) => {
      urls.push(url);
      bodies.push(init.body);
      const body = pages.shift();
      const response: HttpResponse = {
        status: 200,
        headers: { get: () => null },
        json: () => Promise.resolve(body),
      };
      return Promise.resolve(response);
    },
    sleep: () => Promise.resolve(),
  };
  return { api: createApi(options), urls, bodies };
}
const routeItems: RouteItem[] = [{ stop_id: 'stp_1001', packages: 2, instructions: 'Side door' }];

it('enumerates beyond misleading metadata with page_size=50 and preserves query case', async () => {
  const { api, urls } = setup([
    { items: [stop()], has_more: false, total_pages: 0 },
    { items: [stop('stp_1019')] },
    { items: [] },
  ]);
  await expect(api.listStops('North & cafe')).resolves.toEqual([
    { id: 'stp_1001', name: 'North Cafe', address: '12 North Rd', phone: '020', packagesMax: 5 },
    { id: 'stp_1019', name: 'North Cafe', address: '12 North Rd', phone: '020', packagesMax: 5 },
  ]);
  expect(urls).toEqual([
    'http://api.test/v1/stops?page=1&page_size=50&q=North%20%26%20cafe',
    'http://api.test/v1/stops?page=2&page_size=50&q=North%20%26%20cafe',
    'http://api.test/v1/stops?page=3&page_size=50&q=North%20%26%20cafe',
  ]);
});
it('deduplicates repeated IDs and terminates on a no-new-ID page', async () => {
  const { api, urls } = setup([
    { items: [stop()] },
    { items: [stop(), stop('stp_1019')] },
    { items: [stop('stp_1019')] },
  ]);
  expect((await api.listStops('')).map((item) => item.id)).toEqual(['stp_1001', 'stp_1019']);
  expect(urls).toHaveLength(3);
});
it('terminates null no-match results as successful empty search', async () => {
  const { api, urls } = setup([{ items: null }]);
  await expect(api.listStops('zzzzzzz')).resolves.toEqual([]);
  expect(urls).toHaveLength(1);
});
it('never turns a malformed later page into empty or partial success', async () => {
  const { api } = setup([{ items: [stop()] }, { unexpected: [] }]);
  await expect(api.listStops('')).rejects.toMatchObject({ kind: 'invalid-response' });
});
it('reports a visible safety error when 100 pages keep adding IDs', async () => {
  let page = 0;
  const api = createApi({
    baseURL: 'http://api.test',
    fetch: () =>
      Promise.resolve({
        status: 200,
        headers: { get: () => null },
        json: () => Promise.resolve({ items: [stop(`stp_${++page}`)] }),
      }),
  });
  await expect(api.listStops('')).rejects.toMatchObject({ kind: 'pagination' });
  expect(page).toBe(100);
});
it('returns only usable decoded photos and encodes the stop ID', async () => {
  const { api, urls } = setup([
    {
      items: [
        { id: 'p1', tag: 'entrance', url: 'https://images.test/1' },
        { id: 'p2', tag: 'parking', url: null },
      ],
    },
  ]);
  await expect(api.getPhotos('stp/a')).resolves.toEqual([
    { id: 'p1', tag: 'entrance', url: 'https://images.test/1' },
  ]);
  expect(urls).toEqual(['http://api.test/v1/stops/stp%2Fa/photos']);
});
it('sends the route body unchanged and returns the confirmed route', async () => {
  const { api, bodies } = setup([{ id: 'rt_2000', status: 'draft', stops: routeItems }]);
  await expect(api.createRoute(routeItems)).resolves.toEqual({
    id: 'rt_2000',
    status: 'draft',
    stops: [{ stop_id: 'stp_1001', packages: 2, instructions: 'Side door' }],
  });
  expect(bodies).toEqual([
    '{"stops":[{"stop_id":"stp_1001","packages":2,"instructions":"Side door"}]}',
  ]);
});
it('does not confirm an altered successful route response', async () => {
  const { api } = setup([
    { id: 'rt_2000', status: 'draft', stops: [{ ...routeItems[0], instructions: 'wrong' }] },
  ]);
  await expect(api.createRoute(routeItems)).rejects.toMatchObject({
    kind: 'invalid-response',
    outcome: 'uncertain',
  });
});
it.each([' ', 'a'.repeat(201), 'a'.repeat(199) + '\ud83d'])(
  'rejects invalid instructions before any request',
  async (instructions) => {
    const { api, urls } = setup([]);
    await expect(
      api.createRoute([{ stop_id: 'stp_1001', packages: 2, instructions }])
    ).rejects.toMatchObject({ kind: 'validation', outcome: 'definitive' });
    expect(urls).toHaveLength(0);
  }
);
