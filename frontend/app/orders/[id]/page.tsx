"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Section from "@/components/Section";
import { Package, Truck, CheckCircle, Clock, AlertCircle } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  price: number;
  imageUrl?: string;
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
  currency: string;
  shippingAddress: any;
  items: OrderItem[];
  events: OrderEvent[];
  createdAt: string;
  updatedAt: string;
}

const statusSteps = [
  { status: "PENDING", label: "Order Placed", icon: Clock },
  { status: "CONFIRMED", label: "Confirmed", icon: CheckCircle },
  { status: "PROCESSING", label: "Processing", icon: Package },
  { status: "SHIPPED", label: "Shipped", icon: Truck },
  { status: "DELIVERED", label: "Delivered", icon: CheckCircle },
];

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  PROCESSING: "bg-purple-100 text-purple-800",
  SHIPPED: "bg-indigo-100 text-indigo-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
  REFUNDED: "bg-gray-100 text-gray-800",
};

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/orders/${orderId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        if (res.status === 404) {
          setError("Order not found");
        } else {
          setError("Failed to load order");
        }
        return;
      }

      const data = await res.json();
      setOrder(data);
    } catch (err) {
      setError("Failed to load order");
    } finally {
      setLoading(false);
    }
  };

  const getCurrentStep = () => {
    if (!order) return -1;
    return statusSteps.findIndex((s) => s.status === order.status);
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
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">{error || "Order not found"}</h2>
          <p className="text-gray-600 mb-6">
            The order you're looking for doesn't exist or you don't have permission to view it.
          </p>
          <Link href="/account/orders" className="btn-primary">
            View My Orders
          </Link>
        </div>
      </Section>
    );
  }

  const currentStep = getCurrentStep();

  return (
    <Section>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Order #{order.orderNumber}</h1>
              <p className="text-gray-600">
                Placed on {new Date(order.createdAt).toLocaleDateString()}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[order.status]}`}>
              {order.status}
            </span>
          </div>
        </div>

        {/* Progress Tracker */}
        {order.status !== "CANCELLED" && order.status !== "REFUNDED" && (
          <div className="card mb-8">
            <h3 className="font-semibold mb-6">Order Progress</h3>
            <div className="relative">
              {/* Progress Line */}
              <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200">
                <div
                  className="h-full bg-accent transition-all"
                  style={{ width: `${(currentStep / (statusSteps.length - 1)) * 100}%` }}
                />
              </div>

              {/* Steps */}
              <div className="relative flex justify-between">
                {statusSteps.map((step, index) => {
                  const Icon = step.icon;
                  const isComplete = index <= currentStep;
                  const isCurrent = index === currentStep;

                  return (
                    <div key={step.status} className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center z-10 ${
                          isComplete
                            ? "bg-accent text-white"
                            : "bg-gray-200 text-gray-500"
                        } ${isCurrent ? "ring-4 ring-accent/20" : ""}`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <span
                        className={`mt-2 text-sm ${
                          isComplete ? "font-medium text-accent" : "text-gray-500"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Order Items */}
        <div className="card mb-8">
          <h3 className="font-semibold mb-4">Order Items</h3>
          <div className="divide-y">
            {order.items.map((item) => (
              <div key={item.id} className="py-4 flex items-center gap-4">
                <div className="w-16 h-16 bg-gray-100 rounded overflow-hidden">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.productName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <Package className="w-6 h-6" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium">{item.productName}</h4>
                  <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                </div>
                <div className="font-medium">
                  {order.currency} {(Number(item.price) * item.quantity).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order Summary */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Shipping Address */}
          {order.shippingAddress && (
            <div className="card">
              <h3 className="font-semibold mb-4">Shipping Address</h3>
              <div className="text-gray-600 space-y-1">
                <p className="font-medium text-gray-900">{order.shippingAddress.name}</p>
                <p>{order.shippingAddress.address}</p>
                <p>
                  {order.shippingAddress.city}, {order.shippingAddress.postalCode}
                </p>
                <p>{order.shippingAddress.country}</p>
                {order.shippingAddress.phone && <p>{order.shippingAddress.phone}</p>}
              </div>
            </div>
          )}

          {/* Payment Summary */}
          <div className="card">
            <h3 className="font-semibold mb-4">Payment Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span>{order.currency} {Number(order.subtotal).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Shipping</span>
                <span>
                  {Number(order.shippingCost) > 0
                    ? `${order.currency} ${Number(order.shippingCost).toLocaleString()}`
                    : "Free"}
                </span>
              </div>
              <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
                <span>Total</span>
                <span>{order.currency} {Number(order.totalAmount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Payment Status</span>
                <span className={order.paymentStatus === "SUCCESSFUL" ? "text-green-600" : ""}>
                  {order.paymentStatus}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Order Timeline */}
        {order.events && order.events.length > 0 && (
          <div className="card mt-6">
            <h3 className="font-semibold mb-4">Order Timeline</h3>
            <div className="space-y-4">
              {order.events.map((event, index) => (
                <div key={event.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 bg-accent rounded-full" />
                    {index < order.events.length - 1 && (
                      <div className="w-0.5 h-full bg-gray-200 mt-1" />
                    )}
                  </div>
                  <div className="pb-4">
                    <p className="font-medium">{event.message}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(event.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-8 flex gap-4">
          <Link href="/account/orders" className="btn-secondary">
            ← Back to Orders
          </Link>
          {order.status === "DELIVERED" && (
            <button className="btn-primary">Leave a Review</button>
          )}
        </div>
      </div>
    </Section>
  );
}
