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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Login and get user data
      const response = await api.login(email, password);
      const userRole = (response.user?.role || "") as string;
      
      // Determine redirect based on role and URL param
      const explicitRedirect = searchParams.get("redirect");
      let redirectTo = "/account";
      
      if (explicitRedirect) {
        // If explicit redirect was requested (e.g., from admin), use that
        redirectTo = explicitRedirect;
      } else if (userRole === "ADMIN" || userRole === "STAFF" || userRole === "MANAGER") {
        // Admin/Staff users go to admin dashboard by default
        redirectTo = "/admin";
      }
      
      // Also call the useAuth login to update context state
      await login(email, password).catch(() => {
        // Already logged in via api.login, just ignore duplicate login error
      });
      
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
            <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-small font-medium mb-2">Email</label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-small font-medium mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-small">
                <input type="checkbox" />
                Remember me
              </label>
              <Link href="/auth/forgot-password" className="text-small link">
                Forgot password?
              </Link>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-small text-text-muted">
              Don't have an account?{" "}
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
