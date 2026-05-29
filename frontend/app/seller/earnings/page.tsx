"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import {
  Wallet,
  TrendingUp,
  Banknote,
  Clock,
  AlertTriangle,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Download,
} from "lucide-react";
import { ResponsiveContainer, Area, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { arrayToCSV, downloadCSV } from "@/lib/utils/csv";

interface EarningsData {
  totalEarnings: number;
  balance: number;
  totalWithdrawn: number;
  pendingPayouts: number;
  recentTransactions: Array<{
    id: string;
    orderNumber: string;
    productName: string;
    amount: number;
    commission: number;
    net: number;
    date: string;
  }>;
}

interface Payout {
  id: string;
  amount: number;
  method: string;
  status: string;
  createdAt: string;
}

export default function SellerEarnings() {
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [earningsTrend, setEarningsTrend] = useState<Array<{ date: string; revenue: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("MOBILE_MONEY");
  const [requesting, setRequesting] = useState(false);
  const [payoutError, setPayoutError] = useState("");
  const [payoutSuccess, setPayoutSuccess] = useState("");

  const fetchEarnings = useCallback(async () => {
    try {
      setLoading(true);
      const [earningsData, payoutsData, analyticsData] = await Promise.all([
        apiFetch("/api/seller/earnings"),
        apiFetch("/api/seller/payouts").catch(() => ({ payouts: [] })),
        apiFetch("/api/seller/analytics?period=30").catch(() => null),
      ]);
      setEarnings(earningsData);
      setPayouts(payoutsData.payouts || []);
      if (analyticsData?.salesTrend) setEarningsTrend(analyticsData.salesTrend);
    } catch (err: any) {
      setError(err.message || "Failed to load earnings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  const requestPayout = async () => {
    const amount = parseFloat(payoutAmount);
    if (!amount || amount <= 0) {
      setPayoutError("Please enter a valid amount");
      return;
    }
    if (earnings && amount > earnings.balance) {
      setPayoutError("Amount exceeds available balance");
      return;
    }
    try {
      setRequesting(true);
      setPayoutError("");
      await apiFetch("/api/seller/payouts/request", {
        method: "POST",
        body: JSON.stringify({ amount, method: payoutMethod }),
      });
      setPayoutSuccess("Payout request submitted successfully!");
      setPayoutAmount("");
      setTimeout(() => {
        setShowPayoutModal(false);
        setPayoutSuccess("");
        fetchEarnings();
      }, 2000);
    } catch (err: any) {
      setPayoutError(err.message || "Failed to request payout");
    } finally {
      setRequesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchEarnings}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!earnings) return null;

  const statCards = [
    {
      label: "Total Earned",
      value: `UGX ${earnings.totalEarnings.toLocaleString()}`,
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Available Balance",
      value: `UGX ${earnings.balance.toLocaleString()}`,
      icon: Wallet,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Total Withdrawn",
      value: `UGX ${earnings.totalWithdrawn.toLocaleString()}`,
      icon: Banknote,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Pending Payouts",
      value: `UGX ${earnings.pendingPayouts.toLocaleString()}`,
      icon: Clock,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  const payoutStatusColors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-700",
    PROCESSING: "bg-blue-100 text-blue-700",
    COMPLETED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-xl font-bold text-gray-900">Earnings</h2>
        <button
          onClick={() => {
            setPayoutError("");
            setPayoutSuccess("");
            setPayoutAmount("");
            setShowPayoutModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <Banknote className="w-4 h-4" />
          Request Payout
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-10 h-10 ${card.bg} rounded-lg flex items-center justify-center`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="text-sm text-gray-600 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Earnings Trend Chart */}
      {earningsTrend.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">30-Day Earnings Trend</h3>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={earningsTrend}>
              <defs>
                <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="date"
                tickFormatter={(d: any) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                tick={{ fontSize: 12 }}
                stroke="#9ca3af"
              />
              <YAxis
                tickFormatter={(n: any) => Number(n) >= 1000 ? (Number(n) / 1000).toFixed(0) + "K" : String(n)}
                tick={{ fontSize: 12 }}
                stroke="#9ca3af"
              />
              <Tooltip formatter={(val: any) => [`UGX ${Number(val).toLocaleString()}`, "Revenue"]} labelFormatter={(d: any) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
              <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#earnGrad)" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Earnings Breakdown */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Earnings Breakdown</h3>
          {earnings.recentTransactions.length > 0 && (
            <button
              onClick={() => {
                const headers = ["Order", "Product", "Amount (UGX)", "Commission (UGX)", "Net (UGX)", "Date"];
                const rows = earnings.recentTransactions.map((t) => [
                  t.orderNumber, t.productName, t.amount, t.commission, t.net,
                  new Date(t.date).toLocaleDateString(),
                ]);
                downloadCSV(`earnings-${new Date().toISOString().slice(0, 10)}`, arrayToCSV(headers, rows));
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">
                  Order
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">
                  Product
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">
                  Amount
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">
                  Commission
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">
                  Net
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {earnings.recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    No earnings yet
                  </td>
                </tr>
              ) : (
                earnings.recentTransactions.map((item) => (
                  <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {item.orderNumber}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{item.productName}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      UGX {item.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-red-600">
                      -UGX {item.commission.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-green-600">
                      UGX {item.net.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(item.date).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payout History */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Payout History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">
                  Amount
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">
                  Method
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {payouts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                    No payouts yet
                  </td>
                </tr>
              ) : (
                payouts.map((payout) => (
                  <tr key={payout.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      UGX {payout.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {payout.method === "MOBILE_MONEY" ? "Mobile Money" : "Bank Transfer"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          payoutStatusColors[payout.status] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {payout.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(payout.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payout Request Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 bg-black/50 z-[400] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Request Payout</h3>
              <button
                onClick={() => setShowPayoutModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {payoutSuccess ? (
                <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-100 rounded-lg text-green-700 text-sm">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  {payoutSuccess}
                </div>
              ) : (
                <>
                  {payoutError && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">
                      {payoutError}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount (UGX)
                    </label>
                    <input
                      type="number"
                      value={payoutAmount}
                      onChange={(e) => setPayoutAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      placeholder="Enter amount"
                      min="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Available: UGX {earnings.balance.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payout Method
                    </label>
                    <select
                      value={payoutMethod}
                      onChange={(e) => setPayoutMethod(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                    >
                      <option value="MOBILE_MONEY">Mobile Money</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                    </select>
                  </div>
                </>
              )}
            </div>
            {!payoutSuccess && (
              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
                <button
                  onClick={() => setShowPayoutModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={requestPayout}
                  disabled={requesting}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {requesting ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
