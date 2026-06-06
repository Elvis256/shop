"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Section from "@/components/Section";
import OrderSummary from "@/components/OrderSummary";
import { useCart } from "@/lib/hooks/useCart";
import { useShippingConfig } from "@/lib/hooks/useShippingConfig";
import { useToast } from "@/lib/hooks/useToast";
import { useAuth } from "@/lib/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCountry } from "@/contexts/CountryContext";
import { parseDaysRange, formatDateRange } from "@/components/DeliveryEstimate";
import { Check, CreditCard, Smartphone, Loader2, AlertCircle, Shield, Package, Plane, Zap, Lock, Eye, Truck, Banknote, Wallet, Star, MessageCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import AddressAutocomplete, { type AddressSelection } from "@/components/AddressAutocomplete";

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
  const { items, total: cartTotal, clearCart, updateItemBadge, cartId } = useCart();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const { country } = useCountry();
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

  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState("");
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [deliveryMethod, setDeliveryMethod] = useState<"home" | "pickup">("home");
  const [selectedPickupPoint, setSelectedPickupPoint] = useState("");

  // Stable idempotency key — generated once per checkout session, reused on retries
  const idempotencyKeyRef = useRef(`ck_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`);

  // Store credit state
  const [storeCreditBalance, setStoreCreditBalance] = useState(0);
  const [storeCreditAmount, setStoreCreditAmount] = useState(0);
  const [storeCreditApplied, setStoreCreditApplied] = useState(false);
  const [storeCreditLoading, setStoreCreditLoading] = useState(false);

  // Regenerate idempotency key when payment-affecting settings change
  useEffect(() => {
    idempotencyKeyRef.current = `ck_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
  }, [installmentsEnabled, installmentCount, paymentMethod, storeCreditApplied]);

  // Loyalty points state
  const [loyaltyBalance, setLoyaltyBalance] = useState(0);
  const [loyaltyRedeem, setLoyaltyRedeem] = useState(0);
  const [loyaltyApplied, setLoyaltyApplied] = useState(false);

  // Saved addresses state
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [usingSavedAddress, setUsingSavedAddress] = useState(false);

  // Gift card state
  const [giftCardCode, setGiftCardCode] = useState("");
  const [giftCardBalance, setGiftCardBalance] = useState(0);
  const [giftCardApplied, setGiftCardApplied] = useState(false);
  const [giftCardLoading, setGiftCardLoading] = useState(false);
  const [giftCardError, setGiftCardError] = useState("");

  // Coupon state (synced from OrderSummary)
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);

  const handleCouponChange = (code: string, discount: number) => {
    setCouponCode(code);
    setCouponDiscount(discount);
  };

  // Fetch store credit + loyalty balance for authenticated users
  useEffect(() => {
    if (user) {
      apiFetch("/api/store-credit")
        .then((d) => {
          if (d && d.balance > 0) setStoreCreditBalance(d.balance);
        })
        .catch(() => {});
      apiFetch("/api/loyalty/balance")
        .then((d) => {
          if (d && d.points > 0) setLoyaltyBalance(d.points);
        })
        .catch(() => {});
      apiFetch("/api/addresses")
        .then((d) => {
          const addrs = Array.isArray(d) ? d : d?.addresses || [];
          setSavedAddresses(addrs);
          // Auto-select default address
          const defaultAddr = addrs.find((a: any) => a.isDefault) || addrs[0];
          if (defaultAddr) selectSavedAddress(defaultAddr);
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

  const checkGiftCard = async () => {
    if (!giftCardCode.trim()) return;
    setGiftCardLoading(true);
    setGiftCardError("");
    try {
      const data = await apiFetch(`/api/gift-cards/check/${giftCardCode.trim()}`);
      if (data.balance > 0) {
        setGiftCardBalance(Number(data.balance));
        setGiftCardApplied(true);
      } else {
        setGiftCardError("Gift card has no remaining balance");
      }
    } catch (err: any) {
      setGiftCardError(err?.message || "Invalid or expired gift card");
      setGiftCardApplied(false);
      setGiftCardBalance(0);
    } finally {
      setGiftCardLoading(false);
    }
  };

  const removeGiftCard = () => {
    setGiftCardApplied(false);
    setGiftCardBalance(0);
    setGiftCardCode("");
    setGiftCardError("");
  };

  const selectSavedAddress = (addr: any) => {
    const nameParts = (addr.name || "").split(" ");
    setShipping({
      firstName: nameParts[0] || shipping.firstName,
      lastName: nameParts.slice(1).join(" ") || shipping.lastName,
      email: shipping.email,
      phone: addr.phone || shipping.phone,
      address: addr.address || addr.street || "",
      city: addr.city || "",
      county: addr.county || addr.state || "",
      postalCode: addr.postalCode || addr.zip || "",
      discreet: shipping.discreet,
    });
    setUsingSavedAddress(true);
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
  const orderTotal = cartTotal - couponDiscount + shippingCost;
  const creditDiscount = storeCreditApplied ? Math.min(storeCreditAmount, orderTotal) : 0;
  const giftCardDiscount = giftCardApplied ? Math.min(giftCardBalance, orderTotal - creditDiscount) : 0;
  const finalTotal = orderTotal - creditDiscount - giftCardDiscount;
  const firstInstallmentAmount = installmentsEnabled && installmentCount >= 2
    ? Math.ceil(finalTotal / installmentCount)
    : finalTotal;

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
    if (!shipping.firstName || !shipping.lastName || !shipping.phone || !shipping.address || !shipping.city) {
      setError("Please fill in all required fields");
      return false;
    }
    if (!shipping.email && !shipping.phone) {
      setError("Please provide an email address or phone number");
      return false;
    }
    if (shipping.email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(shipping.email)) {
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
      const payload = {
        cartId: cartId || undefined,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
        currency: "UGX",
        amount: Math.max(0, cartTotal - couponDiscount + shippingCost),
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
          ...(shipping.email ? { email: shipping.email } : {}),
          phone: shipping.phone,
        },
        ...(deliveryTimeSlot ? { deliveryTimeSlot } : {}),
        shippingAddress: {
          name: `${shipping.firstName} ${shipping.lastName}`,
          address: shipping.address,
          city: shipping.city,
          postalCode: shipping.postalCode,
          country: "Uganda",
          phone: shipping.phone,
        },
        discreet: shipping.discreet,
        whatsappOptIn,
        ...(couponCode ? { couponCode } : {}),
        ...(storeCreditApplied && creditDiscount > 0 ? { storeCreditAmount: creditDiscount } : {}),
        ...(loyaltyApplied && loyaltyRedeem > 0 ? { loyaltyPointsRedeem: loyaltyRedeem } : {}),
        ...(giftCardApplied && giftCardDiscount > 0 ? { giftCardCode: giftCardCode.trim(), giftCardAmount: giftCardDiscount } : {}),
        ...(installmentsEnabled ? { installments: installmentCount } : {}),
        // Include affiliate referral code if present
        ...(typeof window !== "undefined" && localStorage.getItem("affiliate_ref")
          ? { affiliateCode: localStorage.getItem("affiliate_ref") }
          : {}),
      };

      const idempotencyKey = idempotencyKeyRef.current;
      const data = await apiFetch("/api/checkout/create", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(payload),
      });

      setOrderId(data.orderId);

      if (data.paymentLink) {
        // Redirect to PayPal or Flutterwave
        window.location.href = data.paymentLink;
      } else if (data.status === "SUCCESSFUL") {
        // Fully paid (e.g., store credit covered the entire amount)
        clearCart();
        showToast("Payment successful!", "success");
        router.push(`/orders/${data.orderId}?success=true`);
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

  // Ref to cancel payment polling on unmount
  const pollingCancelRef = useRef(false);
  const pollingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      pollingCancelRef.current = true;
      if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current);
    };
  }, []);

  const pollPaymentStatus = async (orderId: string) => {
    let attempts = 0;
    const maxAttempts = 60;
    pollingCancelRef.current = false;

    const checkStatus = async () => {
      if (pollingCancelRef.current) return;
      try {
        const res = await fetch(`${API_URL}/api/orders/${orderId}/payment-status`, { credentials: "include" });
        const data = await res.json();

        if (pollingCancelRef.current) return;

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
        if (attempts < maxAttempts && !pollingCancelRef.current) {
          pollingTimeoutRef.current = setTimeout(checkStatus, 5000);
        } else {
          setPaymentPending(false);
          setError("Payment timeout. Please check your order status.");
        }
      } catch (err) {
        console.error("Failed to check payment status:", err);
        attempts++;
        if (attempts < maxAttempts && !pollingCancelRef.current) {
          pollingTimeoutRef.current = setTimeout(checkStatus, 5000);
        }
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
      <div className="flex items-center justify-center gap-4 mb-12" aria-label="Checkout steps">
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
        <div role="alert" className="max-w-2xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Form */}
        <div className="lg:col-span-2">
          {step === 1 && (
            <div className="card space-y-6">
              {/* Guest Checkout Banner */}
              {!user && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-8">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="font-medium text-blue-900 text-sm">Checking out as guest</p>
                      <p className="text-xs text-blue-700 mt-0.5">No account needed. We&apos;ll email your order confirmation.</p>
                    </div>
                    <Link href={`/auth/login?redirect=/checkout`} className="text-sm font-medium text-blue-700 hover:text-blue-900 underline">
                      Sign in instead
                    </Link>
                  </div>
                </div>
              )}

              <h3 className="flex items-center gap-2"><Package className="w-5 h-5 text-accent" />Shipping Information</h3>

              {/* Saved Address — compact summary when selected */}
              {user && savedAddresses.length > 0 && usingSavedAddress ? (
                <div className="p-4 bg-primary-50 border border-primary/20 rounded-12 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{shipping.firstName} {shipping.lastName}</p>
                      <p className="text-sm text-text-muted">{shipping.address}, {shipping.city}</p>
                      <p className="text-sm text-text-muted">{shipping.phone}</p>
                      {shipping.email && <p className="text-sm text-text-muted">{shipping.email}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => setUsingSavedAddress(false)}
                      className="text-sm text-primary font-medium hover:underline shrink-0"
                    >
                      Change
                    </button>
                  </div>
                  {savedAddresses.length > 1 && (
                    <div className="flex gap-2 pt-1 flex-wrap">
                      {savedAddresses.map((addr) => (
                        <button
                          key={addr.id}
                          type="button"
                          onClick={() => selectSavedAddress(addr)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                            shipping.address === (addr.address || addr.street)
                              ? "border-primary bg-primary text-white"
                              : "border-border bg-surface hover:border-primary/50 text-text-muted"
                          }`}
                        >
                          {addr.label || addr.city || "Address"}
                          {addr.isDefault && " (Default)"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Saved Address Selector — expanded */}
                  {user && savedAddresses.length > 0 && !usingSavedAddress && (
                    <div className="space-y-2">
                      <p className="text-small text-text-muted">Select a saved address:</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {savedAddresses.map((addr) => (
                          <button
                            key={addr.id}
                            type="button"
                            onClick={() => selectSavedAddress(addr)}
                            className={`text-left p-3 rounded-12 border transition-all duration-150 ${
                              shipping.address === (addr.address || addr.street)
                                ? "border-primary bg-primary-50 ring-1 ring-primary"
                                : "border-border hover:border-primary/50 bg-surface"
                            }`}
                          >
                            <p className="font-medium text-sm">{addr.name || addr.label || "Address"}</p>
                            <p className="text-xs text-text-muted mt-0.5">
                              {addr.address || addr.street}, {addr.city}
                              {addr.isDefault && <span className="ml-1 text-primary font-medium">(Default)</span>}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="firstName" className="block text-small font-medium mb-2">First Name *</label>
                      <input
                        id="firstName"
                        className="input"
                        placeholder="John"
                        autoComplete="given-name"
                        value={shipping.firstName}
                        onChange={(e) => updateShipping("firstName", e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="lastName" className="block text-small font-medium mb-2">Last Name *</label>
                      <input
                        id="lastName"
                        className="input"
                        placeholder="Doe"
                        autoComplete="family-name"
                        value={shipping.lastName}
                        onChange={(e) => updateShipping("lastName", e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-small font-medium mb-2">Email <span className="text-text-muted font-normal">(optional)</span></label>
                    <input
                      id="email"
                      className="input"
                      type="email"
                      placeholder="john@example.com"
                      autoComplete="email"
                      value={shipping.email}
                      onChange={(e) => updateShipping("email", e.target.value)}
                    />
                    {!shipping.email && shipping.phone && (
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <Smartphone className="w-3 h-3" /> Phone number is enough — we&apos;ll text your order updates
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-small font-medium mb-2">Phone * <span className="text-text-muted font-normal">(Uganda format)</span></label>
                    <input
                      id="phone"
                      className="input"
                      type="tel"
                      placeholder="+256 700 000 000"
                      autoComplete="tel"
                      value={shipping.phone}
                      onChange={(e) => updateShipping("phone", e.target.value)}
                    />
                  </div>

                  <div>
                    <label htmlFor="address" className="block text-small font-medium mb-2">Address *</label>
                    <AddressAutocomplete
                      id="address"
                      className="input"
                      placeholder="Start typing your address..."
                      value={shipping.address}
                      onChange={(e) => updateShipping("address", e.target.value)}
                      onAddressSelect={(addr: AddressSelection) => {
                        updateShipping("address", addr.street);
                        updateShipping("city", addr.city);
                        updateShipping("county", addr.county);
                        updateShipping("postalCode", addr.postalCode);
                      }}
                      enableGeocoding={deliveryMethod === "home"}
                    />
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="city" className="block text-small font-medium mb-2">City *</label>
                      <input
                        id="city"
                        className="input"
                        placeholder="Kampala"
                        autoComplete="address-level2"
                        value={shipping.city}
                        onChange={(e) => updateShipping("city", e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="county" className="block text-small font-medium mb-2">District</label>
                      <input
                        id="county"
                        className="input"
                        placeholder="Kampala"
                        autoComplete="address-level1"
                        value={shipping.county}
                        onChange={(e) => updateShipping("county", e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="postalCode" className="block text-small font-medium mb-2">Postal Code</label>
                      <input
                        id="postalCode"
                        className="input"
                        placeholder="e.g. 256"
                        autoComplete="postal-code"
                        value={shipping.postalCode}
                        onChange={(e) => updateShipping("postalCode", e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Delivery Method */}
              <div>
                <span id="deliveryMethodLabel" className="block text-small font-medium mb-2">Delivery Method</span>
                <div className="grid grid-cols-2 gap-3" role="group" aria-labelledby="deliveryMethodLabel">
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod("home")}
                    className={`p-3 border rounded-8 text-sm font-medium text-center transition-colors ${
                      deliveryMethod === "home" ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-gray-300"
                    }`}
                  >
                    <Truck className="w-5 h-5 mx-auto mb-1" />
                    Home Delivery
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod("pickup")}
                    className={`p-3 border rounded-8 text-sm font-medium text-center transition-colors ${
                      deliveryMethod === "pickup" ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-gray-300"
                    }`}
                  >
                    <Package className="w-5 h-5 mx-auto mb-1" />
                    Pickup Point
                  </button>
                </div>
                {deliveryMethod === "pickup" && (
                  <div className="mt-3">
                    <input
                      type="text"
                      placeholder="Enter pickup point name or area..."
                      value={selectedPickupPoint}
                      onChange={(e) => setSelectedPickupPoint(e.target.value)}
                      className="input text-sm"
                    />
                    <p className="text-xs text-text-muted mt-1">
                      <Link href="/pickup-points" target="_blank" className="text-primary hover:underline">View all pickup points →</Link>
                    </p>
                  </div>
                )}
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

              {/* WhatsApp Updates Opt-in */}
              <label className="flex items-start gap-3 p-4 border border-border rounded-8 cursor-pointer hover:border-green-400 transition-colors">
                <input
                  type="checkbox"
                  className="mt-1 accent-green-500"
                  checked={whatsappOptIn}
                  onChange={(e) => setWhatsappOptIn(e.target.checked)}
                />
                <div>
                  <span className="font-medium flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-green-500" />Get updates via WhatsApp
                  </span>
                  <p className="text-small text-text-muted">
                    Receive order confirmations, shipping updates, and delivery notifications on WhatsApp.
                  </p>
                </div>
              </label>

              {/* Delivery Time Slot */}
              <div>
                <span id="deliveryTimeLabel" className="block text-small font-medium mb-2 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-accent" />Preferred Delivery Time
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-labelledby="deliveryTimeLabel">
                  {[
                    { value: "", label: "No preference" },
                    { value: "Morning (8am-12pm)", label: "Morning" },
                    { value: "Afternoon (12pm-5pm)", label: "Afternoon" },
                    { value: "Evening (5pm-9pm)", label: "Evening" },
                  ].map(slot => (
                    <button
                      key={slot.value}
                      type="button"
                      onClick={() => setDeliveryTimeSlot(slot.value)}
                      className={`py-2 px-3 rounded-8 text-sm font-medium border transition-colors ${
                        deliveryTimeSlot === slot.value
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border text-text-muted hover:border-accent/50"
                      }`}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
                {deliveryTimeSlot && <p className="text-xs text-text-muted mt-1">{deliveryTimeSlot}</p>}
              </div>

              {/* Privacy badge for guest checkout */}
              {!user && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-8">
                  <Shield className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <p className="text-xs text-green-700 dark:text-green-400">
                    Your data is auto-deleted 30 days after delivery. We value your privacy.
                  </p>
                </div>
              )}

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
                    <label htmlFor="mobileNetwork" className="block text-small font-medium mb-2">Select Network</label>
                    <select
                      id="mobileNetwork"
                      className="input-select"
                      value={mobileNetwork}
                      onChange={(e) => setMobileNetwork(e.target.value as "MPESA" | "AIRTEL" | "MTN")}
                    >
                      {(country.mobileNetworks && country.mobileNetworks.length > 0
                        ? country.mobileNetworks
                        : [{ id: "MTN", name: "MTN MoMo" }, { id: "AIRTEL", name: "Airtel Money" }, { id: "MPESA", name: "M-Pesa" }]
                      ).map((n) => (
                        <option key={n.id} value={n.id}>{n.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="mobilePhone" className="block text-small font-medium mb-2">Phone Number *</label>
                    <input
                      id="mobilePhone"
                      className="input"
                      placeholder={`${country.dialCode} ${country.phonePlaceholder || "700 000 000"}`}
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
                    <span className="block text-xs font-medium text-gray-600 mb-1">
                      Number of payments
                    </span>
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
                        const intervalWeeks = installmentCount <= 2 ? 2 : 4;
                        const isFirst = i === 0;
                        return (
                          <p key={i} className="text-xs text-gray-600 flex justify-between">
                            <span>{isFirst ? "Today" : `In ${i * intervalWeeks} weeks`}</span>
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

              {/* Loyalty Points Redemption */}
              {user && loyaltyBalance > 0 && (
                <div className="p-4 bg-purple-50 border border-purple-100 rounded-8 space-y-3">
                  <h4 className="font-medium text-small text-purple-900 flex items-center gap-2">
                    <Star className="w-4 h-4 text-purple-600" /> Loyalty Points
                  </h4>
                  <p className="text-small text-purple-800">
                    Available: <strong>{loyaltyBalance.toLocaleString()} points</strong> (worth {formatPrice(loyaltyBalance)})
                  </p>
                  {!loyaltyApplied ? (
                    <div className="space-y-2">
                      <input
                        type="range"
                        min={0}
                        max={Math.min(loyaltyBalance, Math.floor(finalTotal))}
                        value={loyaltyRedeem}
                        onChange={(e) => setLoyaltyRedeem(Number(e.target.value))}
                        className="w-full accent-purple-600"
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-small text-purple-700">Redeem: {formatPrice(loyaltyRedeem)}</span>
                        <button
                          onClick={() => { if (loyaltyRedeem > 0) setLoyaltyApplied(true); }}
                          disabled={loyaltyRedeem <= 0}
                          className="btn-secondary text-small"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-small text-green-700">
                        Points applied: -{formatPrice(loyaltyRedeem)}
                      </span>
                      <button onClick={() => { setLoyaltyApplied(false); setLoyaltyRedeem(0); }} className="text-small text-red-600 hover:underline">
                        Remove
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-purple-600">
                    You&apos;ll earn <strong>{Math.floor(cartTotal / 1000)}</strong> new points from this order!
                  </p>
                </div>
              )}

              {/* Gift Card Redemption */}
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-8 space-y-3">
                <h4 className="font-medium text-small text-blue-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" /> Gift Card
                </h4>
                {!giftCardApplied ? (
                  <>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="input flex-1 uppercase"
                        placeholder="Enter gift card code"
                        value={giftCardCode}
                        onChange={(e) => { setGiftCardCode(e.target.value.toUpperCase()); setGiftCardError(""); }}
                      />
                      <button
                        onClick={checkGiftCard}
                        disabled={!giftCardCode.trim() || giftCardLoading}
                        className="btn-secondary"
                      >
                        {giftCardLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                      </button>
                    </div>
                    {giftCardError && (
                      <p className="text-small text-red-600">{giftCardError}</p>
                    )}
                  </>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-small text-green-700">
                        Gift card applied: -{formatPrice(giftCardDiscount)}
                      </span>
                      <button onClick={removeGiftCard} className="text-small text-red-600 hover:underline">
                        Remove
                      </button>
                    </div>
                    {giftCardBalance > giftCardDiscount && (
                      <p className="text-xs text-blue-700">
                        Remaining balance after purchase: {formatPrice(giftCardBalance - giftCardDiscount)}
                      </p>
                    )}
                  </div>
                )}
              </div>

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
                      {installmentsEnabled && installmentCount >= 2
                        ? `Pay ${formatPrice(firstInstallmentAmount)} (1st of ${installmentCount})`
                        : `Pay ${formatPrice(finalTotal)}`}
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
          <OrderSummary city={shipping.city} onCouponChange={handleCouponChange} />
        </div>
      </div>
    </Section>
  );
}
