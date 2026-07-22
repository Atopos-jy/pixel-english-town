'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type AuthUser = { id: string; email: string; name: string | null; role: string };
type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
type ApiResponse<T> = { code: number; data: T | null; message: string };
type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  refresh: () => Promise<boolean>;
  logout: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function getCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch('/api/v1/auth/me');
  const body = (await response.json()) as ApiResponse<AuthUser>;
  return response.ok && body.code === 0 ? body.data : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const refresh = useCallback(async () => {
    setStatus('loading');
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setStatus(currentUser ? 'authenticated' : 'unauthenticated');
      return currentUser !== null;
    } catch {
      setUser(null);
      setStatus('unauthenticated');
      return false;
    }
  }, []);
  const logout = useCallback(async () => {
    await fetch('/api/v1/auth/logout', { method: 'POST' });
    setUser(null);
    setStatus('unauthenticated');
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return <AuthContext.Provider value={{ user, status, refresh, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth 必须在 AuthProvider 内使用');
  return context;
}
