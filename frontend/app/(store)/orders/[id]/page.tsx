"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import Section from "@/components/Section";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useCurrency } from "@/contexts/CurrencyContext";
import ProductImage from "@/components/ProductImage";
import { apiFetch } from "@/lib/api";
import {
  Package, Truck, CheckCircle, Clock, AlertCircle, CreditCard,
  Smartphone, Banknote, MapPin, ShieldCheck, Eye, Copy, Check,
  FileText, RefreshCw, Loader2, Shield, AlertTriangle, ThumbsUp,
} from "lucide-react";

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productSlug?: string;
  quantity: number;
  price: number;
  imageUrl?: string | null;
}

interface OrderEvent {
  id: string;
  type: string;
  message: string;
  createdAt: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  subtotal: number;
  shippingCost: number;
  discount?: number;
  currency: string;
  discreet?: boolean;
  trackingNumber?: string | null;
  customerName?: string;
  shippingAddress: any;
  items: OrderItem[];
  payments?: Array<{ method: string; status: string }>;
  events?: OrderEvent[];
  createdAt: string;
  updatedAt?: string;
}

const statusSteps = [
  { status: "PENDING", label: "Order Placed", icon: Clock },
  { status: "CONFIRMED", label: "Confirmed", icon: CheckCircle },
  { status: "PROCESSING", label: "Processing", icon: Package },
  { status: "SHIPPED", label: "Shipped", icon: Truck },
  { status: "DELIVERED", label: "Delivered", icon: CheckCircle },
];

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
  CONFIRMED: "bg-blue-100 text-blue-800 border-blue-200",
  PROCESSING: "bg-purple-100 text-purple-800 border-purple-200",
  SHIPPED: "bg-indigo-100 text-indigo-800 border-indigo-200",
  DELIVERED: "bg-green-100 text-green-800 border-green-200",
  CANCELLED: "bg-red-100 text-red-800 border-red-200",
  REFUNDED: "bg-gray-100 text-gray-800 border-gray-200",
};

const paymentMethodLabels: Record<string, { label: string; icon: typeof CreditCard }> = {
  MOBILE_MONEY: { label: "Mobile Money", icon: Smartphone },
  CARD: { label: "Credit/Debit Card", icon: CreditCard },
  PAYPAL: { label: "PayPal", icon: CreditCard },
  COD: { label: "Cash on Delivery", icon: Banknote },
};

export default function OrderDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orderId = params.id as string;
  const isSuccess = searchParams.get("success") === "true";
  const { formatPrice } = useCurrency();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [showModify, setShowModify] = useState(false);
  const [modifyAddress, setModifyAddress] = useState("");
  const [modifyNotes, setModifyNotes] = useState("");
  const [modifying, setModifying] = useState(false);
  const [modifySuccess, setModifySuccess] = useState(false);
  const [modifyError, setModifyError] = useState<string | null>(null);
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);
  const [deliveryConfirmed, setDeliveryConfirmed] = useState(false);
  const [escrow, setEscrow] = useState<{ status: string; releaseDate: string; amount: number } | null>(null);

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    try {
      const data = await apiFetch(`/api/orders/${orderId}`);
      setOrder(data);
      // Load escrow status
      try {
        const escrowData = await apiFetch(`/api/orders/${orderId}/escrow`);
        if (escrowData.escrow) setEscrow(escrowData.escrow);
      } catch { /* no escrow */ }
    } catch {
      setError("Failed to load order");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelivery = async () => {
    if (!order) return;
    setConfirmingDelivery(true);
    try {
      await apiFetch(`/api/orders/${order.id}/confirm-delivery`, { method: "POST" });
      setDeliveryConfirmed(true);
      loadOrder();
    } catch {
      // handled silently
    } finally {
      setConfirmingDelivery(false);
    }
  };

  const copyOrderNumber = () => {
    if (!order) return;
    navigator.clipboard.writeText(order.orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCancelOrder = async () => {
    if (!order) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await apiFetch(`/api/orders/${order.id}/cancel`, { method: "POST" });
      setCancelConfirm(false);
      loadOrder();
    } catch (err: any) {
      setCancelError(err.message || "Failed to cancel order. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  const canCancel = order && ["PENDING", "CONFIRMED"].includes(order.status);
  const canModify = order && order.status === "PENDING";

  const handleModifyOrder = async () => {
    if (!order) return;
    setModifying(true);
    setModifySuccess(false);
    setModifyError(null);
    try {
      await apiFetch(`/api/orders/${order.id}/modify`, {
        method: "PUT",
        body: JSON.stringify({
          shippingAddress: modifyAddress || undefined,
          notes: modifyNotes || undefined,
        }),
      });
      setModifySuccess(true);
      setShowModify(false);
      loadOrder();
      setTimeout(() => setModifySuccess(false), 4000);
    } catch (err: any) {
      setModifyError(err.message || "Failed to modify order. Please try again.");
    } finally {
      setModifying(false);
    }
  };

  const handleReorder = async () => {
    if (!order) return;
    setReordering(true);
    setReorderError(null);
    try {
      await apiFetch(`/api/orders/${order.id}/reorder`, { method: "POST" });
      window.location.href = "/cart";
    } catch (err: any) {
      setReorderError(err.message || "Failed to reorder. Please try again.");
    } finally {
      setReordering(false);
    }
  };

  const handleDownloadInvoice = () => {
    if (!order) return;
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    const url = `${API_URL}/api/invoices/${order.id}?format=html`;
    const win = window.open(url, "_blank");
    if (win) {
      // Attempt to trigger print dialog after the page loads
      win.addEventListener("load", () => win.print());
    }
  };

  const getCurrentStep = () => {
    if (!order) return -1;
    return statusSteps.findIndex((s) => s.status === order.status);
  };

  const getPaymentMethod = () => {
    if (!order?.payments?.length) return null;
    return order.payments[0].method;
  };

  const parseAddress = () => {
    if (!order?.shippingAddress) return null;
    let addr = order.shippingAddress;
    if (typeof addr === "string") {
      try { addr = JSON.parse(addr); } catch { return null; }
    }
    return addr;
  };

  if (loading) {
    return (
      <Section>
        <div className="max-w-3xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-100 rounded w-1/2" />
            <div className="h-24 bg-gray-100 rounded" />
            <div className="h-48 bg-gray-100 rounded" />
          </div>
        </div>
      </Section>
    );
  }

  if (error || !order) {
    return (
      <Section>
        <div className="max-w-3xl mx-auto text-center py-12">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">{error || "Order not found"}</h2>
          <p className="text-gray-500 mb-6">
            The order you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to view it.
          </p>
          <Link href="/" className="btn-primary">Continue Shopping</Link>
        </div>
      </Section>
    );
  }

  const currentStep = getCurrentStep();
  const isCancelledOrRefunded = order.status === "CANCELLED" || order.status === "REFUNDED";
  const paymentMethod = getPaymentMethod();
  const pmInfo = paymentMethod ? paymentMethodLabels[paymentMethod] : null;
  const address = parseAddress();
  const subtotal = Number(order.subtotal) || 0;
  const shippingCost = Number(order.shippingCost) || 0;
  const discount = Number(order.discount) || 0;

  return (
    <Section>
      <div className="max-w-3xl mx-auto">
        <Breadcrumbs items={[
          { label: "Account", href: "/account" },
          { label: "Orders", href: "/account/orders" },
          { label: order.orderNumber.split("-").slice(-1)[0] },
        ]} />

        {/* Success Banner */}
        {isSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-800">Order placed successfully!</p>
              <p className="text-sm text-green-700">
                {paymentMethod === "COD"
                  ? "Please have cash ready when your order is delivered."
                  : "We'll send you a confirmation email shortly."}
              </p>
            </div>
          </div>
        )}

        {/* Buyer Protection Banner */}
        {escrow && (
          <div className={`mb-6 p-4 rounded-xl border flex items-start gap-3 ${
            escrow.status === "HELD" ? "bg-blue-50 border-blue-200" :
            escrow.status === "RELEASED" ? "bg-green-50 border-green-200" :
            escrow.status === "DISPUTED" ? "bg-orange-50 border-orange-200" :
            escrow.status === "REFUNDED" ? "bg-gray-50 border-gray-200" :
            "bg-blue-50 border-blue-200"
          }`}>
            <Shield className={`w-6 h-6 flex-shrink-0 mt-0.5 ${
              escrow.status === "HELD" ? "text-blue-600" :
              escrow.status === "RELEASED" ? "text-green-600" :
              escrow.status === "DISPUTED" ? "text-orange-600" :
              "text-gray-600"
            }`} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-900">Buyer Protection Active</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  escrow.status === "HELD" ? "bg-blue-100 text-blue-700" :
                  escrow.status === "RELEASED" ? "bg-green-100 text-green-700" :
                  escrow.status === "DISPUTED" ? "bg-orange-100 text-orange-700" :
                  "bg-gray-100 text-gray-700"
                }`}>
                  {escrow.status === "HELD" ? "Payment Held" :
                   escrow.status === "RELEASED" ? "Payment Released" :
                   escrow.status === "DISPUTED" ? "Under Dispute" :
                   escrow.status === "REFUNDED" ? "Refunded" : escrow.status}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {escrow.status === "HELD"
                  ? "Your payment is held securely until you confirm delivery. You have 7 days after delivery to report any issues."
                  : escrow.status === "RELEASED"
                  ? "Payment has been released to the seller. Thank you for confirming!"
                  : escrow.status === "DISPUTED"
                  ? "This order is under dispute review. Your funds are safe."
                  : "Your refund has been processed."}
              </p>
            </div>
          </div>
        )}

        {/* Confirm Delivery / Dispute Actions */}
        {order && ["SHIPPED", "DELIVERED"].includes(order.status) && escrow?.status === "HELD" && !deliveryConfirmed && (
          <div className="mb-6 p-4 bg-white border border-gray-200 rounded-xl">
            <h3 className="font-semibold mb-2">Have you received your order?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Confirm delivery to release payment to the seller. If there&apos;s an issue, you can open a dispute.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleConfirmDelivery}
                disabled={confirmingDelivery}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {confirmingDelivery ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                Yes, I received my order
              </button>
              <Link
                href={`/account/disputes/new?orderId=${order.id}`}
                className="flex items-center gap-2 px-4 py-2 border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50"
              >
                <AlertTriangle className="w-4 h-4" />
                Report an Issue
              </Link>
            </div>
          </div>
        )}

        {deliveryConfirmed && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <div>
              <p className="font-semibold text-green-800">Delivery confirmed!</p>
              <p className="text-sm text-green-700">Payment has been released to the seller. Thank you!</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">Order #{order.orderNumber}</h1>
                <button onClick={copyOrderNumber} className="p-1.5 text-gray-400 hover:text-gray-600 rounded">
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-gray-500 mt-1">
                Placed on {(() => { try { const d = new Date(order.createdAt); return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); } catch { return "N/A"; } })()}
              </p>
            </div>
            <span className={`px-3 py-1.5 rounded-full text-sm font-medium border ${statusColors[order.status] || "bg-gray-100 text-gray-700"}`}>
              {order.status}
            </span>
          </div>
        </div>

        {/* Progress Tracker */}
        {!isCancelledOrRefunded && (
          <div className="card mb-6">
            <h3 className="font-semibold mb-6">Order Progress</h3>
            <div className="relative">
              <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200">
                <div
                  className="h-full bg-accent transition-all duration-500"
                  style={{ width: `${Math.max(0, (currentStep / (statusSteps.length - 1)) * 100)}%` }}
                />
              </div>
              <div className="relative flex justify-between">
                {statusSteps.map((step, index) => {
                  const Icon = step.icon;
                  const isComplete = index <= currentStep;
                  const isCurrent = index === currentStep;
                  return (
                    <div key={step.status} className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center z-10 transition-all ${
                          isComplete ? "bg-accent text-white" : "bg-gray-200 text-gray-400"
                        } ${isCurrent ? "ring-4 ring-accent/20 scale-110" : ""}`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className={`mt-2 text-xs sm:text-sm text-center ${isComplete ? "font-medium text-accent" : "text-gray-400"}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Cancelled/Refunded Banner */}
        {isCancelledOrRefunded && (
          <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 ${
            order.status === "CANCELLED" ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"
          }`}>
            <AlertCircle className={`w-6 h-6 flex-shrink-0 ${order.status === "CANCELLED" ? "text-red-500" : "text-gray-500"}`} />
            <div>
              <p className={`font-semibold ${order.status === "CANCELLED" ? "text-red-800" : "text-gray-800"}`}>
                Order {order.status.toLowerCase()}
              </p>
              <p className={`text-sm ${order.status === "CANCELLED" ? "text-red-600" : "text-gray-600"}`}>
                {order.status === "CANCELLED"
                  ? "This order has been cancelled."
                  : "This order has been refunded."}
              </p>
            </div>
          </div>
        )}

        {/* Tracking Number */}
        {order.trackingNumber && (
          <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center gap-3">
            <Truck className="w-5 h-5 text-indigo-600 flex-shrink-0" />
            <div>
              <p className="text-sm text-indigo-700">Tracking Number</p>
              <p className="font-semibold text-indigo-900">{order.trackingNumber}</p>
            </div>
          </div>
        )}

        {/* Order Items */}
        <div className="card mb-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-accent" />
            Order Items ({order.items.length})
          </h3>
          <div className="divide-y divide-gray-100">
            {order.items.map((item) => (
              <div key={item.id} className="py-4 flex items-center gap-4">
                <div className="w-16 h-16 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0">
                  <ProductImage src={item.imageUrl} alt={item.productName} width={64} height={64} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={item.productSlug ? `/product/${item.productSlug}` : "#"}
                    className="font-medium text-gray-900 hover:text-accent transition-colors line-clamp-1"
                  >
                    {item.productName}
                  </Link>
                  <p className="text-sm text-gray-500">Qty: {item.quantity} × {formatPrice(Number(item.price))}</p>
                </div>
                <div className="font-semibold text-right">
                  {formatPrice(Number(item.price) * item.quantity)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid sm:grid-cols-2 gap-6 mb-6">
          {/* Shipping Address */}
          <div className="card">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-accent" />
              Shipping Address
            </h3>
            {address ? (
              <div className="text-gray-600 space-y-1 text-sm">
                <p className="font-medium text-gray-900">{address.name || order.customerName}</p>
                {address.phone && <p>{address.phone}</p>}
                {(address.address || address.street) && <p>{address.address || address.street}</p>}
                <p>
                  {[address.city, address.county || address.postalCode, address.country].filter(Boolean).join(", ")}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-400">No address provided</p>
            )}
          </div>

          {/* Payment Summary */}
          <div className="card">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-accent" />
              Payment Summary
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span className="text-gray-900">{formatPrice(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{formatPrice(discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Shipping</span>
                <span className="text-gray-900">{shippingCost > 0 ? formatPrice(shippingCost) : "Free"}</span>
              </div>
              <div className="border-t pt-2 mt-2 flex justify-between font-semibold text-base">
                <span>Total</span>
                <span>{formatPrice(Number(order.totalAmount))}</span>
              </div>
              {pmInfo && (
                <div className="flex justify-between items-center pt-2 border-t mt-2">
                  <span className="text-gray-500">Method</span>
                  <span className="flex items-center gap-1.5 text-gray-700">
                    <pmInfo.icon className="w-4 h-4" />
                    {pmInfo.label}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Status</span>
                <span className={`font-medium ${
                  order.paymentStatus === "SUCCESSFUL" ? "text-green-600" :
                  order.paymentStatus === "PENDING" ? "text-yellow-600" :
                  order.paymentStatus === "FAILED" ? "text-red-600" : "text-gray-600"
                }`}>
                  {order.paymentStatus}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Discreet Packaging */}
        {order.discreet && (
          <div className="card mb-6 bg-green-50 border-green-200">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div>
                <span className="font-medium text-green-800">Discreet Packaging Confirmed</span>
                <p className="text-sm text-green-700">Plain packaging • Neutral sender name • Anonymous billing</p>
              </div>
            </div>
          </div>
        )}

        {/* Order Timeline */}
        {order.events && order.events.length > 0 && (
          <div className="card mb-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-accent" />
              Order Timeline
            </h3>
            <div className="space-y-0">
              {order.events.map((event, index) => (
                <div key={event.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${index === 0 ? "bg-accent" : "bg-gray-300"}`} />
                    {index < order.events!.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 my-1" />}
                  </div>
                  <div className="pb-4 min-w-0">
                    <p className={`text-sm ${index === 0 ? "font-medium text-gray-900" : "text-gray-600"}`}>{event.message}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {(() => { try { const d = new Date(event.createdAt); return isNaN(d.getTime()) ? "" : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } })()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modify Order Success */}
        {modifySuccess && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-700 font-medium">Order updated successfully!</p>
          </div>
        )}

        {/* Modify Order Section */}
        {canModify && showModify && (
          <div className="mb-4 card border border-blue-200 bg-blue-50/30">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Modify Order
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shipping Address
                </label>
                <textarea
                  value={modifyAddress}
                  onChange={(e) => setModifyAddress(e.target.value)}
                  placeholder="Enter new shipping address..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[80px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Order Notes
                </label>
                <textarea
                  value={modifyNotes}
                  onChange={(e) => setModifyNotes(e.target.value)}
                  placeholder="Add delivery instructions or special notes..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[60px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              {modifyError && (
                <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {modifyError}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleModifyOrder}
                  disabled={modifying || (!modifyAddress && !modifyNotes)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {modifying ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Saving...</>
                  ) : (
                    "Save Changes"
                  )}
                </button>
                <button
                  onClick={() => { setShowModify(false); setModifyError(null); }}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cancel Order Confirmation */}
        {cancelConfirm && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="font-semibold text-red-800 mb-2">Cancel this order?</p>
            <p className="text-sm text-red-700 mb-3">This action cannot be undone. Your items will be released and you will receive a confirmation email.</p>
            {cancelError && (
              <div className="mb-3 flex items-center gap-2 text-sm text-red-700 bg-red-100 border border-red-300 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {cancelError}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={handleCancelOrder} disabled={cancelling} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
                {cancelling ? "Cancelling..." : "Yes, Cancel Order"}
              </button>
              <button onClick={() => { setCancelConfirm(false); setCancelError(null); }} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                Keep Order
              </button>
            </div>
          </div>
        )}

        {/* Reorder Error */}
        {reorderError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{reorderError}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Link href="/account/orders" className="btn-secondary">← My Orders</Link>
          <Link href={`/track-order?order=${order.orderNumber}`} className="btn-secondary flex items-center gap-2">
            <Eye className="w-4 h-4" />Track Order
          </Link>
          {canModify && !showModify && (
            <button
              onClick={() => setShowModify(true)}
              className="btn-secondary flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />Modify Order
            </button>
          )}
          <button
            onClick={handleReorder}
            disabled={reordering}
            className="btn-secondary flex items-center gap-2"
          >
            {reordering ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Reordering...</>
            ) : (
              <><RefreshCw className="w-4 h-4" />Reorder</>
            )}
          </button>
          <button
            onClick={handleDownloadInvoice}
            className="btn-secondary flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />Download Invoice
          </button>
          {canCancel && !cancelConfirm && (
            <button onClick={() => setCancelConfirm(true)} className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-100">
              Cancel Order
            </button>
          )}
          {order.status === "DELIVERED" && (
            <button className="btn-primary">Leave a Review</button>
          )}
        </div>
      </div>
    </Section>
  );
}
