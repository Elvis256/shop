"use client";

import { useState, useEffect } from "react";
import { X, Smartphone, Download } from "lucide-react";

export default function AppDownloadBanner() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const wasDismissed = sessionStorage.getItem("app-banner-dismissed");
    if (wasDismissed) {
      setDismissed(true);
      return;
    }
    // Show after 2 seconds
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const showApk = process.env.NEXT_PUBLIC_SHOW_APK === "true";
if (dismissed || !visible || !showApk) return null;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("app-banner-dismissed", "1");
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-6 md:max-w-sm animate-slide-up">
      <div className="bg-primary text-white rounded-2xl shadow-2xl p-4 flex items-center gap-4 relative">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/20 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
          <Smartphone className="w-6 h-6" />
        </div>

        <div className="flex-1 min-w-0 pr-4">
          <p className="font-bold text-sm">Get Our App</p>
          <p className="text-xs opacity-90 mt-0.5">Shop privately on Android. Fast, discreet & secure.</p>
        </div>

        <a
          href="/shop-app.apk"
          download="PleasureZone.apk"
          onClick={handleDismiss}
          className="flex-shrink-0 bg-white text-primary font-bold text-xs px-4 py-2.5 rounded-xl hover:bg-white/90 transition-colors flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          Install
        </a>
      </div>
    </div>
  );
}
