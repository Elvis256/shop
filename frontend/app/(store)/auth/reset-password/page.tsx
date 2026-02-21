"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Section from "@/components/Section";
import { api } from "@/lib/api";
import { CheckCircle, Eye, EyeOff } from "lucide-react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Invalid reset link");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      await api.resetPassword(token, password);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Section>
        <div className="max-w-md mx-auto text-center">
          <div className="card py-12">
            <CheckCircle className="w-16 h-16 mx-auto mb-6 text-green-500" />
            <h2 className="mb-4">Password Reset!</h2>
            <p className="text-text-muted mb-8">
              Your password has been successfully reset. You can now sign in with your new password.
            </p>
            <Link href="/auth/login" className="btn-primary">
              Sign In
            </Link>
          </div>
        </div>
      </Section>
    );
  }

  if (!token) {
    return (
      <Section>
        <div className="max-w-md mx-auto text-center">
          <div className="card py-12">
            <h2 className="mb-4">Invalid Link</h2>
            <p className="text-text-muted mb-8">
              This password reset link is invalid or has expired.
            </p>
            <Link href="/auth/forgot-password" className="btn-primary">
              Request New Link
            </Link>
          </div>
        </div>
      </Section>
    );
  }

  return (
    <Section>
      <div className="max-w-md mx-auto">
        <h1 className="text-center mb-8">Reset Password</h1>

        <div className="card">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-8 mb-6 text-small">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-small font-medium mb-2">New Password</label>
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

            <div>
              <label className="block text-small font-medium mb-2">Confirm Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        </div>
      </div>
    </Section>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <Section>
        <div className="max-w-md mx-auto text-center">
          <div className="card py-12">
            <div className="animate-pulse">Loading...</div>
          </div>
        </div>
      </Section>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
