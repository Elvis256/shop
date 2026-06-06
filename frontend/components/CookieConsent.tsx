"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie_consent");
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => {
    localStorage.setItem("cookie_consent", "accepted");
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem("cookie_consent", "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[999] p-4 animate-slide-up">
      <div className="max-w-lg mx-auto bg-surface border border-border rounded-2xl shadow-xl p-5">
        <p className="text-sm text-text-muted leading-relaxed">
          We use cookies to improve your experience and remember your preferences.{" "}
          <Link href="/policies/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
        </p>
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={accept}
            className="flex-1 px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-hover transition-colors duration-200"
          >
            Accept
          </button>
          <button
            onClick={decline}
            className="flex-1 px-4 py-2.5 bg-surface-secondary text-text-muted text-sm font-medium rounded-xl hover:bg-border/50 transition-colors duration-200"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
