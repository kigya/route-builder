import { validateDraft, limitInstruction } from '@/features/route/validation';
import { initialDraft } from '@/features/route/model';
import { draft, stop } from './fixtures';
test('empty draft cannot submit', () => {
  expect(validateDraft(initialDraft).stops).toBeDefined();
});
test.each(['', ' \n\t', 'a'.repeat(201), 'a'.repeat(199) + '\ud83d', '\ude00', 'a\ud800b'])(
  'invalid instructions are flagged without modification: %s',
  (text) => {
    const source = draft(text);
    expect(validateDraft(source)['north.instructions']).toBeDefined();
    expect(source.stops[0]?.instructions).toBe(text);
  }
);
test.each(['a'.repeat(200), 'a'.repeat(198) + '😀', '😀'.repeat(100)])(
  'valid 200 UTF-16 units pass: %s',
  (text) => {
    expect(validateDraft(draft(text))).toEqual({});
  }
);
test.each([
  ['a'.repeat(201), 'a'.repeat(200)],
  ['a'.repeat(199) + '😀', 'a'.repeat(199)],
  ['a'.repeat(198) + '😀x', 'a'.repeat(198) + '😀'],
  ['a'.repeat(199) + '\ud83d', 'a'.repeat(199)],
  ['x\ude00y', 'xy'],
])('limiter never leaves a lone surrogate', (text, expected) => {
  expect(limitInstruction(text)).toBe(expected);
});
test.each([
  [null, 100],
  [9, 10],
  [9, 0],
  [9, 1.5],
])('quantity outside limit is flagged', (max, packages) => {
  const source = {
    ...draft(),
    stops: [{ stop: stop('north', max), packages: packages ?? 0, instructions: 'Reception' }],
  };
  expect(validateDraft(source)['north.packages']).toBeDefined();
});
