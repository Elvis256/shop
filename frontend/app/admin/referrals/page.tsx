"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import {
  Search,
  Users,
  UserCheck,
  Gift,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Download,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  Share2,
  Copy,
  Check,
  Loader2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ReferralUser {
  id: string;
  name: string | null;
  email: string;
}

interface Referral {
  id: string;
  referralCodeId: string;
  referredUserId: string;
  status: "PENDING" | "COMPLETED" | "EXPIRED";
  rewardAmount: number | null;
  rewardPaid: boolean;
  firstOrderId: string | null;
  firstOrderAt: string | null;
  createdAt: string;
  updatedAt: string;
  referredUser: ReferralUser;
}

interface ReferralCode {
  id: string;
  userId: string;
  code: string;
  usageCount: number;
  totalEarnings: number;
  createdAt: string;
  updatedAt: string;
  user: ReferralUser;
  referrals: Referral[];
}

interface Stats {
  totalCodes: number;
  totalReferrals: number;
  successfulConversions: number;
  totalRewardsPaid: number;
}

type FilterType = "all" | "conversions" | "pending_payouts";

function fmt(amount: number) {
  return `UGX ${Number(amount || 0).toLocaleString()}`;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  COMPLETED: { label: "Completed", color: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2 },
  PENDING: { label: "Pending", color: "bg-yellow-50 text-yellow-700 border-yellow-200", icon: Clock },
  EXPIRED: { label: "Expired", color: "bg-gray-50 text-gray-500 border-gray-200", icon: AlertCircle },
};

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function AdminReferralsPage() {
  const [codes, setCodes] = useState<ReferralCode[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalCodes: 0,
    totalReferrals: 0,
    successfulConversions: 0,
    totalRewardsPaid: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [page, setPage] = useState(1);
  const [selectedCode, setSelectedCode] = useState<ReferralCode | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const limit = 20;
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    document.title = "Referrals | Admin";
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [codesRes, statsRes] = await Promise.all([
        apiFetch("/api/referrals/admin/all"),
        apiFetch("/api/referrals/admin/stats"),
      ]);
      setCodes(Array.isArray(codesRes) ? codesRes : codesRes.codes || []);
      if (statsRes) setStats(statsRes);
    } catch (e) {
      console.error("Failed to load referral data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMarkPaid = async (referralId: string) => {
    setPayingId(referralId);
    try {
      await apiFetch(`/api/referrals/admin/${referralId}/payout`, { method: "PUT" });
      await loadData();
      if (selectedCode) {
        const updated = codes.find((c) => c.id === selectedCode.id);
        if (updated) setSelectedCode(updated);
      }
    } catch (e) {
      console.error("Failed to mark as paid:", e);
    } finally {
      setPayingId(null);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  /* Filtering & search */
  const filtered = codes.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      c.code.toLowerCase().includes(q) ||
      c.user.name?.toLowerCase().includes(q) ||
      c.user.email.toLowerCase().includes(q);

    if (!matchSearch) return false;

    if (filter === "conversions") {
      return c.referrals.some((r) => r.status === "COMPLETED");
    }
    if (filter === "pending_payouts") {
      return c.referrals.some((r) => r.status === "COMPLETED" && !r.rewardPaid);
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const paginated = filtered.slice((page - 1) * limit, page * limit);

  useEffect(() => {
    setPage(1);
  }, [search, filter]);

  const exportCSV = () => {
    const headers = ["Referrer", "Email", "Code", "Referrals", "Conversions", "Earnings", "Created"];
    const rows = filtered.map((c) => [
      c.user.name || "",
      c.user.email,
      c.code,
      c.usageCount,
      c.referrals.filter((r) => r.status === "COMPLETED").length,
      c.totalEarnings,
      c.createdAt,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "referrals.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Referrals</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage referral codes, track conversions and payouts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Referral Codes", value: stats.totalCodes, icon: Share2 },
          { label: "Total Referrals", value: stats.totalReferrals, icon: Users },
          { label: "Conversions", value: stats.successfulConversions, icon: UserCheck },
          { label: "Rewards Paid", value: fmt(stats.totalRewardsPaid), icon: DollarSign },
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

      {/* Search & Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
            placeholder="Search by name, email, or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm">
          {([
            { key: "all", label: "All" },
            { key: "conversions", label: "With Conversions" },
            { key: "pending_payouts", label: "Pending Payouts" },
          ] as { key: FilterType; label: string }[]).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-2 transition-colors ${
                filter === f.key
                  ? "bg-gray-900 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f.label}
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Referrer
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Referrals
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Conversions
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Earnings
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-4 py-4">
                      <div
                        className="h-4 bg-gray-100 rounded animate-pulse"
                        style={{ width: `${60 + Math.random() * 30}%` }}
                      />
                    </td>
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Share2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No referral codes found</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Referral codes will appear here when users create them
                    </p>
                  </td>
                </tr>
              ) : (
                paginated.map((c) => {
                  const conversions = c.referrals.filter((r) => r.status === "COMPLETED").length;
                  const pendingPayouts = c.referrals.filter(
                    (r) => r.status === "COMPLETED" && !r.rewardPaid
                  ).length;

                  return (
                    <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-medium shrink-0">
                            {(c.user.name?.[0] || c.user.email[0]).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {c.user.name || "—"}
                            </p>
                            <p className="text-xs text-gray-500 truncate">{c.user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <code className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                            {c.code}
                          </code>
                          <button
                            onClick={() => copyCode(c.code)}
                            className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                          >
                            {copiedCode === c.code ? (
                              <Check className="w-3 h-3 text-green-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{c.usageCount}</td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-900">{conversions}</span>
                        {pendingPayouts > 0 && (
                          <span className="ml-1.5 text-xs bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded border border-yellow-200">
                            {pendingPayouts} unpaid
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {fmt(c.totalEarnings)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(c.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedCode(c)}
                          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 underline-offset-2 hover:underline"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, filtered.length)} of{" "}
              {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p =
                  totalPages <= 5
                    ? i + 1
                    : Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 text-xs rounded border transition-colors ${
                      page === p
                        ? "bg-gray-900 text-white border-gray-900"
                        : "border-gray-200 hover:bg-gray-50 text-gray-600"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Referral Detail Modal */}
      {selectedCode && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {selectedCode.user.name || selectedCode.user.email}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Code: <code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">{selectedCode.code}</code>
                  {" · "}
                  {selectedCode.usageCount} referral{selectedCode.usageCount !== 1 ? "s" : ""}
                  {" · "}
                  {fmt(selectedCode.totalEarnings)} earned
                </p>
              </div>
              <button
                onClick={() => setSelectedCode(null)}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1 px-6 py-4">
              {selectedCode.referrals.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No referrals yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedCode.referrals.map((ref) => {
                    const sc = statusConfig[ref.status] || statusConfig.PENDING;
                    const StatusIcon = sc.icon;
                    return (
                      <div
                        key={ref.id}
                        className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-xs font-medium shrink-0">
                              {(ref.referredUser.name?.[0] || ref.referredUser.email[0]).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {ref.referredUser.name || "—"}
                              </p>
                              <p className="text-xs text-gray-500">{ref.referredUser.email}</p>
                            </div>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border font-medium ${sc.color}`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {sc.label}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <p className="text-gray-400 uppercase tracking-wide">Referred</p>
                            <p className="text-gray-700 mt-0.5">{formatDate(ref.createdAt)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 uppercase tracking-wide">First Order</p>
                            <p className="text-gray-700 mt-0.5">
                              {ref.firstOrderId ? formatDate(ref.firstOrderAt) : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 uppercase tracking-wide">Reward</p>
                            <p className="text-gray-700 mt-0.5">
                              {ref.rewardAmount ? fmt(ref.rewardAmount) : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 uppercase tracking-wide">Paid</p>
                            <p className="mt-0.5">
                              {ref.rewardPaid ? (
                                <span className="text-green-600 font-medium">Yes</span>
                              ) : ref.status === "COMPLETED" ? (
                                <button
                                  onClick={() => handleMarkPaid(ref.id)}
                                  disabled={payingId === ref.id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-900 text-white rounded text-xs hover:bg-gray-800 disabled:opacity-50"
                                >
                                  {payingId === ref.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <DollarSign className="w-3 h-3" />
                                  )}
                                  Mark Paid
                                </button>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
