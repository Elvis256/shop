"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Section from "@/components/Section";
import OrderSummary from "@/components/OrderSummary";
import { useCart } from "@/lib/hooks/useCart";
import { useToast } from "@/lib/hooks/useToast";
import { Check, CreditCard, Smartphone, Loader2, AlertCircle } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Step = 1 | 2 | 3;

interface ShippingData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  county: string;
  postalCode: string;
  discreet: boolean;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total: cartTotal, clearCart } = useCart();
  const { showToast } = useToast();
  
  const [step, setStep] = useState<Step>(1);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "mobile_money">("mobile_money");
  const [mobileNetwork, setMobileNetwork] = useState<"MPESA" | "AIRTEL" | "MTN">("MPESA");
  const [mobilePhone, setMobilePhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentPending, setPaymentPending] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  
  const [shipping, setShipping] = useState<ShippingData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    county: "",
    postalCode: "",
    discreet: true,
  });

  const steps = [
    { num: 1, label: "Shipping" },
    { num: 2, label: "Payment" },
    { num: 3, label: "Confirm" },
  ];

  const updateShipping = (field: keyof ShippingData, value: string | boolean) => {
    setShipping((prev) => ({ ...prev, [field]: value }));
  };

  const validateShipping = () => {
    if (!shipping.firstName || !shipping.lastName || !shipping.email || !shipping.phone || !shipping.address || !shipping.city) {
      setError("Please fill in all required fields");
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(shipping.email)) {
      setError("Please enter a valid email address");
      return false;
    }
    setError(null);
    return true;
  };

  const validatePayment = () => {
    if (paymentMethod === "mobile_money" && !mobilePhone) {
      setError("Please enter your mobile money phone number");
      return false;
    }
    setError(null);
    return true;
  };

  const processPayment = async () => {
    if (items.length === 0) {
      setError("Your cart is empty");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");
      
      const payload = {
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
        currency: "KES",
        amount: cartTotal,
        paymentMethod,
        ...(paymentMethod === "mobile_money" && {
          mobileMoney: {
            network: mobileNetwork,
            phone: mobilePhone,
          },
        }),
        customer: {
          name: `${shipping.firstName} ${shipping.lastName}`,
          email: shipping.email,
          phone: shipping.phone,
        },
        shippingAddress: {
          name: `${shipping.firstName} ${shipping.lastName}`,
          address: shipping.address,
          city: shipping.city,
          postalCode: shipping.postalCode,
          country: "Kenya",
          phone: shipping.phone,
        },
        discreet: shipping.discreet,
      };

      const res = await fetch(`${API_URL}/api/checkout/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Payment failed");
      }

      setOrderId(data.orderId);

      if (paymentMethod === "card" && data.paymentLink) {
        // Redirect to Flutterwave for card payment
        window.location.href = data.paymentLink;
      } else {
        // Mobile money - show pending screen
        setPaymentPending(true);
        showToast("Please approve the payment on your phone", "info");
        
        // Poll for payment status
        pollPaymentStatus(data.orderId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
      showToast("Payment failed. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const pollPaymentStatus = async (orderId: string) => {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes with 5-second intervals

    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/api/orders/${orderId}`);
        const data = await res.json();

        if (data.paymentStatus === "SUCCESSFUL") {
          clearCart();
          showToast("Payment successful!", "success");
          router.push(`/orders/${orderId}?success=true`);
          return;
        }

        if (data.paymentStatus === "FAILED") {
          setPaymentPending(false);
          setError("Payment was declined. Please try again.");
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 5000);
        } else {
          setPaymentPending(false);
          setError("Payment timeout. Please check your order status.");
        }
      } catch (err) {
        console.error("Failed to check payment status:", err);
      }
    };

    checkStatus();
  };

  // Mobile money pending screen
  if (paymentPending) {
    return (
      <Section>
        <div className="max-w-md mx-auto text-center py-16">
          <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Smartphone className="w-10 h-10 text-accent animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold mb-4">Approve Payment on Your Phone</h2>
          <p className="text-gray-600 mb-6">
            We've sent a payment request to <strong>{mobilePhone}</strong>. 
            Please check your phone and enter your {mobileNetwork} PIN to complete the payment.
          </p>
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Waiting for payment confirmation...</span>
          </div>
          <button
            onClick={() => setPaymentPending(false)}
            className="btn-secondary mt-8"
          >
            Cancel
          </button>
        </div>
      </Section>
    );
  }

  return (
    <Section title="Checkout">
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-4 mb-12">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                step >= s.num
                  ? "bg-accent text-white"
                  : "bg-gray-100 text-text-muted"
              }`}
            >
              {step > s.num ? <Check className="w-5 h-5" /> : s.num}
            </div>
            <span className="ml-2 font-medium hidden sm:inline">{s.label}</span>
            {i < steps.length - 1 && (
              <div className="w-12 h-0.5 bg-gray-200 mx-4" />
            )}
          </div>
        ))}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="max-w-2xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Form */}
        <div className="lg:col-span-2">
          {step === 1 && (
            <div className="card space-y-6">
              <h3>Shipping Information</h3>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-small font-medium mb-2">First Name *</label>
                  <input
                    className="input"
                    placeholder="John"
                    value={shipping.firstName}
                    onChange={(e) => updateShipping("firstName", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-small font-medium mb-2">Last Name *</label>
                  <input
                    className="input"
                    placeholder="Doe"
                    value={shipping.lastName}
                    onChange={(e) => updateShipping("lastName", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-small font-medium mb-2">Email *</label>
                <input
                  className="input"
                  type="email"
                  placeholder="john@example.com"
                  value={shipping.email}
                  onChange={(e) => updateShipping("email", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-small font-medium mb-2">Phone *</label>
                <input
                  className="input"
                  type="tel"
                  placeholder="+254 712 345 678"
                  value={shipping.phone}
                  onChange={(e) => updateShipping("phone", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-small font-medium mb-2">Address *</label>
                <input
                  className="input"
                  placeholder="Street address"
                  value={shipping.address}
                  onChange={(e) => updateShipping("address", e.target.value)}
                />
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-small font-medium mb-2">City *</label>
                  <input
                    className="input"
                    placeholder="Nairobi"
                    value={shipping.city}
                    onChange={(e) => updateShipping("city", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-small font-medium mb-2">County</label>
                  <input
                    className="input"
                    placeholder="Nairobi"
                    value={shipping.county}
                    onChange={(e) => updateShipping("county", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-small font-medium mb-2">Postal Code</label>
                  <input
                    className="input"
                    placeholder="00100"
                    value={shipping.postalCode}
                    onChange={(e) => updateShipping("postalCode", e.target.value)}
                  />
                </div>
              </div>

              {/* Discreet Option */}
              <label className="flex items-start gap-3 p-4 border border-border rounded-8 cursor-pointer hover:border-accent">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={shipping.discreet}
                  onChange={(e) => updateShipping("discreet", e.target.checked)}
                />
                <div>
                  <span className="font-medium">Discreet Shipping</span>
                  <p className="text-small text-text-muted">
                    Plain packaging with neutral sender name. No product info on the label.
                  </p>
                </div>
              </label>

              <button
                onClick={() => validateShipping() && setStep(2)}
                className="btn-primary w-full"
              >
                Continue to Payment
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="card space-y-6">
              <h3>Payment Method</h3>

              {/* Payment Options */}
              <div className="space-y-4">
                <label
                  className={`flex items-center gap-4 p-4 border rounded-8 cursor-pointer ${
                    paymentMethod === "mobile_money" ? "border-accent bg-accent/5" : "border-border"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === "mobile_money"}
                    onChange={() => setPaymentMethod("mobile_money")}
                  />
                  <Smartphone className="w-6 h-6" />
                  <div>
                    <span className="font-medium">Mobile Money</span>
                    <p className="text-small text-text-muted">M-Pesa, Airtel Money, MTN MoMo</p>
                  </div>
                </label>

                <label
                  className={`flex items-center gap-4 p-4 border rounded-8 cursor-pointer ${
                    paymentMethod === "card" ? "border-accent bg-accent/5" : "border-border"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === "card"}
                    onChange={() => setPaymentMethod("card")}
                  />
                  <CreditCard className="w-6 h-6" />
                  <div>
                    <span className="font-medium">Credit/Debit Card</span>
                    <p className="text-small text-text-muted">Visa, Mastercard - Secure checkout via Flutterwave</p>
                  </div>
                </label>
              </div>

              {/* Mobile Money Form */}
              {paymentMethod === "mobile_money" && (
                <div className="space-y-4 pt-4 border-t border-border">
                  <div>
                    <label className="block text-small font-medium mb-2">Select Network</label>
                    <select
                      className="input-select"
                      value={mobileNetwork}
                      onChange={(e) => setMobileNetwork(e.target.value as any)}
                    >
                      <option value="MPESA">M-Pesa (Kenya)</option>
                      <option value="AIRTEL">Airtel Money (Kenya/Uganda)</option>
                      <option value="MTN">MTN MoMo (Uganda)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-small font-medium mb-2">Phone Number *</label>
                    <input
                      className="input"
                      placeholder="+254 712 345 678"
                      value={mobilePhone}
                      onChange={(e) => setMobilePhone(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter the phone number registered with {mobileNetwork}
                    </p>
                  </div>
                </div>
              )}

              {/* Card Info */}
              {paymentMethod === "card" && (
                <div className="p-4 bg-gray-50 rounded-8">
                  <p className="text-sm text-gray-600">
                    You'll be redirected to Flutterwave's secure payment page to complete your card payment.
                  </p>
                </div>
              )}

              <div className="flex gap-4">
                <button onClick={() => setStep(1)} className="btn-secondary flex-1">
                  Back
                </button>
                <button
                  onClick={() => validatePayment() && setStep(3)}
                  className="btn-primary flex-1"
                >
                  Review Order
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="card space-y-6">
              <h3>Review & Confirm</h3>

              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-8">
                  <h4 className="font-medium mb-2">Shipping</h4>
                  <p className="text-small text-text-muted">
                    {shipping.firstName} {shipping.lastName}<br />
                    {shipping.address}<br />
                    {shipping.city}, {shipping.county} {shipping.postalCode}<br />
                    {shipping.email} | {shipping.phone}
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-8">
                  <h4 className="font-medium mb-2">Payment</h4>
                  <p className="text-small text-text-muted">
                    {paymentMethod === "mobile_money"
                      ? `${mobileNetwork} - ${mobilePhone}`
                      : "Credit/Debit Card (via Flutterwave)"}
                  </p>
                </div>
              </div>

              {shipping.discreet && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-8">
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <span className="font-medium text-green-800">Discreet Order</span>
                      <p className="text-small text-green-700">
                        Your order will be shipped in plain packaging with no product details.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={() => setStep(2)}
                  className="btn-secondary flex-1"
                  disabled={loading}
                >
                  Back
                </button>
                <button
                  onClick={processPayment}
                  disabled={loading || items.length === 0}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    `Place Order - KES ${cartTotal.toLocaleString()}`
                  )}
                </button>
              </div>

              <p className="text-center text-small text-text-muted">
                By placing this order, you agree to our Terms of Service and Privacy Policy.
              </p>
            </div>
          )}
        </div>

        {/* Order Summary */}
        <div>
          <OrderSummary />
        </div>
      </div>
    </Section>
  );
}
