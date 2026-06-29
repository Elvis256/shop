"use client";

import { useState, useEffect } from "react";
import { Trophy, Medal, Award } from "lucide-react";

const API_URL = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");

interface LeaderboardEntry {
  rank: number;
  name: string;
  referralCount: number;
}

export default function ReferralLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/referrals/leaderboard`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.leaderboard) setEntries(data.leaderboard.slice(0, 10));
        else if (Array.isArray(data)) setEntries(data.slice(0, 10));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="card">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" /> Referral Leaderboard
        </h3>
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-surface-secondary rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (entries.length === 0) return null;

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Award className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 h-5 text-center text-sm font-bold text-text-muted">{rank}</span>;
  };

  const rankBg = (rank: number) => {
    if (rank === 1) return "bg-yellow-50 border-yellow-200";
    if (rank === 2) return "bg-gray-50 border-gray-200";
    if (rank === 3) return "bg-amber-50 border-amber-200";
    return "bg-surface border-transparent";
  };

  return (
    <div className="card">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-yellow-500" /> Referral Leaderboard
      </h3>
      <div className="space-y-2">
        {entries.map((entry, i) => {
          const rank = entry.rank || i + 1;
          return (
            <div
              key={i}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${rankBg(rank)} transition-colors`}
            >
              <div className="shrink-0">{rankIcon(rank)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">{entry.name}</p>
              </div>
              <div className="text-sm font-semibold text-text-muted">
                {entry.referralCount} referral{entry.referralCount !== 1 ? "s" : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
