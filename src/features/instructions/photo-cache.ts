import type { DeliveryPhoto, RouteApi } from '@/api/types';
type PhotoState =
  | { status: 'idle' | 'loading' | 'error'; photos: [] }
  | { status: 'loaded'; photos: DeliveryPhoto[] };
const idle: PhotoState = { status: 'idle', photos: [] };
function createResource(api: RouteApi, id: string) {
  let state = idle;
  let users = 0;
  let generation = 0;
  let controller: AbortController | undefined;
  const listeners = new Set<() => void>();
  function publish(next: PhotoState) {
    state = next;
    listeners.forEach((listener) => listener());
  }
  function start() {
    if (!users || state.status === 'loading' || state.status === 'loaded') return;
    const token = ++generation;
    controller = new AbortController();
    publish({ status: 'loading', photos: [] });
    void api.getPhotos(id, controller.signal).then(
      (photos) => {
        if (token !== generation || !users) return;
        publish({
          status: 'loaded',
          photos: photos.filter(
            (photo) => typeof photo.url === 'string' && photo.url.trim().length > 0
          ),
        });
      },
      () => {
        if (token !== generation || !users) return;
        publish({ status: 'error', photos: [] });
      }
    );
  }
  return {
    snapshot: () => state,
    subscribe(this: void, listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    retain() {
      users++;
      // Errors are retained until an explicit photo retry.
      if (state.status === 'idle') start();
      return () => {
        users--;
        if (!users && state.status === 'loading') {
          generation++;
          controller?.abort();
          publish(idle);
        }
      };
    },
    retry(this: void) {
      if (state.status === 'error') start();
    },
  };
}
type Resource = ReturnType<typeof createResource>;
// The provider API instance defines the cache lifetime, including the shared rate-limit budget.
const caches = new WeakMap<RouteApi, Map<string, Resource>>();
export function photoResource(api: RouteApi, id: string): Resource {
  let cache = caches.get(api);
  if (!cache) {
    cache = new Map();
    caches.set(api, cache);
  }
  let resource = cache.get(id);
  if (!resource) {
    resource = createResource(api, id);
    cache.set(id, resource);
  }
  return resource;
}
