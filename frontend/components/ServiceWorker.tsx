"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // On ChunkLoadError, clear all caches and reload once
    window.addEventListener("error", (e) => {
      if (
        e.message?.includes("ChunkLoadError") ||
        e.message?.includes("Failed to load chunk") ||
        e.message?.includes("Loading chunk") ||
        (e.target as HTMLElement)?.tagName === "SCRIPT"
      ) {
        const reloaded = sessionStorage.getItem("chunk_reload");
        if (!reloaded) {
          sessionStorage.setItem("chunk_reload", "1");
          // Unregister all service workers and clear caches, then reload
          navigator.serviceWorker.getRegistrations().then((regs) => {
            Promise.all([
              ...regs.map((r) => r.unregister()),
              caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))),
            ]).then(() => window.location.reload());
          });
        }
      }
    }, true);

    // Clear stale chunk_reload flag on clean load
    sessionStorage.removeItem("chunk_reload");

    // Register service worker (only in production via next-pwa)
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Force new SW to activate immediately
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          newWorker?.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      })
      .catch(() => {
        // SW not available (dev mode) — that's fine
      });
  }, []);

  return null;
}
