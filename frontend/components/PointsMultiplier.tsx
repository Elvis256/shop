"use client";

import { useState, useEffect, useMemo } from "react";
import { Zap } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface Multiplier {
  multiplier: number;
  label?: string;
  endsAt: string;
}

function useCountdown(targetDate: Date) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(targetDate));
  const targetMs = targetDate.getTime();

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getTimeLeft(new Date(targetMs)));
    }, 1000);
    return () => clearInterval(timer);
  }, [targetMs]);

  return timeLeft;
}

function getTimeLeft(target: Date) {
  const diff = Math.max(0, target.getTime() - Date.now());
  return {
    hours: Math.floor(diff / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
    expired: diff === 0,
  };
}

export default function PointsMultiplier() {
  const [multiplier, setMultiplier] = useState<Multiplier | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/loyalty/multiplier`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.endsAt && new Date(data.endsAt) > new Date()) {
          setMultiplier(data);
        }
      })
      .catch(() => {});
  }, []);

  if (!multiplier) return null;

  return <MultiplierBanner multiplier={multiplier} />;
}

function MultiplierBanner({ multiplier }: { multiplier: Multiplier }) {
  const endsAt = useMemo(() => new Date(multiplier.endsAt), [multiplier.endsAt]);
  const { hours, minutes, seconds, expired } = useCountdown(endsAt);

  if (expired) return null;

  const label = multiplier.label || `${multiplier.multiplier}x Points Weekend!`;
  const endStr = endsAt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white">
      {/* Animated background sparkles */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-1 left-[10%] w-2 h-2 bg-white rounded-full animate-pulse" />
        <div className="absolute top-3 left-[30%] w-1.5 h-1.5 bg-white rounded-full animate-pulse delay-300" />
        <div className="absolute bottom-2 left-[50%] w-2 h-2 bg-white rounded-full animate-pulse delay-700" />
        <div className="absolute top-2 right-[20%] w-1.5 h-1.5 bg-white rounded-full animate-pulse delay-500" />
        <div className="absolute bottom-1 right-[10%] w-2 h-2 bg-white rounded-full animate-pulse delay-100" />
      </div>

      <div className="relative container py-3 px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 animate-pulse" />
            <span className="font-bold text-sm sm:text-base">
              🎉 {label}
            </span>
          </div>
          <span className="text-xs sm:text-sm opacity-90">
            Earn {multiplier.multiplier}x loyalty points on all orders. Ends {endStr}
          </span>
          <div className="flex items-center gap-1.5 font-mono text-sm font-bold">
            <span className="bg-white/20 backdrop-blur-sm rounded px-1.5 py-0.5">
              {String(hours).padStart(2, "0")}
            </span>
            <span>:</span>
            <span className="bg-white/20 backdrop-blur-sm rounded px-1.5 py-0.5">
              {String(minutes).padStart(2, "0")}
            </span>
            <span>:</span>
            <span className="bg-white/20 backdrop-blur-sm rounded px-1.5 py-0.5">
              {String(seconds).padStart(2, "0")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
