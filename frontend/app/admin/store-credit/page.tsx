"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import {
  Search,
  Plus,
  Wallet,
  AlertTriangle,
  Check,
  Loader2,
  X,
  User,
  ArrowRight,
} from "lucide-react";

const inputClass =
  "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition-colors";

function fmt(amount: number) {
  return `UGX ${Number(amount || 0).toLocaleString()}`;
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

export default function StoreCreditPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingUser, setLoadingUser] = useState(false);

  const [addAmount, setAddAmount] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [adding, setAdding] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (searchQuery.length < 2) return;
    setSearching(true);
    setError(null);
    setHasSearched(true);
    try {
      const data = await api.admin.searchUsersForCredit(searchQuery);
      setSearchResults(data.users || []);
    } catch (err) {
      setError("Failed to search users");
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const selectUser = async (user: UserResult) => {
    setSelectedUser(user);
    setLoadingUser(true);
    setError(null);
    try {
      const data = await api.admin.getUserCredit(user.id);
      setUserBalance(Number(data.balance) || 0);
      setTransactions(data.transactions || []);
    } catch (err) {
      setError("Failed to load user credit details");
    } finally {
      setLoadingUser(false);
    }
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
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Store Credit Management</h1>
        <p className="text-sm text-gray-500 mt-1">Search for customers and manage their store credit balance</p>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 border border-red-200 rounded-lg flex items-center gap-3 bg-white">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700 text-sm flex-1">{error}</p>
          <button onClick={() => setError(null)}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
      )}
      {success && (
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

        {/* Search Results */}
        {hasSearched && (
          <div className="mt-4">
            {searchResults.length === 0 ? (
              <p className="text-sm text-gray-400">No users found for &ldquo;{searchQuery}&rdquo;</p>
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
                    <User className="w-5 h-5 text-gray-400 shrink-0" />
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

      {/* Selected User Details */}
      {selectedUser && (
        <>
          {/* Add Credit Form */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {selectedUser.name || selectedUser.email}
                </h2>
                <p className="text-sm text-gray-500">{selectedUser.email}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-gray-400" />
                  <span className="text-2xl font-semibold text-gray-900">{fmt(userBalance)}</span>
                </div>
                <p className="text-xs text-gray-400">current balance</p>
              </div>
            </div>

            <form onSubmit={handleAddCredit} className="border-t border-gray-100 pt-4 mt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Add Credit</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Amount (UGX) *</label>
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
                  <label className="block text-xs text-gray-500 mb-1">Description *</label>
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
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {adding ? "Adding…" : "Add Credit"}
              </button>
            </form>
          </div>

          {/* Transaction History */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Transaction History</h2>
            </div>
            {loadingUser ? (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-gray-300 mx-auto" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="p-8 text-center">
                <Wallet className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No transactions yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {transactions.map((tx) => (
                  <div key={tx.id} className="px-6 py-3 flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${Number(tx.amount) > 0 ? "bg-emerald-400" : "bg-red-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700">{tx.description || tx.type}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(tx.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        {tx.orderId && <span className="ml-2">Order: {tx.orderId.slice(-8)}</span>}
                      </p>
                    </div>
                    <span className={`text-sm font-medium tabular-nums ${Number(tx.amount) > 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {Number(tx.amount) > 0 ? "+" : ""}{fmt(Number(tx.amount))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
