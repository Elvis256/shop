"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Register the service worker and force update on new builds
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // Check for updates immediately
        reg.update().catch(() => {});

        // When a new SW is installed, reload the page to use fresh assets
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "activated" && navigator.serviceWorker.controller) {
              // New SW activated while we had an old one — reload for fresh content
              window.location.reload();
            }
          });
        });
      })
      .catch((err) => console.warn("SW registration failed:", err));

    // Listen for controller change (new SW took over)
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });
  }, []);

  return null;
}
