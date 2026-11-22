import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { addFavorite, listFavorites, removeFavorite } from './api';

// Favourite product IDs, kept per device and (when signed in) mirrored to the
// server so they follow the user across devices and drive price-drop alerts.
// Mirrors the web's localStorage + /favorites sync pattern.
const STORE_KEY = 'nhonga_favs';

interface FavoritesValue {
  /** True once the initial hydrate (local + server) has settled. */
  ready: boolean;
  isFavorite: (productId: string) => boolean;
  toggle: (productId: string) => void;
  count: number;
}

const FavoritesContext = createContext<FavoritesValue | null>(null);

async function readLocal(): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(STORE_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
async function writeLocal(ids: string[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(ids));
  } catch {
    /* storage full or unavailable — the in-memory set still works this session */
  }
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  // Keep a live ref so toggle() always reads the latest set without re-creating.
  const idsRef = useRef(ids);
  idsRef.current = ids;

  useEffect(() => {
    let active = true;
    (async () => {
      const local = await readLocal();
      const set = new Set(local);
      // Merge the server's favourites when a session exists; push any local-only
      // ones up so a guest's hearts survive signing in.
      try {
        const server = await listFavorites();
        const serverIds = new Set(server.map((f) => f.productId));
        for (const id of serverIds) set.add(id);
        for (const id of local) if (!serverIds.has(id)) void addFavorite(id);
      } catch {
        /* not signed in or offline — local set stands */
      }
      if (!active) return;
      setIds(set);
      void writeLocal([...set]);
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const toggle = useCallback((productId: string) => {
    const next = new Set(idsRef.current);
    const adding = !next.has(productId);
    if (adding) next.add(productId);
    else next.delete(productId);
    setIds(next);
    void writeLocal([...next]);
    // Best-effort server sync (no-op server-side when not signed in).
    if (adding) void addFavorite(productId).catch(() => undefined);
    else void removeFavorite(productId);
  }, []);

  const value = useMemo<FavoritesValue>(
    () => ({
      ready,
      count: ids.size,
      isFavorite: (id: string) => ids.has(id),
      toggle,
    }),
    [ids, ready, toggle],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within a FavoritesProvider');
  return ctx;
}
