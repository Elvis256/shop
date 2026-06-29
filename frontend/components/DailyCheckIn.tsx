"use client";

// Daily check-in FAB + modal
// Self-manages visibility based on auth and check-in status

import { useState, useEffect, useCallback } from "react";
import { CalendarDays, X, Check, Flame } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useToast } from "@/lib/hooks/useToast";
import { useCart } from "@/lib/hooks/useCart";

const API_URL = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");

function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

interface CheckInDay {
  date: string;
  points: number;
  streak: number;
  bonus: number;
}

interface CheckInStatus {
  checkedInToday: boolean;
  currentStreak: number;
  recentCheckIns: CheckInDay[];
  totalPointsEarned: number;
}

const MILESTONES = [
  { days: 7, bonus: 50 },
  { days: 14, bonus: 100 },
  { days: 30, bonus: 200 },
];

function getLast7Days(): { label: string; dateStr: string }[] {
  const days: { label: string; dateStr: string }[] = [];
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      label: labels[d.getDay()],
      dateStr: d.toISOString().split("T")[0],
    });
  }
  return days;
}

export default function DailyCheckIn() {
  const { user, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { addItem } = useCart();
  const [status, setStatus] = useState<CheckInStatus | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [checking, setChecking] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [resultMessage, setResultMessage] = useState("");
  const [bonusEarned, setBonusEarned] = useState(0);

  // Mystery drops state
  const [mysteryDrops, setMysteryDrops] = useState<any[]>([]);
  const [dropsLoading, setDropsLoading] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;

    fetch(`${API_URL}/api/social/check-in/status`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setStatus(data);
      })
      .catch(() => {});
  }, [user, authLoading]);

  useEffect(() => {
    if (showModal && status && status.currentStreak >= 3) {
      setDropsLoading(true);
      fetch(`${API_URL}/api/social/check-in/mystery-drops`, { credentials: "include" })
        .then((r) => r.ok ? r.json() : { products: [] })
        .then((data) => {
          setMysteryDrops(data.products || []);
        })
        .catch(() => {})
        .finally(() => setDropsLoading(false));
    }
  }, [showModal, status]);

  const handleCheckIn = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    try {
      const csrf = getCsrfToken();
      const res = await fetch(`${API_URL}/api/social/check-in`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "x-csrf-token": csrf } : {}),
        },
      });

      if (!res.ok) throw new Error("Check-in failed");
      const data = await res.json();

      setStatus((prev) =>
        prev
          ? {
              ...prev,
              checkedInToday: true,
              currentStreak: data.streak ?? prev.currentStreak + 1,
              totalPointsEarned: data.totalPoints ?? prev.totalPointsEarned,
            }
          : prev
      );

      setBonusEarned(data.bonus || 0);
      setResultMessage(data.message || "Checked in!");
      setShowConfetti(true);
      showToast(data.message || "Daily check-in complete! 🎉", "success");

      setTimeout(() => setShowConfetti(false), 3000);
    } catch {
      showToast("Check-in failed. Try again later.", "error");
    } finally {
      setChecking(false);
    }
  }, [checking, showToast]);

  if (authLoading || !user || !status) return null;

  const last7 = getLast7Days();
  const checkedDates = new Set(
    status.recentCheckIns?.map((c) => c.date?.split("T")[0]) ?? []
  );

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setShowModal(true)}
        className={`fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all
          ${
            status.checkedInToday
              ? "bg-green-500 text-white"
              : "bg-gradient-to-br from-orange-500 to-red-500 text-white animate-pulse"
          }`}
        aria-label="Daily Check-in"
      >
        {status.checkedInToday ? (
          <Check className="w-6 h-6" />
        ) : (
          <Flame className="w-6 h-6" />
        )}
      </button>

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Confetti */}
            {showConfetti && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
                {Array.from({ length: 30 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-2 h-2 rounded-full animate-bounce"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 60}%`,
                      backgroundColor: ["#f59e0b", "#ef4444", "#10b981", "#6366f1", "#ec4899"][i % 5],
                      animationDelay: `${Math.random() * 0.5}s`,
                      animationDuration: `${0.6 + Math.random() * 0.8}s`,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-5 text-white relative">
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/20 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-bold">Daily Check-in</h2>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-3xl">🔥</span>
                <div>
                  <p className="text-2xl font-bold">{status.currentStreak} day streak</p>
                  <p className="text-sm text-orange-100">
                    ⭐ {status.totalPointsEarned} total points
                  </p>
                </div>
              </div>
            </div>

            {/* 7-day calendar */}
            <div className="px-6 py-4">
              <div className="grid grid-cols-7 gap-2 mb-4">
                {last7.map(({ label, dateStr }) => {
                  const checked = checkedDates.has(dateStr);
                  const isToday = dateStr === new Date().toISOString().split("T")[0];
                  return (
                    <div key={dateStr} className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-gray-500 font-medium">{label}</span>
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                          ${checked ? "bg-green-500 text-white" : ""}
                          ${isToday && !checked ? "ring-2 ring-orange-400 bg-orange-50 text-orange-600" : ""}
                          ${!checked && !isToday ? "bg-gray-100 text-gray-400" : ""}`}
                      >
                        {checked ? "✓" : new Date(dateStr + "T12:00:00").getDate()}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Milestones */}
              <div className="bg-gray-50 rounded-xl p-3 mb-4">
                <p className="text-xs font-semibold text-gray-600 mb-2">Streak Milestones</p>
                <div className="flex justify-between">
                  {MILESTONES.map((m) => {
                    const reached = status.currentStreak >= m.days;
                    return (
                      <div key={m.days} className="flex flex-col items-center gap-1">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                            ${reached ? "bg-yellow-400 text-yellow-900" : "bg-gray-200 text-gray-500"}`}
                        >
                          ⭐
                        </div>
                        <span className="text-[10px] text-gray-500">{m.days}d</span>
                        <span className={`text-[10px] font-semibold ${reached ? "text-yellow-600" : "text-gray-400"}`}>
                          +{m.bonus}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Result message */}
              {resultMessage && (
                <div className="text-center text-sm text-green-600 font-medium mb-3">
                  {resultMessage}
                  {bonusEarned > 0 && (
                    <span className="block text-yellow-600">🎉 Bonus: +{bonusEarned} pts</span>
                  )}
                </div>
              )}

              {/* Check-in button */}
              <button
                onClick={handleCheckIn}
                disabled={status.checkedInToday || checking}
                className={`w-full py-3 rounded-xl font-bold text-lg transition-all active:scale-95
                  ${
                    status.checkedInToday
                      ? "bg-green-100 text-green-700 cursor-default"
                      : "bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 shadow-lg"
                  }
                  disabled:opacity-70`}
              >
                {checking
                  ? "Checking in..."
                  : status.checkedInToday
                  ? "✓ Checked in today!"
                  : "Check In Now"}
              </button>

              {/* Mystery Drops */}
              {status.currentStreak >= 3 && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-2 text-left">
                  <p className="text-xs font-bold text-red-500 flex items-center gap-1">
                    🎁 Unlocked: Mystery Drops! ({status.currentStreak}-day streak)
                  </p>
                  {dropsLoading ? (
                    <div className="text-[10px] text-gray-400 animate-pulse">Loading special drops...</div>
                  ) : mysteryDrops.length === 0 ? (
                    <p className="text-[10px] text-gray-400">No active mystery drops today. Check back tomorrow!</p>
                  ) : (
                    <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                      {mysteryDrops.map((prod) => (
                        <div key={prod.id} className="flex items-center justify-between gap-3 p-2 bg-rose-50/50 dark:bg-gray-800 rounded-lg border border-rose-100/10">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{prod.name}</p>
                            <p className="text-[10px] text-red-500 font-bold">UGX {Number(prod.price).toLocaleString()}</p>
                          </div>
                          <button
                            onClick={() => {
                              addItem({
                                id: prod.id,
                                productId: prod.id,
                                name: prod.name,
                                slug: prod.slug,
                                price: Number(prod.price),
                                imageUrl: prod.images?.[0]?.url || null,
                                stock: prod.stock || 10,
                                quantity: 1,
                              });
                              showToast(`${prod.name} added to cart! 🛒`, "success");
                            }}
                            className="bg-red-500 hover:bg-red-600 text-white px-2.5 py-1 text-[10px] font-bold rounded-lg shrink-0 transition-colors"
                          >
                            Claim
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
