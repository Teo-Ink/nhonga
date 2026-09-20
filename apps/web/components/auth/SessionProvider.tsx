'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export interface SessionUser {
  id: string;
  phoneE164: string;
  displayName: string;
  email: string | null;
  phoneVerified: boolean;
}

interface SessionCtx {
  user: SessionUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

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
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return <Ctx.Provider value={{ user, loading, refresh, signOut }}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSession must be used within SessionProvider');
  return c;
}
