"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Clock, Share2, Check, ChevronRight, Copy, MessageCircle, Gift } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useToast } from "@/lib/hooks/useToast";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCountdown } from "@/lib/hooks/useCountdown";

interface Participant {
  user: { name: string };
}

interface GroupBuyData {
  id: string;
  productId: string;
  targetCount: number;
  currentCount: number;
  discountPercent: number;
  groupPrice: number;
  expiresAt: string;
  status: string;
  spotsLeft: number;
  progress: number;
  participants: Participant[];
}

interface GroupBuyBannerProps {
  productId: string;
  productName: string;
  regularPrice: number;
}

export default function GroupBuyBanner({ productId, productName, regularPrice }: GroupBuyBannerProps) {
  const [groupBuy, setGroupBuy] = useState<GroupBuyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [copied, setCopied] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const { formatPrice } = useCurrency();

  const fetchGroupBuy = useCallback(async () => {
    try {
      const res = await fetch(`/api/social/group-buy/product/${productId}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setGroupBuy(data.groupBuy ?? null);
      }
    } catch {
      // silently fail — no group buy available
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchGroupBuy();
  }, [fetchGroupBuy]);

  const handleJoin = async () => {
    if (!isAuthenticated) {
      showToast("Please log in to join a group buy", "warning");
      return;
    }
    if (!groupBuy) return;
    setJoining(true);
    try {
      const res = await fetch(`/api/social/group-buy/${groupBuy.id}/join`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        setJoined(true);
        showToast("You've joined the group buy! 🎉", "success");
        fetchGroupBuy();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.message || "Could not join group buy", "error");
      }
    } catch {
      showToast("Something went wrong", "error");
    } finally {
      setJoining(false);
    }
  };

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = `Join our group buy for ${productName} and save ${groupBuy?.discountPercent}%! ${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Group Buy: ${productName}`, text, url });
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showToast("Link copied!", "success");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWhatsApp = () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = `🔥 Join our group buy for ${productName} and save ${groupBuy?.discountPercent}%! ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  if (loading || !groupBuy) return null;

  const participantNames = groupBuy.participants.map((p) => p.user.name.split(" ")[0]);
  const displayNames =
    participantNames.length <= 2
      ? participantNames.join(" and ")
      : `${participantNames.slice(0, 2).join(", ")} and ${participantNames.length - 2} more`;

  return (
    <div className="mb-4 rounded-xl border-2 border-transparent bg-gradient-to-r from-purple-50 to-pink-50 p-[2px]">
      <div className="relative rounded-[10px] bg-white p-4 overflow-hidden">
        {/* Gradient top accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500" />

        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">👥</span>
          <h3 className="font-bold text-gray-900">Group Buy Deal!</h3>
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
            <Gift className="w-3 h-3" />
            Save {groupBuy.discountPercent}%
          </span>
        </div>

        {/* Price comparison */}
        <div className="flex items-baseline gap-3 mb-3">
          <span className="text-sm text-gray-400 line-through">{formatPrice(regularPrice)}</span>
          <span className="text-2xl font-bold text-purple-700">{formatPrice(groupBuy.groupPrice)}</span>
        </div>

        {/* Progress */}
        <div className="mb-3">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">
              <strong>{groupBuy.currentCount}</strong> / {groupBuy.targetCount} joined
            </span>
            <span className="font-medium text-purple-600">{groupBuy.spotsLeft} spots left</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${Math.min(groupBuy.progress, 100)}%` }}
            />
          </div>
        </div>

        {/* Countdown */}
        <CountdownDisplay expiresAt={groupBuy.expiresAt} />

        {/* Participants */}
        {groupBuy.participants.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex -space-x-2">
              {groupBuy.participants.slice(0, 4).map((p, i) => (
                <div
                  key={i}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-white"
                  style={{
                    backgroundColor: ["#8B5CF6", "#EC4899", "#6366F1", "#F59E0B"][i % 4],
                  }}
                >
                  {p.user.name.charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
            <span className="text-xs text-gray-500">{displayNames}</span>
          </div>
        )}

        {/* Join / Joined button */}
        {joined ? (
          <div className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-green-50 text-green-700 font-semibold text-sm mb-2">
            <Check className="w-4 h-4" />
            You&apos;ve joined!
          </div>
        ) : (
          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold text-sm hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 mb-2"
          >
            {joining ? "Joining…" : "Join Group Buy"}
          </button>
        )}

        {/* Share buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleWhatsApp}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            WhatsApp
          </button>
          <button
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-gray-50 text-gray-700 text-xs font-medium hover:bg-gray-100 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Share"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CountdownDisplay({ expiresAt }: { expiresAt: string }) {
  const { hours, minutes, seconds, expired } = useCountdown(expiresAt);

  if (expired) {
    return (
      <div className="text-sm text-red-600 font-medium mb-3">⏰ This group buy has expired</div>
    );
  }

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="flex items-center gap-2 mb-3">
      <Clock className="w-4 h-4 text-purple-500" />
      <div className="flex items-center gap-1">
        {[
          { val: pad(hours), label: "h" },
          { val: pad(minutes), label: "m" },
          { val: pad(seconds), label: "s" },
        ].map((t, i) => (
          <span key={i} className="inline-flex items-center">
            <span className="bg-purple-100 text-purple-800 font-mono font-bold text-sm px-1.5 py-0.5 rounded">
              {t.val}
            </span>
            <span className="text-xs text-gray-400 ml-0.5 mr-1">{t.label}</span>
          </span>
        ))}
      </div>
      <span className="text-xs text-gray-500">remaining</span>
    </div>
  );
}
