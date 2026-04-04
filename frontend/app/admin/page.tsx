"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
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

/* ─── Constants ──────────────────────────────────────────── */

const ORDER_STATUSES = [
  { key: "PENDING",    label: "Pending",    dot: "bg-gray-400" },
  { key: "CONFIRMED",  label: "Confirmed",  dot: "bg-blue-500" },
  { key: "PROCESSING", label: "Processing", dot: "bg-yellow-500" },
  { key: "SHIPPED",    label: "Shipped",    dot: "bg-indigo-500" },
  { key: "DELIVERED",  label: "Delivered",  dot: "bg-emerald-500" },
  { key: "CANCELLED",  label: "Cancelled",  dot: "bg-red-400" },
  { key: "REFUNDED",   label: "Refunded",   dot: "bg-orange-400" },
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

function GrowthBadge({ value }: { value: number }) {
  if (value === 0) return <span className="text-xs text-gray-400 flex items-center gap-0.5"><Minus className="w-3 h-3" /> 0%</span>;
  const up = value > 0;
  return (
    <span className={`text-xs font-medium flex items-center gap-0.5 ${up ? "text-emerald-600" : "text-red-500"}`}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {Math.abs(value)}%
    </span>
  );
}

/* ─── Component ──────────────────────────────────────────── */

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);

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
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-white rounded-lg border" />)}
        </div>
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-80 bg-white rounded-lg border" />
          <div className="h-80 bg-white rounded-lg border" />
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

  return (
    <div className="space-y-5 pb-8">

      {/* ─── Header ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">
            {lastUpdated && <>Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadDashboard(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-gray-500 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link href="/admin/analytics"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
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
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Revenue */}
        <Link href="/admin/analytics" className="group bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] text-gray-500">Revenue</span>
            <GrowthBadge value={data.stats.revenue.growth} />
          </div>
          <p className="text-[22px] font-semibold text-gray-900 leading-tight truncate">{fmt(data.stats.revenue.total)}</p>
          <p className="text-xs text-gray-400 mt-1.5">{fmt(data.stats.revenue.thisMonth)} this month</p>
        </Link>

        {/* Orders */}
        <Link href="/admin/orders" className="group bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] text-gray-500">Orders</span>
            <GrowthBadge value={data.stats.orders.growth} />
          </div>
          <p className="text-[22px] font-semibold text-gray-900 leading-tight">{data.stats.orders.total}</p>
          <p className="text-xs text-gray-400 mt-1.5">{data.stats.orders.thisMonth} this month</p>
        </Link>

        {/* Avg Order Value */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] text-gray-500">Avg. Order</span>
            <Wallet className="w-3.5 h-3.5 text-gray-300" />
          </div>
          <p className="text-[22px] font-semibold text-gray-900 leading-tight truncate">{fmt(avgOrderValue)}</p>
          <p className="text-xs text-gray-400 mt-1.5">{data.stats.orders.total} orders total</p>
        </div>

        {/* Products */}
        <Link href="/admin/products" className="group bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] text-gray-500">Products</span>
            {data.stats.products.lowStock > 0 && (
              <span className="text-xs text-red-500 font-medium">{data.stats.products.lowStock} low</span>
            )}
          </div>
          <p className="text-[22px] font-semibold text-gray-900 leading-tight">{data.stats.products.total}</p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
            <span>{data.stats.products.local} local</span>
            <span>{data.stats.products.cjDropshipping} CJ</span>
            {data.stats.products.aliexpress > 0 && <span>{data.stats.products.aliexpress} AE</span>}
          </div>
        </Link>
      </div>

      {/* ─── Order Pipeline ──────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-[13px] font-medium text-gray-900">Order Pipeline</h2>
          <Link href="/admin/orders" className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1">
            All orders <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-4 lg:grid-cols-7 divide-x divide-gray-100">
          {ORDER_STATUSES.map(({ key, label, dot }) => {
            const count = data.ordersByStatus[key] || 0;
            return (
              <Link key={key} href={`/admin/orders?status=${key}`}
                className="flex flex-col items-center py-4 hover:bg-gray-50 transition-colors">
                <div className={`w-2 h-2 rounded-full ${dot} mb-2`} />
                <span className="text-lg font-semibold text-gray-900">{count}</span>
                <span className="text-[11px] text-gray-400 mt-0.5">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ─── Main Grid ───────────────────────────────────── */}
      <div className="grid lg:grid-cols-5 gap-4">

        {/* ── Recent Orders (3/5) ── */}
        <div className="lg:col-span-3 bg-white rounded-lg border border-gray-200 overflow-hidden">
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
              <div className="grid grid-cols-[1fr_100px_80px_60px] gap-2 px-4 py-2 text-[11px] text-gray-400 uppercase tracking-wider border-b border-gray-50 font-medium">
                <span>Order</span>
                <span className="text-right">Amount</span>
                <span className="text-center">Status</span>
                <span />
              </div>
              {/* Table rows */}
              <div className="divide-y divide-gray-50">
                {data.recentOrders.slice(0, 8).map((order) => {
                  const badgeCls = STATUS_BADGE[order.status] || STATUS_BADGE.PENDING;
                  const payColor = order.paymentStatus ? PAYMENT_BADGE[order.paymentStatus] || "text-gray-400" : "text-gray-400";
                  const payLabel = order.paymentStatus ? PAYMENT_LABEL[order.paymentStatus] || order.paymentStatus : "";
                  return (
                    <div key={order.id} className="grid grid-cols-[1fr_100px_80px_60px] gap-2 items-center px-4 py-2.5 hover:bg-gray-50/50 transition-colors">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-medium text-gray-900">{shortOrderNum(order.orderNumber)}</span>
                          {payLabel && <span className={`text-[11px] ${payColor}`}>· {payLabel}</span>}
                        </div>
                        <p className="text-xs text-gray-400 truncate">{order.customerName} · {timeAgo(order.createdAt)}</p>
                      </div>
                      <span className="text-[13px] font-medium text-gray-900 text-right tabular-nums">{fmt(Number(order.totalAmount))}</span>
                      <div className="flex justify-center">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${badgeCls}`}>
                          {order.status.charAt(0) + order.status.slice(1).toLowerCase()}
                        </span>
                      </div>
                      <div className="flex justify-end">
                        <Link href={`/admin/orders/${order.id}`} className="text-gray-300 hover:text-gray-600 transition-colors">
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
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
                  <div key={product.productId} className="flex items-center gap-3 px-4 py-2.5">
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
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
          <div className="bg-gray-900 rounded-lg p-4 text-white">
            <h3 className="text-[13px] font-medium text-gray-400 mb-3">This Month</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-lg font-semibold">{data.stats.orders.thisMonth}</p>
                <p className="text-[11px] text-gray-400">Orders</p>
              </div>
              <div>
                <p className="text-lg font-semibold truncate">{fmt(data.stats.revenue.thisMonth)}</p>
                <p className="text-[11px] text-gray-400">Revenue</p>
              </div>
              <div>
                <p className="text-lg font-semibold">{data.stats.customers.newThisMonth}</p>
                <p className="text-[11px] text-gray-400">New customers</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ─── Quick Links ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-gray-400 pt-2">
        <span className="text-gray-300 font-medium mr-1">Quick links</span>
        <Link href="/admin/products/new" className="hover:text-gray-600 transition-colors">Add product</Link>
        <Link href="/admin/orders" className="hover:text-gray-600 transition-colors flex items-center gap-1">
          Orders
          {pendingCount > 0 && <span className="text-[10px] bg-gray-200 text-gray-600 px-1 rounded">{pendingCount}</span>}
        </Link>
        <Link href="/admin/customers" className="hover:text-gray-600 transition-colors">Customers</Link>
        <Link href="/admin/coupons" className="hover:text-gray-600 transition-colors">Coupons</Link>
        <Link href="/admin/inventory" className="hover:text-gray-600 transition-colors flex items-center gap-1">
          Inventory
          {data.stats.products.lowStock > 0 && <span className="text-[10px] bg-gray-200 text-gray-600 px-1 rounded">{data.stats.products.lowStock}</span>}
        </Link>
        <Link href="/admin/settings" className="hover:text-gray-600 transition-colors">Settings</Link>
      </div>
    </div>
  );
}
