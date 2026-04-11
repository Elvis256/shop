"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Register the service worker for PWA support
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.warn("SW registration failed:", err));
  }, []);

  return null;
}
