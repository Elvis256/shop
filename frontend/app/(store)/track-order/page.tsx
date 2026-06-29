"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ProductImage from "@/components/ProductImage";
import Section from "@/components/Section";
import {
  Package, Truck, CheckCircle, Clock, Search, AlertCircle,
  MapPin, CreditCard, ShoppingBag, Shield, Copy, Check,
  Smartphone, Banknote, Phone, ChevronRight, ExternalLink,
} from "lucide-react";

const API_URL = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");

interface OrderItem {
  name: string;
  productSlug: string;
  quantity: number;
  price: number;
  imageUrl?: string | null;
}

interface TimelineEvent {
  status: string;
  note: string;
  timestamp: string;
}

interface StatusStep {
  status: string;
  label: string;
  description: string;
  completed: boolean;
  current: boolean;
}

interface ShippingAddress {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
}

interface Order {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string;
  paymentMethodCode?: string;
  customerName: string;
  shippingAddress: ShippingAddress | string;
  trackingNumber?: string;
  discreet: boolean;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  timeline: TimelineEvent[];
  statusSteps: StatusStep[];
  createdAt: string;
}

const statusIcons: Record<string, any> = {
  PENDING: Clock,
  CONFIRMED: CheckCircle,
  PROCESSING: Package,
  SHIPPED: Truck,
  DELIVERED: CheckCircle,
};

const statusColors: Record<string, { badge: string; text: string }> = {
  PENDING: { badge: "bg-amber-50 text-amber-700 border-amber-200", text: "text-amber-600" },
  CONFIRMED: { badge: "bg-blue-50 text-blue-700 border-blue-200", text: "text-blue-600" },
  PROCESSING: { badge: "bg-purple-50 text-purple-700 border-purple-200", text: "text-purple-600" },
  SHIPPED: { badge: "bg-indigo-50 text-indigo-700 border-indigo-200", text: "text-indigo-600" },
  DELIVERED: { badge: "bg-green-50 text-green-700 border-green-200", text: "text-green-600" },
  CANCELLED: { badge: "bg-red-50 text-red-700 border-red-200", text: "text-red-600" },
  REFUNDED: { badge: "bg-gray-50 text-gray-700 border-gray-200", text: "text-gray-600" },
};

const paymentIcons: Record<string, any> = {
  CARD: CreditCard,
  MOBILE_MONEY: Smartphone,
  PAYPAL: CreditCard,
  COD: Banknote,
};

function TrackOrderContent() {
  const searchParams = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(searchParams.get("order") || "");
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [copied, setCopied] = useState(false);

  const doSearch = useCallback(async (num: string, emailAddr: string) => {
    if (!num.trim() || !emailAddr.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const res = await fetch(`${API_URL}/api/orders/track/${num.trim()}?email=${encodeURIComponent(emailAddr.trim())}`);
      if (!res.ok) {
        setError(res.status === 404 ? "Order not found. Please check your order number and email, then try again." : "Failed to fetch order. Please try again.");
        setOrder(null);
        return;
      }
      const data = await res.json();
      setOrder(data);
    } catch {
      setError("Connection error. Please try again.");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-search if ?order= and ?email= params are present
  useEffect(() => {
    const param = searchParams.get("order");
    const emailParam = searchParams.get("email");
    if (param && emailParam) doSearch(param, emailParam);
  }, [searchParams, doSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber.trim()) {
      setError("Please enter an order number");
      return;
    }
    if (!email.trim()) {
      setError("Please enter the email address used for your order");
      return;
    }
    doSearch(orderNumber, email);
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const getAddress = (): ShippingAddress | null => {
    if (!order?.shippingAddress) return null;
    if (typeof order.shippingAddress === "object") return order.shippingAddress as ShippingAddress;
    try { return JSON.parse(order.shippingAddress as string); } catch { return null; }
  };

  const formatAddress = (addr: ShippingAddress) => {
    const parts = [addr.address, addr.city, addr.state, addr.postalCode, addr.country].filter(Boolean);
    return parts.join(", ");
  };

  const getPaymentStatusConfig = (status: string) => {
    switch (status) {
      case "SUCCESSFUL": return { label: "Paid", color: "text-green-700 bg-green-50 border-green-200" };
      case "PENDING": return { label: "Pending", color: "text-amber-700 bg-amber-50 border-amber-200" };
      case "FAILED": return { label: "Failed", color: "text-red-700 bg-red-50 border-red-200" };
      case "REFUNDED": return { label: "Refunded", color: "text-gray-700 bg-gray-50 border-gray-200" };
      default: return { label: status, color: "text-gray-700 bg-gray-50 border-gray-200" };
    }
  };

  return (
    <>
      {/* Search Header */}
      <Section className="bg-gradient-to-b from-accent/5 to-transparent">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 mb-4">
            <Package className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Track Your Order</h1>
          <p className="text-gray-500 mb-8">
            Enter your order number to see the current status and estimated delivery time.
          </p>

          <form onSubmit={handleSearch} className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="Order number, e.g. ORD-1773560066372-TX80LSHCI"
                  className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-accent focus:border-accent bg-white shadow-sm text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address used for the order"
                  className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-accent focus:border-accent bg-white shadow-sm text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary px-8 rounded-xl shadow-sm"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Searching
                  </span>
                ) : "Track"}
              </button>
            </div>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>
      </Section>

      {order && (
        <Section>
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Order Header Card */}
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-lg font-bold text-gray-900">
                        #{order.orderNumber.split("-").slice(-1)[0]}
                      </h2>
                      <button
                        onClick={() => copyText(order.orderNumber)}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded"
                        title="Copy full order number"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-sm text-gray-500">{formatDate(order.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {(() => {
                      const sc = statusColors[order.status] || statusColors.PENDING;
                      const Icon = statusIcons[order.status] || Clock;
                      return (
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border ${sc.badge}`}>
                          <Icon className="w-4 h-4" />
                          {order.status === "CANCELLED" ? "Cancelled" : order.status === "REFUNDED" ? "Refunded" : order.statusSteps.find(s => s.current)?.label || order.status}
                        </span>
                      );
                    })()}
                    {order.discreet && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-gray-50 text-gray-600 border border-gray-200">
                        <Shield className="w-3.5 h-3.5" />
                        Discreet
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Order total summary bar */}
              <div className="px-6 py-3 bg-gray-50 border-t flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  {order.items.length} item{order.items.length !== 1 ? "s" : ""} · {order.paymentMethod || "Payment"}
                </span>
                <span className="font-bold text-gray-900">
                  {order.currency} {Number(order.total).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Progress Tracker */}
            {order.status !== "CANCELLED" && order.status !== "REFUNDED" && (
              <div className="bg-white rounded-2xl border shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-6">Delivery Progress</h3>

                {/* Progress Steps */}
                <div className="relative">
                  {/* Background line */}
                  <div className="absolute top-5 left-5 right-5 h-0.5 bg-gray-200 hidden sm:block" />
                  {/* Active line */}
                  <div
                    className="absolute top-5 left-5 h-0.5 bg-accent hidden sm:block transition-all duration-700"
                    style={{
                      width: `calc(${((order.statusSteps.filter(s => s.completed).length - 1) / (order.statusSteps.length - 1)) * 100}% - 40px)`,
                    }}
                  />

                  <div className="flex flex-col sm:flex-row sm:justify-between gap-4 sm:gap-0">
                    {order.statusSteps.map((step) => {
                      const Icon = statusIcons[step.status] || Clock;
                      return (
                        <div key={step.status} className="flex sm:flex-col items-center sm:items-center gap-3 sm:gap-0">
                          <div
                            className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0 ${
                              step.completed
                                ? "bg-accent text-white shadow-md shadow-accent/20"
                                : "bg-white text-gray-300 border-2 border-gray-200"
                            } ${step.current ? "ring-4 ring-accent/15 scale-110" : ""}`}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="sm:mt-3 sm:text-center">
                            <p className={`text-sm font-medium ${step.completed ? "text-gray-900" : "text-gray-400"}`}>
                              {step.label}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5 hidden md:block max-w-[120px]">
                              {step.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Tracking Number */}
                {order.trackingNumber && (
                  <div className="mt-6 bg-indigo-50 rounded-xl p-4 flex items-center justify-between border border-indigo-100">
                    <div className="flex items-center gap-3">
                      <Truck className="w-5 h-5 text-indigo-600" />
                      <div>
                        <p className="text-xs text-indigo-600 font-medium">Tracking Number</p>
                        <p className="font-mono font-semibold text-indigo-900">{order.trackingNumber}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => copyText(order.trackingNumber!)}
                      className="px-3 py-1.5 text-sm font-medium text-indigo-600 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                )}

                {/* COD Notice */}
                {order.paymentMethodCode === "COD" && order.status !== "DELIVERED" && (
                  <div className="mt-4 bg-amber-50 rounded-xl p-4 flex items-start gap-3 border border-amber-100">
                    <Banknote className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">Cash on Delivery</p>
                      <p className="text-xs text-amber-700 mt-0.5">Please have UGX {Number(order.total).toLocaleString()} ready when your order arrives.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Cancelled/Refunded Banner */}
            {(order.status === "CANCELLED" || order.status === "REFUNDED") && (
              <div className={`rounded-2xl border p-6 ${order.status === "CANCELLED" ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}>
                <div className="flex items-start gap-3">
                  <AlertCircle className={`w-6 h-6 flex-shrink-0 mt-0.5 ${order.status === "CANCELLED" ? "text-red-500" : "text-gray-500"}`} />
                  <div>
                    <p className={`font-semibold ${order.status === "CANCELLED" ? "text-red-800" : "text-gray-800"}`}>
                      Order {order.status === "CANCELLED" ? "Cancelled" : "Refunded"}
                    </p>
                    <p className={`text-sm mt-1 ${order.status === "CANCELLED" ? "text-red-700" : "text-gray-600"}`}>
                      {order.status === "CANCELLED"
                        ? "This order has been cancelled. If you were charged, a refund will be processed."
                        : "This order has been refunded. Please allow 5-10 business days for the refund to appear."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Main Content Grid */}
            <div className="grid md:grid-cols-5 gap-6">
              {/* Items — Takes 3 cols */}
              <div className="md:col-span-3 bg-white rounded-2xl border shadow-sm">
                <div className="p-5 border-b">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-accent" />
                    Order Items
                  </h3>
                </div>
                <div className="divide-y">
                  {order.items.map((item, index) => (
                    <div key={index} className="p-4 flex items-center gap-4">
                      {/* Product Image */}
                      <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                        <ProductImage src={item.imageUrl} alt={item.name} width={64} height={64} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/product/${item.productSlug}`}
                          className="font-medium text-sm text-gray-900 hover:text-accent transition-colors line-clamp-1"
                        >
                          {item.name}
                        </Link>
                        <p className="text-xs text-gray-400 mt-0.5">Qty: {item.quantity}</p>
                      </div>
                      <span className="font-semibold text-sm text-gray-900 whitespace-nowrap">
                        {order.currency} {(Number(item.price) * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Totals */}
                <div className="p-5 bg-gray-50/50 border-t space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="text-gray-700">{order.currency} {Number(order.subtotal).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Shipping</span>
                    <span className={Number(order.shipping) === 0 ? "text-green-600 font-medium" : "text-gray-700"}>
                      {Number(order.shipping) > 0 ? `${order.currency} ${Number(order.shipping).toLocaleString()}` : "Free"}
                    </span>
                  </div>
                  {Number(order.discount) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Discount</span>
                      <span className="text-green-600 font-medium">-{order.currency} {Number(order.discount).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold pt-2 border-t border-gray-200">
                    <span>Total</span>
                    <span className="text-lg">{order.currency} {Number(order.total).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Sidebar — Takes 2 cols */}
              <div className="md:col-span-2 space-y-6">
                {/* Shipping Address */}
                {(() => {
                  const addr = getAddress();
                  if (!addr) return null;
                  return (
                    <div className="bg-white rounded-2xl border shadow-sm p-5">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                        <MapPin className="w-5 h-5 text-accent" />
                        Shipping Address
                      </h3>
                      <div className="space-y-1.5 text-sm">
                        {addr.name && <p className="font-medium text-gray-900">{addr.name}</p>}
                        <p className="text-gray-600">{formatAddress(addr)}</p>
                        {addr.phone && (
                          <p className="text-gray-500 flex items-center gap-1.5 mt-2">
                            <Phone className="w-3.5 h-3.5" />
                            {addr.phone}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Payment Info */}
                <div className="bg-white rounded-2xl border shadow-sm p-5">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                    <CreditCard className="w-5 h-5 text-accent" />
                    Payment
                  </h3>
                  <div className="space-y-3">
                    {order.paymentMethod && (
                      <div className="flex items-center gap-3">
                        {(() => {
                          const PmIcon = paymentIcons[order.paymentMethodCode || ""] || CreditCard;
                          return <PmIcon className="w-5 h-5 text-gray-400" />;
                        })()}
                        <span className="text-sm font-medium text-gray-900">{order.paymentMethod}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Status</span>
                      {(() => {
                        const ps = getPaymentStatusConfig(order.paymentStatus);
                        return (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ps.color}`}>
                            {ps.label}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Privacy Badge */}
                {order.discreet && (
                  <div className="bg-gray-900 rounded-2xl p-5 text-white">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-5 h-5 text-green-400" />
                      <h3 className="font-semibold">Privacy Protected</h3>
                    </div>
                    <ul className="space-y-2 text-sm text-gray-300">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                        Plain, unmarked packaging
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                        Neutral sender name
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                        Anonymous billing
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Timeline */}
            {order.timeline && order.timeline.length > 0 && (
              <div className="bg-white rounded-2xl border shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-5">Order Activity</h3>
                <div className="space-y-0">
                  {order.timeline.map((event, index) => (
                    <div key={index} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5 ${index === 0 ? "bg-accent ring-4 ring-accent/10" : "bg-gray-300"}`} />
                        {index < order.timeline.length - 1 && (
                          <div className="w-0.5 flex-1 bg-gray-200 my-1" />
                        )}
                      </div>
                      <div className="pb-5 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className={`text-sm font-medium ${index === 0 ? "text-gray-900" : "text-gray-600"}`}>
                            {event.note || event.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(event.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Help Footer */}
            <div className="bg-white rounded-2xl border shadow-sm p-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900">Need help with your order?</p>
                  <p className="text-sm text-gray-500">Our support team is available to assist you.</p>
                </div>
                <Link
                  href="/contact"
                  className="btn-secondary flex items-center gap-2 whitespace-nowrap"
                >
                  Contact Support
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* Not Found Help */}
      {searched && !order && !loading && (
        <Section>
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-xl font-semibold mb-6">Can&apos;t Find Your Order?</h2>
            <div className="grid md:grid-cols-2 gap-4 text-left">
              <div className="bg-white rounded-2xl border shadow-sm p-5">
                <h3 className="font-medium text-gray-900 mb-2">Check Your Email</h3>
                <p className="text-gray-500 text-sm">
                  Look for your order confirmation email. The order number starts with &quot;ORD-&quot;.
                </p>
              </div>
              <div className="bg-white rounded-2xl border shadow-sm p-5">
                <h3 className="font-medium text-gray-900 mb-2">Need Help?</h3>
                <p className="text-gray-500 text-sm">
                  <Link href="/contact" className="text-accent hover:underline">
                    Contact our support team
                  </Link>{" "}
                  with your email address and we&apos;ll locate your order.
                </p>
              </div>
            </div>
          </div>
        </Section>
      )}
    </>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense fallback={
      <Section>
        <div className="max-w-2xl mx-auto text-center py-16">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </Section>
    }>
      <TrackOrderContent />
    </Suspense>
  );
}
