"use client";

import { useState, useEffect } from "react";
import { Bell, CheckCircle, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface NotifyMeProps {
  productId: string;
}

export default function NotifyMe({ productId }: NotifyMeProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState("");

  // Pre-fill email if user is logged in
  useEffect(() => {
    apiFetch("/api/auth/me")
      .then((data: any) => {
        if (data?.email) setEmail(data.email);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      await apiFetch("/api/notify/back-in-stock", {
        method: "POST",
        body: JSON.stringify({ productId, email: email.trim() }),
      });
      setSubscribed(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (subscribed) {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
        <CheckCircle className="w-4 h-4 shrink-0" />
        <span>We&apos;ll notify you at <strong>{email}</strong> when this item is back in stock.</span>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
      <div className="flex items-center gap-2 mb-2">
        <Bell className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-gray-900">Get notified when back in stock</span>
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          required
          placeholder="Your email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
          Notify Me
        </button>
      </form>
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
    </div>
  );
}
