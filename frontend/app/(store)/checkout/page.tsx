"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Section from "@/components/Section";
import OrderSummary from "@/components/OrderSummary";
import { useCart } from "@/lib/hooks/useCart";
import { useShippingConfig } from "@/lib/hooks/useShippingConfig";
import { useToast } from "@/lib/hooks/useToast";
import { useAuth } from "@/lib/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { parseDaysRange, formatDateRange } from "@/components/DeliveryEstimate";
import { Check, CreditCard, Smartphone, Loader2, AlertCircle, Shield, Package, Plane, Zap, Lock, Eye, Truck, Banknote, Wallet } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

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
  const { items, total: cartTotal, clearCart, updateItemBadge, cartId } = useCart();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const { config: shippingConfig, calculateShipping } = useShippingConfig();
  
  const [step, setStep] = useState<Step>(1);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "mobile_money" | "paypal" | "cod">("mobile_money");
  const [mobileNetwork, setMobileNetwork] = useState<"MPESA" | "AIRTEL" | "MTN">("MTN");
  const [mobilePhone, setMobilePhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentPending, setPaymentPending] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<Record<string, string>>({});

  // Installments state
  const [installmentsEnabled, setInstallmentsEnabled] = useState(false);
  const [installmentCount, setInstallmentCount] = useState(2);
  
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

  // Store credit state
  const [storeCreditBalance, setStoreCreditBalance] = useState(0);
  const [storeCreditAmount, setStoreCreditAmount] = useState(0);
  const [storeCreditApplied, setStoreCreditApplied] = useState(false);
  const [storeCreditLoading, setStoreCreditLoading] = useState(false);

  // Fetch store credit balance for authenticated users
  useEffect(() => {
    if (user) {
      const token = localStorage.getItem("token");
      fetch(`${API_URL}/api/store-credit`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d && d.balance > 0) setStoreCreditBalance(d.balance);
        })
        .catch(() => {});
    }
  }, [user]);

  const applyStoreCredit = () => {
    if (storeCreditAmount > 0 && storeCreditAmount <= storeCreditBalance) {
      setStoreCreditApplied(true);
    }
  };

  const removeStoreCredit = () => {
    setStoreCreditApplied(false);
    setStoreCreditAmount(0);
  };

  // Enrich cart items missing shippingBadge
  useEffect(() => {
    const missingBadge = items.filter((i) => !i.shippingBadge);
    if (missingBadge.length === 0) return;

    Promise.all(
      missingBadge.map((item) =>
        fetch(`${API_URL}/api/products/${item.slug}`)
          .then((r) => r.json())
          .then((data) => ({
            productId: item.productId,
            badge: data.shippingBadge || "Express",
          }))
          .catch(() => ({ productId: item.productId, badge: "Express" as const }))
      )
    ).then((results) => {
      results.forEach(({ productId, badge }) => {
        updateItemBadge(productId, badge as "From Abroad" | "Express");
      });
    });
  }, [items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasInternational = items.some((i) => i.shippingBadge === "From Abroad");
  const hasLocal = items.some((i) => i.shippingBadge !== "From Abroad");

  // Dynamic shipping calculation from admin settings
  const shippingCalc = calculateShipping(items, shipping.city || "Kampala");
  const shippingCost = shippingCalc.total;
  const orderTotal = cartTotal + shippingCost;
  const creditDiscount = storeCreditApplied ? Math.min(storeCreditAmount, orderTotal) : 0;
  const finalTotal = orderTotal - creditDiscount;

  // Auto-fill from logged-in user
  useEffect(() => {
    if (user) {
      const nameParts = (user.name || "").split(" ");
      setShipping((prev) => ({
        ...prev,
        firstName: prev.firstName || nameParts[0] || "",
        lastName: prev.lastName || nameParts.slice(1).join(" ") || "",
        email: prev.email || user.email || "",
        phone: prev.phone || user.phone || "",
        city: prev.city || "Kampala",
        county: prev.county || "Kampala",
      }));
    }
  }, [user]);

  // Fetch payment settings from public API
  useEffect(() => {
    fetch(`${API_URL}/api/settings/public`)
      .then((r) => r.json())
      .then((data) => {
        const s = data?.settings || data || {};
        setPaymentSettings(s);
        // Auto-select first enabled payment method
        const methods: Array<{ key: string; id: "mobile_money" | "card" | "paypal" | "cod" }> = [
          { key: "payment_mobile_money_enabled", id: "mobile_money" },
          { key: "payment_card_enabled", id: "card" },
          { key: "payment_paypal_enabled", id: "paypal" },
          { key: "payment_cod_enabled", id: "cod" },
        ];
        const first = methods.find((m) => s[m.key] === "true");
        if (first) setPaymentMethod(first.id);
      })
      .catch(() => {});
  }, []);

  // If a payment key hasn't been configured at all, treat it as enabled (backwards-compatible default)
  const hasAnyPaymentConfig = Object.keys(paymentSettings).some((k) => k.startsWith("payment_") && k.endsWith("_enabled"));
  const isPaymentEnabled = (key: string) =>
    hasAnyPaymentConfig ? paymentSettings[key] === "true" : key !== "payment_cod_enabled";

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
        cartId: cartId || undefined,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
        currency: "UGX",
        amount: orderTotal,
        shipping: shippingCost,
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
          country: "Uganda",
          phone: shipping.phone,
        },
        discreet: shipping.discreet,
        // Include affiliate referral code if present
        ...(typeof window !== "undefined" && localStorage.getItem("affiliate_ref")
          ? { affiliateCode: localStorage.getItem("affiliate_ref") }
          : {}),
      };

      const csrf = getCsrfToken();
      const res = await fetch(`${API_URL}/api/checkout/create`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(csrf ? { "x-csrf-token": csrf } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Payment failed");
      }

      setOrderId(data.orderId);

      // Create installment plan if enabled
      if (installmentsEnabled && data.orderId) {
        try {
          const installHeaders: Record<string, string> = { "Content-Type": "application/json" };
          if (token) installHeaders["Authorization"] = `Bearer ${token}`;
          if (csrf) installHeaders["x-csrf-token"] = csrf;
          await fetch(`${API_URL}/api/installments/create`, {
            method: "POST",
            headers: installHeaders,
            credentials: "include",
            body: JSON.stringify({
              orderId: data.orderId,
              totalAmount: finalTotal,
              installments: installmentCount,
              currency: "UGX",
            }),
          });
        } catch {
          // Installment creation failure is non-blocking
        }
      }

      if (data.paymentLink) {
        // Redirect to PayPal or Flutterwave
        window.location.href = data.paymentLink;
      } else if (data.paymentMethod === "cod" || paymentMethod === "cod") {
        // Cash on Delivery - order placed, redirect to confirmation
        clearCart();
        showToast("Order placed! Pay on delivery.", "success");
        router.push(`/orders/${data.orderId}?success=true`);
      } else if (paymentMethod === "mobile_money") {
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

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Form */}
        <div className="lg:col-span-2">
          {step === 1 && (
            <div className="card space-y-6">
              <h3 className="flex items-center gap-2"><Package className="w-5 h-5 text-accent" />Shipping Information</h3>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-small font-medium mb-2">First Name *</label>
                  <input
                    className="input"
                    placeholder="John"
                    autoComplete="given-name"
                    value={shipping.firstName}
                    onChange={(e) => updateShipping("firstName", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-small font-medium mb-2">Last Name *</label>
                  <input
                    className="input"
                    placeholder="Doe"
                    autoComplete="family-name"
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
                  autoComplete="email"
                  value={shipping.email}
                  onChange={(e) => updateShipping("email", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-small font-medium mb-2">Phone * <span className="text-text-muted font-normal">(Uganda format)</span></label>
                <input
                  className="input"
                  type="tel"
                  placeholder="+256 700 000 000"
                  autoComplete="tel"
                  value={shipping.phone}
                  onChange={(e) => updateShipping("phone", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-small font-medium mb-2">Address *</label>
                <input
                  className="input"
                  placeholder="Street address"
                  autoComplete="street-address"
                  value={shipping.address}
                  onChange={(e) => updateShipping("address", e.target.value)}
                />
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-small font-medium mb-2">City *</label>
                  <input
                    className="input"
                    placeholder="Kampala"
                    autoComplete="address-level2"
                    value={shipping.city}
                    onChange={(e) => updateShipping("city", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-small font-medium mb-2">District</label>
                  <input
                    className="input"
                    placeholder="Kampala"
                    autoComplete="address-level1"
                    value={shipping.county}
                    onChange={(e) => updateShipping("county", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-small font-medium mb-2">Postal Code</label>
                  <input
                    className="input"
                    placeholder="e.g. 256"
                    autoComplete="postal-code"
                    value={shipping.postalCode}
                    onChange={(e) => updateShipping("postalCode", e.target.value)}
                  />
                </div>
              </div>

              {/* Discreet Option */}
              <label className="flex items-start gap-3 p-4 border border-border rounded-8 cursor-pointer hover:border-accent transition-colors">
                <input
                  type="checkbox"
                  className="mt-1 accent-accent"
                  checked={shipping.discreet}
                  onChange={(e) => updateShipping("discreet", e.target.checked)}
                />
                <div>
                  <span className="font-medium flex items-center gap-2">
                    <Eye className="w-4 h-4 text-accent" />Discreet Shipping
                  </span>
                  <p className="text-small text-text-muted">
                    Plain packaging with neutral sender name. No product info on the label.
                  </p>
                </div>
              </label>

              {/* Delivery Estimates */}
              {items.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-8 space-y-3">
                  <h4 className="text-small font-medium flex items-center gap-2">
                    <Truck className="w-4 h-4 text-accent" />Estimated Delivery
                  </h4>
                  {hasLocal && (() => {
                    const range = parseDaysRange(shippingConfig.standardDays);
                    return (
                      <div className="flex items-center gap-2 text-small">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          <Zap className="w-3 h-3" />Express
                        </span>
                        <span className="text-text-muted">
                          {shippingConfig.standardDays} (Kampala &amp; nearby)
                          {range && <> — arrives {formatDateRange(range.min, range.max)}</>}
                        </span>
                      </div>
                    );
                  })()}
                  {hasInternational && (() => {
                    const range = parseDaysRange(shippingConfig.intlDays);
                    return (
                      <div className="flex items-center gap-2 text-small">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                          <Plane className="w-3 h-3" />From Abroad
                        </span>
                        <span className="text-text-muted">
                          {shippingConfig.intlDays} (international shipping)
                          {range && <> — arrives {formatDateRange(range.min, range.max)}</>}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}

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
              <h3 className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-accent" />Payment Method</h3>

              {/* Payment Options */}
              <div className="space-y-4">
                {isPaymentEnabled("payment_mobile_money_enabled") && (
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
                    <p className="text-small text-text-muted">MTN MoMo, Airtel Money (Uganda)</p>
                  </div>
                </label>
                )}

                {isPaymentEnabled("payment_card_enabled") && (
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
                    <span className="font-medium">Pay with Flutterwave</span>
                    <p className="text-small text-text-muted">Card, Mobile Money, Bank Transfer, USSD & more</p>
                  </div>
                </label>
                )}

                {isPaymentEnabled("payment_paypal_enabled") && (
                <label
                  className={`flex items-center gap-4 p-4 border rounded-8 cursor-pointer ${
                    paymentMethod === "paypal" ? "border-accent bg-accent/5" : "border-border"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === "paypal"}
                    onChange={() => setPaymentMethod("paypal")}
                  />
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                    <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.77.77 0 0 1 .757-.645h6.613c2.188 0 3.834.562 4.77 1.524.42.432.715.92.876 1.456.17.563.208 1.238.116 2.01-.006.051-.013.103-.02.154a6.52 6.52 0 0 1-.248 1.12 5.74 5.74 0 0 1-.491 1.077 4.37 4.37 0 0 1-.743.896c-.321.309-.7.562-1.126.76-.418.194-.894.34-1.417.434-.512.093-1.08.14-1.687.14H9.44a.96.96 0 0 0-.946.806l-.858 5.438a.64.64 0 0 1-.633.538l.073-.095z" fill="#003087"/>
                    <path d="M19.152 8.024c-.006.051-.013.103-.02.154-.726 3.718-3.214 5.002-6.39 5.002H11.13a.77.77 0 0 0-.757.645l-.823 5.218-.234 1.48a.405.405 0 0 0 .4.467h2.807a.674.674 0 0 0 .665-.567l.027-.142.528-3.343.034-.185a.674.674 0 0 1 .665-.567h.418c2.714 0 4.838-1.1 5.461-4.286.26-1.332.126-2.444-.563-3.226a2.68 2.68 0 0 0-.77-.555l.164.105z" fill="#0070E0"/>
                  </svg>
                  <div>
                    <span className="font-medium">PayPal</span>
                    <p className="text-small text-text-muted">Pay securely with your PayPal account (charged in USD)</p>
                  </div>
                </label>
                )}

                {isPaymentEnabled("payment_cod_enabled") && (
                <label
                  className={`flex items-center gap-4 p-4 border rounded-8 cursor-pointer ${
                    paymentMethod === "cod" ? "border-accent bg-accent/5" : "border-border"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === "cod"}
                    onChange={() => setPaymentMethod("cod")}
                  />
                  <Banknote className="w-6 h-6" />
                  <div>
                    <span className="font-medium">Cash on Delivery</span>
                    <p className="text-small text-text-muted">Pay when you receive your order</p>
                  </div>
                </label>
                )}
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
                      <option value="MTN">MTN MoMo Uganda</option>
                      <option value="AIRTEL">Airtel Money Uganda</option>
                      <option value="MPESA">M-Pesa (Kenya/Uganda)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-small font-medium mb-2">Phone Number *</label>
                    <input
                      className="input"
                      placeholder="+256 700 000 000"
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
                <div className="p-4 bg-gray-50 rounded-8 flex items-start gap-3">
                  <Lock className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Secure Flutterwave Checkout</p>
                    <p className="text-xs text-gray-500 mt-1">
                      You'll be redirected to Flutterwave's secure payment page where you can pay with:
                    </p>
                    <ul className="text-xs text-gray-500 mt-2 space-y-1">
                      <li>💳 Visa, Mastercard & Verve cards</li>
                      <li>📱 Mobile Money (MTN, Airtel)</li>
                      <li>🏦 Bank Transfer & USSD</li>
                    </ul>
                    <p className="text-xs text-gray-400 mt-2">
                      Your payment details are never stored on our servers.
                    </p>
                  </div>
                </div>
              )}

              {/* PayPal Info */}
              {paymentMethod === "paypal" && (
                <div className="p-4 bg-blue-50 rounded-8 flex items-start gap-3">
                  <Lock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">PayPal Secure Checkout</p>
                    <p className="text-xs text-blue-700 mt-1">
                      You'll be redirected to PayPal to complete payment. Amount will be converted from UGX to USD at the current exchange rate.
                    </p>
                  </div>
                </div>
              )}

              {/* COD Info */}
              {paymentMethod === "cod" && (
                <div className="p-4 bg-amber-50 rounded-8 flex items-start gap-3">
                  <Banknote className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-900">Cash on Delivery</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Pay with cash when your order is delivered. Please have the exact amount ready.
                    </p>
                  </div>
                </div>
              )}

              {/* Pay in Installments */}
              <div className="border border-border rounded-8 overflow-hidden">
                <label className="flex items-center gap-3 p-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={installmentsEnabled}
                    onChange={(e) => setInstallmentsEnabled(e.target.checked)}
                    className="accent-accent"
                  />
                  <div>
                    <span className="font-medium text-sm">Pay in Installments</span>
                    <p className="text-xs text-text-muted">Split your payment into smaller amounts</p>
                  </div>
                </label>

                {installmentsEnabled && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Number of payments
                    </label>
                    <div className="flex gap-2">
                      {[2, 3, 4].map((n) => (
                        <button
                          key={n}
                          onClick={() => setInstallmentCount(n)}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                            installmentCount === n
                              ? "border-accent bg-accent/10 text-accent"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          {n} payments
                        </button>
                      ))}
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                      <p className="text-sm font-medium text-gray-900">Payment schedule:</p>
                      {Array.from({ length: installmentCount }).map((_, i) => {
                        const amount = Math.ceil(finalTotal / installmentCount);
                        const isFirst = i === 0;
                        return (
                          <p key={i} className="text-xs text-gray-600 flex justify-between">
                            <span>{isFirst ? "Today" : `In ${i * 2} weeks`}</span>
                            <span className="font-medium">{formatPrice(i === installmentCount - 1 ? finalTotal - amount * (installmentCount - 1) : amount)}</span>
                          </p>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {paymentSettings.payment_instructions && (
                <p className="text-xs text-text-muted italic">{paymentSettings.payment_instructions}</p>
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
              <h3 className="flex items-center gap-2"><Check className="w-5 h-5 text-accent" />Review & Confirm</h3>

              {/* Items Review */}
              <div className="space-y-3 p-4 bg-gray-50 rounded-8">
                <h4 className="font-medium text-small flex items-center gap-2">
                  <Package className="w-4 h-4" />Items ({items.length})
                </h4>
                {items.map((item) => (
                  <div key={item.productId} className="flex items-center gap-3 text-small">
                    <span className="flex-1 line-clamp-1">{item.name}</span>
                    {item.shippingBadge === "From Abroad" ? (
                      <span className="text-[10px] font-medium text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">✈️ Intl</span>
                    ) : (
                      <span className="text-[10px] font-medium text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">⚡ Express</span>
                    )}
                    <span className="text-text-muted">×{item.quantity}</span>
                    <span className="font-medium">{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-8">
                  <h4 className="font-medium mb-2 flex items-center gap-2 text-small">
                    <Truck className="w-4 h-4 text-accent" />Shipping To
                  </h4>
                  <p className="text-small text-text-muted">
                    {shipping.firstName} {shipping.lastName}<br />
                    {shipping.address}<br />
                    {shipping.city}{shipping.county ? `, ${shipping.county}` : ""} {shipping.postalCode}<br />
                    {shipping.phone}
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-8">
                  <h4 className="font-medium mb-2 flex items-center gap-2 text-small">
                    <CreditCard className="w-4 h-4 text-accent" />Payment
                  </h4>
                  <p className="text-small text-text-muted">
                    {paymentMethod === "mobile_money"
                      ? `${mobileNetwork} Mobile Money`
                      : paymentMethod === "paypal"
                      ? "PayPal"
                      : paymentMethod === "cod"
                      ? "Cash on Delivery"
                      : "Flutterwave (Card, Mobile Money, Bank & more)"}
                  </p>
                  <p className="text-small text-text-muted mt-1">
                    {paymentMethod === "mobile_money"
                      ? mobilePhone
                      : paymentMethod === "paypal"
                      ? "Secure checkout via PayPal (charged in USD)"
                      : paymentMethod === "cod"
                      ? "Pay cash when you receive your order"
                      : "Via Flutterwave secure checkout"}
                  </p>
                </div>
              </div>

              {/* Delivery Estimates */}
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-8 space-y-2">
                <h4 className="font-medium text-small text-blue-900 flex items-center gap-2">
                  <Truck className="w-4 h-4" />Estimated Delivery
                </h4>
                {hasLocal && (() => {
                  const range = parseDaysRange(shippingConfig.standardDays);
                  return (
                    <p className="text-small text-blue-800">
                      ⚡ Local items: <strong>{shippingConfig.standardDays}</strong>
                      {range && <> — arrives {formatDateRange(range.min, range.max)}</>}
                    </p>
                  );
                })()}
                {hasInternational && (() => {
                  const range = parseDaysRange(shippingConfig.intlDays);
                  return (
                    <p className="text-small text-blue-800">
                      ✈️ International items: <strong>{shippingConfig.intlDays}</strong>
                      {range && <> — arrives {formatDateRange(range.min, range.max)}</>}
                    </p>
                  );
                })()}
              </div>

              {/* Store Credit */}
              {user && storeCreditBalance > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-8 space-y-3">
                  <h4 className="font-medium text-small text-amber-900 flex items-center gap-2">
                    <Wallet className="w-4 h-4" />Store Credit
                  </h4>
                  <p className="text-small text-amber-800">
                    Available balance: <strong>{formatPrice(storeCreditBalance)}</strong>
                  </p>
                  {!storeCreditApplied ? (
                    <div className="flex gap-2">
                      <input
                        type="number"
                        className="input flex-1"
                        placeholder="Amount to apply"
                        min={0}
                        max={Math.min(storeCreditBalance, orderTotal)}
                        value={storeCreditAmount || ""}
                        onChange={(e) => setStoreCreditAmount(Math.min(Number(e.target.value), storeCreditBalance, orderTotal))}
                      />
                      <button
                        onClick={applyStoreCredit}
                        disabled={storeCreditAmount <= 0}
                        className="btn-secondary"
                      >
                        Apply
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-small text-green-700">
                        ✓ Credit applied: −{formatPrice(creditDiscount)}
                      </span>
                      <button onClick={removeStoreCredit} className="text-small text-red-600 hover:underline">
                        Remove
                      </button>
                    </div>
                  )}
                  {storeCreditApplied && (
                    <p className="text-small font-semibold text-amber-900">
                      New total: {formatPrice(finalTotal)}
                    </p>
                  )}
                </div>
              )}

              {shipping.discreet && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-8">
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <span className="font-medium text-green-800">Discreet Order Confirmed</span>
                      <p className="text-small text-green-700">
                        Plain packaging • Neutral sender name • Anonymous billing
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
                    <>
                      <Lock className="w-4 h-4" />
                      {`Pay ${formatPrice(finalTotal)}`}
                    </>
                  )}
                </button>
              </div>

              <p className="text-center text-small text-text-muted">
                By placing this order, you agree to our{" "}
                <Link href="/policies/terms" className="underline hover:text-text">Terms of Service</Link> and{" "}
                <Link href="/policies/privacy" className="underline hover:text-text">Privacy Policy</Link>.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-xs text-text-muted border-t border-border">
                <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-green-600" />256-bit SSL</span>
                <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5 text-green-600" />Discreet Packaging</span>
                <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5 text-green-600" />Anonymous Billing</span>
              </div>
            </div>
          )}
        </div>

        {/* Order Summary */}
        <div>
          <OrderSummary city={shipping.city} />
        </div>
      </div>
    </Section>
  );
}
