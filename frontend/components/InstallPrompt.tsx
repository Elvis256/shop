"use client";

import { useState, useEffect } from "react";
import { X, Download } from "lucide-react";

const DISMISS_KEY = "installPromptDismissedAt";
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() - Number(dismissed) < SEVEN_DAYS) return;

    // Only show on mobile/tablet
    const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    if (!isMobile) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShow(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-4 right-4 z-40 max-w-md mx-auto animate-slide-in">
      <div className="bg-surface border border-border rounded-2xl shadow-lg p-4 flex items-center gap-3">
        <div className="p-2 bg-pink-500/10 rounded-xl text-pink-500 shrink-0">
          <Download className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text">📱 Install UGSex App for faster shopping</p>
        </div>
        <button
          onClick={handleInstall}
          className="px-4 py-2 bg-pink-500 text-white text-sm font-medium rounded-full hover:bg-pink-600 transition-colors shrink-0"
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          className="p-1.5 text-text-muted hover:text-text transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
