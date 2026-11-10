import type { DraftStorage } from '@/features/route/persistence';
export function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} {
  let resolve: (value: T) => void = () => {
    throw new Error('Deferred not initialized');
  };
  let reject: (error: Error) => void = () => {
    throw new Error('Deferred not initialized');
  };
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
export function memoryStorage(raw: string | null = null): DraftStorage & { read(): string | null } {
  let value = raw;
  return {
    getItem: () => Promise.resolve(value),
    setItem: (_key, next) => {
      value = next;
      return Promise.resolve();
    },
    read: () => value,
  };
}
