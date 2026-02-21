"use client";

import { useState } from "react";
import Link from "next/link";
import Section from "@/components/Section";
import { api } from "@/lib/api";
import { Mail, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <Section>
        <div className="max-w-md mx-auto text-center">
          <div className="card py-12">
            <Mail className="w-16 h-16 mx-auto mb-6 text-accent" />
            <h2 className="mb-4">Check Your Email</h2>
            <p className="text-text-muted mb-8">
              If an account exists for <strong>{email}</strong>, we've sent a password reset link.
            </p>
            <Link href="/auth/login" className="btn-secondary">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Login
            </Link>
          </div>
        </div>
      </Section>
    );
  }

  return (
    <Section>
      <div className="max-w-md mx-auto">
        <h1 className="text-center mb-8">Forgot Password</h1>

        <div className="card">
          <p className="text-text-muted mb-6">
            Enter your email address and we'll send you a link to reset your password.
          </p>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-8 mb-6 text-small">
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

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/auth/login" className="text-small link">
              <ArrowLeft className="w-4 h-4 inline mr-1" />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </Section>
  );
}
