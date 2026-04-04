"use client";

import { useState, useEffect } from "react";
import { Scissors, Check, Share2, MessageCircle, Copy, ShoppingCart } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCountdown } from "@/lib/hooks/useCountdown";
import { useToast } from "@/lib/hooks/useToast";
import { useParams } from "next/navigation";
import Link from "next/link";
import ProductImage from "@/components/ProductImage";

interface SlashData {
  id: string;
  slashCode: string;
  originalPrice: number;
  currentPrice: number;
  minPrice: number;
  slashAmount: number;
  maxSlashes: number;
  currentSlashes: number;
  expiresAt: string;
  savings?: number;
  savingsPercent?: number;
  slashesRemaining?: number;
  isExpired?: boolean;
  product?: {
    name: string;
    slug: string;
    imageUrl: string | null;
  };
}

export default function SlashPage() {
  const params = useParams();
  const code = params.code as string;
  const [slash, setSlash] = useState<SlashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [slashing, setSlashing] = useState(false);
  const [slashed, setSlashed] = useState(false);
  const [alreadySlashed, setAlreadySlashed] = useState(false);
  const [amountSlashed, setAmountSlashed] = useState(0);
  const [copied, setCopied] = useState(false);
  const { formatPrice } = useCurrency();
  const { showToast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/social/price-slash/${code}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setSlash(data.priceSlash);
        }
      } catch {
        // failed
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  const handleSlash = async () => {
    setSlashing(true);
    try {
      const res = await fetch(`/api/social/price-slash/${code}/slash`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.slashApplied) {
          setSlashed(true);
          setAmountSlashed(data.amountSlashed || 0);
          setSlash(data.priceSlash);
          showToast(data.message || "You slashed the price! ✂️", "success");
        } else {
          setAlreadySlashed(true);
          showToast("You already helped slash this price!", "info");
        }
      } else {
        const data = await res.json().catch(() => ({}));
        if (data.message?.includes("already")) {
          setAlreadySlashed(true);
        }
        showToast(data.message || "Could not slash the price", "error");
      }
    } catch {
      showToast("Something went wrong", "error");
    } finally {
      setSlashing(false);
    }
  };

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    showToast("Link copied!", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const name = slash?.product?.name || "this product";
    const text = `✂️ Help slash the price on ${name}! Click to cut the price: ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-orange-300 border-t-orange-600 rounded-full" />
      </div>
    );
  }

  if (!slash) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="text-6xl mb-4">✂️</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Slash not found</h1>
        <p className="text-gray-500 mb-4">This price slash may have expired or doesn&apos;t exist.</p>
        <Link href="/" className="text-orange-600 font-medium hover:underline">
          Browse products →
        </Link>
      </div>
    );
  }

  const progressPercent = (slash.currentSlashes / slash.maxSlashes) * 100;
  const slashesRemaining = slash.slashesRemaining ?? slash.maxSlashes - slash.currentSlashes;

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Product */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
          {slash.product?.imageUrl && (
            <div className="relative aspect-video bg-gray-50">
              <ProductImage
                src={slash.product.imageUrl}
                alt={slash.product?.name || "Product"}
                fill
                className="object-contain"
              />
            </div>
          )}
          <div className="p-6">
            <h1 className="text-xl font-bold text-gray-900 mb-4">
              {slash.product?.name || "Product"}
            </h1>

            {/* Price display */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1">Original</p>
                <p className="text-xl text-gray-400 line-through">{formatPrice(slash.originalPrice)}</p>
              </div>
              <Scissors className="w-6 h-6 text-orange-500" />
              <div className="text-center">
                <p className="text-xs text-orange-600 mb-1 font-medium">Slashed!</p>
                <p className="text-3xl font-bold text-orange-600">{formatPrice(slash.currentPrice)}</p>
              </div>
            </div>

            {/* Savings badge */}
            {slash.savings && slash.savings > 0 && (
              <div className="text-center mb-4">
                <span className="inline-flex items-center gap-1 text-sm font-medium text-green-700 bg-green-100 px-3 py-1 rounded-full">
                  Save {formatPrice(slash.savings)} ({slash.savingsPercent}% off)
                </span>
              </div>
            )}

            {/* Slash progress */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">
                  {slash.currentSlashes} / {slash.maxSlashes} slashes
                </span>
                <span className="text-orange-600 font-medium">{slashesRemaining} remaining</span>
              </div>
              <div className="h-3 bg-orange-100 rounded-full overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(progressPercent, 100)}%` }}
                />
              </div>
            </div>

            {/* Countdown */}
            <SlashPageCountdown expiresAt={slash.expiresAt} />

            {/* Action button */}
            {slashed ? (
              <div className="space-y-3">
                <div className="w-full flex flex-col items-center justify-center gap-2 py-4 rounded-xl bg-green-50 border border-green-200">
                  <Check className="w-8 h-8 text-green-600" />
                  <p className="text-green-700 font-semibold">You slashed the price!</p>
                  {amountSlashed > 0 && (
                    <p className="text-green-600 text-sm">You cut {formatPrice(amountSlashed)} off!</p>
                  )}
                </div>
                {/* Share more */}
                <p className="text-center text-sm text-gray-500">Share with more friends to slash further!</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleWhatsApp}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp
                  </button>
                  <button
                    onClick={handleCopyLink}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copied!" : "Copy Link"}
                  </button>
                </div>
              </div>
            ) : alreadySlashed ? (
              <div className="w-full flex flex-col items-center justify-center gap-2 py-4 rounded-xl bg-blue-50 border border-blue-200">
                <Scissors className="w-8 h-8 text-blue-600" />
                <p className="text-blue-700 font-semibold">You already helped slash this price!</p>
              </div>
            ) : (
              <button
                onClick={handleSlash}
                disabled={slashing || slash.isExpired}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold text-lg hover:from-orange-600 hover:to-red-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Scissors className="w-5 h-5" />
                {slashing ? "Slashing…" : "✂️ Help Slash the Price!"}
              </button>
            )}

            {/* View product link */}
            {slash.product?.slug && (
              <Link
                href={`/product/${slash.product.slug}`}
                className="block text-center mt-4 text-orange-600 font-medium text-sm hover:underline"
              >
                View Product →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SlashPageCountdown({ expiresAt }: { expiresAt: string }) {
  const { hours, minutes, seconds, expired } = useCountdown(expiresAt);

  if (expired) {
    return <div className="text-center text-sm text-red-600 font-medium mb-4">⏰ Slash period has ended</div>;
  }

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="flex items-center justify-center gap-2 mb-4 text-sm text-gray-600">
      <span>⏰</span>
      <span>
        {pad(hours)}h {pad(minutes)}m {pad(seconds)}s remaining
      </span>
    </div>
  );
}
