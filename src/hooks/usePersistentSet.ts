import { useCallback, useState } from 'react';

function read(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function write(key: string, codes: Set<string>) {
  try {
    window.localStorage.setItem(key, JSON.stringify([...codes]));
  } catch {
    /* private browsing or quota — carry on with in-memory state */
  }
}

/**
 * A Set of country codes backed by localStorage: the countries a traveller has
 * opened, and the ones they saved for later.
 */
export function usePersistentSet(key: string) {
  const [codes, setCodes] = useState<Set<string>>(() => new Set(read(key)));

  const update = useCallback(
    (change: (current: Set<string>) => Set<string> | null) => {
      setCodes((current) => {
        const next = change(current);
        if (!next) return current;
        write(key, next);
        return next;
      });
    },
    [key],
  );

  const add = useCallback(
    (code: string) => update((current) => (current.has(code) ? null : new Set(current).add(code))),
    [update],
  );

  const toggle = useCallback(
    (code: string) =>
      update((current) => {
        const next = new Set(current);
        if (!next.delete(code)) next.add(code);
        return next;
      }),
    [update],
  );

  const clear = useCallback(() => update(() => new Set()), [update]);

  return { codes, add, toggle, clear };
}
