import type { Stop } from '@/api/types';
export type StopSection = { title: string; data: Stop[] };
function compare(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}
export function groupStops(stops: readonly Stop[]): StopSection[] {
  const sections = new Map<string, Stop[]>();
  const sorted = [...stops].sort(
    (left, right) =>
      compare(left.name.trim().toUpperCase(), right.name.trim().toUpperCase()) ||
      compare(left.name, right.name) ||
      compare(left.id, right.id)
  );
  for (const stop of sorted) {
    const initial = stop.name.trim().charAt(0).toUpperCase();
    const title = /^[A-Z]$/.test(initial) ? initial : '#';
    const data = sections.get(title) ?? [];
    data.push(stop);
    sections.set(title, data);
  }
  return [...sections]
    .sort(([left], [right]) => (left === '#' ? 1 : right === '#' ? -1 : compare(left, right)))
    .map(([title, data]) => ({ title, data }));
}
