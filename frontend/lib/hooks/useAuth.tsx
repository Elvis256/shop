"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface SellerInfo {
  id: string;
  storeName?: string;
  storeSlug?: string;
  status: string;
  tier?: string;
  logo?: string;
  rating?: number;
  reviewCount?: number;
}

interface User {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  role: string;
  receiptMasked?: boolean;
  createdAt?: string;
  seller?: SellerInfo | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string, telegramUserId?: string) => Promise<{ user: User }>;
  register: (email: string, password: string, name?: string, telegramUserId?: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isSeller: boolean;
  isAuthenticated: boolean;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// In browser: use relative URLs (same-origin, avoids CORS with www vs non-www)
// On server (SSR): use absolute URL to reach backend directly
const API_URL = typeof window !== "undefined"
  ? ""
  : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");

// Helper to get CSRF token from cookie
function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const isBrowser = typeof window !== "undefined";
      const twaToken = isBrowser ? localStorage.getItem("twa_token") : null;
      const twaRefreshToken = isBrowser ? localStorage.getItem("twa_refresh_token") : null;
      const isTwa = isBrowser && (!!(window as any).Telegram?.WebApp || !!twaToken);

      const headers: Record<string, string> = {};
      if (twaToken) headers["Authorization"] = `Bearer ${twaToken}`;
      if (isTwa) headers["x-twa-context"] = "true";

      // First try with current token
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers,
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else if (res.status === 401) {
        // Access token expired — attempt refresh then retry
        try {
          const csrfToken = getCsrfToken();
          const refreshHeaders: Record<string, string> = {};
          if (csrfToken) refreshHeaders["x-csrf-token"] = csrfToken;
          if (twaToken) refreshHeaders["Authorization"] = `Bearer ${twaToken}`;
          if (twaRefreshToken) refreshHeaders["x-refresh-token"] = twaRefreshToken;
          if (isTwa) refreshHeaders["x-twa-context"] = "true";

          const refreshRes = await fetch(`${API_URL}/api/auth/refresh`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...refreshHeaders,
            },
            body: JSON.stringify({ refreshToken: twaRefreshToken }),
            credentials: "include",
          });
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            if (isBrowser) {
              if (refreshData.accessToken) {
                localStorage.setItem("twa_token", refreshData.accessToken);
              }
              if (refreshData.refreshToken) {
                localStorage.setItem("twa_refresh_token", refreshData.refreshToken);
              }
            }

            // Retry /me with new token
            const retryHeaders: Record<string, string> = {};
            const newTwaToken = isBrowser ? localStorage.getItem("twa_token") : null;
            if (newTwaToken) retryHeaders["Authorization"] = `Bearer ${newTwaToken}`;
            if (isTwa) retryHeaders["x-twa-context"] = "true";

            const retryRes = await fetch(`${API_URL}/api/auth/me`, {
              headers: retryHeaders,
              credentials: "include",
            });
            if (retryRes.ok) {
              const data = await retryRes.json();
              setUser(data);
            } else {
              setUser(null);
            }
          } else {
            setUser(null);
          }
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Failed to check auth:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string, telegramUserId?: string): Promise<{ user: User }> => {
    const csrfToken = getCsrfToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (csrfToken) headers["x-csrf-token"] = csrfToken;

    const isBrowser = typeof window !== "undefined";
    const twaToken = isBrowser ? localStorage.getItem("twa_token") : null;
    if (twaToken) headers["Authorization"] = `Bearer ${twaToken}`;
    const isTwa = isBrowser && (!!(window as any).Telegram?.WebApp || !!twaToken || !!telegramUserId);
    if (isTwa) headers["x-twa-context"] = "true";

    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email, password, telegramUserId }),
      credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Login failed");
    }

    if (isBrowser) {
      if (data.accessToken) {
        localStorage.setItem("twa_token", data.accessToken);
      }
      if (data.refreshToken) {
        localStorage.setItem("twa_refresh_token", data.refreshToken);
      }
    }

    setUser(data.user);
    return data;
  };

  const register = async (email: string, password: string, name?: string, telegramUserId?: string) => {
    const csrfToken = getCsrfToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (csrfToken) headers["x-csrf-token"] = csrfToken;

    const isBrowser = typeof window !== "undefined";
    const twaToken = isBrowser ? localStorage.getItem("twa_token") : null;
    if (twaToken) headers["Authorization"] = `Bearer ${twaToken}`;
    const isTwa = isBrowser && (!!(window as any).Telegram?.WebApp || !!twaToken || !!telegramUserId);
    if (isTwa) headers["x-twa-context"] = "true";
    
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email, password, name, telegramUserId }),
      credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Registration failed");
    }

    if (isBrowser) {
      if (data.accessToken) {
        localStorage.setItem("twa_token", data.accessToken);
      }
      if (data.refreshToken) {
        localStorage.setItem("twa_refresh_token", data.refreshToken);
      }
    }

    setUser(data.user);
  };

  const logout = async () => {
    try {
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = {};
      if (csrfToken) headers["x-csrf-token"] = csrfToken;
      
      const isBrowser = typeof window !== "undefined";
      const twaToken = isBrowser ? localStorage.getItem("twa_token") : null;
      if (twaToken) headers["Authorization"] = `Bearer ${twaToken}`;
      const isTwa = isBrowser && (!!(window as any).Telegram?.WebApp || !!twaToken);
      if (isTwa) headers["x-twa-context"] = "true";

      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        headers,
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    }
    setUser(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("twa_token");
      localStorage.removeItem("twa_refresh_token");
    }
    // Clear cart data on logout
    try {
      localStorage.removeItem("cart");
      localStorage.removeItem("cartId");
    } catch {}
  };

  const isAdmin = user?.role === "ADMIN" || user?.role === "MANAGER";
  const isSeller = !!(user?.seller && user.seller.status === "APPROVED");
  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, isAdmin, isSeller, isAuthenticated, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
