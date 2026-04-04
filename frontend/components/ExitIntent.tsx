"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Mail, Gift } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

export default function ExitIntent() {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleMouseLeave = useCallback((e: MouseEvent) => {
    // Only trigger when mouse moves upward (toward browser chrome)
    if (e.clientY > 10) return;

    // Don't show on mobile-sized screens
    if (window.innerWidth < 768) return;

    // Only show once per session
    if (sessionStorage.getItem("exit_intent_shown")) return;

    // Don't show if user already subscribed
    if (localStorage.getItem("newsletter_subscribed")) return;

    sessionStorage.setItem("exit_intent_shown", "1");
    setShow(true);
  }, []);

  useEffect(() => {
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => document.removeEventListener("mouseleave", handleMouseLeave);
  }, [handleMouseLeave]);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");

    try {
      const csrf = getCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (csrf) headers["x-csrf-token"] = csrf;

      const res = await fetch(`${API_URL}/api/newsletter/subscribe`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ email, source: "exit-intent" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Subscription failed");
      }

      localStorage.setItem("newsletter_subscribed", "1");
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => setShow(false);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ animation: "fadeIn 0.3s ease-out" }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        style={{ animation: "slideUp 0.3s ease-out" }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="bg-gradient-to-br from-accent/10 to-accent/5 px-8 pt-10 pb-6 text-center">
          <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Gift className="w-8 h-8 text-accent" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Wait! Don&apos;t leave empty-handed 🎁
          </h2>
          <p className="text-gray-600">
            Get <span className="font-semibold text-accent">10% off</span> your first order when you subscribe to our newsletter.
          </p>
        </div>

        {/* Body */}
        <div className="px-8 py-6">
          {success ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Mail className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">You&apos;re subscribed!</h3>
              <p className="text-sm text-gray-500">
                Check your email for your 10% discount code.
              </p>
              <button
                onClick={handleClose}
                className="mt-4 text-sm text-accent hover:underline"
              >
                Continue shopping
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="space-y-4">
              <div>
                <label htmlFor="exit-email" className="sr-only">Email address</label>
                <input
                  id="exit-email"
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                />
              </div>

              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-accent text-white py-3 px-4 rounded-xl font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Subscribing..." : "Get My 10% Discount"}
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 transition-colors"
              >
                No thanks, I&apos;ll pay full price
              </button>
            </form>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
