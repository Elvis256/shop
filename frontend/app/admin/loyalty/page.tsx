"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import {
  Award, Search, Users, TrendingUp, Star,
  ChevronLeft, ChevronRight, X, Plus, Minus,
  Loader2, RefreshCw, ArrowUpDown, Eye,
} from "lucide-react";

interface LoyaltyAccount {
  id: string;
  userId: string;
  points: number;
  lifetimePoints: number;
  tier: LoyaltyTier;
  transactions: LoyaltyTransaction[];
  createdAt: string;
  updatedAt: string;
  user: { name: string | null; email: string };
}

interface LoyaltyTransaction {
  id: string;
  accountId: string;
  type: string;
  points: number;
  description: string | null;
  orderId: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface ProgramStats {
  totalMembers: number;
  totalPointsCirculation: number;
  totalPointsRedeemed: number;
  tierBreakdown: Record<LoyaltyTier, number>;
}

type LoyaltyTier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
type FilterTier = "all" | LoyaltyTier;

const TIER_COLORS: Record<LoyaltyTier, string> = {
  BRONZE: "#CD7F32",
  SILVER: "#C0C0C0",
  GOLD: "#FFD700",
  PLATINUM: "#E5E4E2",
};

const TIER_BG: Record<LoyaltyTier, string> = {
  BRONZE: "bg-amber-50 text-amber-800 border-amber-200",
  SILVER: "bg-gray-100 text-gray-700 border-gray-300",
  GOLD: "bg-yellow-50 text-yellow-800 border-yellow-300",
  PLATINUM: "bg-slate-100 text-slate-700 border-slate-300",
};

const INPUT_CLS =
  "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition-colors";

const PER_PAGE = 15;

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function TierBadge({ tier }: { tier: LoyaltyTier }) {
  return (
    <span
      className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full font-semibold border ${TIER_BG[tier]}`}
      style={{ borderColor: TIER_COLORS[tier] }}
    >
      <Star className="w-3 h-3 mr-1" style={{ color: TIER_COLORS[tier] }} fill={TIER_COLORS[tier]} />
      {tier}
    </span>
  );
}

function TxTypeBadge({ type }: { type: string }) {
  const labels: Record<string, { label: string; cls: string }> = {
    PURCHASE_EARN: { label: "Purchase", cls: "bg-green-50 text-green-700" },
    REFERRAL_BONUS: { label: "Referral", cls: "bg-blue-50 text-blue-700" },
    SIGNUP_BONUS: { label: "Signup", cls: "bg-purple-50 text-purple-700" },
    REDEMPTION: { label: "Redeemed", cls: "bg-red-50 text-red-700" },
    EXPIRY: { label: "Expired", cls: "bg-gray-100 text-gray-600" },
    ADJUSTMENT: { label: "Adjustment", cls: "bg-yellow-50 text-yellow-700" },
  };
  const info = labels[type] || { label: type, cls: "bg-gray-100 text-gray-600" };
  return <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${info.cls}`}>{info.label}</span>;
}

export default function LoyaltyPage() {
  const [accounts, setAccounts] = useState<LoyaltyAccount[]>([]);
  const [stats, setStats] = useState<ProgramStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<FilterTier>("all");
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<"points" | "lifetimePoints" | "updatedAt">("points");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [detailAccount, setDetailAccount] = useState<LoyaltyAccount | null>(null);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<LoyaltyAccount | null>(null);
  const [adjustPoints, setAdjustPoints] = useState("");
  const [adjustDesc, setAdjustDesc] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [accountsData, statsData] = await Promise.all([
        apiFetch("/api/loyalty/admin/accounts"),
        apiFetch("/api/loyalty/admin/stats"),
      ]);
      setAccounts(Array.isArray(accountsData) ? accountsData : accountsData.accounts || accountsData.data || []);
      setStats(statsData.stats || statsData);
    } catch (err) {
      console.error("Failed to load loyalty data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { document.title = "Loyalty Program | Admin"; }, []);
  useEffect(() => { setPage(1); }, [search, tierFilter]);

  const toggleSort = (field: "points" | "lifetimePoints" | "updatedAt") => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  const SortIcon = ({ field }: { field: string }) => (
    <ArrowUpDown className={`w-3 h-3 inline ml-1 ${sortField === field ? "text-gray-900" : "text-gray-400"}`} />
  );

  const filtered = accounts
    .filter((a) => {
      if (tierFilter !== "all" && a.tier !== tierFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (a.user.name || "").toLowerCase().includes(q) ||
          a.user.email.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      let diff = 0;
      if (sortField === "points") diff = a.points - b.points;
      else if (sortField === "lifetimePoints") diff = a.lifetimePoints - b.lifetimePoints;
      else diff = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      return sortDir === "desc" ? -diff : diff;
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Compute stats from data if API stats not available
  const displayStats: ProgramStats = stats || {
    totalMembers: accounts.length,
    totalPointsCirculation: accounts.reduce((s, a) => s + a.points, 0),
    totalPointsRedeemed: accounts.reduce((s, a) => s + (a.lifetimePoints - a.points), 0),
    tierBreakdown: {
      BRONZE: accounts.filter((a) => a.tier === "BRONZE").length,
      SILVER: accounts.filter((a) => a.tier === "SILVER").length,
      GOLD: accounts.filter((a) => a.tier === "GOLD").length,
      PLATINUM: accounts.filter((a) => a.tier === "PLATINUM").length,
    },
  };

  const tierTotal = Object.values(displayStats.tierBreakdown).reduce((s, v) => s + v, 0) || 1;

  const openAdjust = (account: LoyaltyAccount) => {
    setAdjustTarget(account);
    setAdjustPoints("");
    setAdjustDesc("");
    setAdjustOpen(true);
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget || !adjustPoints) return;
    setAdjusting(true);
    try {
      await apiFetch("/api/loyalty/admin/adjust", {
        method: "POST",
        body: JSON.stringify({
          userId: adjustTarget.userId,
          points: parseInt(adjustPoints),
          description: adjustDesc || "Manual adjustment",
        }),
      });
      setAdjustOpen(false);
      loadData();
    } catch (err) {
      console.error("Failed to adjust points:", err);
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Loyalty Program</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {displayStats.totalMembers} members · {displayStats.totalPointsCirculation.toLocaleString()} pts in circulation
          </p>
        </div>
        <button onClick={loadData} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Members", value: displayStats.totalMembers.toLocaleString(), icon: Users },
          { label: "Points in Circulation", value: displayStats.totalPointsCirculation.toLocaleString(), icon: Award },
          { label: "Points Redeemed", value: displayStats.totalPointsRedeemed.toLocaleString(), icon: TrendingUp },
          { label: "Avg Points/Member", value: displayStats.totalMembers ? Math.round(displayStats.totalPointsCirculation / displayStats.totalMembers).toLocaleString() : "0", icon: Star },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
              <s.icon className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tier Breakdown */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Members by Tier</h3>
        <div className="flex items-center gap-2 mb-3">
          {(["BRONZE", "SILVER", "GOLD", "PLATINUM"] as LoyaltyTier[]).map((tier) => (
            <TierBadge key={tier} tier={tier} />
          ))}
        </div>
        <div className="space-y-2">
          {(["PLATINUM", "GOLD", "SILVER", "BRONZE"] as LoyaltyTier[]).map((tier) => {
            const count = displayStats.tierBreakdown[tier] || 0;
            const pct = Math.round((count / tierTotal) * 100);
            return (
              <div key={tier} className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-600 w-20">{tier}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 flex items-center pl-2"
                    style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: TIER_COLORS[tier] }}
                  >
                    {pct >= 10 && <span className="text-[10px] font-bold text-white drop-shadow-sm">{pct}%</span>}
                  </div>
                </div>
                <span className="text-xs text-gray-500 w-16 text-right">{count} ({pct}%)</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm">
          {(["all", "BRONZE", "SILVER", "GOLD", "PLATINUM"] as FilterTier[]).map((f) => (
            <button
              key={f}
              onClick={() => setTierFilter(f)}
              className={`px-3 py-2 capitalize transition-colors ${tierFilter === f ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              {f === "all" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Tier</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer select-none" onClick={() => toggleSort("points")}>
                  Points <SortIcon field="points" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer select-none" onClick={() => toggleSort("lifetimePoints")}>
                  Lifetime <SortIcon field="lifetimePoints" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer select-none" onClick={() => toggleSort("updatedAt")}>
                  Last Activity <SortIcon field="updatedAt" />
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-4 py-4">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
                    </td>
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Award className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No loyalty members found</p>
                    <p className="text-xs text-gray-400 mt-1">Members join automatically on their first purchase</p>
                  </td>
                </tr>
              ) : (
                paginated.map((account) => (
                  <tr key={account.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{account.user.name || "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{account.user.email}</td>
                    <td className="px-4 py-3"><TierBadge tier={account.tier} /></td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{account.points.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{account.lifetimePoints.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{fmtDate(account.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setDetailAccount(account)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100" title="View transactions">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => openAdjust(account)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100" title="Adjust points">
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .map((p, idx, arr) => (
                  <span key={p} className="flex items-center">
                    {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-gray-400">…</span>}
                    <button
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-md text-sm ${p === page ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                    >
                      {p}
                    </button>
                  </span>
                ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transaction History Modal */}
      {detailAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDetailAccount(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Member Details</h2>
              <button onClick={() => setDetailAccount(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-md">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                  <Award className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <p className="text-base font-semibold text-gray-900">{detailAccount.user.name || "Unknown"}</p>
                  <p className="text-sm text-gray-500">{detailAccount.user.email}</p>
                </div>
                <div className="ml-auto"><TierBadge tier={detailAccount.tier} /></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase">Current Points</p>
                  <p className="text-lg font-semibold text-gray-900">{detailAccount.points.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase">Lifetime Points</p>
                  <p className="text-lg font-semibold text-gray-900">{detailAccount.lifetimePoints.toLocaleString()}</p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-900">Transaction History</h3>
                  <button onClick={() => { setDetailAccount(null); openAdjust(detailAccount); }} className="text-xs text-gray-600 hover:text-gray-900 underline">
                    Adjust Points
                  </button>
                </div>
                {detailAccount.transactions && detailAccount.transactions.length > 0 ? (
                  <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-white">
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Points</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {detailAccount.transactions
                          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                          .map((tx) => (
                            <tr key={tx.id}>
                              <td className="px-3 py-2 text-sm text-gray-600">{fmtDate(tx.createdAt)}</td>
                              <td className="px-3 py-2"><TxTypeBadge type={tx.type} /></td>
                              <td className={`px-3 py-2 text-sm font-semibold text-right ${tx.points >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {tx.points >= 0 ? "+" : ""}{tx.points.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-lg">
                    No transactions yet
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Points Modal */}
      {adjustOpen && adjustTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setAdjustOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Adjust Points</h2>
              <button onClick={() => setAdjustOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-md">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAdjust} className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
                <Award className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{adjustTarget.user.name || adjustTarget.user.email}</p>
                  <p className="text-xs text-gray-500">Current balance: {adjustTarget.points.toLocaleString()} pts</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Points (use negative to deduct) *</label>
                <input
                  type="number"
                  className={INPUT_CLS}
                  placeholder="e.g. 500 or -200"
                  value={adjustPoints}
                  onChange={(e) => setAdjustPoints(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  {adjustPoints && !isNaN(parseInt(adjustPoints))
                    ? `New balance: ${(adjustTarget.points + parseInt(adjustPoints)).toLocaleString()} pts`
                    : "Enter a positive or negative number"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                <input
                  type="text"
                  className={INPUT_CLS}
                  placeholder="e.g. Compensation for delayed order"
                  value={adjustDesc}
                  onChange={(e) => setAdjustDesc(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setAdjustOpen(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={adjusting} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">
                  {adjusting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {adjustPoints && parseInt(adjustPoints) < 0 ? (
                    <><Minus className="w-4 h-4" /> Deduct Points</>
                  ) : (
                    <><Plus className="w-4 h-4" /> Add Points</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
