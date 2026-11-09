import { ApiError } from './types';
import type { CreatedRoute, DeliveryPhoto, RouteItem, Stop } from './types';

function invalid(): never {
  throw new ApiError('invalid-response', 'The service returned an unexpected response.', {
    outcome: 'uncertain',
  });
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return invalid();
  return value;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) return invalid();
  return value;
}
function items(value: unknown): unknown[] {
  const rows = record(value).items;
  if (rows === null) return [];
  if (!Array.isArray(rows)) return invalid();
  return rows;
}
function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
function packagesMax(value: unknown): number | null {
  const number = typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : value;
  return positiveInteger(number) ? number : null;
}
export function decodeStops(value: unknown): Stop[] {
  return items(value).map((item) => {
    const row = record(item);
    return {
      id: text(row.id),
      name: text(row.name),
      address: text(row.address),
      phone: typeof row.phone === 'string' ? row.phone : '',
      packagesMax: packagesMax(row.packages_max),
    };
  });
}
function photoUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  // Accept ordinary HTTP(S) image hosts without depending on Hermes URL support.
  const match = /^https?:\/\/([a-z0-9.-]+)(?::(\d{1,5}))?(?:[/?#][^\s\\]*)?$/i.exec(value);
  const host = match?.[1];
  const port = match?.[2];
  return (
    host !== undefined &&
    host.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)) &&
    (port === undefined || Number(port) <= 65535)
  );
}
export function decodePhotos(value: unknown): DeliveryPhoto[] {
  return items(value).flatMap((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return [];
    const row = record(item);
    if (
      !photoUrl(row.url) ||
      typeof row.id !== 'string' ||
      !row.id.trim() ||
      typeof row.tag !== 'string'
    )
      return [];
    return [{ id: row.id, url: row.url, tag: row.tag }];
  });
}
export function decodeCreatedRoute(value: unknown): CreatedRoute {
  const row = record(value);
  const id = text(row.id);
  if (row.status !== 'draft' || !Array.isArray(row.stops) || row.stops.length === 0)
    return invalid();
  const stops: RouteItem[] = row.stops.map((item: unknown) => {
    const stop = record(item);
    if (!positiveInteger(stop.packages) || typeof stop.instructions !== 'string') return invalid();
    return {
      stop_id: text(stop.stop_id),
      packages: stop.packages,
      instructions: stop.instructions,
    };
  });
  return { id, status: 'draft', stops };
}
