'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export interface SessionUser {
  id: string;
  /** Null until an account opened with Google/Facebook confirms a number. */
  phoneE164: string | null;
  displayName: string;
  email: string | null;
  phoneVerified: boolean;
  /** Linked sign-in providers: "google", "facebook". */
  providers?: string[];
}

export interface SessionShop {
  slug: string;
  displayName: string;
}

interface SessionCtx {
  user: SessionUser | null;
  /** The signed-in user's shop, or null if they haven't opened one (buyer). */
  shop: SessionShop | null;
  /** Convenience: true when the user has a shop. */
  isSeller: boolean;
  loading: boolean;
  /** True while the shop lookup is in flight (avoids a buyer/seller flash). */
  shopLoading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [shop, setShop] = useState<SessionShop | null>(null);
  const [loading, setLoading] = useState(true);
  const [shopLoading, setShopLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = (await res.json()) as { user: SessionUser | null };
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
    setShop(null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Once signed in, find out whether the user has a shop (seller vs buyer view).
  useEffect(() => {
    if (!user) {
      setShop(null);
      setShopLoading(false);
      return;
    }
    let active = true;
    setShopLoading(true);
    void fetch('/api/mine/shop', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: SessionShop | null) => {
        if (active) setShop(s && typeof s.slug === 'string' ? s : null);
      })
      .catch(() => {
        if (active) setShop(null);
      })
      .finally(() => {
        if (active) setShopLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <Ctx.Provider
      value={{ user, shop, isSeller: shop !== null, loading, shopLoading, refresh, signOut }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSession(): SessionCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSession must be used within SessionProvider');
  return c;
}
