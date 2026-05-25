"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Section from "@/components/Section";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useAuth } from "@/lib/hooks/useAuth";
import { api, apiFetch } from "@/lib/api";
import { Package, Eye, ChevronLeft, RefreshCw, Loader2, AlertCircle, X } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";

interface Order {
  id: string;
  orderNumber: string;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
}

export default function OrdersPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { formatPrice } = useCurrency();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);

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
        <div className="flex items-center gap-4 mb-8">
          <Link href="/account" className="btn-icon">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1>My Orders</h1>
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
                <div className="mt-4 pt-4 border-t border-border flex justify-end gap-2">
                  <div className="h-8 bg-surface-secondary rounded w-24" />
                  <div className="h-8 bg-surface-secondary rounded w-28" />
                </div>
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="card text-center py-16">
            <Package className="w-16 h-16 mx-auto mb-4 text-text-muted" />
            <h3 className="mb-2">No orders yet</h3>
            <p className="text-text-muted mb-6">Start shopping to see your orders here.</p>
            <Link href="/category" className="btn-primary">
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="card">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">Order #{order.orderNumber}</p>
                    <p className="text-small text-text-muted">
                      {new Date(order.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatPrice(Number(order.totalAmount))}</p>
                    <span className={`badge ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border flex justify-end gap-2">
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
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
