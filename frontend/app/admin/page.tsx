"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  RefreshCw,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  Activity,
  ChevronRight,
  Minus,
  MoreHorizontal,
  Banknote,
  BarChart3,
  ExternalLink,
  Wallet,
  Plus,
  Settings,
  FileText,
  Share2,
  Zap,
  Scissors,
  CalendarCheck,
  UserPlus,
  Store,
  PieChart,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────── */

interface DashboardData {
  stats: {
    orders: { total: number; thisMonth: number; growth: number };
    revenue: { total: number; thisMonth: number; growth: number; currency: string };
    customers: { total: number; newThisMonth: number };
    products: {
      total: number;
      lowStock: number;
      cjDropshipping: number;
      aliexpress: number;
      local: number;
      categoryBreakdown: Array<{ category: string; count: number }>;
    };
  };
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    totalAmount: number;
    status: string;
    paymentStatus?: string;
    createdAt: string;
  }>;
  topProducts: Array<{
    productId: string;
    name: string;
    price: number;
    soldCount: number;
  }>;
  ordersByStatus: Record<string, number>;
  marketplace?: {
    directRevenue: { total: number; thisMonth: number };
    commissionRevenue: { total: number; thisMonth: number };
    vendorGrossSales: { total: number; thisMonth: number };
    platformRevenue: { total: number; thisMonth: number };
    pendingPayouts: { amount: number; count: number };
    vendors: { active: number; pending: number };
    vendorProducts: number;
  };
}

interface LowStockProduct {
  id: string;
  name: string;
  slug: string;
  stock: number;
  lowStockAlert: number;
  price: number;
  category: string | null;
}

interface SocialStats {
  activeGroupBuys: number;
  sharesToday: number;
  activePriceSlashes: number;
  dailyCheckins: number;
}

/* ─── Constants ──────────────────────────────────────────── */

const ORDER_STATUSES = [
  { key: "PENDING",    label: "Pending",    dot: "bg-gray-400",    text: "text-gray-500" },
  { key: "CONFIRMED",  label: "Confirmed",  dot: "bg-blue-500",    text: "text-blue-600" },
  { key: "PROCESSING", label: "Processing", dot: "bg-yellow-500",  text: "text-yellow-600" },
  { key: "SHIPPED",    label: "Shipped",    dot: "bg-indigo-500",  text: "text-indigo-600" },
  { key: "DELIVERED",  label: "Delivered",  dot: "bg-emerald-500", text: "text-emerald-600" },
  { key: "CANCELLED",  label: "Cancelled",  dot: "bg-red-400",     text: "text-red-500" },
  { key: "REFUNDED",   label: "Refunded",   dot: "bg-orange-400",  text: "text-orange-500" },
] as const;

const STATUS_BADGE: Record<string, string> = {
  PENDING:    "bg-gray-100 text-gray-600",
  CONFIRMED:  "bg-blue-50 text-blue-700",
  PROCESSING: "bg-yellow-50 text-yellow-700",
  SHIPPED:    "bg-indigo-50 text-indigo-700",
  DELIVERED:  "bg-emerald-50 text-emerald-700",
  CANCELLED:  "bg-red-50 text-red-600",
  REFUNDED:   "bg-orange-50 text-orange-600",
};

const PAYMENT_BADGE: Record<string, string> = {
  SUCCESSFUL: "text-emerald-600",
  PENDING:    "text-yellow-600",
  FAILED:     "text-red-500",
  REFUNDED:   "text-orange-500",
};

const PAYMENT_LABEL: Record<string, string> = {
  SUCCESSFUL: "Paid",
  PENDING:    "Unpaid",
  FAILED:     "Failed",
  REFUNDED:   "Refunded",
};

/* ─── Helpers ────────────────────────────────────────────── */

function fmt(amount: number) {
  return `UGX ${Number(amount || 0).toLocaleString()}`;
}

function timeAgo(date: string) {
  const ms = Date.now() - new Date(date).getTime();
  const m = Math.floor(ms / 60000);
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(ms / 86400000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function shortOrderNum(num: string) {
  const parts = num.split("-");
  return parts.length >= 3 ? `#${parts[parts.length - 1]}` : `#${num}`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function GrowthBadge({ value, large }: { value: number; large?: boolean }) {
  if (value === 0) return <span className={`${large ? "text-sm px-2 py-0.5 rounded-full bg-gray-50" : "text-xs"} text-gray-400 flex items-center gap-0.5`}><Minus className={large ? "w-3.5 h-3.5" : "w-3 h-3"} /> 0%</span>;
  const up = value > 0;
  return (
    <span className={`${large ? "text-sm font-semibold px-2.5 py-0.5 rounded-full" : "text-xs font-medium"} flex items-center gap-0.5 ${up ? `text-emerald-600 ${large ? "bg-emerald-50" : ""}` : `text-red-500 ${large ? "bg-red-50" : ""}`}`}>
      {up ? <TrendingUp className={large ? "w-3.5 h-3.5" : "w-3 h-3"} /> : <TrendingDown className={large ? "w-3.5 h-3.5" : "w-3 h-3"} />}
      {Math.abs(value)}%
    </span>
  );
}

const QUICK_ACTIONS = [
  { href: "/admin/products/new", icon: Plus,         label: "Add Product",      color: "text-blue-600 bg-blue-50" },
  { href: "/admin/orders",       icon: ShoppingCart,  label: "Manage Orders",    color: "text-emerald-600 bg-emerald-50" },
  { href: "/admin/coupons",      icon: Scissors,      label: "Create Coupon",    color: "text-purple-600 bg-purple-50" },
  { href: "/admin/social",       icon: Share2,        label: "Social Shopping",  color: "text-pink-600 bg-pink-50" },
  { href: "/admin/analytics",    icon: BarChart3,     label: "Analytics",        color: "text-indigo-600 bg-indigo-50" },
  { href: "/admin/settings",     icon: Settings,      label: "Settings",         color: "text-gray-600 bg-gray-100" },
  { href: "/admin/content",      icon: FileText,      label: "Blog Post",        color: "text-amber-600 bg-amber-50" },
  { href: "/admin/shipping",     icon: Truck,         label: "Shipping",         color: "text-cyan-600 bg-cyan-50" },
] as const;

/* ─── Component ──────────────────────────────────────────── */

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [socialStats, setSocialStats] = useState<SocialStats>({ activeGroupBuys: 0, sharesToday: 0, activePriceSlashes: 0, dailyCheckins: 0 });

  const loadDashboard = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [result, lowStockRes] = await Promise.all([
        api.admin.getDashboard() as unknown as DashboardData,
        api.admin.getLowStockProducts(10).catch(() => ({ products: [], total: 0 })),
      ]);
      setData(result);
      setLowStockProducts(lowStockRes.products || []);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch social stats separately — gracefully handle missing endpoint
  useEffect(() => {
    apiFetch("/api/admin/social/stats")
      .then((d: SocialStats) => setSocialStats(d))
      .catch(() => { /* endpoint may not exist yet */ });
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => loadDashboard(), 60000);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  /* ── Loading skeleton ─── */
  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="flex justify-between">
          <div><div className="h-7 w-40 bg-gray-100 rounded-md" /><div className="h-4 w-64 bg-gray-100 rounded-md mt-2" /></div>
          <div className="h-8 w-24 bg-gray-100 rounded-md" />
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
          {[1,2,3,4,5].map(i => <div key={i} className="h-32 bg-white rounded-xl border" />)}
        </div>
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-80 bg-white rounded-xl border" />
          <div className="h-80 bg-white rounded-xl border" />
        </div>
      </div>
    );
  }

  /* ── Error state ─── */
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <AlertTriangle className="w-8 h-8 text-gray-400" />
        <p className="text-sm text-gray-600">Failed to load dashboard</p>
        <p className="text-xs text-gray-400">{error}</p>
        <button onClick={() => loadDashboard(true)} className="text-sm text-gray-700 border border-gray-200 rounded-md px-4 py-1.5 hover:bg-gray-50 transition-colors">
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const pendingCount = data.ordersByStatus["PENDING"] || 0;
  const confirmedCount = data.ordersByStatus["CONFIRMED"] || 0;
  const processingCount = data.ordersByStatus["PROCESSING"] || 0;
  const shippedCount = data.ordersByStatus["SHIPPED"] || 0;
  const actionableCount = pendingCount + confirmedCount + processingCount;
  const avgOrderValue = data.stats.orders.total > 0
    ? Math.round(data.stats.revenue.total / data.stats.orders.total)
    : 0;

  // Month glance bar chart values
  const monthRevenue = data.stats.revenue.thisMonth;
  const monthOrders = data.stats.orders.thisMonth;
  const monthNewCustomers = data.stats.customers.newThisMonth;
  const glanceMax = Math.max(monthRevenue, monthOrders * 10000, monthNewCustomers * 50000, 1);

  const userName = user?.name?.split(" ")[0] || "Admin";

  return (
    <div className="space-y-5 pb-8">

      {/* ─── Header ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 rounded-xl bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 px-6 py-5 -mx-4 lg:-mx-6 -mt-4 lg:-mt-6">
        <div>
          <h1 className="text-xl font-semibold text-white">{getGreeting()}, {userName} 👋</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">
            Here&apos;s what&apos;s happening with your store today.
            {lastUpdated && <> · Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadDashboard(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-gray-300 bg-white/10 border border-white/10 rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link href="/admin/analytics"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-white bg-white/10 border border-white/10 rounded-lg hover:bg-white/20 transition-colors">
            <BarChart3 className="w-3.5 h-3.5" />
            Analytics
          </Link>
        </div>
      </div>

      {/* ─── Action Required Banner ──────────────────────── */}
      {actionableCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="w-2 h-2 bg-gray-900 rounded-full shrink-0 animate-pulse" />
          <span className="text-[13px] text-gray-700 flex-1">
            <span className="font-medium">{actionableCount} order{actionableCount !== 1 ? "s" : ""}</span> require action
          </span>
          <div className="flex items-center gap-2 text-[13px]">
            {pendingCount > 0 && (
              <Link href="/admin/orders?status=PENDING" className="text-gray-500 hover:text-gray-900 transition-colors">
                {pendingCount} pending
              </Link>
            )}
            {confirmedCount > 0 && (
              <>
                {pendingCount > 0 && <span className="text-gray-300">·</span>}
                <Link href="/admin/orders?status=CONFIRMED" className="text-gray-500 hover:text-gray-900 transition-colors">
                  {confirmedCount} confirmed
                </Link>
              </>
            )}
            {processingCount > 0 && (
              <>
                {(pendingCount > 0 || confirmedCount > 0) && <span className="text-gray-300">·</span>}
                <Link href="/admin/orders?status=PROCESSING" className="text-gray-500 hover:text-gray-900 transition-colors">
                  {processingCount} processing
                </Link>
              </>
            )}
            <Link href="/admin/orders" className="ml-1 text-gray-400 hover:text-gray-600">
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* ─── KPI Cards ───────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        {/* Revenue */}
        <Link href="/admin/analytics" className="group relative overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl border border-blue-100 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-xl" />
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Banknote className="w-5 h-5 text-blue-600" />
            </div>
            <GrowthBadge value={data.stats.revenue.growth} large />
          </div>
          <p className="text-[22px] font-bold text-gray-900 leading-tight truncate">{fmt(data.stats.revenue.total)}</p>
          <p className="text-xs text-gray-500 mt-1">{fmt(data.stats.revenue.thisMonth)} this month</p>
          <p className="text-[11px] text-blue-600/70 mt-0.5">Avg order: {fmt(avgOrderValue)}</p>
        </Link>

        {/* Orders */}
        <Link href="/admin/orders" className="group relative overflow-hidden bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl border border-emerald-100 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-l-xl" />
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-emerald-600" />
            </div>
            <GrowthBadge value={data.stats.orders.growth} large />
          </div>
          <p className="text-[22px] font-bold text-gray-900 leading-tight">{data.stats.orders.total}</p>
          <p className="text-xs text-gray-500 mt-1">{data.stats.orders.thisMonth} this month</p>
        </Link>

        {/* Customers */}
        <Link href="/admin/customers" className="group relative overflow-hidden bg-gradient-to-br from-violet-50 to-violet-100/50 rounded-xl border border-violet-100 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500 rounded-l-xl" />
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-violet-600" />
            </div>
            {data.stats.customers.newThisMonth > 0 && (
              <span className="text-sm font-semibold px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-600 flex items-center gap-0.5">
                <UserPlus className="w-3.5 h-3.5" />+{data.stats.customers.newThisMonth}
              </span>
            )}
          </div>
          <p className="text-[22px] font-bold text-gray-900 leading-tight">{data.stats.customers.total}</p>
          <p className="text-xs text-gray-500 mt-1">{data.stats.customers.newThisMonth} new this month</p>
        </Link>

        {/* Products */}
        <Link href="/admin/products" className="group relative overflow-hidden bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl border border-amber-100 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 rounded-l-xl" />
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Package className="w-5 h-5 text-amber-600" />
            </div>
            {data.stats.products.lowStock > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-500">{data.stats.products.lowStock} low</span>
            )}
          </div>
          <p className="text-[22px] font-bold text-gray-900 leading-tight">{data.stats.products.total}</p>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
            <span>{data.stats.products.local} local</span>
            <span className="text-gray-300">·</span>
            <span>{data.stats.products.cjDropshipping} CJ</span>
            {data.stats.products.aliexpress > 0 && <><span className="text-gray-300">·</span><span>{data.stats.products.aliexpress} AE</span></>}
          </div>
        </Link>

        {/* Today's Activity */}
        <div className="col-span-2 xl:col-span-1 relative overflow-hidden bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 text-white">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/30 rounded-l-xl" />
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
              <Activity className="w-5 h-5 text-white/80" />
            </div>
            <span className="text-[13px] font-medium text-white/70">Today</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Orders</span>
              <span className="text-sm font-bold tabular-nums">{data.stats.orders.thisMonth > 0 ? Math.max(1, Math.round(data.stats.orders.thisMonth / new Date().getDate())) : 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Revenue</span>
              <span className="text-sm font-bold tabular-nums truncate ml-2">{fmt(data.stats.revenue.thisMonth > 0 ? Math.round(data.stats.revenue.thisMonth / new Date().getDate()) : 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Signups</span>
              <span className="text-sm font-bold tabular-nums">{data.stats.customers.newThisMonth > 0 ? Math.max(1, Math.round(data.stats.customers.newThisMonth / new Date().getDate())) : 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── This Month at a Glance ──────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-[13px] font-medium text-gray-900">This Month at a Glance</h2>
        </div>
        <div className="p-4 space-y-3">
          {/* Revenue bar */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-24 shrink-0">Revenue</span>
            <div className="flex-1 h-7 bg-gray-50 rounded-full overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-700"
                style={{ width: `${Math.max(4, (monthRevenue / glanceMax) * 100)}%` }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-gray-600 tabular-nums">{fmt(monthRevenue)}</span>
            </div>
          </div>
          {/* Orders bar */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-24 shrink-0">Orders</span>
            <div className="flex-1 h-7 bg-gray-50 rounded-full overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700"
                style={{ width: `${Math.max(4, ((monthOrders * 10000) / glanceMax) * 100)}%` }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-gray-600 tabular-nums">{monthOrders} orders</span>
            </div>
          </div>
          {/* New Customers bar */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-24 shrink-0">New Customers</span>
            <div className="flex-1 h-7 bg-gray-50 rounded-full overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-violet-400 rounded-full transition-all duration-700"
                style={{ width: `${Math.max(4, ((monthNewCustomers * 50000) / glanceMax) * 100)}%` }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-gray-600 tabular-nums">{monthNewCustomers} customers</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Revenue Streams ──────────────────────────────── */}
      {data.marketplace && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-blue-500" />
              <h2 className="text-[13px] font-medium text-gray-900">Revenue Streams</h2>
            </div>
            <Link href="/admin/sellers" className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1">
              Manage Sellers <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Revenue breakdown cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-gray-100">
            {/* Direct Sales */}
            <div className="bg-white p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Your Products</span>
              </div>
              <p className="text-lg font-bold text-gray-900">{fmt(data.marketplace.directRevenue.total)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{fmt(data.marketplace.directRevenue.thisMonth)} this month</p>
            </div>

            {/* Commission Revenue */}
            <div className="bg-white p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Commissions</span>
              </div>
              <p className="text-lg font-bold text-gray-900">{fmt(data.marketplace.commissionRevenue.total)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{fmt(data.marketplace.commissionRevenue.thisMonth)} this month</p>
            </div>

            {/* Total Platform Revenue */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-4 text-white">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-white/60" />
                <span className="text-[11px] text-white/60 uppercase tracking-wider font-medium">Platform Total</span>
              </div>
              <p className="text-lg font-bold">{fmt(data.marketplace.platformRevenue.total)}</p>
              <p className="text-xs text-white/50 mt-0.5">{fmt(data.marketplace.platformRevenue.thisMonth)} this month</p>
            </div>

            {/* Pending Payouts */}
            <div className="bg-white p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-orange-500" />
                <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Vendor Payouts Due</span>
              </div>
              <p className="text-lg font-bold text-gray-900">{fmt(data.marketplace.pendingPayouts.amount)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{data.marketplace.pendingPayouts.count} pending request{data.marketplace.pendingPayouts.count !== 1 ? "s" : ""}</p>
            </div>
          </div>

          {/* Vendor summary bar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-gray-400" />
                <span className="font-medium text-gray-700">{data.marketplace.vendors.active}</span> active vendor{data.marketplace.vendors.active !== 1 ? "s" : ""}
              </span>
              {data.marketplace.vendors.pending > 0 && (
                <Link href="/admin/sellers?status=PENDING" className="flex items-center gap-1 text-yellow-600 hover:text-yellow-700 transition-colors">
                  <Clock className="w-3 h-3" />
                  {data.marketplace.vendors.pending} pending approval
                </Link>
              )}
              <span>{data.marketplace.vendorProducts} vendor product{data.marketplace.vendorProducts !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-center gap-2">
              {data.marketplace.pendingPayouts.count > 0 && (
                <Link href="/admin/payouts" className="text-xs text-orange-600 hover:text-orange-700 font-medium transition-colors flex items-center gap-1">
                  Process Payouts <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          </div>

          {/* Revenue split visual bar */}
          {data.marketplace.platformRevenue.total > 0 && (
            <div className="px-4 py-3 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[11px] text-gray-400">Revenue Split</span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-blue-500 transition-all duration-700"
                  style={{ width: `${(data.marketplace.directRevenue.total / (data.marketplace.directRevenue.total + (data.marketplace.vendorGrossSales?.total || 0))) * 100}%` }}
                  title={`Direct Sales: ${fmt(data.marketplace.directRevenue.total)}`}
                />
                <div
                  className="h-full bg-emerald-500 transition-all duration-700"
                  style={{ width: `${(data.marketplace.commissionRevenue.total / (data.marketplace.directRevenue.total + (data.marketplace.vendorGrossSales?.total || 0))) * 100}%` }}
                  title={`Commissions: ${fmt(data.marketplace.commissionRevenue.total)}`}
                />
                <div
                  className="h-full bg-gray-300 transition-all duration-700"
                  title={`Vendor Earnings: ${fmt((data.marketplace.vendorGrossSales?.total || 0) - data.marketplace.commissionRevenue.total)}`}
                />
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-[11px] text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Direct Sales</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Your Commission</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300" /> Vendor Earnings</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Social Shopping Stats ────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-pink-500" />
            <h2 className="text-[13px] font-medium text-gray-900">Social Shopping</h2>
          </div>
          <Link href="/admin/social" className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1">
            Manage <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-gray-100">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-pink-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 leading-tight">{socialStats.activeGroupBuys}</p>
              <p className="text-[11px] text-gray-400">Active Group Buys</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <Share2 className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 leading-tight">{socialStats.sharesToday}</p>
              <p className="text-[11px] text-gray-400">Shares Today</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-orange-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 leading-tight">{socialStats.activePriceSlashes}</p>
              <p className="text-[11px] text-gray-400">Active Price Slashes</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <CalendarCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 leading-tight">{socialStats.dailyCheckins}</p>
              <p className="text-[11px] text-gray-400">Daily Check-ins</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Order Pipeline ──────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-[13px] font-medium text-gray-900">Order Pipeline</h2>
          <Link href="/admin/orders" className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1">
            All orders <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-4 lg:grid-cols-7 divide-x divide-gray-100">
          {ORDER_STATUSES.map(({ key, label, dot, text }) => {
            const count = data.ordersByStatus[key] || 0;
            return (
              <Link key={key} href={`/admin/orders?status=${key}`}
                className="flex flex-col items-center py-5 hover:bg-gray-50 hover:scale-[1.02] transition-all">
                <div className={`w-2.5 h-2.5 rounded-full ${dot} mb-2.5`} />
                <span className={`text-xl font-bold ${text}`}>{count}</span>
                <span className="text-[11px] text-gray-400 mt-0.5">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ─── Main Grid ───────────────────────────────────── */}
      <div className="grid lg:grid-cols-5 gap-4">

        {/* ── Recent Orders (3/5) ── */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h2 className="text-[13px] font-medium text-gray-900">Recent Orders</h2>
            <Link href="/admin/orders" className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {data.recentOrders.length === 0 ? (
            <div className="py-16 text-center">
              <ShoppingCart className="w-8 h-8 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No orders yet</p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="grid grid-cols-[1fr_100px_90px_60px] gap-2 px-4 py-2 text-[11px] text-gray-400 uppercase tracking-wider border-b border-gray-50 font-medium">
                <span>Order</span>
                <span className="text-right">Amount</span>
                <span className="text-center">Status</span>
                <span />
              </div>
              {/* Table rows */}
              <div className="divide-y divide-gray-50">
                {data.recentOrders.slice(0, 8).map((order, idx) => {
                  const badgeCls = STATUS_BADGE[order.status] || STATUS_BADGE.PENDING;
                  const payColor = order.paymentStatus ? PAYMENT_BADGE[order.paymentStatus] || "text-gray-400" : "text-gray-400";
                  const payLabel = order.paymentStatus ? PAYMENT_LABEL[order.paymentStatus] || order.paymentStatus : "";
                  return (
                    <div key={order.id} className={`grid grid-cols-[1fr_100px_90px_60px] gap-2 items-center px-4 py-2.5 hover:bg-blue-50/30 transition-colors ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}>
                      <div className="min-w-0 flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                          <Package className="w-3.5 h-3.5 text-gray-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[13px] font-medium text-gray-900">{shortOrderNum(order.orderNumber)}</span>
                            {payLabel && <span className={`text-[11px] ${payColor}`}>· {payLabel}</span>}
                          </div>
                          <p className="text-xs text-gray-400 truncate">{order.customerName} · {timeAgo(order.createdAt)}</p>
                        </div>
                      </div>
                      <span className="text-[13px] font-medium text-gray-900 text-right tabular-nums">{fmt(Number(order.totalAmount))}</span>
                      <div className="flex justify-center">
                        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-md ${badgeCls}`}>
                          {order.status.charAt(0) + order.status.slice(1).toLowerCase()}
                        </span>
                      </div>
                      <div className="flex justify-end">
                        <Link href={`/admin/orders/${order.id}`} className="text-gray-300 hover:text-gray-600 transition-colors p-1 rounded-md hover:bg-gray-100">
                          <ArrowUpRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
              {data.stats.orders.total > 8 && (
                <div className="px-4 py-2.5 border-t border-gray-100">
                  <Link href="/admin/orders"
                    className="flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors py-1">
                    View all {data.stats.orders.total} orders <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Right Sidebar (2/5) ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Top Products */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-[13px] font-medium text-gray-900">Top Products</h2>
              <Link href="/admin/products" className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1">
                All <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {data.topProducts.length === 0 ? (
              <div className="py-10 text-center">
                <Package className="w-6 h-6 text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No sales data yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {data.topProducts.slice(0, 5).map((product, i) => (
                  <div key={product.productId} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                    <span className="text-xs text-gray-300 w-4 text-right tabular-nums font-medium shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-gray-900 truncate">{product.name}</p>
                      <p className="text-xs text-gray-400">{fmt(Number(product.price))}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[13px] font-medium text-gray-900 tabular-nums">{product.soldCount}</span>
                      <span className="text-xs text-gray-400 ml-0.5">sold</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Low Stock */}
          {lowStockProducts.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
                  <h2 className="text-[13px] font-medium text-gray-900">Low Stock Alerts</h2>
                  <span className="text-[11px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">{lowStockProducts.length} product{lowStockProducts.length !== 1 ? "s" : ""} low on stock</span>
                </div>
                <Link href="/admin/inventory" className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1">
                  Manage <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="divide-y divide-gray-50">
                {lowStockProducts.map((p) => (
                  <Link key={p.id} href={`/admin/products/${p.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.stock === 0 ? "bg-red-400" : "bg-yellow-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-gray-700 truncate">{p.name}</p>
                      {p.category && <p className="text-[11px] text-gray-400">{p.category}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-xs tabular-nums font-medium ${p.stock === 0 ? "text-red-500" : "text-yellow-600"}`}>
                        {p.stock === 0 ? "Out of stock" : `${p.stock} left`}
                      </span>
                      <p className="text-[10px] text-gray-400">threshold: {p.lowStockAlert}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Categories */}
          {data.stats.products.categoryBreakdown?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h2 className="text-[13px] font-medium text-gray-900">Categories</h2>
                <Link href="/admin/categories" className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1">
                  Manage <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="px-4 py-3 space-y-2.5">
                {data.stats.products.categoryBreakdown.map((cat) => {
                  const pct = data.stats.products.total > 0 ? Math.round((cat.count / data.stats.products.total) * 100) : 0;
                  return (
                    <div key={cat.category}>
                      <div className="flex items-center justify-between text-[13px] mb-1">
                        <span className="text-gray-700">{cat.category}</span>
                        <span className="text-gray-400 text-xs tabular-nums">{cat.count}</span>
                      </div>
                      <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gray-900 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Month Summary */}
          <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-indigo-900 rounded-xl p-5 text-white">
            <h3 className="text-[13px] font-medium text-gray-400 mb-4">This Month</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-2xl font-bold">{data.stats.orders.thisMonth}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Orders</p>
              </div>
              <div>
                <p className="text-2xl font-bold truncate">{fmt(data.stats.revenue.thisMonth)}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Revenue</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{data.stats.customers.newThisMonth}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">New customers</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ─── Quick Actions ────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-[13px] font-medium text-gray-900">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-gray-100">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex items-center gap-3 px-4 py-3.5 bg-white hover:bg-gray-50 hover:translate-x-0.5 transition-all"
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${action.color}`}>
                <action.icon className="w-4.5 h-4.5" />
              </div>
              <span className="text-[13px] font-medium text-gray-700">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
