"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Search, Eye, Truck, Package, RefreshCw } from "lucide-react";

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  itemCount: number;
  createdAt: string;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });

  const loadOrders = (params: Record<string, string> = {}) => {
    setLoading(true);
    api.admin.getOrders({ search, status: statusFilter, ...params })
      .then((data) => {
        setOrders(data.orders);
        setPagination(data.pagination);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrders();
  }, [search, statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DELIVERED": return "bg-green-100 text-green-700";
      case "SHIPPED": return "bg-blue-100 text-blue-700";
      case "PROCESSING": return "bg-yellow-100 text-yellow-700";
      case "CONFIRMED": return "bg-purple-100 text-purple-700";
      case "PENDING": return "bg-gray-100 text-gray-700";
      case "CANCELLED": return "bg-red-100 text-red-700";
      case "REFUNDED": return "bg-orange-100 text-orange-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case "SUCCESSFUL": return "text-green-600";
      case "PENDING": return "text-yellow-600";
      case "FAILED": return "text-red-600";
      case "REFUNDED": return "text-orange-600";
      default: return "text-gray-600";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="text-text-muted">{pagination.total} total orders</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-border p-4">
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <input
              type="text"
              className="input pl-10"
              placeholder="Search orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="input w-40"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="PROCESSING">Processing</option>
            <option value="SHIPPED">Shipped</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="REFUNDED">Refunded</option>
          </select>
          <button onClick={() => loadOrders()} className="btn-secondary gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-border">
            <tr>
              <th className="p-4 text-left text-sm font-medium">Order</th>
              <th className="p-4 text-left text-sm font-medium">Customer</th>
              <th className="p-4 text-left text-sm font-medium">Total</th>
              <th className="p-4 text-left text-sm font-medium">Payment</th>
              <th className="p-4 text-left text-sm font-medium">Status</th>
              <th className="p-4 text-left text-sm font-medium">Date</th>
              <th className="p-4 text-right text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-text-muted">
                  Loading...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-text-muted">
                  No orders found
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <p className="font-medium">#{order.orderNumber}</p>
                    <p className="text-sm text-text-muted">{order.itemCount} items</p>
                  </td>
                  <td className="p-4">
                    <p className="font-medium">{order.customerName}</p>
                    <p className="text-sm text-text-muted">{order.customerEmail}</p>
                  </td>
                  <td className="p-4 font-medium">
                    KES {Number(order.totalAmount).toLocaleString()}
                  </td>
                  <td className="p-4">
                    <p className={`text-sm ${getPaymentBadge(order.paymentStatus)}`}>
                      {order.paymentStatus}
                    </p>
                    <p className="text-xs text-text-muted">{order.paymentMethod}</p>
                  </td>
                  <td className="p-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadge(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-text-muted">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="btn-secondary text-sm gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border">
            <p className="text-sm text-text-muted">
              Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => loadOrders({ page: String(pagination.page - 1) })}
                disabled={pagination.page === 1}
                className="btn-secondary text-sm"
              >
                Previous
              </button>
              <button
                onClick={() => loadOrders({ page: String(pagination.page + 1) })}
                disabled={pagination.page === pagination.totalPages}
                className="btn-secondary text-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
