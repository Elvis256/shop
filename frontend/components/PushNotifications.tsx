"use client";

import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";

const API_URL = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");
const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_KEY || "";
const SUBSCRIBED_KEY = "pushSubscribed";
const DISMISSED_KEY = "pushDismissedAt";
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const DELAY_MS = 60_000;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushNotifications() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (Notification.permission === "granted") return;
    if (Notification.permission === "denied") return;
    if (localStorage.getItem(SUBSCRIBED_KEY)) return;

    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed && Date.now() - Number(dismissed) < SEVEN_DAYS) return;

    const timer = setTimeout(() => setShow(true), DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const handleEnable = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setShow(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      if (VAPID_KEY) {
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_KEY).buffer as ArrayBuffer,
        });

        fetch(`${API_URL}/api/push/subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(subscription),
        }).catch(() => {});
      }

      localStorage.setItem(SUBSCRIBED_KEY, "true");
    } catch {
      // Permission denied or subscription failed
    }
    setShow(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-4 right-4 z-40 max-w-md mx-auto animate-slide-in">
      <div className="bg-surface border border-border rounded-2xl shadow-lg p-4 flex items-center gap-3">
        <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500 shrink-0">
          <Bell className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text">
            🔔 Get notified about deals and order updates?
          </p>
        </div>
        <button
          onClick={handleEnable}
          className="px-4 py-2 bg-pink-500 text-white text-sm font-medium rounded-full hover:bg-pink-600 transition-colors shrink-0"
        >
          Enable
        </button>
        <button
          onClick={handleDismiss}
          className="p-1.5 text-text-muted hover:text-text transition-colors shrink-0"
          aria-label="Not now"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
