"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Section from "@/components/Section";
import { useAuth } from "@/lib/hooks/useAuth";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordValid = password.length >= 8;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setTouched({ email: true, password: true });
    if (!emailValid || !passwordValid) return;
    setLoading(true);

    try {
      const response = await api.login(email, password);
      const userRole = (response.user?.role || "") as string;
      
      const explicitRedirect = searchParams.get("redirect");
      let redirectTo = "/account";
      
      if (explicitRedirect) {
        redirectTo = explicitRedirect;
      } else if (userRole === "ADMIN" || userRole === "STAFF" || userRole === "MANAGER") {
        redirectTo = "/admin";
      }
      
      await login(email, password).catch(() => {});
      router.push(redirectTo);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Login failed";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Section>
      <div className="max-w-md mx-auto">
        <h1 className="text-center mb-8">Sign In</h1>

        <div className="card">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-small font-medium mb-2">Email</label>
              <input
                type="email"
                className={`input ${touched.email && !emailValid ? "border-red-400" : ""}`}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                required
              />
              {touched.email && !emailValid && (
                <p className="text-xs text-red-500 mt-1">Enter a valid email address</p>
              )}
            </div>

            <div>
              <label className="block text-small font-medium mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className={`input pr-10 ${touched.password && !passwordValid ? "border-red-400" : ""}`}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {touched.password && !passwordValid && (
                <p className="text-xs text-red-500 mt-1">Password must be at least 8 characters</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-small cursor-pointer">
                <input type="checkbox" className="rounded" />
                Remember me
              </label>
              <Link href="/auth/forgot-password" className="text-small link">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              className="btn-primary w-full flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
              ) : "Sign In"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-small text-text-muted">
              Don&apos;t have an account?{" "}
              <Link href="/auth/register" className="link">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <Section>
        <div className="max-w-md mx-auto text-center py-16">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        </div>
      </Section>
    }>
      <LoginForm />
    </Suspense>
  );
}
