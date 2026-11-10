import { ApiError } from '@/api/types';
import type { RouteApi } from '@/api/types';
import type { RouteDraft } from './model';
import { DraftStorageError } from './persistence';
import type { DraftStore } from './persistence';
import { validateDraft } from './validation';
export type SubmitResult = { draft: RouteDraft; error?: Error; storageError?: DraftStorageError };
export interface Submitter {
  readonly isSubmitting: boolean;
  submit(draft: RouteDraft): Promise<SubmitResult>;
  retryUncertain(
    draft: RouteDraft,
    confirmation: { acknowledgeDuplicateRisk: true }
  ): Promise<SubmitResult>;
  reset(): void;
}
function snapshotDraft(draft: RouteDraft): RouteDraft {
  const marker = draft.submission;
  const submission =
    marker.status === 'idle'
      ? { status: 'idle' as const }
      : marker.status === 'succeeded'
        ? {
            status: 'succeeded' as const,
            route: { ...marker.route, stops: marker.route.stops.map((item) => ({ ...item })) },
          }
        : { ...marker, items: marker.items.map((item) => ({ ...item })) };
  return {
    ...draft,
    stops: draft.stops.map((entry) => ({ ...entry, stop: { ...entry.stop } })),
    submission,
  };
}
function asStorageError(error: unknown): DraftStorageError {
  return error instanceof DraftStorageError
    ? error
    : new DraftStorageError(error instanceof Error ? error.message : 'Unable to save the draft.');
}
let attemptSequence = 0;
export function createSubmitter(
  api: RouteApi,
  store: DraftStore,
  options?: { createAttemptId?: () => string }
): Submitter {
  let active: Promise<SubmitResult> | undefined;
  let terminal: SubmitResult | undefined;
  const createAttemptId =
    options?.createAttemptId ?? (() => `${Date.now().toString(36)}-${++attemptSequence}`);
  async function run(snapshot: RouteDraft): Promise<SubmitResult> {
    if (Object.keys(validateDraft(snapshot)).length)
      return {
        draft: snapshot,
        error: new ApiError('validation', 'Check the selected stops and delivery instructions.', {
          outcome: 'definitive',
        }),
      };
    const items = snapshot.stops.map((entry) => ({
      stop_id: entry.stop.id,
      packages: entry.packages,
      instructions: entry.instructions,
    }));
    const attemptId = createAttemptId();
    const attempting: RouteDraft = {
      ...snapshot,
      submission: { status: 'attempting', attemptId, items },
    };
    try {
      await store.flush();
      await store.save(attempting);
    } catch (error) {
      return { draft: snapshot, storageError: asStorageError(error) };
    }
    let result: SubmitResult;
    try {
      const route = await api.createRoute(items.map((item) => ({ ...item })));
      result = { draft: { ...snapshot, submission: { status: 'succeeded', route } } };
    } catch (error) {
      const failure =
        error instanceof Error ? error : new Error('Route creation could not be confirmed.');
      const submission =
        error instanceof ApiError && error.outcome === 'definitive'
          ? snapshot.submission.status === 'uncertain'
            ? // A rejected retry says nothing about the earlier request's outcome.
              snapshot.submission
            : { status: 'idle' as const }
          : { status: 'uncertain' as const, attemptId, items };
      result = { draft: { ...snapshot, submission }, error: failure };
    }
    try {
      await store.save(result.draft);
    } catch (error) {
      // If recording a definitive rejection fails, disk still says 'attempting'.
      // Keep a single conservative state until that marker can be saved again.
      const safeDraft: RouteDraft =
        result.draft.submission.status === 'idle'
          ? { ...snapshot, submission: { status: 'uncertain', attemptId, items } }
          : result.draft;
      result = { ...result, draft: safeDraft, storageError: asStorageError(error) };
    }
    terminal = result.draft.submission.status === 'idle' ? undefined : result;
    return result;
  }
  function start(draft: RouteDraft): Promise<SubmitResult> {
    // Clone and lock before any persistence await; React rendering is not the lock.
    const snapshot = snapshotDraft(draft);
    active = run(snapshot).finally(() => {
      active = undefined;
    });
    return active;
  }
  return {
    get isSubmitting() {
      return active !== undefined;
    },
    submit(draft) {
      if (active) return active;
      if (terminal) return Promise.resolve(terminal);
      if (draft.submission.status !== 'idle') {
        const snapshot = snapshotDraft(draft);
        if (snapshot.submission.status === 'attempting')
          snapshot.submission = { ...snapshot.submission, status: 'uncertain' };
        terminal = { draft: snapshot };
        return Promise.resolve(terminal);
      }
      return start(draft);
    },
    retryUncertain(draft, confirmation) {
      if (active) return active;
      const source = terminal?.draft ?? draft;
      if (
        confirmation.acknowledgeDuplicateRisk !== true ||
        source.submission.status !== 'uncertain'
      )
        return Promise.resolve({
          draft: source,
          error: new Error(
            'Acknowledge the duplicate-route risk before retrying an uncertain attempt.'
          ),
        });
      // Keep the old uncertainty if persistence blocks the acknowledged retry.
      terminal ??= { draft: snapshotDraft(source) };
      return start(source);
    },
    reset() {
      if (active) throw new Error('Wait for route creation to finish before starting a new route.');
      terminal = undefined;
    },
  };
}
