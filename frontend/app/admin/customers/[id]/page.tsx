"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import {
  ArrowLeft, User, Mail, Phone, Calendar, ShoppingBag,
  ShieldCheck, ShieldAlert, MapPin, Star, Loader2,
  Package, ExternalLink,
} from "lucide-react";

interface CustomerDetail {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  totalSpent: number;
  addresses: Array<{
    id: string;
    label: string | null;
    fullName: string;
    phone: string;
    street: string;
    city: string;
    region: string | null;
    country: string;
    isDefault: boolean;
  }>;
  orders: Array<{
    id: string;
    orderNumber: string;
    totalAmount: number;
    status: string;
    createdAt: string;
  }>;
  reviews: Array<{
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
    product: { name: string };
  }>;
  _count: {
    orders: number;
    wishlist: number;
    reviews: number;
  };
}

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700 border-yellow-200",
  CONFIRMED: "bg-blue-50 text-blue-700 border-blue-200",
  PROCESSING: "bg-indigo-50 text-indigo-700 border-indigo-200",
  SHIPPED: "bg-purple-50 text-purple-700 border-purple-200",
  DELIVERED: "bg-green-50 text-green-700 border-green-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
  REFUNDED: "bg-gray-50 text-gray-700 border-gray-200",
};

export default function AdminCustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [togglingBlock, setTogglingBlock] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    loadCustomer();
  }, [params.id]);

  const loadCustomer = async () => {
    try {
      setLoading(true);
      const data = await apiFetch(`/api/admin/customers/${params.id}`);
      const parsed = await data.json();
      if (!data.ok) throw new Error(parsed.error || "Failed to load");
      setCustomer(parsed);
      setIsBlocked(parsed.isBlocked || false);
    } catch (e: any) {
      setError(e.message || "Customer not found");
    } finally {
      setLoading(false);
    }
  };

  const toggleBlock = async () => {
    if (!customer) return;
    setTogglingBlock(true);
    try {
      const res = await apiFetch(`/api/admin/customers/${customer.id}`, {
        method: "PUT",
        body: JSON.stringify({ isBlocked: !isBlocked }),
      });
      if (res.ok) setIsBlocked(!isBlocked);
    } catch (e) {
      console.error("Toggle block failed:", e);
    } finally {
      setTogglingBlock(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const formatCurrency = (v: number) => `USh ${Number(v).toLocaleString()}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="text-center py-32">
        <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-600 font-medium">{error || "Customer not found"}</p>
        <button onClick={() => router.push("/admin/customers")}
          className="mt-4 text-sm text-pink-600 hover:underline">
          Back to customers
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/admin/customers")}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 bg-gray-900 text-white rounded-full flex items-center justify-center text-lg font-medium">
                {(customer.name?.[0] || customer.email[0]).toUpperCase()}
              </div>
              {isBlocked && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 border-2 border-white rounded-full" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{customer.name || "Unnamed"}</h1>
              <p className="text-sm text-gray-500">{customer.email}</p>
            </div>
          </div>
        </div>
        <button onClick={toggleBlock} disabled={togglingBlock}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
            isBlocked
              ? "bg-green-600 text-white hover:bg-green-700"
              : "bg-red-600 text-white hover:bg-red-700"
          }`}>
          {togglingBlock ? <Loader2 className="w-4 h-4 animate-spin" /> :
            isBlocked ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
          {isBlocked ? "Unblock" : "Block"}
        </button>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Orders", value: customer._count.orders, icon: Package },
          { label: "Total Spent", value: formatCurrency(customer.totalSpent), icon: ShoppingBag },
          { label: "Reviews", value: customer._count.reviews, icon: Star },
          { label: "Wishlist", value: customer._count.wishlist, icon: Package },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
              <s.icon className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-xl font-semibold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Contact & Details */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Details</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2.5">
              <Mail className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-gray-500 text-xs">Email</p>
                <p className="text-gray-900 break-all">{customer.email}</p>
                {customer.emailVerified && (
                  <span className="text-[10px] text-green-600">Verified</span>
                )}
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Phone className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-gray-500 text-xs">Phone</p>
                <p className="text-gray-900">{customer.phone || "Not provided"}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Calendar className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-gray-500 text-xs">Joined</p>
                <p className="text-gray-900">{formatDate(customer.createdAt)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <User className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-gray-500 text-xs">Role</p>
                <p className="text-gray-900">{customer.role}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Addresses */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Addresses ({customer.addresses.length})</h2>
          {customer.addresses.length === 0 ? (
            <p className="text-sm text-gray-400">No saved addresses</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {customer.addresses.map((addr) => (
                <div key={addr.id} className="text-sm border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    <span className="font-medium text-gray-900">{addr.fullName}</span>
                    {addr.isDefault && (
                      <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Default</span>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs">{addr.street}, {addr.city}{addr.region ? `, ${addr.region}` : ""}</p>
                  <p className="text-gray-500 text-xs">{addr.phone}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reviews */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Recent Reviews ({customer._count.reviews})</h2>
          {customer.reviews.length === 0 ? (
            <p className="text-sm text-gray-400">No reviews yet</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {customer.reviews.map((rev) => (
                <div key={rev.id} className="text-sm border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900 text-xs truncate">{rev.product.name}</span>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-3 h-3 ${i < rev.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}`} />
                      ))}
                    </div>
                  </div>
                  {rev.comment && <p className="text-gray-500 text-xs line-clamp-2">{rev.comment}</p>}
                  <p className="text-gray-400 text-[10px] mt-1">{formatDate(rev.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Recent Orders</h2>
          <Link href={`/admin/orders?customer=${encodeURIComponent(customer.email)}`}
            className="text-xs text-gray-500 hover:text-gray-900 inline-flex items-center gap-1">
            View all <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
        {customer.orders.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">No orders yet</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500">Order</th>
                <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500">Date</th>
                <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-5 py-2.5 text-right text-xs font-medium text-gray-500">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customer.orders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3">
                    <Link href={`/admin/orders/${o.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500">{formatDate(o.createdAt)}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex text-xs px-2 py-0.5 rounded border font-medium ${statusColors[o.status] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-900 text-right font-medium">
                    {formatCurrency(o.totalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
