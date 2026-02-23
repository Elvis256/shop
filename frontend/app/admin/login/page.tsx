"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, ShieldCheck, Lock } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function getCsrfToken(): Promise<string> {
  // Try cookie first
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  if (match) return match[1];
  // Fetch fresh token
  const res = await fetch(`${API_URL}/api/csrf-token`, { credentials: "include" });
  const data = await res.json();
  return data.csrfToken;
}

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Field-level validation
  const emailValid = email === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordValid = password === "" || password.length >= 8;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch(`${API_URL}/api/admin/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ email, password, ...(requires2FA ? { totpCode } : {}) }),
      });

      const data = await res.json();

      if (res.status === 202 && data.requires2FA) {
        setRequires2FA(true);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      window.location.href = "/admin";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-secondary flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4 shadow-lg">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-text">Admin Portal</h1>
          <p className="text-text-muted text-sm mt-1">Sign in to manage your store</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-border p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6 text-sm flex items-start gap-2">
              <Lock className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {!requires2FA ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    className={`input ${!emailValid ? "border-red-400 focus:ring-red-300" : ""}`}
                    placeholder="admin@store.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    suppressHydrationWarning
                  />
                  {!emailValid && (
                    <p className="text-xs text-red-500 mt-1">Enter a valid email address</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      className={`input pr-10 ${!passwordValid ? "border-red-400 focus:ring-red-300" : ""}`}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      suppressHydrationWarning
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                      onClick={() => setShowPassword(!showPassword)}
                      suppressHydrationWarning
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {!passwordValid && (
                    <p className="text-xs text-red-500 mt-1">Password must be at least 8 characters</p>
                  )}
                </div>
              </>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 rounded-xl text-sm text-blue-700">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  Enter the 6-digit code from your authenticator app
                </div>
                <label className="block text-sm font-medium text-text mb-1.5">
                  Authenticator Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  className="input text-center text-xl tracking-[0.5em] font-mono"
                  placeholder="000000"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                  required
                />
                <button
                  type="button"
                  className="text-xs text-text-muted hover:text-text mt-2"
                  onClick={() => { setRequires2FA(false); setTotpCode(""); setError(""); }}
                >
                  ← Back
                </button>
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full flex items-center justify-center gap-2"
              disabled={loading || !emailValid || !passwordValid}
              suppressHydrationWarning
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
              ) : requires2FA ? (
                "Verify & Sign In"
              ) : (
                "Sign In to Admin"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-text-muted mt-6">
          Not an admin?{" "}
          <a href="/" className="text-primary hover:underline">Go to store</a>
        </p>
      </div>
    </div>
  );
}
