"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCurrency } from "@/contexts/CurrencyContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface DailyDealData {
  id: string;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    imageUrl: string | null;
    images?: { url: string }[];
  };
  dealPrice: number;
  endsAt?: string;
}

function useCountdown(targetDate: Date) {
  const [time, setTime] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const diff = Math.max(0, targetDate.getTime() - now.getTime());
      setTime({
        hours: Math.floor(diff / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return time;
}

function getMidnight(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export default function DailyDeal() {
  const [deal, setDeal] = useState<DailyDealData | null>(null);
  const { formatPrice } = useCurrency();
  const midnight = getMidnight();
  const countdown = useCountdown(deal?.endsAt ? new Date(deal.endsAt) : midnight);

  useEffect(() => {
    fetch(`${API_URL}/api/daily-deal`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.product) setDeal(data);
      })
      .catch(() => {});
  }, []);

  if (!deal) return null;

  const originalPrice = Number(deal.product.price);
  const dealPrice = Number(deal.dealPrice);
  const savingsPercent = Math.round((1 - dealPrice / originalPrice) * 100);
  const imageUrl =
    deal.product.imageUrl ||
    deal.product.images?.[0]?.url ||
    null;

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <section className="py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 to-orange-500 text-white">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.2),transparent_70%)]" />
          </div>

          <div className="relative grid md:grid-cols-2 gap-6 p-6 sm:p-8 lg:p-10 items-center">
            {/* Left: info */}
            <div>
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium mb-4">
                🔥 Deal of the Day
              </div>

              <h2 className="text-2xl sm:text-3xl font-bold mb-3 leading-tight">
                {deal.product.name}
              </h2>

              {/* Price */}
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-3xl sm:text-4xl font-extrabold">
                  {formatPrice(dealPrice)}
                </span>
                <span className="text-lg line-through opacity-70">
                  {formatPrice(originalPrice)}
                </span>
                {savingsPercent > 0 && (
                  <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-md">
                    SAVE {savingsPercent}%
                  </span>
                )}
              </div>

              {/* Countdown */}
              <div className="mb-6">
                <p className="text-sm opacity-80 mb-2">Ends in:</p>
                <div className="flex gap-2">
                  {[
                    { value: pad(countdown.hours), label: "HRS" },
                    { value: pad(countdown.minutes), label: "MIN" },
                    { value: pad(countdown.seconds), label: "SEC" },
                  ].map((t) => (
                    <div
                      key={t.label}
                      className="bg-black/30 backdrop-blur-sm rounded-lg px-3 py-2 text-center min-w-[56px]"
                    >
                      <span className="text-2xl font-mono font-bold block leading-none">
                        {t.value}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider opacity-70">
                        {t.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Link
                href={`/product/${deal.product.slug}`}
                className="inline-flex items-center gap-2 bg-white text-red-600 px-6 py-3 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
              >
                Grab Today&apos;s Deal →
              </Link>
            </div>

            {/* Right: image */}
            <div className="flex items-center justify-center">
              {imageUrl ? (
                <div className="relative w-48 h-48 sm:w-64 sm:h-64">
                  <Image
                    src={imageUrl}
                    alt={deal.product.name}
                    fill
                    className="object-contain drop-shadow-2xl"
                  />
                </div>
              ) : (
                <div className="w-48 h-48 sm:w-64 sm:h-64 bg-white/10 rounded-2xl flex items-center justify-center">
                  <span className="text-6xl">🏷️</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
