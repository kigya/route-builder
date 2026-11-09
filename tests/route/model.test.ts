import { draftReducer, initialDraft } from '@/features/route/model';
import { draft, stop } from './fixtures';

test('single selection replaces an unedited stop', () => {
  expect(draftReducer(draft(''), { type: 'selectStop', stop: stop('south') }).stops).toEqual([
    { stop: stop('south'), packages: 1, instructions: '' },
  ]);
});
test('single replacement with written instructions requires confirmation', () => {
  const source = draft();
  expect(draftReducer(source, { type: 'selectStop', stop: stop('south') })).toEqual(source);
  expect(
    draftReducer(source, { type: 'confirmSingleReplacement', stop: stop('south') }).stops
  ).toEqual([{ stop: stop('south'), packages: 1, instructions: '' }]);
});
test('multi selection keeps insertion order and ignores duplicate selection', () => {
  const multi = draftReducer(draft(), { type: 'setMode', mode: 'multi' });
  const added = draftReducer(multi, { type: 'selectStop', stop: stop('south') });
  expect(draftReducer(added, { type: 'selectStop', stop: stop() }).stops).toEqual([
    { stop: stop(), packages: 2, instructions: 'Leave at reception' },
    { stop: stop('south'), packages: 1, instructions: '' },
  ]);
});
test('destructive mode change waits for confirmation and then retains the first entry', () => {
  const source = {
    ...draft(),
    mode: 'multi' as const,
    stops: [...draft().stops, { stop: stop('south'), packages: 3, instructions: 'Side door' }],
  };
  expect(draftReducer(source, { type: 'setMode', mode: 'single' })).toEqual(source);
  expect(draftReducer(source, { type: 'confirmModeChange', mode: 'single' })).toEqual(draft());
});
test.each([0, -1, 10, 1.5, NaN])(
  'invalid quantity %s preserves quantity and instructions',
  (packages) => {
    expect(draftReducer(draft(), { type: 'setPackages', id: 'north', packages })).toEqual(draft());
  }
);
test.each([
  [9, 1],
  [9, 9],
  [null, 99],
  [120, 120],
])('accepts max %s quantity %s without clearing text', (max, packages) => {
  const source = {
    ...draft(),
    stops: [{ stop: stop('north', max), packages: 2, instructions: 'Keep text' }],
  };
  expect(
    draftReducer(source, { type: 'setPackages', id: 'north', packages: packages ?? 1 }).stops
  ).toEqual([{ stop: stop('north', max), packages, instructions: 'Keep text' }]);
});
test('removing last stop leaves an empty draft', () => {
  expect(draftReducer(draft(), { type: 'removeStop', id: 'north' }).stops).toEqual([]);
});
test('Clear all clears only the specified card', () => {
  const source = {
    ...draft(),
    mode: 'multi' as const,
    stops: [...draft().stops, { stop: stop('south'), packages: 3, instructions: 'Side door' }],
  };
  expect(draftReducer(source, { type: 'clearInstructions', id: 'north' }).stops).toEqual([
    { stop: stop(), packages: 2, instructions: '' },
    { stop: stop('south'), packages: 3, instructions: 'Side door' },
  ]);
});
test('instruction edits limit malformed native cutoff safely', () => {
  expect(
    draftReducer(draft(), {
      type: 'setInstructions',
      id: 'north',
      text: 'a'.repeat(199) + '\ud83d',
    }).stops[0]?.instructions
  ).toBe('a'.repeat(199));
});
test('uncertain and successful drafts cannot be edited accidentally', () => {
  const source = {
    ...draft(),
    submission: {
      status: 'uncertain' as const,
      attemptId: 'attempt',
      items: [{ stop_id: 'north', packages: 2, instructions: 'Leave at reception' }],
    },
  };
  expect(draftReducer(source, { type: 'clearInstructions', id: 'north' })).toEqual(source);
});
test('empty initial draft has no selections', () => {
  expect(initialDraft.stops).toEqual([]);
});
test('editing a restored over-limit draft preserves gradual corrections and its unseen tail', () => {
  const source = draft('a'.repeat(250));
  expect(
    draftReducer(source, { type: 'setInstructions', id: 'north', text: 'a'.repeat(249) }).stops[0]
      ?.instructions
  ).toBe('a'.repeat(249));
});
