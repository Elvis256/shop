"use client";

// Floating purchase notification toast
// Renders fixed position, auto-cycles through recent purchases
// Uses localStorage to respect "don't show" preference

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ShoppingBag, X } from "lucide-react";
import ProductImage from "@/components/ProductImage";

const API_URL = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");
const DISPLAY_INTERVAL = 15000;
const DISMISS_DELAY = 5000;
const LS_KEY = "live_feed_hidden";

interface FeedItem {
  productName: string;
  productSlug: string;
  productImage: string;
  city: string;
  timeAgo: string;
}

export default function LivePurchaseFeed() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(LS_KEY)) return;

    const controller = new AbortController();
    fetch(`${API_URL}/api/social/live-feed`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.feed?.length) setFeed(data.feed);
      })
      .catch(() => {});

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!feed.length) return;

    // Show first item after a short delay
    const initialTimer = setTimeout(() => {
      setCurrentIndex(0);
      setVisible(true);
    }, 3000);

    return () => clearTimeout(initialTimer);
  }, [feed]);

  // Cycle through items
  useEffect(() => {
    if (currentIndex < 0 || !feed.length) return;

    // Auto-dismiss current toast
    dismissTimerRef.current = setTimeout(() => {
      setVisible(false);
    }, DISMISS_DELAY);

    // Show next item after interval
    if (currentIndex < feed.length - 1) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          const next = prev + 1;
          if (next >= feed.length) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return prev;
          }
          setVisible(true);
          return next;
        });
      }, DISPLAY_INTERVAL);
    }

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [currentIndex, feed.length]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setDismissed(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const handleDontShow = useCallback(() => {
    localStorage.setItem(LS_KEY, "1");
    handleDismiss();
  }, [handleDismiss]);

  if (dismissed || currentIndex < 0 || !feed.length) return null;

  const item = feed[currentIndex];
  if (!item) return null;

  const content = (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0">
        {item.productImage ? (
          <ProductImage
            src={item.productImage}
            alt={item.productName}
            width={40}
            height={40}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-gray-400" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 leading-snug">
          Someone in <span className="font-semibold">{item.city}</span> just bought
        </p>
        <p className="text-sm font-medium text-gray-800 truncate">
          {item.productName}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{item.timeAgo}</p>
      </div>
    </div>
  );

  return (
    <div
      className={`fixed z-50 transition-all duration-500 ease-out
        bottom-4 left-4 sm:bottom-6 sm:left-6
        max-sm:top-4 max-sm:left-4 max-sm:right-4 max-sm:bottom-auto
        ${visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"}`}
    >
      <div className="max-w-sm w-full bg-white/90 backdrop-blur-lg border border-gray-200 rounded-xl shadow-lg p-3 relative group">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {item.productSlug ? (
          <Link href={`/product/${item.productSlug}`} className="block">
            {content}
          </Link>
        ) : (
          content
        )}

        <button
          onClick={handleDontShow}
          className="text-[10px] text-gray-400 hover:text-gray-600 mt-2 transition-colors"
        >
          Don&apos;t show again
        </button>
      </div>
    </div>
  );
}
