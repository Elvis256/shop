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
  Award,
  Star,
  Percent,
  ShieldCheck,
  PlusCircle,
  Sparkles,
  Settings,
  RotateCcw,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { ResponsiveContainer, Area, ComposedChart, Tooltip } from "recharts";

interface DashboardStats {
  totalProducts: number;
  totalOrders: number;
  totalEarnings: number;
  balance: number;
  totalSales: number;
  rating?: number | string;
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

  const getTierProgress = (tier: string = "BRONZE", totalSales: number = 0, rating: number = 0) => {
    const currentSales = totalSales;
    const currentRating = rating;

    if (tier === "BRONZE" || !tier) {
      const orderProgress = Math.min((currentSales / 10) * 100, 100);
      const ratingProgress = Math.min((currentRating / 4.0) * 100, 100);
      const progress = Math.round((orderProgress + ratingProgress) / 2);
      return {
        currentTier: "Bronze",
        nextTier: "Silver Seller",
        ordersNeeded: Math.max(10 - currentSales, 0),
        ratingNeeded: 4.0,
        progress,
        reqString: `Complete ${currentSales}/10 sales and maintain a 4.0+ rating.`,
      };
    } else if (tier === "SILVER") {
      const orderProgress = Math.min((currentSales / 50) * 100, 100);
      const ratingProgress = Math.min((currentRating / 4.5) * 100, 100);
      const progress = Math.round((orderProgress + ratingProgress) / 2);
      return {
        currentTier: "Silver",
        nextTier: "Gold Seller",
        ordersNeeded: Math.max(50 - currentSales, 0),
        ratingNeeded: 4.5,
        progress,
        reqString: `Complete ${currentSales}/50 sales and maintain a 4.5+ rating.`,
      };
    } else {
      return {
        currentTier: "Gold",
        nextTier: "Max Level Reached",
        ordersNeeded: 0,
        ratingNeeded: 5.0,
        progress: 100,
        reqString: "You are a top-performing Gold Seller! Keep up the excellent work.",
      };
    }
  };

  const getRecommendations = (rating: number, fulfillmentRate: number, returnRate: number, totalProducts: number) => {
    const recs = [];
    
    if (rating === 0) {
      recs.push({
        id: "rating-init",
        title: "No ratings yet",
        description: "Focus on delivery speed and customer service for your first orders to build a strong 5-star profile.",
        impact: "HIGH",
        icon: Star,
        color: "text-amber-500 bg-amber-50 dark:bg-amber-500/10",
      });
    } else if (rating < 4.0) {
      recs.push({
        id: "rating-low",
        title: "Improve customer rating",
        description: "Your seller rating is below 4.0. Focus on response speed in chats and offering premium, plain discreet packaging.",
        impact: "CRITICAL",
        icon: Star,
        color: "text-red-500 bg-red-50 dark:bg-red-500/10",
      });
    }

    if (fulfillmentRate < 95) {
      recs.push({
        id: "fulfillment-low",
        title: "Optimize stock accuracy",
        description: "Fulfillment is below 95%. Update inventory quantities regularly to avoid cancelling customer orders.",
        impact: "HIGH",
        icon: Package,
        color: "text-orange-500 bg-orange-50 dark:bg-orange-500/10",
      });
    }

    if (returnRate > 5) {
      recs.push({
        id: "return-high",
        title: "Enhance product detail quality",
        description: "High return rate detected. Add size guides, clarify descriptions, and use high-quality images to reduce client returns.",
        impact: "MEDIUM",
        icon: RotateCcw,
        color: "text-blue-500 bg-blue-50 dark:bg-blue-500/10",
      });
    }

    if (totalProducts === 0) {
      recs.push({
        id: "no-products",
        title: "Catalog is empty",
        description: "Upload your first wellness product to start attracting Ugandan buyers on the platform.",
        impact: "CRITICAL",
        icon: PlusCircle,
        color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10",
      });
    }

    if (recs.length === 0) {
      recs.push({
        id: "general-grow",
        title: "Launch a promotional offer",
        description: "All metrics are excellent! Create a discount coupon or buy-one-get-one deal to boost conversion rates.",
        impact: "MEDIUM",
        icon: Tag,
        color: "text-green-500 bg-green-50 dark:bg-green-500/10",
      });
    }

    return recs;
  };

  const quickActions = [
    {
      label: "Add Product",
      description: "List a new item",
      href: "/seller/products?action=new",
      icon: PlusCircle,
      bg: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
    },
    {
      label: "View Orders",
      description: "Manage sales",
      href: "/seller/orders",
      icon: ShoppingCart,
      bg: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
    },
    {
      label: "Create Coupon",
      description: "Launch discounts",
      href: "/seller/promotions?action=new",
      icon: Percent,
      bg: "bg-pink-50 text-pink-600 dark:bg-pink-500/10 dark:text-pink-400",
    },
    {
      label: "Earnings",
      description: "Payout details",
      href: "/seller/earnings",
      icon: Wallet,
      bg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
    },
    {
      label: "Settings",
      description: "Store profile & logo",
      href: "/seller/settings",
      icon: Settings,
      bg: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
    },
  ];


  const tierConfig = {
    BRONZE: { label: "Bronze Seller", bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-300" },
    SILVER: { label: "Silver Seller", bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-300" },
    GOLD: { label: "Gold Seller", bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-400" },
  };

  const tierProgress = getTierProgress(stats.tier, stats.totalSales, stats.rating ? Number(stats.rating) : 0);

  return (
    <div className="space-y-6">
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

      {/* Upper Management Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Onboarding Checklist */}
        {onboarding && !onboarding.isComplete && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" /> Getting Started
                </h3>
                <span className="text-xs font-semibold text-indigo-600 px-2 py-0.5 bg-indigo-50 rounded-lg">{onboarding.progress}% complete</span>
              </div>
              {/* Progress Bar */}
              <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4">
                <div
                  className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${onboarding.progress}%` }}
                />
              </div>
              {/* Checklist */}
              <div className="space-y-2.5">
                {onboarding.steps.map((step) => (
                  <div key={step.key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {step.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      )}
                      <span className={`text-xs ${step.completed ? "text-gray-400 line-through" : "text-gray-700 font-medium"}`}>
                        {step.label}
                      </span>
                    </div>
                    {!step.completed && (
                      <Link
                        href={step.link}
                        className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-0.5"
                      >
                        Do this <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <Link
              href="/seller/onboarding"
              className="mt-4 block text-center py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-xs font-bold transition-all"
            >
              Complete Setup Wizard
            </Link>
          </div>
        )}

        {/* Tier & Growth Card */}
        {tierProgress && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500" /> Seller Level
                </h3>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${tierConfig[stats.tier || "BRONZE"].bg} ${tierConfig[stats.tier || "BRONZE"].text}`}>
                  {tierConfig[stats.tier || "BRONZE"].label}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Increase sales and rating to rank up, unlocking lower platform fees and higher search priority.
              </p>
              {/* Requirements Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600">Next Level: <b>{tierProgress.nextTier}</b></span>
                  <span className="font-semibold text-gray-900">{tierProgress.progress}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-amber-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${tierProgress.progress}%` }}
                  />
                </div>
                <p className="text-[11px] leading-relaxed text-gray-600 bg-amber-50/50 p-2 rounded-lg border border-amber-100/30">
                  ⚡ <b>Target:</b> {tierProgress.reqString}
                </p>
              </div>
            </div>
            <div className="text-[10px] text-gray-400 mt-3 text-center">
              Commissions: Bronze (15%) • Silver (12%) • Gold (8%)
            </div>
          </div>
        )}

        {/* Performance Optimizer */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" /> CX Optimizer
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Actionable advice based on customer satisfaction metrics:
            </p>
            <div className="space-y-2.5">
              {getRecommendations(
                stats.rating ? Number(stats.rating) : 0,
                scorecard?.fulfillmentRate ?? 100,
                scorecard?.returnRate ?? 0,
                stats.totalProducts
              ).map((rec, index) => {
                const IconComponent = rec.icon;
                return (
                  <div key={index} className="flex gap-2.5 items-start bg-gray-50/50 p-2.5 rounded-xl border border-gray-100/40">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${rec.color}`}>
                      <IconComponent className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900">{rec.title}</h4>
                      <p className="text-[10px] text-gray-500 mt-0.5 leading-normal">{rec.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
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

      {/* Quick Action Shortcuts Hub */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-sm font-bold text-gray-900 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                href={action.href}
                className="hover:border-primary/30 border border-gray-100 rounded-2xl p-4 shadow-sm transition-all duration-200 flex items-center gap-3 group bg-gray-50/20"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${action.bg}`}>
                  <Icon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-900 group-hover:text-primary transition-colors">
                    {action.label}
                  </h4>
                  <p className="text-[9px] text-gray-500 mt-0.5">{action.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
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
