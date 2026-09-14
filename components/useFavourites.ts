'use client';

import { useCallback, useEffect, useState } from 'react';

/* ============================================================
   Favourite games — the heart on each tile.

   Kept in localStorage, not the account, on purpose: a visitor can
   star games before they ever register. When the `users` table grows
   a favourites column this hook is the only thing that changes.
   ============================================================ */

const KEY = 'rr888bd:favourites';

/** One shared list per tab, so every heart on the page agrees. */
const listeners = new Set<(ids: string[]) => void>();
let current: string[] | null = null;

function read(): string[] {
  if (current) return current;
  try {
    const raw = localStorage.getItem(KEY);
    current = raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    current = [];
  }
  return current;
}

function write(ids: string[]) {
  current = ids;
  try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* private mode */ }
  listeners.forEach((fn) => fn(ids));
}

export function useFavourites() {
  /* Server render and first paint both start empty — localStorage does not
     exist on the server, and reading it during render would hydrate-mismatch. */
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    setIds(read());
    listeners.add(setIds);
    return () => { listeners.delete(setIds); };
  }, []);

  const toggle = useCallback((id: string) => {
    const now = read();
    write(now.includes(id) ? now.filter((x) => x !== id) : [id, ...now]);
  }, []);

  return { ids, toggle, isFavourite: (id: string) => ids.includes(id) };
}
