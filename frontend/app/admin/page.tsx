"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  ShoppingCart,
  DollarSign,
  Users,
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Plus,
  Eye,
  Percent,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  Activity,
  Calendar,
  Bell,
  CreditCard,
  Banknote,
  UserPlus,
  BarChart3,
  Layers,
  ChevronRight,
  Circle,
} from "lucide-react";

interface DashboardData {
  stats: {
    orders: { total: number; thisMonth: number; growth: number };
    revenue: { total: number; thisMonth: number; growth: number; currency: string };
    customers: { total: number; newThisMonth: number };
    products: { total: number; lowStock: number };
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
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; icon: typeof Clock }> = {
  PENDING:    { label: "Pending",    bg: "bg-gray-100",    text: "text-gray-600",    icon: Clock },
  CONFIRMED:  { label: "Confirmed",  bg: "bg-indigo-100",  text: "text-indigo-700",  icon: CheckCircle2 },
  PROCESSING: { label: "Processing", bg: "bg-yellow-100",  text: "text-yellow-700",  icon: Activity },
  SHIPPED:    { label: "Shipped",    bg: "bg-blue-100",    text: "text-blue-700",    icon: Truck },
  DELIVERED:  { label: "Delivered",  bg: "bg-emerald-100", text: "text-emerald-700", icon: CheckCircle2 },
  CANCELLED:  { label: "Cancelled",  bg: "bg-red-100",     text: "text-red-600",     icon: XCircle },
  REFUNDED:   { label: "Refunded",   bg: "bg-orange-100",  text: "text-orange-700",  icon: Banknote },
};

const PAYMENT_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  SUCCESSFUL: { label: "Paid",    bg: "bg-emerald-100", text: "text-emerald-700" },
  PENDING:    { label: "Pending", bg: "bg-yellow-100",  text: "text-yellow-700" },
  FAILED:     { label: "Failed",  bg: "bg-red-100",     text: "text-red-600" },
  REFUNDED:   { label: "Refunded",bg: "bg-orange-100",  text: "text-orange-700" },
};

function formatCurrency(amount: number) {
  return `USh ${Number(amount).toLocaleString()}`;
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await api.admin.getDashboard() as unknown as DashboardData;
      setData(result);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => loadDashboard(), 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadDashboard]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 bg-gray-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-white rounded-xl shadow-sm animate-pulse border" />)}
        </div>
        <div className="h-48 bg-white rounded-xl animate-pulse border" />
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-72 bg-white rounded-xl animate-pulse border" />
          <div className="h-72 bg-white rounded-xl animate-pulse border" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="p-4 bg-red-100 rounded-full">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-gray-900">Failed to load dashboard</p>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
        </div>
        <button onClick={() => loadDashboard(true)} className="btn-primary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Try Again
        </button>
      </div>
    );
  }

  if (!data) return null;

  const pendingCount = data.ordersByStatus["PENDING"] || 0;
  const processingCount = data.ordersByStatus["PROCESSING"] || 0;
  const needsAttention = pendingCount + processingCount + data.stats.products.lowStock;

  return (
    <div className="space-y-6 pb-8">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {getGreeting()} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Here&apos;s what&apos;s happening in your store today.
            {lastUpdated && (
              <span className="ml-2 text-gray-400 text-xs">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-300 text-primary"
            />
            Auto-refresh
          </label>
          <button
            onClick={() => loadDashboard(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            href="/admin/analytics"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Analytics
          </Link>
        </div>
      </div>

      {/* ── Needs Attention (only shows if there are issues) ─ */}
      {needsAttention > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-amber-600" />
            <span className="font-semibold text-amber-900 text-sm">
              {needsAttention} item{needsAttention !== 1 ? "s" : ""} need your attention
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {pendingCount > 0 && (
              <Link href="/admin/orders?status=PENDING"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-sm text-amber-800 hover:bg-amber-100 transition-colors font-medium">
                <Clock className="w-3.5 h-3.5" />
                {pendingCount} pending order{pendingCount !== 1 ? "s" : ""}
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
            {processingCount > 0 && (
              <Link href="/admin/orders?status=PROCESSING"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-sm text-amber-800 hover:bg-amber-100 transition-colors font-medium">
                <Activity className="w-3.5 h-3.5" />
                {processingCount} being processed
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
            {data.stats.products.lowStock > 0 && (
              <Link href="/admin/inventory?filter=low"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-sm text-amber-800 hover:bg-amber-100 transition-colors font-medium">
                <Package className="w-3.5 h-3.5" />
                {data.stats.products.lowStock} low stock product{data.stats.products.lowStock !== 1 ? "s" : ""}
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── Stat Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Revenue */}
        <div className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-emerald-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            {data.stats.revenue.growth !== 0 && (
              <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                data.stats.revenue.growth >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
              }`}>
                {data.stats.revenue.growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(data.stats.revenue.growth)}%
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-gray-900 truncate">{formatCurrency(data.stats.revenue.total)}</p>
          <p className="text-xs text-gray-500 mt-1">Total Revenue</p>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">This month</span>
            <span className="text-xs font-semibold text-gray-700">{formatCurrency(data.stats.revenue.thisMonth)}</span>
          </div>
        </div>

        {/* Orders */}
        <div className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-blue-100 rounded-lg">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
            </div>
            {data.stats.orders.growth !== 0 && (
              <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                data.stats.orders.growth >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
              }`}>
                {data.stats.orders.growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(data.stats.orders.growth)}%
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-gray-900">{data.stats.orders.total.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">Total Orders</p>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">This month</span>
            <span className="text-xs font-semibold text-gray-700">{data.stats.orders.thisMonth} orders</span>
          </div>
        </div>

        {/* Customers */}
        <div className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-violet-100 rounded-lg">
              <Users className="w-5 h-5 text-violet-600" />
            </div>
            {data.stats.customers.newThisMonth > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                <UserPlus className="w-3 h-3" />
                +{data.stats.customers.newThisMonth}
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-gray-900">{data.stats.customers.total.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">Total Customers</p>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">New this month</span>
            <span className="text-xs font-semibold text-gray-700">{data.stats.customers.newThisMonth} new</span>
          </div>
        </div>

        {/* Products */}
        <div className={`rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow ${
          data.stats.products.lowStock > 0 ? "bg-amber-50 border-amber-200" : "bg-white"
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`p-2.5 rounded-lg ${data.stats.products.lowStock > 0 ? "bg-amber-100" : "bg-amber-100"}`}>
              <Package className={`w-5 h-5 ${data.stats.products.lowStock > 0 ? "text-amber-600" : "text-amber-600"}`} />
            </div>
            {data.stats.products.lowStock > 0 && (
              <Link href="/admin/inventory?filter=low"
                className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 hover:bg-amber-300 transition-colors">
                <AlertTriangle className="w-3 h-3" />
                {data.stats.products.lowStock} low
              </Link>
            )}
          </div>
          <p className="text-2xl font-bold text-gray-900">{data.stats.products.total.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">Active Products</p>
          <div className="mt-3 pt-3 border-t border-amber-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">Stock health</span>
            <span className={`text-xs font-semibold ${data.stats.products.lowStock > 0 ? "text-amber-700" : "text-emerald-600"}`}>
              {data.stats.products.lowStock > 0 ? `${data.stats.products.lowStock} need restock` : "All stocked ✓"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ─────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link href="/admin/products/new"
          className="group flex flex-col items-center gap-2 p-4 bg-white rounded-xl border shadow-sm hover:shadow-md hover:border-blue-200 hover:bg-blue-50 transition-all active:scale-95">
          <div className="p-2.5 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
            <Plus className="w-5 h-5 text-blue-600" />
          </div>
          <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">Add Product</span>
        </Link>
        <Link href="/admin/orders"
          className="group flex flex-col items-center gap-2 p-4 bg-white rounded-xl border shadow-sm hover:shadow-md hover:border-emerald-200 hover:bg-emerald-50 transition-all active:scale-95">
          <div className="relative p-2.5 bg-emerald-100 rounded-lg group-hover:bg-emerald-200 transition-colors">
            <ShoppingCart className="w-5 h-5 text-emerald-600" />
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {pendingCount > 9 ? "9+" : pendingCount}
              </span>
            )}
          </div>
          <span className="text-sm font-medium text-gray-700 group-hover:text-emerald-700">Orders</span>
        </Link>
        <Link href="/admin/coupons"
          className="group flex flex-col items-center gap-2 p-4 bg-white rounded-xl border shadow-sm hover:shadow-md hover:border-purple-200 hover:bg-purple-50 transition-all active:scale-95">
          <div className="p-2.5 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
            <Percent className="w-5 h-5 text-purple-600" />
          </div>
          <span className="text-sm font-medium text-gray-700 group-hover:text-purple-700">Coupons</span>
        </Link>
        <Link href="/admin/inventory"
          className="group flex flex-col items-center gap-2 p-4 bg-white rounded-xl border shadow-sm hover:shadow-md hover:border-amber-200 hover:bg-amber-50 transition-all active:scale-95">
          <div className="relative p-2.5 bg-amber-100 rounded-lg group-hover:bg-amber-200 transition-colors">
            <Layers className="w-5 h-5 text-amber-600" />
            {data.stats.products.lowStock > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {data.stats.products.lowStock > 9 ? "9+" : data.stats.products.lowStock}
              </span>
            )}
          </div>
          <span className="text-sm font-medium text-gray-700 group-hover:text-amber-700">Inventory</span>
        </Link>
      </div>

      {/* ── Main Two-Column Grid ───────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-5">

        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-gray-500" />
              <h2 className="font-semibold text-gray-900">Recent Orders</h2>
              {data.recentOrders.length > 0 && (
                <span className="text-xs text-gray-400">({data.recentOrders.length})</span>
              )}
            </div>
            <Link href="/admin/orders"
              className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 font-medium transition-colors">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {data.recentOrders.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingCart className="w-8 h-8 text-gray-300" />
              </div>
              <p className="font-medium text-gray-500">No orders yet</p>
              <p className="text-sm text-gray-400 mt-1">Orders will appear here when customers purchase</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.recentOrders.slice(0, 6).map((order) => {
                const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
                const paymentCfg = order.paymentStatus ? PAYMENT_CONFIG[order.paymentStatus] : null;
                const StatusIcon = statusCfg.icon;
                return (
                  <div key={order.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                    {/* Status dot */}
                    <div className={`w-2 h-2 rounded-full shrink-0 ${statusCfg.bg.replace("bg-", "bg-").replace("-100", "-400")}`} />
                    {/* Order info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 text-sm">#{order.orderNumber}</span>
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${statusCfg.bg} ${statusCfg.text}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusCfg.label}
                        </span>
                        {paymentCfg && (
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${paymentCfg.bg} ${paymentCfg.text}`}>
                            <CreditCard className="w-3 h-3" />
                            {paymentCfg.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {order.customerName} · {timeAgo(order.createdAt)}
                      </p>
                    </div>
                    {/* Amount + action */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-semibold text-gray-900 text-sm">{formatCurrency(Number(order.totalAmount))}</span>
                      <Link href={`/admin/orders/${order.id}`}
                        className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 hover:bg-primary hover:text-white rounded-lg text-xs font-medium text-gray-600 transition-colors">
                        <Eye className="w-3 h-3" />
                        View
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {data.recentOrders.length > 0 && (
            <div className="px-5 py-3 bg-gray-50 border-t">
              <Link href="/admin/orders"
                className="flex items-center justify-center gap-2 w-full py-2 text-sm text-primary font-medium hover:bg-primary/5 rounded-lg transition-colors">
                View all {data.stats.orders.total} orders <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-5">

          {/* Top Products */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-500" />
                <h2 className="font-semibold text-gray-900">Top Products</h2>
              </div>
              <Link href="/admin/products"
                className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1">
                All <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {data.topProducts.length === 0 ? (
              <div className="p-8 text-center">
                <Package className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No sales yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {data.topProducts.slice(0, 5).map((product, i) => (
                  <div key={product.productId} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                      i === 0 ? "bg-yellow-400 text-white" :
                      i === 1 ? "bg-gray-300 text-white" :
                      i === 2 ? "bg-amber-600 text-white" :
                      "bg-gray-100 text-gray-500"
                    }`}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                      <p className="text-xs text-gray-400">{formatCurrency(Number(product.price))}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900">{product.soldCount}</p>
                      <p className="text-[11px] text-gray-400">sold</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Today's Snapshot */}
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-5 text-white">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 opacity-80" />
              <span className="text-sm font-medium opacity-90">Month Summary</span>
            </div>
            <div className="space-y-3">
              {[
                { label: "Orders", value: data.stats.orders.thisMonth.toString(), icon: ShoppingCart },
                { label: "Revenue", value: formatCurrency(data.stats.revenue.thisMonth), icon: DollarSign },
                { label: "New Customers", value: data.stats.customers.newThisMonth.toString(), icon: UserPlus },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center justify-between bg-white/10 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 opacity-80" />
                    <span className="text-xs opacity-80">{label}</span>
                  </div>
                  <span className="text-sm font-bold">{value}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Orders by Status ──────────────────────────────── */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <Circle className="w-4 h-4 text-gray-500" />
            <h2 className="font-semibold text-gray-900">Orders by Status</h2>
          </div>
          <Link href="/admin/orders"
            className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1">
            Manage all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="p-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {(Object.entries(STATUS_CONFIG) as [string, typeof STATUS_CONFIG[string]][]).map(([status, cfg]) => {
            const count = data.ordersByStatus[status] || 0;
            const Icon = cfg.icon;
            return (
              <Link key={status} href={`/admin/orders?status=${status}`}
                className={`text-center p-3.5 rounded-xl border-2 border-transparent hover:border-gray-200 transition-all hover:shadow-md active:scale-95 ${cfg.bg}`}>
                <Icon className={`w-5 h-5 mx-auto mb-1.5 ${cfg.text}`} />
                <p className="text-xl font-bold text-gray-900">{count}</p>
                <p className={`text-[11px] font-medium mt-0.5 ${cfg.text}`}>{cfg.label}</p>
              </Link>
            );
          })}
        </div>
      </div>

    </div>
  );
}
