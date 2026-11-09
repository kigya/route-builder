import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactElement, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createApi } from '@/api/client';
import type { RouteApi } from '@/api/types';
import type { DraftAction, RouteDraft } from './model';
import { draftReducer, initialDraft } from './model';
import { createDraftStore } from './persistence';
import { createSubmitter } from './submission';
import { validateDraft } from './validation';
import type { DraftStorage } from './persistence';
import type { SubmitResult } from './submission';
export type RouteDraftView = {
  status: 'restoring' | 'ready' | 'recovery' | 'restore-error';
  ready: boolean;
  saving: boolean;
  isSubmitting: boolean;
  canEdit: boolean;
  storageError: Error | undefined;
  recoveryReason: 'invalid' | 'version' | undefined;
  draft: RouteDraft;
  validation: Record<string, string>;
  result: SubmitResult | undefined;
  api: RouteApi;
  dispatch(action: DraftAction): void;
  submit(): Promise<SubmitResult>;
  retryUncertain(confirmation: { acknowledgeDuplicateRisk: true }): Promise<SubmitResult>;
  retryRestore(): Promise<void>;
  retrySave(): Promise<boolean>;
  reset(confirmation: { acknowledgeDataLoss: true }): Promise<boolean>;
  discardSavedDraft(confirmation: { acknowledgeDataLoss: true }): Promise<boolean>;
};
type RouteState = Pick<
  RouteDraftView,
  'status' | 'draft' | 'saving' | 'isSubmitting' | 'storageError' | 'recoveryReason' | 'result'
>;
type RouteActions = Pick<
  RouteDraftView,
  | 'dispatch'
  | 'submit'
  | 'retryUncertain'
  | 'retryRestore'
  | 'retrySave'
  | 'reset'
  | 'discardSavedDraft'
>;
function createSession(api: RouteApi, storage: DraftStorage) {
  const store = createDraftStore(storage);
  const submitter = createSubmitter(api, store);
  const listeners = new Set<() => void>();
  let state: RouteState = {
    status: 'restoring',
    draft: { ...initialDraft, stops: [], submission: { status: 'idle' } },
    saving: false,
    isSubmitting: false,
    storageError: undefined,
    recoveryReason: undefined,
    result: undefined,
  };
  let restoring: Promise<void> | undefined;
  let submitting: Promise<SubmitResult> | undefined;
  let pendingSaves = 0;
  function update(change: Partial<RouteState>) {
    state = { ...state, ...change };
    listeners.forEach((listener) => listener());
  }
  function errorFrom(error: unknown) {
    return error instanceof Error ? error : new Error('Draft storage is unavailable.');
  }
  function restore(): Promise<void> {
    if (restoring) return restoring;
    if (state.status === 'ready') return Promise.resolve();
    update({ status: 'restoring', storageError: undefined });
    restoring = store
      .load()
      .then((loaded) => {
        if (loaded.status === 'recovery')
          update({ status: 'recovery', recoveryReason: loaded.reason });
        else
          update({
            status: 'ready',
            draft: loaded.draft,
            recoveryReason: undefined,
            result: undefined,
          });
      })
      .catch((error: unknown) => {
        update({ status: 'restore-error', storageError: errorFrom(error) });
      })
      .finally(() => {
        restoring = undefined;
      });
    return restoring;
  }
  async function persist(draft: RouteDraft): Promise<boolean> {
    pendingSaves++;
    update({ saving: true });
    try {
      await store.save(draft);
      update({ storageError: undefined });
      return true;
    } catch (error) {
      update({ storageError: errorFrom(error) });
      return false;
    } finally {
      pendingSaves--;
      update({ saving: pendingSaves > 0 || state.isSubmitting });
    }
  }
  function submit(confirmation?: { acknowledgeDuplicateRisk: true }): Promise<SubmitResult> {
    if (submitting) return submitting;
    if (state.status !== 'ready')
      return Promise.resolve({
        draft: state.draft,
        error: new Error('Restore the saved draft before creating a route.'),
      });
    update({ isSubmitting: true, saving: true, result: undefined });
    const request = confirmation
      ? submitter.retryUncertain(state.draft, confirmation)
      : submitter.submit(state.draft);
    submitting = request
      .then((result) => {
        update({ draft: result.draft, result, storageError: result.storageError });
        return result;
      })
      .finally(() => {
        submitting = undefined;
        update({ isSubmitting: false, saving: pendingSaves > 0 });
      });
    return submitting;
  }
  async function reset(confirmation: { acknowledgeDataLoss: true }): Promise<boolean> {
    if (state.isSubmitting || state.status === 'restoring') return false;
    const previousStatus = state.status;
    update({ status: 'restoring', saving: true });
    try {
      const draft = await store.discardAndReset(confirmation);
      submitter.reset();
      update({
        status: 'ready',
        draft,
        storageError: undefined,
        recoveryReason: undefined,
        result: undefined,
      });
      return true;
    } catch (error) {
      update({ status: previousStatus, storageError: errorFrom(error) });
      return false;
    } finally {
      update({ saving: pendingSaves > 0 });
    }
  }
  const actions: RouteActions = {
    dispatch(action) {
      if (state.status !== 'ready' || state.isSubmitting) return;
      const next = draftReducer(state.draft, action);
      if (next === state.draft) return;
      update({ draft: next, result: undefined });
      void persist(next);
    },
    submit: () => submit(),
    retryUncertain: (confirmation) => submit(confirmation),
    retryRestore: restore,
    retrySave: () =>
      state.status === 'ready' && !state.isSubmitting
        ? persist(state.draft)
        : Promise.resolve(false),
    reset,
    discardSavedDraft: reset,
  };
  return {
    api,
    actions,
    restore,
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
const RouteContext = createContext<ReturnType<typeof createSession> | undefined>(undefined);
export function RouteProvider({
  children,
  api,
  storage,
}: {
  children: ReactNode;
  api?: RouteApi;
  storage?: DraftStorage;
}): ReactElement {
  const [session] = useState(() =>
    createSession(
      api ??
        createApi({ baseURL: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:4000' }),
      storage ?? AsyncStorage
    )
  );
  useEffect(() => {
    void session.restore();
  }, [session]);
  return <RouteContext.Provider value={session}>{children}</RouteContext.Provider>;
}
export function useRouteDraft(): RouteDraftView {
  const session = useContext(RouteContext);
  if (!session) throw new Error('useRouteDraft must be used inside RouteProvider.');
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  return {
    ...state,
    ...session.actions,
    api: session.api,
    ready: state.status === 'ready',
    canEdit:
      state.status === 'ready' && !state.isSubmitting && state.draft.submission.status === 'idle',
    validation: validateDraft(state.draft),
  };
}
