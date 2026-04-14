import React, {createContext, useContext, useState, useEffect, useCallback} from 'react';
import {api} from '../lib/api';
import {storage} from '../lib/storage';
import type {UserProfile} from '../lib/types';

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({children}: {children: React.ReactNode}) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const savedUser = await storage.getUser();
        if (savedUser) {
          setUser(savedUser);
          try {
            const freshUser = await api.auth.me();
            setUser(freshUser);
            await storage.setUser(freshUser);
          } catch {
            // Token might be expired, try refresh
            const refreshed = await api.auth.refresh();
            if (refreshed) {
              const freshUser = await api.auth.me();
              setUser(freshUser);
              await storage.setUser(freshUser);
            } else {
              setUser(null);
              await storage.clearTokens();
              await storage.clearUser();
            }
          }
        }
      } catch {
        // Ignore
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.auth.login({email, password});
    if ((res as any).accessToken) await storage.setAccessToken((res as any).accessToken);
    if ((res as any).refreshToken) await storage.setRefreshToken((res as any).refreshToken);
    setUser(res.user);
    await storage.setUser(res.user);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, phone?: string) => {
    const res = await api.auth.register({name, email, password, phone});
    if ((res as any).accessToken) await storage.setAccessToken((res as any).accessToken);
    if ((res as any).refreshToken) await storage.setRefreshToken((res as any).refreshToken);
    setUser(res.user);
    await storage.setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    try { await api.auth.logout(); } catch {}
    setUser(null);
    await storage.clearTokens();
    await storage.clearUser();
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const freshUser = await api.auth.me();
      setUser(freshUser);
      await storage.setUser(freshUser);
    } catch {}
  }, []);

  return (
    <AuthContext.Provider value={{user, isLoading, isAuthenticated: !!user, login, register, logout, refreshUser}}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
