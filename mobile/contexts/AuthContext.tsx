import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { secureStorage, storage } from "@/lib/storage";
import type { User, UserProfile } from "@/lib/types";

interface AuthState {
  user: Pick<User, "id" | "email" | "name" | "role"> | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: Partial<{ name: string; phone: string }>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Load saved user on mount
  useEffect(() => {
    (async () => {
      try {
        const token = await secureStorage.getToken();
        const savedUser = await storage.getUser();
        if (token && savedUser) {
          setState((s) => ({
            ...s,
            user: savedUser,
            isAuthenticated: true,
            isLoading: false,
          }));
          // Fetch fresh profile in background
          try {
            const profile = await api.getProfile();
            setState((s) => ({ ...s, profile, user: profile }));
            await storage.setUser(profile);
          } catch {
            // Token might be expired, try refresh
            try {
              await api.refresh();
              const profile = await api.getProfile();
              setState((s) => ({ ...s, profile, user: profile }));
              await storage.setUser(profile);
            } catch {
              // Refresh failed, clear auth
              await secureStorage.clearTokens();
              await storage.clearUser();
              setState({
                user: null,
                profile: null,
                isLoading: false,
                isAuthenticated: false,
              });
            }
          }
        } else {
          setState((s) => ({ ...s, isLoading: false }));
        }
      } catch {
        setState((s) => ({ ...s, isLoading: false }));
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    if (res.token) await secureStorage.setToken(res.token);
    if (res.refreshToken) await secureStorage.setRefreshToken(res.refreshToken);
    await storage.setUser(res.user);
    setState({
      user: res.user,
      profile: null,
      isLoading: false,
      isAuthenticated: true,
    });
    // Fetch full profile
    try {
      const profile = await api.getProfile();
      setState((s) => ({ ...s, profile }));
    } catch {}
  }, []);

  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      const res = await api.register(email, password, name);
      if (res.token) await secureStorage.setToken(res.token);
      if (res.refreshToken) await secureStorage.setRefreshToken(res.refreshToken);
      await storage.setUser(res.user);
      setState({
        user: res.user,
        profile: null,
        isLoading: false,
        isAuthenticated: true,
      });
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {}
    await secureStorage.clearTokens();
    await storage.clearUser();
    await storage.clearCart();
    setState({
      user: null,
      profile: null,
      isLoading: false,
      isAuthenticated: false,
    });
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await api.getProfile();
      setState((s) => ({ ...s, profile, user: profile }));
      await storage.setUser(profile);
    } catch {}
  }, []);

  const updateProfile = useCallback(
    async (data: Partial<{ name: string; phone: string }>) => {
      await api.updateProfile(data);
      await refreshProfile();
    },
    [refreshProfile]
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await api.changePassword(currentPassword, newPassword);
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        refreshProfile,
        updateProfile,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
