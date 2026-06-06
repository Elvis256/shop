"use client";

import { useState, useEffect } from "react";
import { Bell, CheckCircle, Loader2, Users } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface NotifyMeProps {
  productId: string;
  waitingCount?: number;
}

export default function NotifyMe({ productId, waitingCount }: NotifyMeProps) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notifyVia, setNotifyVia] = useState<"email" | "whatsapp" | "both">("email");
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState("");
  const [subscriberCount, setSubscriberCount] = useState(waitingCount || 0);

  // Pre-fill email/phone if user is logged in
  useEffect(() => {
    apiFetch("/api/auth/me")
      .then((data: any) => {
        if (data?.email) setEmail(data.email);
        if (data?.phone) setPhone(data.phone);
      })
      .catch(() => {});
  }, []);

  // Fetch waiting count
  useEffect(() => {
    if (!waitingCount) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/notify/back-in-stock/count?productId=${productId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.count) setSubscriberCount(data.count);
        })
        .catch(() => {});
    }
  }, [productId, waitingCount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() && !phone.trim()) return;
    setLoading(true);
    setError("");
    try {
      await apiFetch("/api/notify/back-in-stock", {
        method: "POST",
        body: JSON.stringify({
          productId,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          notifyVia,
        }),
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
        <span>
          We&apos;ll notify you via {notifyVia === "both" ? "email & WhatsApp" : notifyVia} when this item is back in stock.
        </span>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-gray-900">Get notified when back in stock</span>
        </div>
        {subscriberCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Users className="w-3 h-3" />
            {subscriberCount} waiting
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Notify via preference */}
        <div className="flex gap-2">
          {(["email", "whatsapp", "both"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setNotifyVia(opt)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                notifyVia === opt
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-gray-600 border-gray-200 hover:border-primary"
              }`}
            >
              {opt === "email" ? "Email" : opt === "whatsapp" ? "WhatsApp" : "Both"}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {(notifyVia === "email" || notifyVia === "both") && (
            <input
              type="email"
              required={notifyVia === "email"}
              placeholder="Your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          )}
          {(notifyVia === "whatsapp" || notifyVia === "both") && (
            <input
              type="tel"
              required={notifyVia === "whatsapp"}
              placeholder="WhatsApp number (e.g. 256700123456)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
          Notify Me
        </button>
      </form>
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
    </div>
  );
}
