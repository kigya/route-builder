import { decodeCreatedRoute, decodePhotos, decodeStops } from './decode';
import { createTransport } from './transport';
import type { ApiOptions } from './transport';
import { ApiError } from './types';
import type { RouteApi, RouteItem, Stop } from './types';

function validInstructions(text: string) {
  if (!text.trim() || text.length > 200) return false;
  // Reject lone surrogates, including a high surrogate cut at the 200-unit boundary.
  for (let index = 0; index < text.length; index++) {
    const unit = text.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(++index);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  return true;
}
function validateItems(items: RouteItem[]) {
  if (
    !items.length ||
    items.some(
      (item) =>
        !item.stop_id.trim() ||
        !Number.isSafeInteger(item.packages) ||
        item.packages < 1 ||
        !validInstructions(item.instructions)
    )
  ) {
    throw new ApiError(
      'validation',
      'Each stop needs a positive quantity and instructions of up to 200 UTF-16 units.',
      { outcome: 'definitive' }
    );
  }
}

export function createApi(options: ApiOptions): RouteApi {
  // Keep this instance in the provider so all endpoint methods share its cooldown.
  const transport = createTransport(options);
  return {
    async listStops(q, signal) {
      const stops = new Map<string, Stop>();
      for (let page = 1; page <= 100; page++) {
        const rows = decodeStops(
          await transport.request(
            'GET',
            `/v1/stops?page=${page}&page_size=50&q=${encodeURIComponent(q)}`,
            { signal: signal }
          )
        );
        const previousSize = stops.size;
        for (const stop of rows) if (!stops.has(stop.id)) stops.set(stop.id, stop);
        if (stops.size === previousSize) return [...stops.values()];
      }
      throw new ApiError(
        'pagination',
        'The address book exceeded the safe page limit. Please narrow your search.',
        { outcome: 'definitive' }
      );
    },
    async getPhotos(id, signal) {
      return decodePhotos(
        await transport.request('GET', `/v1/stops/${encodeURIComponent(id)}/photos`, {
          signal: signal,
        })
      );
    },
    async createRoute(items) {
      validateItems(items);
      // Snapshot before the first await so external edits cannot change an in-flight route.
      const submitted = items.map((item) => ({ ...item }));
      const route = decodeCreatedRoute(
        await transport.request('POST', '/v1/routes', { body: { stops: submitted } })
      );
      if (
        route.stops.length !== submitted.length ||
        route.stops.some((item, index) => {
          const sent = submitted[index];
          return (
            !sent ||
            item.stop_id !== sent.stop_id ||
            item.packages !== sent.packages ||
            item.instructions !== sent.instructions
          );
        })
      )
        throw new ApiError(
          'invalid-response',
          'The confirmed route differs from the submitted route.',
          { outcome: 'uncertain' }
        );
      return route;
    },
  };
}
