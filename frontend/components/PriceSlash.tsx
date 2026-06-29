"use client";

import { useState, useEffect, useCallback } from "react";
import { Scissors, Clock, Share2, Check, Copy, MessageCircle, ShoppingCart, X } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useToast } from "@/lib/hooks/useToast";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCountdown } from "@/lib/hooks/useCountdown";

interface PriceSlashData {
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
}

interface PriceSlashButtonProps {
  productId: string;
  productSlug: string;
  productName: string;
  originalPrice: number;
  activeSlash?: PriceSlashData | null;
  onSlashCreated?: (slash: PriceSlashData) => void;
}

export default function PriceSlashButton({
  productId,
  productSlug,
  productName,
  originalPrice,
  activeSlash,
  onSlashCreated,
}: PriceSlashButtonProps) {
  const [slashData, setSlashData] = useState<PriceSlashData | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [animatePrice, setAnimatePrice] = useState(false);
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const { formatPrice } = useCurrency();

  useEffect(() => {
    if (activeSlash) {
      setSlashData(activeSlash);
      setShowCard(true);
    } else if (activeSlash === null) {
      setSlashData(null);
      setShowCard(false);
    }
  }, [activeSlash]);

  const handleCreate = async () => {
    if (!isAuthenticated) {
      showToast("Please log in to start a price slash", "warning");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/social/price-slash", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      if (res.ok) {
        const data = await res.json();
        setSlashData(data.priceSlash);
        setShowCard(true);
        if (onSlashCreated) {
          onSlashCreated(data.priceSlash);
        }
        showToast("Price slash started! Share with friends to slash the price! ✂️", "success");
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.message || "Could not start price slash", "error");
      }
    } catch {
      showToast("Something went wrong", "error");
    } finally {
      setCreating(false);
    }
  };

  const shareUrl = slashData
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/slash/${slashData.slashCode}`
    : "";

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    showToast("Link copied!", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const text = `✂️ Help me slash the price on ${productName}! Click to cut the price: ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Slash the price: ${productName}`,
          text: `Help me slash the price on ${productName}!`,
          url: shareUrl,
        });
      } catch {
        // user cancelled
      }
    } else {
      handleCopyLink();
    }
  };

  // Animate price when slash data changes
  useEffect(() => {
    if (slashData) {
      setAnimatePrice(true);
      const t = setTimeout(() => setAnimatePrice(false), 600);
      return () => clearTimeout(t);
    }
  }, [slashData?.currentPrice]);

  if (!showCard) {
    return (
      <div className="mb-4">
        <button
          onClick={handleCreate}
          disabled={creating}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border-2 border-dashed border-orange-300 text-orange-600 font-semibold text-sm hover:bg-orange-50 hover:border-orange-400 transition-all disabled:opacity-50 group"
        >
          <Scissors className="w-4 h-4 transition-transform group-hover:-rotate-45" />
          {creating ? "Starting…" : "✂️ Slash the Price"}
        </button>
      </div>
    );
  }

  if (!slashData) return null;

  const progressPercent = (slashData.currentSlashes / slashData.maxSlashes) * 100;
  const slashesRemaining = slashData.slashesRemaining ?? slashData.maxSlashes - slashData.currentSlashes;

  return (
    <div className="mb-4 rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-yellow-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <Scissors className="w-5 h-5 text-orange-600" />
          <h3 className="font-bold text-gray-900 text-sm">Price Slash Active!</h3>
        </div>
        <button
          onClick={() => setShowCard(false)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 pb-4">
        {/* Price display */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-gray-400 line-through text-sm">{formatPrice(slashData.originalPrice)}</span>
          <span className="text-lg">→</span>
          <span
            className={`text-2xl font-bold text-orange-600 transition-all duration-500 ${
              animatePrice ? "scale-110" : "scale-100"
            }`}
          >
            {formatPrice(slashData.currentPrice)}
          </span>
        </div>

        {/* Slash progress */}
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-600">
              {slashData.currentSlashes} / {slashData.maxSlashes} slashes
            </span>
            <span className="text-orange-600 font-medium">{slashesRemaining} remaining</span>
          </div>
          <div className="h-2.5 bg-orange-100 rounded-full overflow-hidden relative">
            <div
              className="h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
            {/* Slash marks */}
            {Array.from({ length: slashData.currentSlashes }).map((_, i) => (
              <div
                key={i}
                className="absolute top-0 h-full w-0.5 bg-white/60"
                style={{ left: `${((i + 1) / slashData.maxSlashes) * 100}%` }}
              />
            ))}
          </div>
        </div>

        {/* Countdown */}
        <SlashCountdown expiresAt={slashData.expiresAt} />

        {/* Share buttons */}
        <p className="text-xs text-gray-500 mb-2 text-center">Share to slash more!</p>
        <div className="flex gap-2 mb-3">
          <button
            onClick={handleWhatsApp}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            WhatsApp
          </button>
          <button
            onClick={handleCopyLink}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Copy Link"}
          </button>
          <button
            onClick={handleShare}
            className="flex items-center justify-center p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Buy at slashed price */}
        {(slashData.currentSlashes >= slashData.maxSlashes || slashData.isExpired) && (
          <a
            href={`/product/${productSlug}`}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold text-sm hover:from-orange-600 hover:to-red-600 transition-all"
          >
            <ShoppingCart className="w-4 h-4" />
            Buy at Slashed Price
          </a>
        )}
      </div>
    </div>
  );
}

function SlashCountdown({ expiresAt }: { expiresAt: string }) {
  const { hours, minutes, seconds, expired } = useCountdown(expiresAt);

  if (expired) {
    return <div className="text-xs text-red-600 font-medium mb-3 text-center">⏰ Slash period ended</div>;
  }

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="flex items-center justify-center gap-1.5 mb-3">
      <Clock className="w-3.5 h-3.5 text-orange-500" />
      <span className="text-xs text-gray-500">
        {pad(hours)}h {pad(minutes)}m {pad(seconds)}s left to slash
      </span>
    </div>
  );
}
