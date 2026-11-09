import type { CreatedRoute, RouteItem, Stop } from '@/api/types';
import { limitInstruction, validQuantity } from './validation';
export type DraftStop = { stop: Stop; packages: number; instructions: string };
export type SubmissionMarker =
  | { status: 'idle' }
  | { status: 'attempting' | 'uncertain'; attemptId: string; items: RouteItem[] }
  | { status: 'succeeded'; route: CreatedRoute };
export type RouteDraft = {
  version: 1;
  mode: 'single' | 'multi';
  stops: DraftStop[];
  submission: SubmissionMarker;
};
export type DraftAction =
  | { type: 'selectStop' | 'confirmSingleReplacement'; stop: Stop; packages?: number }
  | { type: 'setMode' | 'confirmModeChange'; mode: RouteDraft['mode'] }
  | { type: 'removeStop'; id: string }
  | { type: 'clearInstructions'; id: string }
  | { type: 'setPackages'; id: string; packages: number }
  | { type: 'setInstructions'; id: string; text: string };
export const initialDraft: RouteDraft = {
  version: 1,
  mode: 'single',
  stops: [],
  submission: { status: 'idle' },
};
export function draftReducer(state: RouteDraft, action: DraftAction): RouteDraft {
  if (state.submission.status !== 'idle') return state;
  switch (action.type) {
    case 'selectStop':
    case 'confirmSingleReplacement': {
      if (state.stops.some((entry) => entry.stop.id === action.stop.id)) return state;
      const packages = action.packages ?? 1;
      if (!validQuantity(action.stop, packages)) return state;
      if (
        state.mode === 'single' &&
        action.type === 'selectStop' &&
        state.stops.some((entry) => entry.instructions.trim())
      )
        return state;
      const entry = { stop: { ...action.stop }, packages, instructions: '' };
      return { ...state, stops: state.mode === 'single' ? [entry] : [...state.stops, entry] };
    }
    case 'setMode':
    case 'confirmModeChange':
      if (action.mode === state.mode) return state;
      if (action.mode === 'single' && state.stops.length > 1 && action.type !== 'confirmModeChange')
        return state;
      return {
        ...state,
        mode: action.mode,
        stops: action.mode === 'single' ? state.stops.slice(0, 1) : state.stops,
      };
    case 'removeStop':
      return { ...state, stops: state.stops.filter((entry) => entry.stop.id !== action.id) };
    case 'setPackages':
      return {
        ...state,
        stops: state.stops.map((entry) =>
          entry.stop.id === action.id && validQuantity(entry.stop, action.packages)
            ? { ...entry, packages: action.packages }
            : entry
        ),
      };
    case 'setInstructions':
    case 'clearInstructions':
      return {
        ...state,
        stops: state.stops.map((entry) =>
          entry.stop.id === action.id
            ? {
                ...entry,
                instructions:
                  action.type === 'clearInstructions'
                    ? ''
                    : entry.instructions !== limitInstruction(entry.instructions)
                      ? action.text
                      : limitInstruction(action.text),
              }
            : entry
        ),
      };
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
