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

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin.getDashboard()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-white rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Revenue",
      value: `KES ${data.stats.revenue.total.toLocaleString()}`,
      subValue: `KES ${data.stats.revenue.thisMonth.toLocaleString()} this month`,
      growth: data.stats.revenue.growth,
      icon: DollarSign,
      color: "text-green-600 bg-green-100",
    },
    {
      title: "Orders",
      value: data.stats.orders.total.toLocaleString(),
      subValue: `${data.stats.orders.thisMonth} this month`,
      growth: data.stats.orders.growth,
      icon: ShoppingCart,
      color: "text-blue-600 bg-blue-100",
    },
    {
      title: "Customers",
      value: data.stats.customers.total.toLocaleString(),
      subValue: `${data.stats.customers.newThisMonth} new this month`,
      icon: Users,
      color: "text-purple-600 bg-purple-100",
    },
    {
      title: "Products",
      value: data.stats.products.total.toLocaleString(),
      subValue: data.stats.products.lowStock > 0 
        ? `${data.stats.products.lowStock} low stock` 
        : "All stocked",
      icon: Package,
      color: "text-orange-600 bg-orange-100",
      alert: data.stats.products.lowStock > 0,
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "DELIVERED": return "bg-green-100 text-green-700";
      case "SHIPPED": return "bg-blue-100 text-blue-700";
      case "PROCESSING": return "bg-yellow-100 text-yellow-700";
      case "PENDING": return "bg-gray-100 text-gray-700";
      default: return "bg-red-100 text-red-700";
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-text-muted">Welcome back! Here's what's happening today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <div key={stat.title} className="bg-white rounded-lg border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              {stat.growth !== undefined && (
                <div className={`flex items-center gap-1 text-sm ${
                  stat.growth >= 0 ? "text-green-600" : "text-red-600"
                }`}>
                  {stat.growth >= 0 ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  {Math.abs(stat.growth)}%
                </div>
              )}
              {stat.alert && (
                <AlertTriangle className="w-5 h-5 text-orange-500" />
              )}
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-sm text-text-muted">{stat.subValue}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Recent Orders */}
        <div className="bg-white rounded-lg border border-border">
          <div className="flex items-center justify-between p-6 border-b border-border">
            <h2 className="font-semibold">Recent Orders</h2>
            <Link href="/admin/orders" className="text-sm text-accent hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {data.recentOrders.slice(0, 5).map((order) => (
              <Link
                key={order.id}
                href={`/admin/orders/${order.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium">#{order.orderNumber}</p>
                  <p className="text-sm text-text-muted">{order.customerName}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">KES {Number(order.totalAmount).toLocaleString()}</p>
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(order.status)}`}>
                    {order.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-lg border border-border">
          <div className="flex items-center justify-between p-6 border-b border-border">
            <h2 className="font-semibold">Top Selling Products</h2>
            <Link href="/admin/products" className="text-sm text-accent hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {data.topProducts.map((product, index) => (
              <div key={product.productId} className="flex items-center gap-4 p-4">
                <span className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm text-text-muted">
                    KES {Number(product.price).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{product.soldCount}</p>
                  <p className="text-xs text-text-muted">sold</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Orders by Status */}
      <div className="bg-white rounded-lg border border-border p-6">
        <h2 className="font-semibold mb-6">Orders by Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"].map((status) => (
            <div key={status} className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold">{data.ordersByStatus[status] || 0}</p>
              <p className="text-xs text-text-muted">{status}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
