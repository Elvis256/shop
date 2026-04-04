"use client";

// Share for discount component — product page integration
// Lets users share a product link and unlock a coupon after 3 friend clicks

import { useState, useEffect, useCallback } from "react";
import { Gift, Copy, Check, ExternalLink } from "lucide-react";
import { useToast } from "@/lib/hooks/useToast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const SITE_URL = "https://ugsex.com";
const CLICKS_NEEDED = 3;

function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

interface ShareForDiscountProps {
  productId: string;
  productSlug: string;
  productName: string;
}

interface ShareData {
  id: string;
  shareCode: string;
  clicks: number;
  couponCode: string | null;
  discount: number;
}

export default function ShareForDiscount({
  productId,
  productSlug,
  productName,
}: ShareForDiscountProps) {
  const { showToast } = useToast();
  const [share, setShare] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [couponUnlocked, setCouponUnlocked] = useState(false);

  // Check if user already has a share for this product
  useEffect(() => {
    fetch(`${API_URL}/api/social/share/my-shares?productId=${productId}`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.shares?.length) {
          const existing = data.shares[0];
          setShare(existing);
          if (existing.couponCode && existing.clicks >= CLICKS_NEEDED) {
            setCouponUnlocked(true);
          }
        }
      })
      .catch(() => {});
  }, [productId]);

  const handleShare = useCallback(
    async (platform: string) => {
      setLoading(true);
      try {
        let currentShare = share;

        // Create share if we don't have one
        if (!currentShare) {
          const csrf = getCsrfToken();
          const res = await fetch(`${API_URL}/api/social/share`, {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              ...(csrf ? { "x-csrf-token": csrf } : {}),
            },
            body: JSON.stringify({ productId, platform }),
          });
          if (!res.ok) throw new Error("Failed to create share");
          const data = await res.json();
          currentShare = data.share;
          setShare(data.share);
        }

        if (!currentShare) return;

        const shareUrl = `${SITE_URL}/product/${productSlug}?ref=${currentShare.shareCode}`;
        const text = `Check out ${productName}!`;

        switch (platform) {
          case "whatsapp":
            window.open(
              `https://wa.me/?text=${encodeURIComponent(text + " " + shareUrl)}`,
              "_blank"
            );
            break;
          case "facebook":
            window.open(
              `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
              "_blank"
            );
            break;
          case "twitter":
            window.open(
              `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`,
              "_blank"
            );
            break;
          case "copy":
            await navigator.clipboard.writeText(shareUrl);
            setLinkCopied(true);
            showToast("Link copied!", "success");
            setTimeout(() => setLinkCopied(false), 2000);
            break;
        }
      } catch {
        showToast("Failed to share. Try again.", "error");
      } finally {
        setLoading(false);
      }
    },
    [share, productId, productSlug, productName, showToast]
  );

  const handleCopyCoupon = useCallback(async () => {
    if (!share?.couponCode) return;
    await navigator.clipboard.writeText(share.couponCode);
    setCodeCopied(true);
    showToast("Coupon code copied!", "success");
    setTimeout(() => setCodeCopied(false), 2000);
  }, [share, showToast]);

  // Poll for click updates if we have a share but no coupon yet
  useEffect(() => {
    if (!share || couponUnlocked) return;

    const interval = setInterval(() => {
      fetch(`${API_URL}/api/social/share/${share.id}/clicks`, {
        credentials: "include",
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return;
          if (data.couponUnlocked && data.share) {
            setShare(data.share);
            setCouponUnlocked(true);
            showToast("🎉 Coupon unlocked! Use it at checkout.", "success");
          } else if (data.share) {
            setShare(data.share);
          }
        })
        .catch(() => {});
    }, 30000);

    return () => clearInterval(interval);
  }, [share, couponUnlocked, showToast]);

  const clicks = share?.clicks ?? 0;
  const progress = Math.min((clicks / CLICKS_NEEDED) * 100, 100);

  return (
    <div className="border-2 border-dashed border-purple-200 rounded-xl p-4 bg-purple-50/50">
      <div className="flex items-center gap-2 mb-3">
        <Gift className="w-5 h-5 text-purple-600" />
        <h3 className="font-semibold text-gray-900">🎁 Share &amp; Save 10%</h3>
      </div>

      {couponUnlocked && share?.couponCode ? (
        /* Coupon unlocked state */
        <div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
            <p className="text-sm text-green-700 font-medium mb-2">
              🎉 Coupon unlocked!
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white border border-green-300 rounded-md px-3 py-2 text-center font-mono font-bold text-green-800 text-lg tracking-wider">
                {share.couponCode}
              </code>
              <button
                onClick={handleCopyCoupon}
                className="p-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors shrink-0"
                aria-label="Copy coupon"
              >
                {codeCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500">Apply this code at checkout for 10% off.</p>
        </div>
      ) : (
        /* Share state */
        <div>
          <p className="text-sm text-gray-600 mb-3">
            Share this product with friends. When {CLICKS_NEEDED} friends click your link, you unlock a 10% discount!
          </p>

          {/* Progress bar */}
          {share && (
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{clicks} of {CLICKS_NEEDED} clicks</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Share buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleShare("whatsapp")}
              disabled={loading}
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-60"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.352 0-4.55-.737-6.354-2.003l-.448-.313-2.838.952.952-2.838-.313-.448A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
              </svg>
              WhatsApp
            </button>
            <button
              onClick={() => handleShare("facebook")}
              disabled={loading}
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Facebook
            </button>
            <button
              onClick={() => handleShare("twitter")}
              disabled={loading}
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-60"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Twitter
            </button>
            <button
              onClick={() => handleShare("copy")}
              disabled={loading}
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gray-600 text-white text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-60"
            >
              {linkCopied ? (
                <Check className="w-4 h-4" />
              ) : (
                <ExternalLink className="w-4 h-4" />
              )}
              {linkCopied ? "Copied!" : "Copy Link"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
