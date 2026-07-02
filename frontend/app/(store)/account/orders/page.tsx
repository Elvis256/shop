"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Section from "@/components/Section";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useAuth } from "@/lib/hooks/useAuth";
import { api, apiFetch } from "@/lib/api";
import { Package, Eye, ChevronLeft, RefreshCw, Loader2, AlertCircle, X, Search, MapPin, Calendar, XCircle } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useToast } from "@/lib/hooks/useToast";
import ConfirmDialog from "@/components/ConfirmDialog";

interface Order {
  id: string;
  orderNumber: string;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
  estimatedDeliveryDate?: string | null;
  items?: { id: string; quantity: number; product?: { name: string; images?: { url: string }[] } }[];
  itemCount?: number;
}

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
];

const DATE_RANGES = [
  { value: "", label: "All time" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 3 months" },
];

export default function OrdersPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { formatPrice } = useCurrency();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const { showToast } = useToast();

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [dateRange, setDateRange] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const handleReorder = async (orderId: string) => {
    setReorderingId(orderId);
    setReorderError(null);
    try {
      await apiFetch(`/api/orders/${orderId}/reorder`, { method: "POST" });
      window.location.href = "/cart";
    } catch (err: any) {
      setReorderError(err.message || "Failed to reorder. Please try again.");
    } finally {
      setReorderingId(null);
    }
  };

  const handleCancel = async (orderId: string) => {
    setCancellingId(orderId);
    try {
      await apiFetch(`/api/orders/${orderId}/cancel`, { method: "POST" });
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: "CANCELLED" } : o));
      showToast("Order cancelled successfully", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to cancel order", "error");
    } finally {
      setCancellingId(null);
      setCancelTarget(null);
    }
  };

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) {
      api.getOrders()
        .then((data: any) => setOrders(data.orders || data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [user]);

  const filteredOrders = useMemo(() => {
    let result = orders;

    if (statusFilter) {
      result = result.filter((o) => o.status === statusFilter);
    }

    if (dateRange) {
      const days = parseInt(dateRange);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      result = result.filter((o) => new Date(o.createdAt) >= cutoff);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((o) => o.orderNumber.toLowerCase().includes(q));
    }

    return result;
  }, [orders, statusFilter, dateRange, searchQuery]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "DELIVERED":
        return "bg-green-100 text-green-700";
      case "SHIPPED":
        return "bg-blue-100 text-blue-700";
      case "PROCESSING":
        return "bg-yellow-100 text-yellow-700";
      case "CANCELLED":
      case "REFUNDED":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  if (isLoading || !user) {
    return (
      <Section>
        <div className="text-center py-16">Loading...</div>
      </Section>
    );
  }

  return (
    <Section>
      <div className="max-w-4xl mx-auto">
        <Breadcrumbs items={[{ label: "Account", href: "/account" }, { label: "My Orders" }]} />
        <div className="flex items-center gap-4 mb-6">
          <Link href="/account" className="btn-icon">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1>My Orders</h1>
        </div>

        {/* Filters */}
        <div className="mb-6 space-y-4">
          {/* Status Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
                  statusFilter === tab.value
                    ? "bg-primary text-white"
                    : "bg-surface-secondary text-text-muted hover:text-text"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search + Date Range */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search by order number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-9 py-2 text-sm w-full"
              />
            </div>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="input py-2 text-sm max-w-[180px]"
            >
              {DATE_RANGES.map((dr) => (
                <option key={dr.value} value={dr.value}>{dr.label}</option>
              ))}
            </select>
          </div>
        </div>

        {reorderError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{reorderError}</span>
            </div>
            <button onClick={() => setReorderError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="h-4 bg-surface-secondary rounded w-40" />
                    <div className="h-3 bg-surface-secondary rounded w-28" />
                  </div>
                  <div className="space-y-2 text-right">
                    <div className="h-4 bg-surface-secondary rounded w-20 ml-auto" />
                    <div className="h-5 bg-surface-secondary rounded w-16 ml-auto" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="card text-center py-16">
            <Package className="w-16 h-16 mx-auto mb-4 text-text-muted" />
            <h3 className="mb-2">{orders.length === 0 ? "No orders yet" : "No matching orders"}</h3>
            <p className="text-text-muted mb-6">
              {orders.length === 0
                ? "Start shopping to see your orders here."
                : "Try adjusting your filters or search term."}
            </p>
            {orders.length === 0 && (
              <Link href="/category" className="btn-primary">
                Browse Products
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const itemCount = order.items?.reduce((sum, it) => sum + it.quantity, 0) || 0;
              const firstImage = order.items?.[0]?.product?.images?.[0]?.url;
              return (
                <div key={order.id} className="card">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {firstImage && (
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-surface-secondary flex-shrink-0">
                          <img src={firstImage} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">Order #{order.orderNumber}</p>
                        <p className="text-small text-text-muted">
                          {new Date(order.createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                          {itemCount > 0 && <span className="ml-2">({itemCount} item{itemCount !== 1 ? "s" : ""})</span>}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatPrice(Number(order.totalAmount))}</p>
                      <span className={`badge ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                  {/* Estimated delivery date */}
                  {order.estimatedDeliveryDate && !["DELIVERED", "CANCELLED", "REFUNDED"].includes(order.status) && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        Estimated delivery: {new Date(order.estimatedDeliveryDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                  )}
                  <div className="mt-4 pt-4 border-t border-border flex justify-end gap-2">
                    {(order.status === "PENDING" || order.status === "CONFIRMED") && (
                      <button
                        onClick={() => setCancelTarget(order.id)}
                        disabled={cancellingId === order.id}
                        className="btn-secondary text-small gap-2 text-red-600 hover:bg-red-50"
                      >
                        {cancellingId === order.id ? (
                          <><Loader2 className="w-4 h-4 animate-spin" />Cancelling...</>
                        ) : (
                          <><XCircle className="w-4 h-4" />Cancel</>
                        )}
                      </button>
                    )}
                    {(order.status === "SHIPPED" || order.status === "PROCESSING") && (
                      <Link
                        href={`/orders/${order.id}`}
                        className="btn-secondary text-small gap-2"
                      >
                        <MapPin className="w-4 h-4" />
                        Track
                      </Link>
                    )}
                    <button
                      onClick={() => handleReorder(order.id)}
                      disabled={reorderingId === order.id}
                      className="btn-secondary text-small gap-2"
                    >
                      {reorderingId === order.id ? (
                        <><Loader2 className="w-4 h-4 animate-spin" />Reordering...</>
                      ) : (
                        <><RefreshCw className="w-4 h-4" />Reorder</>
                      )}
                    </button>
                    <Link
                      href={`/orders/${order.id}`}
                      className="btn-secondary text-small gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      View Details
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <ConfirmDialog
          open={!!cancelTarget}
          title="Cancel Order"
          message="Are you sure you want to cancel this order? This action cannot be undone."
          variant="danger"
          confirmLabel="Yes, Cancel Order"
          loading={cancellingId === cancelTarget}
          onConfirm={() => cancelTarget && handleCancel(cancelTarget)}
          onCancel={() => setCancelTarget(null)}
        />
      </div>
    </Section>
  );
}
