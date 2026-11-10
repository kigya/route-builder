import type { Stop } from '@/api/types';
import type { RouteDraft } from './model';
export const INSTRUCTION_LIMIT = 200;
export function packageLimit(stop: Stop): number {
  return stop.packagesMax ?? 99;
}
export function validQuantity(stop: Stop, packages: number): boolean {
  return Number.isSafeInteger(packages) && packages >= 1 && packages <= packageLimit(stop);
}
export function limitInstruction(text: string): string {
  let limited = '';
  for (const character of text) {
    const unit = character.charCodeAt(0);
    // Native maxLength may already have split an emoji before this handler runs.
    if (character.length === 1 && unit >= 0xd800 && unit <= 0xdfff) continue;
    if (limited.length + character.length > INSTRUCTION_LIMIT) break;
    limited += character;
  }
  return limited;
}
export function validateDraft(draft: RouteDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (draft.stops.length === 0) errors.stops = 'Select at least one stop.';
  for (const entry of draft.stops) {
    if (!validQuantity(entry.stop, entry.packages))
      errors[`${entry.stop.id}.packages`] =
        `Enter a whole quantity from 1 to ${packageLimit(entry.stop)}.`;
    if (!entry.instructions.trim())
      errors[`${entry.stop.id}.instructions`] = 'Add delivery instructions.';
    else if (entry.instructions !== limitInstruction(entry.instructions))
      errors[`${entry.stop.id}.instructions`] =
        'Use up to 200 characters without incomplete emoji.';
  }
  return errors;
}
