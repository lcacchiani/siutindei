'use client';

import type { ReactNode } from 'react';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import {
  ensureFreshTokens,
  getUserProfile,
  startLogin,
  startLogout,
} from '../lib/auth';
import { getConfigErrors } from '../lib/config';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  status: AuthStatus;
  user: ReturnType<typeof getUserProfile> | null;
  isAdmin: boolean;
  configErrors: string[];
  error: string;
  login: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthContextValue['user']>(null);
  const [error, setError] = useState('');
  const configErrors = useMemo(() => getConfigErrors(), []);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      if (configErrors.length > 0) {
        if (isMounted) {
          setStatus('unauthenticated');
        }
        return;
      }
      try {
        const tokens = await ensureFreshTokens();
        if (!isMounted) {
          return;
        }
        if (tokens) {
          const profile = getUserProfile(tokens);
          setUser(profile);
          setStatus('authenticated');
        } else {
          setStatus('unauthenticated');
        }
      } catch (err) {
        if (!isMounted) {
          return;
        }
        const message =
          err instanceof Error ? err.message : 'Unable to load session.';
        setError(message);
        setStatus('unauthenticated');
      }
    };

    loadSession();

    return () => {
      isMounted = false;
    };
  }, [configErrors]);

  const login = async () => {
    await startLogin();
  };

  const logout = () => {
    startLogout();
  };

  const isAdmin = Boolean(user?.groups?.includes('admin'));

  const value: AuthContextValue = {
    status,
    user,
    isAdmin,
    configErrors,
    error,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }
  return context;
}
