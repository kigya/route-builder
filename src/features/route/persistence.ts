import type { CreatedRoute, RouteItem, Stop } from '@/api/types';
import { initialDraft } from './model';
import type { DraftStop, RouteDraft, SubmissionMarker } from './model';
import { validQuantity, validateDraft } from './validation';
export interface DraftStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
export type DraftLoad =
  | { status: 'loaded'; draft: RouteDraft }
  | { status: 'recovery'; raw: string; reason: 'invalid' | 'version' };
export interface DraftStore {
  load(): Promise<DraftLoad>;
  save(draft: RouteDraft): Promise<void>;
  flush(): Promise<void>;
  discardAndReset(confirmation: { acknowledgeDataLoss: true }): Promise<RouteDraft>;
}
export class DraftStorageError extends Error {
  override readonly name = 'DraftStorageError';
}
export const DRAFT_STORAGE_KEY = 'route-builder:draft';
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isStop(value: unknown): value is Stop {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    !!value.id.trim() &&
    typeof value.name === 'string' &&
    !!value.name.trim() &&
    typeof value.address === 'string' &&
    !!value.address.trim() &&
    typeof value.phone === 'string' &&
    (value.packagesMax === null ||
      (typeof value.packagesMax === 'number' &&
        Number.isSafeInteger(value.packagesMax) &&
        value.packagesMax > 0))
  );
}
function isDraftStop(value: unknown): value is DraftStop {
  return (
    isRecord(value) &&
    isStop(value.stop) &&
    typeof value.packages === 'number' &&
    validQuantity(value.stop, value.packages) &&
    typeof value.instructions === 'string'
  );
}
function isItem(value: unknown): value is RouteItem {
  return (
    isRecord(value) &&
    typeof value.stop_id === 'string' &&
    !!value.stop_id.trim() &&
    typeof value.packages === 'number' &&
    Number.isSafeInteger(value.packages) &&
    value.packages > 0 &&
    typeof value.instructions === 'string'
  );
}
function isRoute(value: unknown): value is CreatedRoute {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    !!value.id.trim() &&
    value.status === 'draft' &&
    Array.isArray(value.stops) &&
    value.stops.every(isItem)
  );
}
function isMarker(value: unknown): value is SubmissionMarker {
  if (!isRecord(value)) return false;
  if (value.status === 'idle') return true;
  if (value.status === 'succeeded') return isRoute(value.route);
  return (
    (value.status === 'attempting' || value.status === 'uncertain') &&
    typeof value.attemptId === 'string' &&
    !!value.attemptId.trim() &&
    Array.isArray(value.items) &&
    value.items.every(isItem)
  );
}
function isDraft(value: unknown): value is RouteDraft {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    (value.mode !== 'single' && value.mode !== 'multi') ||
    !Array.isArray(value.stops) ||
    !value.stops.every(isDraftStop) ||
    !isMarker(value.submission)
  )
    return false;
  if (value.mode === 'single' && value.stops.length > 1) return false;
  if (new Set(value.stops.map((entry) => entry.stop.id)).size !== value.stops.length) return false;
  const draft: RouteDraft = {
    version: 1,
    mode: value.mode,
    stops: value.stops,
    submission: value.submission,
  };
  if (draft.submission.status === 'idle') return true;
  if (Object.keys(validateDraft(draft)).length) return false;
  const items =
    draft.submission.status === 'succeeded' ? draft.submission.route.stops : draft.submission.items;
  return (
    items.length === draft.stops.length &&
    items.every((item, index) => {
      const entry = draft.stops[index];
      return (
        entry !== undefined &&
        item.stop_id === entry.stop.id &&
        item.packages === entry.packages &&
        item.instructions === entry.instructions
      );
    })
  );
}
function decodeDraft(raw: string): DraftLoad {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { status: 'recovery', raw, reason: 'invalid' };
  }
  if (isRecord(value) && value.version !== 1) return { status: 'recovery', raw, reason: 'version' };
  if (!isDraft(value)) return { status: 'recovery', raw, reason: 'invalid' };
  const draft =
    value.submission.status === 'attempting'
      ? { ...value, submission: { ...value.submission, status: 'uncertain' as const } }
      : value;
  return { status: 'loaded', draft };
}
function storageError(error: unknown): DraftStorageError {
  return new DraftStorageError(
    error instanceof Error ? error.message : 'Draft storage is unavailable.'
  );
}
export function createDraftStore(storage: DraftStorage): DraftStore {
  let queue = Promise.resolve();
  let canSave = false;
  let failure: DraftStorageError | undefined;
  function enqueue(raw: string): Promise<void> {
    const operation = queue.then(async () => {
      try {
        await storage.setItem(DRAFT_STORAGE_KEY, raw);
        failure = undefined;
      } catch (error) {
        failure = storageError(error);
        throw failure;
      }
    });
    // Keep later writes usable, but retain the rejection for flush and the caller.
    queue = operation.catch(() => undefined);
    return operation;
  }
  return {
    async load() {
      await queue;
      canSave = false;
      let raw: string | null;
      try {
        raw = await storage.getItem(DRAFT_STORAGE_KEY);
      } catch (error) {
        throw storageError(error);
      }
      const result: DraftLoad =
        raw === null
          ? {
              status: 'loaded',
              draft: { ...initialDraft, stops: [], submission: { status: 'idle' } },
            }
          : decodeDraft(raw);
      canSave = result.status === 'loaded';
      return result;
    },
    save(draft) {
      if (!canSave)
        return Promise.reject(
          new DraftStorageError('Restore or explicitly discard the saved draft before writing.')
        );
      if (!isDraft(draft))
        return Promise.reject(new DraftStorageError('The draft cannot be saved safely.'));
      // Serialize now so mutations during an earlier write cannot change this save.
      return enqueue(JSON.stringify(draft));
    },
    async flush() {
      await queue;
      if (failure) throw failure;
    },
    async discardAndReset(confirmation) {
      if (confirmation.acknowledgeDataLoss !== true)
        throw new DraftStorageError('Confirm discarding the saved draft first.');
      const draft: RouteDraft = { ...initialDraft, stops: [], submission: { status: 'idle' } };
      await enqueue(JSON.stringify(draft));
      canSave = true;
      return draft;
    },
  };
}
