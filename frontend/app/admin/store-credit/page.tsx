"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import {
  Search, Plus, Wallet, AlertTriangle, Check, Loader2, X, User,
  ArrowRight, ArrowLeft, ArrowDownLeft, ArrowUpRight,
  ShoppingCart, Hash, TrendingUp, TrendingDown, Filter,
} from "lucide-react";

const inputClass =
  "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition-colors";

const PRESET_AMOUNTS = [10000, 25000, 50000, 100000];

function fmt(amount: number) {
  return `UGX ${Number(amount || 0).toLocaleString()}`;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (days === 0) return `Today at ${time}`;
  if (days === 1) return `Yesterday at ${time}`;
  if (days < 7) return `${days} days ago at ${time}`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

interface UserResult {
  id: string;
  name: string | null;
  email: string;
  balance: number;
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  orderId: string | null;
  createdAt: string;
}

type TxFilter = "all" | "credits" | "debits";

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: string; icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function TxIcon({ amount, orderId }: { amount: number; orderId: string | null }) {
  if (orderId) return <ShoppingCart className="w-4 h-4 text-orange-400" />;
  if (amount > 0) return <ArrowDownLeft className="w-4 h-4 text-emerald-500" />;
  return <ArrowUpRight className="w-4 h-4 text-red-400" />;
}

export default function StoreCreditPage() {
  useEffect(() => { document.title = "Store Credit | Admin"; }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingUser, setLoadingUser] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [addAmount, setAddAmount] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [adding, setAdding] = useState(false);
  const [txFilter, setTxFilter] = useState<TxFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const stats = useMemo(() => {
    const totalCredits = transactions.reduce(
      (s, t) => s + (Number(t.amount) > 0 ? Number(t.amount) : 0),
      0
    );
    const totalDebits = transactions.reduce(
      (s, t) => s + (Number(t.amount) < 0 ? Math.abs(Number(t.amount)) : 0),
      0
    );
    return { totalCredits, totalDebits, count: transactions.length };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    if (txFilter === "credits") return transactions.filter((t) => Number(t.amount) > 0);
    if (txFilter === "debits") return transactions.filter((t) => Number(t.amount) < 0);
    return transactions;
  }, [transactions, txFilter]);

  const handleSearch = useCallback(async () => {
    if (searchQuery.length < 2) return;
    setSearching(true);
    setError(null);
    setHasSearched(true);
    try {
      const data = await api.admin.searchUsersForCredit(searchQuery);
      setSearchResults(data.users || []);
    } catch {
      setError("Failed to search users");
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const selectUser = async (user: UserResult) => {
    setSelectedUser(user);
    setShowModal(true);
    setLoadingUser(true);
    setError(null);
    setTxFilter("all");
    try {
      const data = await api.admin.getUserCredit(user.id);
      setUserBalance(Number(data.balance) || 0);
      setTransactions(data.transactions || []);
    } catch {
      setError("Failed to load user credit details");
    } finally {
      setLoadingUser(false);
    }
  };

  const deselectUser = () => {
    setSelectedUser(null); setShowModal(false); setUserBalance(0);
    setTransactions([]); setAddAmount(""); setAddDescription("");
    setTxFilter("all"); setError(null); setSuccess(null);
  };

  const handleAddCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setAdding(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await api.admin.addStoreCredit(
        selectedUser.id,
        parseFloat(addAmount),
        addDescription
      );
      setUserBalance(Number(result.balance));
      setTransactions((prev) => [result.transaction, ...prev]);
      setAddAmount("");
      setAddDescription("");
      setSuccess(`Added ${fmt(parseFloat(addAmount))} to ${selectedUser.email}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || "Failed to add store credit");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Store Credit Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Search for customers and manage their store credit balance
          </p>
        </div>
        {selectedUser && !showModal && (
          <button
            onClick={deselectUser}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Search
          </button>
        )}
      </div>

      {/* Messages */}
      {error && !showModal && (
        <div className="p-4 border border-red-200 rounded-lg flex items-center gap-3 bg-white">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700 text-sm flex-1">{error}</p>
          <button onClick={() => setError(null)} aria-label="Dismiss error"><X className="w-4 h-4 text-gray-400" /></button>
        </div>
      )}
      {success && !showModal && (
        <div className="p-4 border border-emerald-200 rounded-lg flex items-center gap-3 bg-white">
          <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <p className="text-emerald-700 text-sm">{success}</p>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Find Customer</h2>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="email"
              className={inputClass}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search by email address..."
            />
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || searchQuery.length < 2}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
          </button>
        </div>

        {/* Search loading */}
        {searching && (
          <div className="mt-6 flex flex-col items-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">Searching customers…</p>
          </div>
        )}

        {/* Search Results */}
        {hasSearched && !searching && (
          <div className="mt-4">
            {searchResults.length === 0 ? (
              <div className="text-center py-8">
                <User className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No users found for &ldquo;{searchQuery}&rdquo;</p>
                <p className="text-xs text-gray-300 mt-1">Try a different email address</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => selectUser(user)}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors rounded-lg ${
                      selectedUser?.id === user.id ? "bg-gray-50 ring-1 ring-gray-200" : ""
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{user.name || "No name"}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium text-gray-900">{fmt(Number(user.balance))}</p>
                      <p className="text-[10px] text-gray-400">balance</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal overlay for selected user */}
      {showModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
          <div className="fixed inset-0 bg-black/30" onClick={deselectUser} />
          <div className="relative bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-2xl max-h-[80vh] overflow-y-auto z-10">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <User className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedUser.name || selectedUser.email}
                  </h2>
                  <p className="text-sm text-gray-500">{selectedUser.email}</p>
                </div>
              </div>
              <button onClick={deselectUser} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Close">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {loadingUser ? (
              <div className="flex flex-col items-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-gray-300 mb-3" />
                <p className="text-sm text-gray-400">Loading credit details…</p>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Modal Messages */}
                {error && (
                  <div className="p-3 border border-red-200 rounded-lg flex items-center gap-3 bg-red-50/50">
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="text-red-700 text-sm flex-1">{error}</p>
                    <button onClick={() => setError(null)} aria-label="Dismiss error"><X className="w-3.5 h-3.5 text-gray-400" /></button>
                  </div>
                )}
                {success && (
                  <div className="p-3 border border-emerald-200 rounded-lg flex items-center gap-3 bg-emerald-50/50">
                    <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <p className="text-emerald-700 text-sm">{success}</p>
                  </div>
                )}

                {/* Stat Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard
                    label="Balance"
                    value={fmt(userBalance)}
                    icon={Wallet}
                    color="text-blue-500"
                  />
                  <StatCard
                    label="Total Credits"
                    value={fmt(stats.totalCredits)}
                    icon={TrendingUp}
                    color="text-emerald-500"
                  />
                  <StatCard
                    label="Total Spent"
                    value={fmt(stats.totalDebits)}
                    icon={TrendingDown}
                    color="text-red-400"
                  />
                  <StatCard
                    label="Transactions"
                    value={String(stats.count)}
                    icon={Hash}
                    color="text-gray-400"
                  />
                </div>

                {/* Add Credit Form */}
                <form onSubmit={handleAddCredit} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Add Credit
                  </h3>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {PRESET_AMOUNTS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAddAmount(String(preset))}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                          addAmount === String(preset)
                            ? "bg-gray-900 text-white border-gray-900"
                            : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                        }`}
                      >
                        {fmt(preset)}
                      </button>
                    ))}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Amount (UGX) *
                      </label>
                      <input
                        type="number"
                        className={inputClass}
                        value={addAmount}
                        onChange={(e) => setAddAmount(e.target.value)}
                        required
                        min="1"
                        step="0.01"
                        placeholder="e.g., 50000"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Description *
                      </label>
                      <input
                        type="text"
                        className={inputClass}
                        value={addDescription}
                        onChange={(e) => setAddDescription(e.target.value)}
                        required
                        placeholder="e.g., Refund for order #123"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={adding || !addAmount || !addDescription}
                    className="mt-3 flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {adding ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    {adding ? "Adding…" : "Add Credit"}
                  </button>
                </form>

                {/* Transaction History */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-700">
                      Transaction History
                    </h3>
                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                      {(["all", "credits", "debits"] as TxFilter[]).map((f) => (
                        <button
                          key={f}
                          onClick={() => setTxFilter(f)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                            txFilter === f
                              ? "bg-white text-gray-900 shadow-sm"
                              : "text-gray-500 hover:text-gray-700"
                          }`}
                        >
                          {f === "all" ? "All" : f === "credits" ? "Credits" : "Debits"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {filteredTransactions.length === 0 ? (
                    <div className="py-10 text-center">
                      <Filter className="w-7 h-7 text-gray-200 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">
                        {transactions.length === 0 ? "No transactions yet" : "No matching transactions"}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {filteredTransactions.map((tx) => {
                        const amt = Number(tx.amount);
                        const isCredit = amt > 0;
                        return (
                          <div
                            key={tx.id}
                            className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50/50 transition-colors"
                          >
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                tx.orderId
                                  ? "bg-orange-50"
                                  : isCredit
                                  ? "bg-emerald-50"
                                  : "bg-red-50"
                              }`}
                            >
                              <TxIcon amount={amt} orderId={tx.orderId} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-700 truncate">
                                {tx.description || tx.type}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                <span>{formatDate(tx.createdAt)}</span>
                                {tx.orderId && (
                                  <span className="inline-flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded text-[10px] text-gray-500">
                                    <ShoppingCart className="w-3 h-3" />{tx.orderId.slice(-8)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span
                              className={`text-sm font-medium tabular-nums shrink-0 ${
                                isCredit ? "text-emerald-600" : "text-red-500"
                              }`}
                            >
                              {isCredit ? "+" : ""}
                              {fmt(amt)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
