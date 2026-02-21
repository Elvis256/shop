"use client";

import { useEffect, useState } from "react";
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
  Zap,
  Calendar,
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

const quickActions = [
  { label: "Add Product", href: "/admin/products/new", icon: Plus, color: "bg-blue-500" },
  { label: "View Orders", href: "/admin/orders", icon: Eye, color: "bg-emerald-500" },
  { label: "Create Coupon", href: "/admin/coupons", icon: Percent, color: "bg-purple-500" },
  { label: "Check Inventory", href: "/admin/inventory", icon: Package, color: "bg-amber-500" },
];

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadDashboard = () => {
    setLoading(true);
    setError(null);
    api.admin.getDashboard()
      .then((result: any) => {
        setData(result);
        setLastUpdated(new Date());
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadDashboard();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-64 bg-gray-200 rounded animate-pulse mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-36 bg-white rounded-xl shadow-sm animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={loadDashboard} className="btn-primary">
          Try Again
        </button>
      </div>
    );
  }

  if (!data) return null;

  const formatCurrency = (amount: number) => {
    return `USh ${amount.toLocaleString()}`;
  };

  const statCards = [
    {
      title: "Total Revenue",
      value: formatCurrency(data.stats.revenue.total),
      subValue: `${formatCurrency(data.stats.revenue.thisMonth)} this month`,
      growth: data.stats.revenue.growth,
      icon: DollarSign,
      iconBg: "bg-emerald-500",
      bgGradient: "from-emerald-50 to-teal-50",
    },
    {
      title: "Orders",
      value: data.stats.orders.total.toLocaleString(),
      subValue: `${data.stats.orders.thisMonth} this month`,
      growth: data.stats.orders.growth,
      icon: ShoppingCart,
      iconBg: "bg-blue-500",
      bgGradient: "from-blue-50 to-indigo-50",
    },
    {
      title: "Customers",
      value: data.stats.customers.total.toLocaleString(),
      subValue: `${data.stats.customers.newThisMonth} new this month`,
      icon: Users,
      iconBg: "bg-violet-500",
      bgGradient: "from-violet-50 to-purple-50",
    },
    {
      title: "Products",
      value: data.stats.products.total.toLocaleString(),
      subValue: data.stats.products.lowStock > 0 
        ? `${data.stats.products.lowStock} low stock` 
        : "All stocked",
      icon: Package,
      iconBg: "bg-amber-500",
      bgGradient: "from-amber-50 to-orange-50",
      alert: data.stats.products.lowStock > 0,
    },
  ];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DELIVERED: "bg-emerald-100 text-emerald-700",
      SHIPPED: "bg-blue-100 text-blue-700",
      PROCESSING: "bg-yellow-100 text-yellow-700",
      CONFIRMED: "bg-indigo-100 text-indigo-700",
      PENDING: "bg-gray-100 text-gray-700",
      CANCELLED: "bg-red-100 text-red-700",
      REFUNDED: "bg-orange-100 text-orange-700",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, typeof Clock> = {
      PENDING: Clock,
      CONFIRMED: CheckCircle2,
      PROCESSING: Activity,
      SHIPPED: Truck,
      DELIVERED: CheckCircle2,
      CANCELLED: XCircle,
      REFUNDED: DollarSign,
    };
    return icons[status] || Clock;
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="space-y-8">
      {/* Header with Quick Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Welcome back! Here&apos;s your store overview.
            {lastUpdated && (
              <span className="ml-2 text-xs text-gray-400">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto-refresh toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            Auto-refresh
          </label>
          <button 
            onClick={loadDashboard}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            href="/admin/analytics"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Zap className="w-4 h-4" />
            Analytics
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickActions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="flex items-center gap-3 p-4 bg-white rounded-xl border shadow-sm hover:shadow-md hover:border-gray-300 transition-all group"
          >
            <div className={`p-2.5 rounded-lg ${action.color} text-white group-hover:scale-110 transition-transform`}>
              <action.icon className="w-5 h-5" />
            </div>
            <span className="font-medium text-gray-700 group-hover:text-gray-900">{action.label}</span>
          </Link>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <div 
            key={stat.title} 
            className={`bg-gradient-to-br ${stat.bgGradient} rounded-xl border border-white/50 shadow-sm p-6 relative overflow-hidden hover:shadow-md transition-shadow`}
          >
            <div className="flex items-start justify-between">
              <div className={`p-3 rounded-xl ${stat.iconBg} text-white shadow-lg`}>
                <stat.icon className="w-6 h-6" />
              </div>
              {stat.growth !== undefined && (
                <div className={`flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-full ${
                  stat.growth >= 0 
                    ? "text-emerald-700 bg-emerald-100" 
                    : "text-red-700 bg-red-100"
                }`}>
                  {stat.growth >= 0 ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" />
                  )}
                  {Math.abs(stat.growth)}%
                </div>
              )}
              {stat.alert && (
                <Link href="/admin/inventory?filter=low" className="flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-full text-amber-700 bg-amber-100 hover:bg-amber-200 transition-colors">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
            <div className="mt-4">
              <p className="text-2xl lg:text-3xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.subValue}</p>
            </div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mt-3">{stat.title}</p>
          </div>
        ))}
      </div>

      {/* Today's Summary Banner */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Today&apos;s Summary</h3>
              <p className="text-white/80 text-sm">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6 md:gap-8">
            <div className="text-center">
              <p className="text-2xl font-bold">{data.stats.orders.thisMonth}</p>
              <p className="text-xs text-white/70">Orders This Month</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{formatCurrency(data.stats.revenue.thisMonth)}</p>
              <p className="text-xs text-white/70">Revenue This Month</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{data.stats.customers.newThisMonth}</p>
              <p className="text-xs text-white/70">New Customers</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Orders - Takes 2 columns */}
        <div className="lg:col-span-2 bg-white rounded-xl border shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="font-semibold text-gray-900">Recent Orders</h2>
            <Link 
              href="/admin/orders" 
              className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1"
            >
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {data.recentOrders.length === 0 ? (
            <div className="p-12 text-center">
              <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No orders yet</p>
              <p className="text-sm text-gray-400 mt-1">Orders will appear here when customers purchase</p>
            </div>
          ) : (
            <div className="divide-y">
              {data.recentOrders.slice(0, 5).map((order) => {
                const StatusIcon = getStatusIcon(order.status);
                return (
                  <Link
                    key={order.id}
                    href={`/admin/orders/${order.id}`}
                    className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${getStatusColor(order.status).split(' ')[0]}`}>
                        <StatusIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">#{order.orderNumber}</p>
                        <p className="text-sm text-gray-500">{order.customerName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(Number(order.totalAmount))}
                      </p>
                      <p className="text-xs text-gray-400">{formatTimeAgo(order.createdAt)}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-xl border shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="font-semibold text-gray-900">Top Products</h2>
            <Link 
              href="/admin/products" 
              className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1"
            >
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {data.topProducts.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No sales yet</p>
              <p className="text-sm text-gray-400 mt-1">Best sellers will appear here</p>
            </div>
          ) : (
            <div className="divide-y">
              {data.topProducts.slice(0, 5).map((product, index) => (
                <div key={product.productId} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    index === 0 ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-md" :
                    index === 1 ? "bg-gradient-to-br from-gray-300 to-gray-400 text-white" :
                    index === 2 ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white" :
                    "bg-gray-100 text-gray-500"
                  }`}>
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{product.name}</p>
                    <p className="text-sm text-gray-500">
                      {formatCurrency(Number(product.price))}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{product.soldCount}</p>
                    <p className="text-xs text-gray-500">sold</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Orders by Status with Visual Indicators */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-gray-900">Orders by Status</h2>
          <Link 
            href="/admin/orders" 
            className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1"
          >
            Manage <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
          {["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"].map((status) => {
            const StatusIcon = getStatusIcon(status);
            const count = data.ordersByStatus[status] || 0;
            return (
              <Link
                key={status}
                href={`/admin/orders?status=${status}`}
                className={`text-center p-4 rounded-xl border-2 border-transparent hover:border-gray-200 transition-all ${getStatusColor(status).replace('text-', 'bg-').split(' ')[0]}/20 hover:shadow-md`}
              >
                <StatusIcon className={`w-5 h-5 mx-auto mb-2 ${getStatusColor(status).split(' ')[1]}`} />
                <p className="text-2xl font-bold text-gray-900">{count}</p>
                <p className="text-xs font-medium text-gray-600 mt-1">{status}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Low Stock Alert (if any) */}
      {data.stats.products.lowStock > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-100 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900">Low Stock Alert</h3>
              <p className="text-amber-700 mt-1">
                {data.stats.products.lowStock} product{data.stats.products.lowStock > 1 ? 's' : ''} running low on stock. Review and restock to avoid stockouts.
              </p>
            </div>
            <Link
              href="/admin/inventory?filter=low"
              className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors"
            >
              View Items
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
