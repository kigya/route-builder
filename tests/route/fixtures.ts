import type { Stop } from '@/api/types';
import type { RouteDraft } from '@/features/route/model';
export function stop(id = 'north', packagesMax: number | null = 9): Stop {
  return { id, name: id, address: '12 North Street', phone: '', packagesMax };
}
export function draft(instructions = 'Leave at reception'): RouteDraft {
  return {
    version: 1,
    mode: 'single',
    stops: [{ stop: stop(), packages: 2, instructions }],
    submission: { status: 'idle' },
  };
}
