"use client";

import { useState } from "react";
import { Mail, CheckCircle, Loader2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface NewsletterSignupProps {
  source?: string;
  variant?: "default" | "compact" | "hero";
  className?: string;
}

export default function NewsletterSignup({
  source = "website",
  variant = "default",
  className = "",
}: NewsletterSignupProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus("error");
      setMessage("Please enter a valid email address");
      return;
    }

    setStatus("loading");

    try {
      const res = await fetch(`${API_URL}/api/newsletter/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setMessage(data.message || "Successfully subscribed!");
        setEmail("");
      } else {
        setStatus("error");
        setMessage(data.error || "Failed to subscribe");
      }
    } catch (error) {
      setStatus("error");
      setMessage("Connection error. Please try again.");
    }
  };

  if (status === "success") {
    return (
      <div className={`flex items-center gap-3 text-green-600 ${className}`}>
        <CheckCircle className="w-6 h-6" />
        <span className="font-medium">{message}</span>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <form onSubmit={handleSubmit} className={`flex gap-2 ${className}`}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent text-sm"
          disabled={status === "loading"}
          suppressHydrationWarning
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="btn-primary text-sm px-4"
          suppressHydrationWarning
        >
          {status === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Subscribe"}
        </button>
      </form>
    );
  }

  if (variant === "hero") {
    return (
      <div className={`bg-accent text-white rounded-2xl p-8 md:p-12 ${className}`}>
        <div className="max-w-2xl mx-auto text-center">
          <Mail className="w-12 h-12 mx-auto mb-4 opacity-80" />
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Get 10% Off Your First Order
          </h2>
          <p className="text-white/80 mb-6">
            Subscribe to our newsletter for exclusive deals, new arrivals, and wellness tips.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              className="flex-1 px-4 py-3 rounded-lg text-gray-900 focus:ring-2 focus:ring-white"
              disabled={status === "loading"}
              suppressHydrationWarning
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="px-6 py-3 bg-white text-accent font-semibold rounded-lg hover:bg-gray-100 transition-colors"
              suppressHydrationWarning
            >
              {status === "loading" ? "Subscribing..." : "Subscribe"}
            </button>
          </form>
          {status === "error" && (
            <p className="mt-3 text-red-200">{message}</p>
          )}
          <p className="text-xs text-white/60 mt-4">
            We respect your privacy. Unsubscribe anytime.
          </p>
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div className={className}>
      <h3 className="font-semibold mb-2">Subscribe to Our Newsletter</h3>
      <p className="text-sm text-gray-600 mb-4">
        Get exclusive offers, new arrivals, and tips delivered to your inbox.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
            disabled={status === "loading"}
            suppressHydrationWarning
          />
        </div>
        <button
          type="submit"
          disabled={status === "loading"}
          className="btn-primary w-full"
          suppressHydrationWarning
        >
          {status === "loading" ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Subscribing...
            </span>
          ) : (
            "Subscribe & Get 10% Off"
          )}
        </button>
        {status === "error" && (
          <p className="text-red-600 text-sm">{message}</p>
        )}
      </form>
    </div>
  );
}
