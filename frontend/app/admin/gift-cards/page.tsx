"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import {
  Gift, Plus, Search, Copy, Check, X, Eye,
  ChevronLeft, ChevronRight, ToggleLeft, ToggleRight,
  CreditCard, TrendingUp, RefreshCw, Loader2, Mail,
} from "lucide-react";

interface GiftCard {
  id: string;
  code: string;
  initialValue: number;
  currentValue: number;
  currency: string;
  purchaserEmail: string | null;
  purchaserName: string | null;
  recipientEmail: string | null;
  recipientName: string | null;
  message: string | null;
  isActive: boolean;
  expiresAt: string | null;
  redemptions: Redemption[];
  createdAt: string;
  updatedAt: string;
}

interface Redemption {
  id: string;
  giftCardId: string;
  orderId: string;
  amount: number;
  createdAt: string;
}

type FilterType = "all" | "active" | "expired" | "depleted";

const INPUT_CLS =
  "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition-colors";

const PER_PAGE = 15;

function fmt(amount: number) {
  return `UGX ${Number(amount || 0).toLocaleString()}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getStatus(card: GiftCard): "active" | "expired" | "depleted" {
  if (Number(card.currentValue) <= 0) return "depleted";
  if (card.expiresAt && new Date(card.expiresAt).getTime() < Date.now()) return "expired";
  if (!card.isActive) return "expired";
  return "active";
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    active: "bg-gray-900 text-white",
    expired: "bg-gray-200 text-gray-700",
    depleted: "bg-gray-100 text-gray-500",
  };
  return (
    <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full font-medium capitalize ${cls[status] || cls.expired}`}>
      {status}
    </span>
  );
}

const EMPTY_FORM = {
  initialValue: "",
  recipientEmail: "",
  recipientName: "",
  message: "",
  expiresAt: "",
};

export default function GiftCardsPage() {
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [page, setPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [detailCard, setDetailCard] = useState<GiftCard | null>(null);

  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const loadCards = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/giftcards");
      setCards(Array.isArray(data) ? data : data.giftCards || data.data || []);
    } catch (err) {
      console.error("Failed to load gift cards:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCards(); }, [loadCards]);
  useEffect(() => { document.title = "Gift Cards | Admin"; }, []);
  useEffect(() => { setPage(1); }, [search, filter]);

  const filtered = cards
    .filter((c) => {
      const status = getStatus(c);
      if (filter === "active" && status !== "active") return false;
      if (filter === "expired" && status !== "expired") return false;
      if (filter === "depleted" && status !== "depleted") return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          c.code.toLowerCase().includes(q) ||
          (c.recipientEmail || "").toLowerCase().includes(q) ||
          (c.recipientName || "").toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Stats
  const stats = {
    totalIssued: cards.length,
    totalValue: cards.reduce((s, c) => s + Number(c.initialValue), 0),
    totalRedeemed: cards.reduce((s, c) => s + (Number(c.initialValue) - Number(c.currentValue)), 0),
    activeCards: cards.filter((c) => getStatus(c) === "active").length,
  };

  const filterCounts: Record<FilterType, number> = {
    all: cards.length,
    active: cards.filter((c) => getStatus(c) === "active").length,
    expired: cards.filter((c) => getStatus(c) === "expired").length,
    depleted: cards.filter((c) => getStatus(c) === "depleted").length,
  };

  const copyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.initialValue) return;
    setSaving(true);
    try {
      await apiFetch("/api/giftcards", {
        method: "POST",
        body: JSON.stringify({
          initialValue: parseFloat(form.initialValue),
          recipientEmail: form.recipientEmail || undefined,
          recipientName: form.recipientName || undefined,
          message: form.message || undefined,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
        }),
      });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      loadCards();
    } catch (err) {
      console.error("Failed to create gift card:", err);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (card: GiftCard) => {
    try {
      await apiFetch("/api/giftcards/" + card.code, {
        method: "PUT",
        body: JSON.stringify({ isActive: !card.isActive }),
      });
      loadCards();
    } catch (err) {
      console.error("Failed to toggle gift card:", err);
    }
  };

  const viewDetail = async (card: GiftCard) => {
    try {
      const data = await apiFetch("/api/giftcards/" + card.code);
      setDetailCard(data.giftCard || data);
    } catch {
      setDetailCard(card);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Gift Cards</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {stats.totalIssued} issued · {stats.activeCards} active
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadCards} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800">
            <Plus className="w-4 h-4" /> Create Gift Card
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Issued", value: stats.totalIssued, icon: Gift },
          { label: "Total Value Issued", value: fmt(stats.totalValue), icon: CreditCard },
          { label: "Total Redeemed", value: fmt(stats.totalRedeemed), icon: TrendingUp },
          { label: "Active Cards", value: stats.activeCards, icon: Check },
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
            placeholder="Search by code or recipient email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm">
          {(["all", "active", "expired", "depleted"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 capitalize transition-colors ${filter === f ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              {f} ({filterCounts[f]})
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Initial Value</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Balance</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Recipient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Created</th>
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
                    <Gift className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No gift cards found</p>
                    <p className="text-xs text-gray-400 mt-1">Create your first gift card to get started</p>
                  </td>
                </tr>
              ) : (
                paginated.map((card) => {
                  const status = getStatus(card);
                  return (
                    <tr key={card.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono font-medium text-gray-900">{card.code}</code>
                          <button
                            onClick={() => copyCode(card.id, card.code)}
                            className="text-gray-400 hover:text-gray-600"
                            title="Copy code"
                          >
                            {copiedId === card.id ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{fmt(card.initialValue)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{fmt(card.currentValue)}</td>
                      <td className="px-4 py-3">
                        {card.recipientName || card.recipientEmail ? (
                          <div>
                            {card.recipientName && <p className="text-sm text-gray-900">{card.recipientName}</p>}
                            {card.recipientEmail && <p className="text-xs text-gray-500">{card.recipientEmail}</p>}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={status} /></td>
                      <td className="px-4 py-3 text-sm text-gray-500">{fmtDate(card.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => viewDetail(card)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100" title="View details">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => toggleActive(card)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100" title={card.isActive ? "Deactivate" : "Activate"}>
                            {card.isActive ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4" />}
                          </button>
                        </div>
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

      {/* Create Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setCreateOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Create Gift Card</h2>
              <button onClick={() => setCreateOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-md">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Value (UGX) *</label>
                <input
                  type="number"
                  className={INPUT_CLS}
                  placeholder="e.g. 50000"
                  value={form.initialValue}
                  onChange={(e) => setForm({ ...form, initialValue: e.target.value })}
                  required
                  min="1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Name</label>
                  <input
                    type="text"
                    className={INPUT_CLS}
                    placeholder="John Doe"
                    value={form.recipientName}
                    onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Email</label>
                  <input
                    type="email"
                    className={INPUT_CLS}
                    placeholder="john@example.com"
                    value={form.recipientEmail}
                    onChange={(e) => setForm({ ...form, recipientEmail: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Personal Message</label>
                <textarea
                  className={INPUT_CLS}
                  rows={3}
                  placeholder="Happy birthday!"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                <input
                  type="date"
                  className={INPUT_CLS}
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Gift Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDetailCard(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Gift Card Details</h2>
              <button onClick={() => setDetailCard(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-md">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Gift className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <code className="text-lg font-mono font-semibold text-gray-900">{detailCard.code}</code>
                  <div className="flex items-center gap-2 mt-0.5">
                    <StatusBadge status={getStatus(detailCard)} />
                    <span className="text-xs text-gray-400">Created {fmtDate(detailCard.createdAt)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase">Initial Value</p>
                  <p className="text-lg font-semibold text-gray-900">{fmt(detailCard.initialValue)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase">Current Balance</p>
                  <p className="text-lg font-semibold text-gray-900">{fmt(detailCard.currentValue)}</p>
                </div>
              </div>

              {(detailCard.recipientName || detailCard.recipientEmail) && (
                <div className="border border-gray-100 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase mb-1">Recipient</p>
                  {detailCard.recipientName && <p className="text-sm font-medium text-gray-900">{detailCard.recipientName}</p>}
                  {detailCard.recipientEmail && (
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" /> {detailCard.recipientEmail}
                    </p>
                  )}
                </div>
              )}

              {detailCard.message && (
                <div className="border border-gray-100 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase mb-1">Message</p>
                  <p className="text-sm text-gray-700 italic">&ldquo;{detailCard.message}&rdquo;</p>
                </div>
              )}

              {detailCard.expiresAt && (
                <div className="text-sm text-gray-500">
                  Expires: <span className="font-medium text-gray-700">{fmtDate(detailCard.expiresAt)}</span>
                </div>
              )}

              {/* Redemption History */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">Redemption History</h3>
                {detailCard.redemptions && detailCard.redemptions.length > 0 ? (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Order</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {detailCard.redemptions.map((r) => (
                          <tr key={r.id}>
                            <td className="px-3 py-2 text-sm text-gray-600">{fmtDate(r.createdAt)}</td>
                            <td className="px-3 py-2 text-sm text-gray-600 font-mono">{r.orderId.slice(0, 8)}…</td>
                            <td className="px-3 py-2 text-sm text-gray-900 font-medium text-right">{fmt(r.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-lg">
                    No redemptions yet
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
