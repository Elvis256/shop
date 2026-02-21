"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  ArrowLeft,
  Package,
  Truck,
  CreditCard,
  User,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Edit2,
  Send,
  DollarSign,
  AlertTriangle,
  Copy,
  Check,
} from "lucide-react";

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  totalAmount: number;
  subtotal: number;
  discount: number;
  tax: number;
  shippingCost: number;
  currency: string;
  discreet: boolean;
  trackingNumber: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
  };
  shippingAddress: {
    name: string;
    phone: string;
    street: string;
    city: string;
    county: string | null;
    country: string;
  } | null;
  items: Array<{
    id: string;
    productId: string;
    name: string;
    price: number;
    quantity: number;
    imageUrl: string | null;
  }>;
  timeline: Array<{
    id: string;
    status: string;
    note: string | null;
    createdAt: string;
  }>;
}

const statusOptions = [
  { value: "PENDING", label: "Pending", color: "bg-gray-100 text-gray-700" },
  { value: "CONFIRMED", label: "Confirmed", color: "bg-blue-100 text-blue-700" },
  { value: "PROCESSING", label: "Processing", color: "bg-yellow-100 text-yellow-700" },
  { value: "SHIPPED", label: "Shipped", color: "bg-indigo-100 text-indigo-700" },
  { value: "DELIVERED", label: "Delivered", color: "bg-green-100 text-green-700" },
  { value: "CANCELLED", label: "Cancelled", color: "bg-red-100 text-red-700" },
  { value: "REFUNDED", label: "Refunded", color: "bg-orange-100 text-orange-700" },
];

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundReason, setRefundReason] = useState("");
  const [copied, setCopied] = useState(false);

  const loadOrder = async () => {
    setLoading(true);
    try {
      const data: any = await api.admin.getOrder(params.id as string);
      setOrder(data);
      setNewStatus(data.status);
      setTrackingNumber(data.trackingNumber || "");
      setRefundAmount(Number(data.totalAmount));
    } catch (error) {
      console.error("Failed to load order:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.id) {
      loadOrder();
    }
  }, [params.id]);

  const handleUpdateStatus = async () => {
    if (!order) return;
    setUpdating(true);
    try {
      await api.admin.updateOrderStatus(order.id, newStatus, statusNote, trackingNumber);
      setShowStatusModal(false);
      setStatusNote("");
      loadOrder();
    } catch (error) {
      console.error("Failed to update status:", error);
      alert("Failed to update order status");
    } finally {
      setUpdating(false);
    }
  };

  const handleRefund = async () => {
    if (!order) return;
    setUpdating(true);
    try {
      await api.admin.refundOrder(order.id, refundAmount, refundReason);
      setShowRefundModal(false);
      setRefundReason("");
      loadOrder();
    } catch (error) {
      console.error("Failed to process refund:", error);
      alert("Failed to process refund");
    } finally {
      setUpdating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatCurrency = (amount: number) => {
    return `${order?.currency || "UGX"} ${Number(amount).toLocaleString()}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    return statusOptions.find((s) => s.value === status)?.color || "bg-gray-100 text-gray-700";
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "SUCCESSFUL":
        return "bg-green-100 text-green-700";
      case "PENDING":
        return "bg-yellow-100 text-yellow-700";
      case "FAILED":
        return "bg-red-100 text-red-700";
      case "REFUNDED":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-gray-200 rounded-xl animate-pulse" />
          <div className="h-96 bg-gray-200 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Order not found</h2>
        <Link href="/admin/orders" className="text-primary hover:underline">
          Back to Orders
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/orders"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">#{order.orderNumber}</h1>
              <button
                onClick={() => copyToClipboard(order.orderNumber)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-gray-500 text-sm">{formatDate(order.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadOrder}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowStatusModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Edit2 className="w-4 h-4" />
            Update Status
          </button>
          {order.paymentStatus === "SUCCESSFUL" && order.status !== "REFUNDED" && (
            <button
              onClick={() => setShowRefundModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
            >
              <DollarSign className="w-4 h-4" />
              Refund
            </button>
          )}
        </div>
      </div>

      {/* Status Badges */}
      <div className="flex flex-wrap gap-3">
        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
          <Package className="w-4 h-4" />
          {order.status}
        </span>
        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${getPaymentStatusColor(order.paymentStatus)}`}>
          <CreditCard className="w-4 h-4" />
          Payment: {order.paymentStatus}
        </span>
        {order.paymentMethod && (
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
            {order.paymentMethod.replace("_", " ")}
          </span>
        )}
        {order.discreet && (
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 text-purple-700">
            Discreet Packaging
          </span>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <div className="bg-white rounded-xl border shadow-sm">
            <div className="px-6 py-4 border-b">
              <h2 className="font-semibold text-gray-900">Order Items</h2>
            </div>
            <div className="divide-y">
              {order.items.map((item) => (
                <div key={item.id} className="px-6 py-4 flex items-center gap-4">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Package className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-sm text-gray-500">
                      {formatCurrency(item.price)} × {item.quantity}
                    </p>
                  </div>
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(item.price * item.quantity)}
                  </p>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="text-gray-900">{formatCurrency(order.subtotal)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Discount</span>
                  <span className="text-green-600">-{formatCurrency(order.discount)}</span>
                </div>
              )}
              {order.tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Tax</span>
                  <span className="text-gray-900">{formatCurrency(order.tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Shipping</span>
                <span className="text-gray-900">
                  {order.shippingCost > 0 ? formatCurrency(order.shippingCost) : "Free"}
                </span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total</span>
                <span>{formatCurrency(order.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border shadow-sm">
            <div className="px-6 py-4 border-b">
              <h2 className="font-semibold text-gray-900">Order Timeline</h2>
            </div>
            <div className="p-6">
              {order.timeline.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No timeline events</p>
              ) : (
                <div className="space-y-4">
                  {order.timeline.map((event, index) => (
                    <div key={event.id} className="flex gap-4">
                      <div className="relative">
                        <div className={`w-3 h-3 rounded-full mt-1.5 ${
                          index === 0 ? "bg-primary" : "bg-gray-300"
                        }`} />
                        {index < order.timeline.length - 1 && (
                          <div className="absolute top-4 left-1.5 w-0.5 h-full -translate-x-1/2 bg-gray-200" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center justify-between">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(event.status)}`}>
                            {event.status}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDate(event.createdAt)}
                          </span>
                        </div>
                        {event.note && (
                          <p className="text-sm text-gray-600 mt-1">{event.note}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-white rounded-xl border shadow-sm">
            <div className="px-6 py-4 border-b">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <User className="w-5 h-5 text-gray-400" />
                Customer
              </h2>
            </div>
            <div className="p-6 space-y-3">
              <p className="font-medium text-gray-900">
                {order.customer.name || "Guest Customer"}
              </p>
              <p className="text-sm text-gray-500">{order.customer.email}</p>
              {order.customer.phone && (
                <p className="text-sm text-gray-500">{order.customer.phone}</p>
              )}
              <Link
                href={`/admin/customers/${order.customer.id}`}
                className="text-sm text-primary hover:underline"
              >
                View Customer Profile →
              </Link>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="bg-white rounded-xl border shadow-sm">
            <div className="px-6 py-4 border-b">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-gray-400" />
                Shipping Address
              </h2>
            </div>
            <div className="p-6">
              {order.shippingAddress ? (
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-gray-900">{order.shippingAddress.name}</p>
                  <p className="text-gray-600">{order.shippingAddress.phone}</p>
                  <p className="text-gray-600">{order.shippingAddress.street}</p>
                  <p className="text-gray-600">
                    {order.shippingAddress.city}
                    {order.shippingAddress.county && `, ${order.shippingAddress.county}`}
                  </p>
                  <p className="text-gray-600">{order.shippingAddress.country}</p>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No shipping address</p>
              )}
            </div>
          </div>

          {/* Tracking */}
          <div className="bg-white rounded-xl border shadow-sm">
            <div className="px-6 py-4 border-b">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-gray-400" />
                Shipping
              </h2>
            </div>
            <div className="p-6">
              {order.trackingNumber ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Tracking Number</p>
                    <p className="font-medium text-gray-900">{order.trackingNumber}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(order.trackingNumber!)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No tracking number yet</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Update Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Update Order Status</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {statusOptions.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
              {newStatus === "SHIPPED" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tracking Number
                  </label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Enter tracking number"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Note (optional)
                </label>
                <textarea
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  rows={3}
                  placeholder="Add a note about this status change..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowStatusModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateStatus}
                disabled={updating}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {updating ? "Updating..." : "Update Status"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Process Refund
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800">
                  This will initiate a refund for the customer. This action cannot be undone.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Refund Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    {order.currency}
                  </span>
                  <input
                    type="number"
                    min="0"
                    max={Number(order.totalAmount)}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(Number(e.target.value))}
                    className="w-full pl-16 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Maximum: {formatCurrency(order.totalAmount)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Refund
                </label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={3}
                  placeholder="Enter the reason for this refund..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  required
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowRefundModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleRefund}
                disabled={updating || !refundReason || refundAmount <= 0}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {updating ? "Processing..." : "Process Refund"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
