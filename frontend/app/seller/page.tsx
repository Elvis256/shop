"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import {
  Package,
  ShoppingCart,
  Wallet,
  TrendingUp,
  Clock,
  CheckCircle2,
  Truck,
  AlertTriangle,
  ShieldAlert,
  Circle,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { ResponsiveContainer, Area, ComposedChart, Tooltip } from "recharts";

interface DashboardStats {
  totalProducts: number;
  totalOrders: number;
  totalEarnings: number;
  balance: number;
  tier?: "BRONZE" | "SILVER" | "GOLD";
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    items: number;
    total: number;
    status: string;
    createdAt: string;
  }>;
  topProducts: Array<{
    name: string;
    unitsSold: number;
    revenue: number;
  }>;
}

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  SHIPPED: "bg-purple-100 text-purple-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function SellerDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [sparkline, setSparkline] = useState<Array<{ date: string; revenue: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<any[]>([]);
  const [scorecard, setScorecard] = useState<any>(null);
  const [onboarding, setOnboarding] = useState<{
    steps: Array<{ key: string; label: string; completed: boolean; link: string }>;
    progress: number;
    isComplete: boolean;
  } | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const [data, analyticsData] = await Promise.all([
        apiFetch("/api/seller/dashboard"),
        apiFetch("/api/seller/analytics?period=7").catch(() => null),
      ]);
      setStats(data);
      if (analyticsData?.salesTrend) setSparkline(analyticsData.salesTrend);

      // Fetch warnings, scorecard, and onboarding status in parallel
      apiFetch("/api/seller/warnings").then((d) => setWarnings(d.warnings || [])).catch(() => {});
      apiFetch("/api/seller/scorecard").then((d) => setScorecard(d.scorecard)).catch(() => {});
      apiFetch("/api/seller/onboarding-status").then((d) => setOnboarding(d)).catch(() => {});
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

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
            onClick={fetchDashboard}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    {
      label: "Total Products",
      value: stats.totalProducts.toString(),
      icon: Package,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Total Orders",
      value: stats.totalOrders.toString(),
      icon: ShoppingCart,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Total Earnings",
      value: `UGX ${stats.totalEarnings.toLocaleString()}`,
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Available Balance",
      value: `UGX ${stats.balance.toLocaleString()}`,
      icon: Wallet,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  const tierConfig = {
    BRONZE: { label: "Bronze Seller", bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-300" },
    SILVER: { label: "Silver Seller", bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-300" },
    GOLD: { label: "Gold Seller", bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-400" },
  };

  return (
    <div className="space-y-6">
      {/* Tier Badge */}
      {stats.tier && (
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${tierConfig[stats.tier].bg} ${tierConfig[stats.tier].text} ${tierConfig[stats.tier].border}`}>
          <span className="text-sm font-semibold">{tierConfig[stats.tier].label}</span>
          {stats.tier === "GOLD" && <span>★</span>}
          {stats.tier === "SILVER" && <span>✦</span>}
        </div>
      )}

      {/* Onboarding Checklist */}
      {onboarding && !onboarding.isComplete && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Getting Started</h3>
            <span className="text-sm font-medium text-primary">{onboarding.progress}% complete</span>
          </div>
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-5">
            <div
              className="bg-primary h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${onboarding.progress}%` }}
            />
          </div>
          {/* Checklist */}
          <div className="space-y-3">
            {onboarding.steps.map((step) => (
              <div key={step.key} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {step.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" />
                  )}
                  <span className={`text-sm ${step.completed ? "text-gray-500 line-through" : "text-gray-900 font-medium"}`}>
                    {step.label}
                  </span>
                </div>
                {!step.completed && (
                  <Link
                    href={step.link}
                    className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1"
                  >
                    Do this <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warning Banner */}
      {warnings.filter((w: any) => !w.acknowledgedAt && (!w.expiresAt || new Date(w.expiresAt) > new Date())).length > 0 && (
        <div className="space-y-2">
          {warnings.filter((w: any) => !w.acknowledgedAt && (!w.expiresAt || new Date(w.expiresAt) > new Date())).map((w: any) => (
            <div key={w.id} className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800">
                  {w.type.replace("_", " ")}: {w.reason}
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Issued {new Date(w.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={async () => {
                  try {
                    await apiFetch(`/api/seller/warnings/${w.id}/acknowledge`, { method: "PUT" });
                    setWarnings((prev) => prev.map((ww: any) => ww.id === w.id ? { ...ww, acknowledgedAt: new Date().toISOString() } : ww));
                  } catch {}
                }}
                className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Acknowledge
              </button>
            </div>
          ))}
        </div>
      )}

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

      {/* 7-Day Sales Sparkline */}
      {sparkline.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-900">7-Day Sales</h2>
            <p className="text-sm text-gray-500">
              UGX {sparkline.reduce((s, d) => s + d.revenue, 0).toLocaleString()} total
            </p>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <ComposedChart data={sparkline}>
              <defs>
                <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip
                formatter={(val: any) => [`UGX ${Number(val).toLocaleString()}`, "Revenue"]}
                labelFormatter={(d: any) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              />
              <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="url(#sparkGrad)" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Performance Scorecard */}
      {scorecard && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" /> Performance
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className={`rounded-lg p-4 text-center ${scorecard.fulfillmentRate < 80 ? "bg-red-50" : "bg-green-50"}`}>
              <p className="text-xs text-gray-500">Fulfillment Rate</p>
              <p className={`text-2xl font-bold ${scorecard.fulfillmentRate < 80 ? "text-red-600" : "text-green-600"}`}>
                {scorecard.fulfillmentRate}%
              </p>
            </div>
            <div className={`rounded-lg p-4 text-center ${scorecard.returnRate > 10 ? "bg-red-50" : "bg-green-50"}`}>
              <p className="text-xs text-gray-500">Return Rate</p>
              <p className={`text-2xl font-bold ${(scorecard.returnRate ?? 0) > 10 ? "text-red-600" : "text-green-600"}`}>
                {scorecard.returnRate ?? 0}%
              </p>
            </div>
            <div className={`rounded-lg p-4 text-center ${(scorecard.customerRating ?? 0) < 3.0 ? "bg-red-50" : "bg-green-50"}`}>
              <p className="text-xs text-gray-500">Rating</p>
              <p className={`text-2xl font-bold ${(scorecard.customerRating ?? 0) < 3.0 ? "text-red-600" : "text-green-600"}`}>
                {(((scorecard.customerRating ?? 0))).toFixed(1)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-xs text-gray-500">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">{scorecard.totalOrders}</p>
            </div>
          </div>
          {scorecard.flags?.length > 0 && (
            <div className="mt-3 space-y-1">
              {scorecard.flags.map((flag: string, i: number) => (
                <p key={i} className="text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {flag}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">
                    Order
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">
                    Customer
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">
                    Items
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">
                    Total
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
                {stats.recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                      No orders yet
                    </td>
                  </tr>
                ) : (
                  stats.recentOrders.map((order) => (
                    <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {order.orderNumber}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{order.customerName}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{order.items}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        UGX {order.total.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            statusColors[order.status] || "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {order.status === "PENDING" && <Clock className="w-3 h-3" />}
                          {order.status === "PROCESSING" && <Package className="w-3 h-3" />}
                          {order.status === "SHIPPED" && <Truck className="w-3 h-3" />}
                          {order.status === "DELIVERED" && <CheckCircle2 className="w-3 h-3" />}
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Top Products</h2>
          </div>
          <div className="p-6 space-y-4">
            {stats.topProducts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No sales yet</p>
            ) : (
              stats.topProducts.map((product, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                      <p className="text-xs text-gray-500">{product.unitsSold} sold</p>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-gray-900 flex-shrink-0 ml-2">
                    UGX {product.revenue.toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
