"use client";

import { useState } from "react";
import Link from "next/link";
import Section from "@/components/Section";
import { 
  Package, Truck, CheckCircle, Clock, Search, AlertCircle,
  MapPin, CreditCard, ShoppingBag, Shield
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface OrderItem {
  name: string;
  productSlug: string;
  quantity: number;
  price: number;
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

interface Order {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string;
  customerName: string;
  shippingAddress: string;
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

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  PROCESSING: "bg-purple-100 text-purple-800",
  SHIPPED: "bg-indigo-100 text-indigo-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
  REFUNDED: "bg-gray-100 text-gray-800",
};

export default function TrackOrderPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!orderNumber.trim()) {
      setError("Please enter an order number");
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const res = await fetch(`${API_URL}/api/orders/track/${orderNumber.trim()}`);
      
      if (!res.ok) {
        if (res.status === 404) {
          setError("Order not found. Please check your order number and try again.");
        } else {
          setError("Failed to fetch order. Please try again.");
        }
        setOrder(null);
        return;
      }

      const data = await res.json();
      setOrder(data);
    } catch (err) {
      setError("Connection error. Please try again.");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Section className="bg-gradient-to-b from-accent/5 to-transparent">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Track Your Order</h1>
          <p className="text-gray-600 mb-8">
            Enter your order number to see the current status and estimated delivery time.
          </p>

          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="Enter order number (e.g., ORD-2026-XXXXX)"
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary px-8"
            >
              {loading ? "Searching..." : "Track"}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>
      </Section>

      {order && (
        <Section>
          <div className="max-w-4xl mx-auto">
            {/* Order Header */}
            <div className="card mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">Order #{order.orderNumber}</h2>
                  <p className="text-gray-600">
                    Placed on {new Date(order.createdAt).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex gap-3">
                  <span className={`px-4 py-2 rounded-full text-sm font-medium ${statusColors[order.status]}`}>
                    {order.status.replace("_", " ")}
                  </span>
                  {order.discreet && (
                    <span className="px-4 py-2 rounded-full text-sm font-medium bg-gray-100 text-gray-700 flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Discreet
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Status Progress */}
            {order.status !== "CANCELLED" && order.status !== "REFUNDED" && (
              <div className="card mb-6">
                <h3 className="font-semibold mb-6">Delivery Progress</h3>
                
                {/* Progress Bar */}
                <div className="relative mb-8">
                  <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200 rounded">
                    <div
                      className="h-full bg-accent rounded transition-all duration-500"
                      style={{
                        width: `${(order.statusSteps.filter(s => s.completed).length - 1) / (order.statusSteps.length - 1) * 100}%`
                      }}
                    />
                  </div>

                  <div className="relative flex justify-between">
                    {order.statusSteps.map((step) => {
                      const Icon = statusIcons[step.status] || Clock;
                      return (
                        <div key={step.status} className="flex flex-col items-center">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center z-10 transition-all ${
                              step.completed
                                ? "bg-accent text-white"
                                : "bg-gray-200 text-gray-400"
                            } ${step.current ? "ring-4 ring-accent/20 scale-110" : ""}`}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="mt-3 text-center">
                            <p className={`text-sm font-medium ${step.completed ? "text-accent" : "text-gray-500"}`}>
                              {step.label}
                            </p>
                            <p className="text-xs text-gray-400 hidden md:block max-w-[100px]">
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
                  <div className="bg-accent/5 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Tracking Number</p>
                      <p className="font-mono font-semibold">{order.trackingNumber}</p>
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(order.trackingNumber!)}
                      className="btn-secondary text-sm"
                    >
                      Copy
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Order Details Grid */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {/* Items */}
              <div className="card">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-accent" />
                  Order Items
                </h3>
                <div className="space-y-3">
                  {order.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <div>
                        <Link 
                          href={`/product/${item.productSlug}`}
                          className="font-medium hover:text-accent"
                        >
                          {item.name}
                        </Link>
                        <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                      </div>
                      <span className="font-medium">
                        {order.currency} {(Number(item.price) * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t mt-4 pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span>{order.currency} {Number(order.subtotal).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Shipping</span>
                    <span>{Number(order.shipping) > 0 ? `${order.currency} ${Number(order.shipping).toLocaleString()}` : "Free"}</span>
                  </div>
                  {Number(order.discount) > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount</span>
                      <span>-{order.currency} {Number(order.discount).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>Total</span>
                    <span>{order.currency} {Number(order.total).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Shipping & Payment */}
              <div className="space-y-6">
                <div className="card">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-accent" />
                    Shipping Address
                  </h3>
                  <p className="text-gray-600 whitespace-pre-line">{order.shippingAddress}</p>
                </div>

                <div className="card">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-accent" />
                    Payment
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status</span>
                      <span className={order.paymentStatus === "SUCCESSFUL" ? "text-green-600 font-medium" : ""}>
                        {order.paymentStatus}
                      </span>
                    </div>
                    {order.paymentMethod && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Method</span>
                        <span>{order.paymentMethod}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline */}
            {order.timeline && order.timeline.length > 0 && (
              <div className="card">
                <h3 className="font-semibold mb-4">Order Timeline</h3>
                <div className="space-y-4">
                  {order.timeline.map((event, index) => (
                    <div key={index} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 bg-accent rounded-full" />
                        {index < order.timeline.length - 1 && (
                          <div className="w-0.5 flex-1 bg-gray-200 mt-1" />
                        )}
                      </div>
                      <div className="pb-4">
                        <p className="font-medium">{event.status}</p>
                        {event.note && <p className="text-gray-600">{event.note}</p>}
                        <p className="text-sm text-gray-400">
                          {new Date(event.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Help Section */}
            <div className="mt-8 text-center text-gray-600">
              <p>
                Need help with your order?{" "}
                <Link href="/contact" className="text-accent hover:underline font-medium">
                  Contact Support
                </Link>
              </p>
            </div>
          </div>
        </Section>
      )}

      {/* Help Section when no order is shown */}
      {searched && !order && !loading && (
        <Section>
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-xl font-semibold mb-4">Can't Find Your Order?</h2>
            <div className="grid md:grid-cols-2 gap-6 text-left">
              <div className="card">
                <h3 className="font-medium mb-2">Check Your Email</h3>
                <p className="text-gray-600 text-sm">
                  Look for an order confirmation email. Your order number starts with "ORD-".
                </p>
              </div>
              <div className="card">
                <h3 className="font-medium mb-2">Need Help?</h3>
                <p className="text-gray-600 text-sm">
                  <Link href="/contact" className="text-accent hover:underline">
                    Contact our support team
                  </Link>{" "}
                  with your email address.
                </p>
              </div>
            </div>
          </div>
        </Section>
      )}
    </>
  );
}
