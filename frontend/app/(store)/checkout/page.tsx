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
import { Check, CreditCard, Smartphone, Loader2, AlertCircle, Shield, Package, Plane, Zap, Lock, Eye, Truck, Banknote, Wallet, Star, MessageCircle, Calendar } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { trackBeginCheckout } from "@/components/GoogleAnalytics";
import AddressAutocomplete, { type AddressSelection } from "@/components/AddressAutocomplete";
import dynamic from "next/dynamic";

const GPSMapPicker = dynamic(() => import("@/components/GPSMapPicker"), {
  ssr: false,
  loading: () => <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center text-xs text-gray-500 animate-pulse">Loading Interactive Map...</div>
});

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
  const [codDepositMethod, setCodDepositMethod] = useState<"card" | "mobile_money">("mobile_money");
  const [mobileNetwork, setMobileNetwork] = useState<"MPESA" | "AIRTEL" | "MTN">("MTN");
  const [mobilePhone, setMobilePhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentPending, setPaymentPending] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<Record<string, string>>({});
  const [savedPayments, setSavedPayments] = useState<Array<{ id: string; type: string; network?: string; phone?: string; phoneMask?: string; label?: string; isDefault: boolean }>>([]);
  const [selectedSavedPayment, setSelectedSavedPayment] = useState<string | null>(null);
  const [savePaymentMethod, setSavePaymentMethod] = useState(false);

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
  const [pickupPoints, setPickupPoints] = useState<any[]>([]);
  const [selectedPickupPointId, setSelectedPickupPointId] = useState<string>("");
  // Incognito Gifting state
  const [isGift, setIsGift] = useState(false);
  const [giftRecipientPhone, setGiftRecipientPhone] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [senderName, setSenderName] = useState("");

  // GPS delivery coordinate pinpoint
  const [useGpsPin, setUseGpsPin] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  // Stealth Packaging selection
  const [packagingType, setPackagingType] = useState<"STANDARD" | "GIFT" | "ULTRA_STEALTH">("STANDARD");

  // Bill Sharing options
  const [isPayForMe, setIsPayForMe] = useState(false);
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitShowItems, setSplitShowItems] = useState(false);
  const [receiptMasked, setReceiptMasked] = useState(false);
  const [dispatchDelay, setDispatchDelay] = useState<"immediate" | "24h" | "3d">("immediate");
  const [splitPartnerPhone, setSplitPartnerPhone] = useState("");
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [billingName, setBillingName] = useState("");

  // Installments eligibility
  const [installmentsEligible, setInstallmentsEligible] = useState<boolean | null>(null);
  const [installmentsIneligibleReason, setInstallmentsIneligibleReason] = useState<string>("");

  // Stable idempotency key — generated once per checkout session, reused on retries
  const idempotencyKeyRef = useRef(`ck_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`);

  // Store credit state
  const [storeCreditBalance, setStoreCreditBalance] = useState(0);
  const [storeCreditAmount, setStoreCreditAmount] = useState(0);
  const [storeCreditApplied, setStoreCreditApplied] = useState(false);
  const [storeCreditLoading, setStoreCreditLoading] = useState(false);

  // Delivery options restriction state
  const [allowedDeliveryMethods, setAllowedDeliveryMethods] = useState<string[]>(["HOME_DELIVERY", "PICKUP", "SELLER_PICKUP"]);
  const [codAllowed, setCodAllowed] = useState(true);

  // Fetch installments eligibility on mount
  useEffect(() => {
    fetch("/api/checkout/eligibility/installments")
      .then((r) => r.json())
      .then((data) => {
        setInstallmentsEligible(data.eligible);
        if (!data.eligible) {
          setInstallmentsIneligibleReason(data.reason || "You do not qualify for installments.");
        }
      })
      .catch(() => {
        setInstallmentsEligible(false);
        setInstallmentsIneligibleReason("Eligibility status check failed.");
      });
  }, []);

  // Fetch allowed delivery and payment options based on items in cart
  const productIdsStr = items.map((i) => i.productId).join(",");
  useEffect(() => {
    if (!productIdsStr) return;
    fetch(`/api/checkout/delivery-options?productIds=${productIdsStr}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.allowedMethods) {
          setAllowedDeliveryMethods(data.allowedMethods);
          // Auto-adjust/fallback selected delivery method based on what is allowed
          if (deliveryMethod === "pickup" && !data.allowedMethods.includes("PICKUP")) {
            setDeliveryMethod("home");
          } else if (deliveryMethod === "home" && !data.allowedMethods.includes("HOME_DELIVERY")) {
            setDeliveryMethod("pickup");
          }
        }
        if (data.codAllowed !== undefined) {
          setCodAllowed(data.codAllowed);
          // If current paymentMethod is cod but COD is not allowed, revert to mobile money
          if (paymentMethod === "cod" && !data.codAllowed) {
            setPaymentMethod("mobile_money");
          }
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productIdsStr]);

  // Fetch active pickup points on mount
  useEffect(() => {
    fetch("/api/pickup-points")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setPickupPoints(data);
        }
      })
      .catch(() => {});
  }, []);

  // Regenerate idempotency key when payment-affecting settings change
  useEffect(() => {
    idempotencyKeyRef.current = `ck_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
  }, [installmentsEnabled, installmentCount, paymentMethod, storeCreditApplied]);

  const checkoutTrackedRef = useRef(false);
  useEffect(() => {
    if (items.length > 0 && !checkoutTrackedRef.current) {
      checkoutTrackedRef.current = true;
      trackBeginCheckout(
        cartTotal,
        items.map((i) => ({
          id: i.productId,
          name: i.name,
          price: Number(i.price),
          quantity: i.quantity,
        }))
      );
    }
  }, [items, cartTotal]);

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
      if (user.receiptMasked) setReceiptMasked(true);
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
      // Fetch saved payment methods
      apiFetch("/api/saved-payments")
        .then((d) => {
          if (Array.isArray(d)) {
            setSavedPayments(d);
            const defaultMethod = d.find((m: any) => m.isDefault);
            if (defaultMethod && defaultMethod.phone) {
              setSelectedSavedPayment(defaultMethod.id);
              setMobilePhone(defaultMethod.phone);
              if (defaultMethod.network) setMobileNetwork(defaultMethod.network as any);
            }
          }
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
  const loyaltyDiscount = loyaltyApplied ? loyaltyRedeem : 0;
  const finalTotal = orderTotal - creditDiscount - giftCardDiscount - loyaltyDiscount;
  const firstInstallmentAmount = installmentsEnabled && installmentCount >= 2
    ? Math.ceil(finalTotal / installmentCount)
    : finalTotal;

  const selectedPointDetails = selectedPickupPointId 
    ? pickupPoints.find((p) => p.id === selectedPickupPointId)
    : null;

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
    if (isGift) {
      if (!giftRecipientPhone) {
        setError("Please enter the recipient's phone number");
        return false;
      }
      const phoneRegex = /^(\+?256|0)?[7][0-9]{8}$/;
      if (!phoneRegex.test(giftRecipientPhone.replace(/\s+/g, ""))) {
        setError("Please enter a valid Ugandan recipient phone number (07XXXXXXXX)");
        return false;
      }
      setError(null);
      return true;
    }

    if (deliveryMethod === "pickup") {
      if (!shipping.firstName || !shipping.lastName || !shipping.phone) {
        setError("Please enter recipient name and phone number");
        return false;
      }
      if (!selectedPickupPointId) {
        setError("Please select a pickup station");
        return false;
      }
    } else {
      if (!shipping.firstName || !shipping.lastName || !shipping.phone || !shipping.address || !shipping.city) {
        setError("Please fill in all required fields");
        return false;
      }
    }

    if (!billingSameAsShipping && !billingName.trim()) {
      setError("Please enter the billing cardholder/corporate account name");
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
    if ((paymentMethod === "mobile_money" || (paymentMethod === "cod" && codDepositMethod === "mobile_money")) && !mobilePhone) {
      setError("Please enter your mobile money phone number");
      return false;
    }
    // FIX H8: Validate Uganda phone format for mobile money number
    if ((paymentMethod === "mobile_money" || (paymentMethod === "cod" && codDepositMethod === "mobile_money")) && mobilePhone) {
      const ugPhone = /^(\+?256|0)?[7][0-9]{8}$/;
      if (!ugPhone.test(mobilePhone.replace(/\s+/g, ""))) {
        setError("Please enter a valid Ugandan mobile money number (e.g. 0771234567)");
        return false;
      }
    }
    if (isPayForMe || isSplitPayment) {
      if (!splitPartnerPhone) {
        setError("Please enter your friend's phone number");
        return false;
      }
      const phoneRegex = /^(\+?256|0)?[7][0-9]{8}$/;
      if (!phoneRegex.test(splitPartnerPhone.replace(/\s+/g, ""))) {
        setError("Please enter a valid Ugandan friend's phone number (07XXXXXXXX)");
        return false;
      }
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
          variantId: item.variantId,
          quantity: item.quantity,
          price: item.price,
        })),
        currency: "UGX",
        amount: Math.max(0, cartTotal - couponDiscount + (isGift ? 0 : shippingCost)),
        shipping: isGift ? 0 : shippingCost,
        paymentMethod,
        ...((paymentMethod === "mobile_money" || (paymentMethod === "cod" && codDepositMethod === "mobile_money")) && {
          mobileMoney: {
            network: mobileNetwork,
            phone: mobilePhone,
          },
        }),
        ...(paymentMethod === "cod" && { codDepositMethod }),
        customer: {
          name: isGift ? (senderName || "Someone special") : (billingSameAsShipping ? `${shipping.firstName} ${shipping.lastName}` : billingName),
          ...(shipping.email ? { email: shipping.email } : {}),
          phone: shipping.phone,
        },
        ...(!isGift && deliveryTimeSlot ? { deliveryTimeSlot } : {}),
        ...(!isGift && deliveryMethod === "home" && {
          shippingAddress: {
            name: `${shipping.firstName} ${shipping.lastName}`,
            address: shipping.address,
            city: shipping.city,
            postalCode: shipping.postalCode,
            country: "Uganda",
            phone: shipping.phone,
            ...(useGpsPin && latitude && longitude ? { latitude, longitude } : {}),
          }
        }),
        ...(deliveryMethod === "pickup" && selectedPickupPointId ? { pickupPointId: selectedPickupPointId } : {}),
        discreet: shipping.discreet,
        deliveryMethod: isGift ? "home" : deliveryMethod,
        whatsappOptIn,
        packagingType,
        isPayForMe,
        isSplitPayment,
        splitShowItems,
        receiptMasked,
        dispatchScheduledAt: dispatchDelay === "immediate" ? null : (dispatchDelay === "24h" ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()),
        ...((isPayForMe || isSplitPayment) ? { splitPartnerPhone } : {}),
        ...(couponCode ? { couponCode } : {}),
        ...(storeCreditApplied && creditDiscount > 0 ? { storeCreditAmount: creditDiscount } : {}),
        ...(loyaltyApplied && loyaltyRedeem > 0 ? { loyaltyPointsRedeem: loyaltyRedeem } : {}),
        ...(giftCardApplied && giftCardDiscount > 0 ? { giftCardCode: giftCardCode.trim(), giftCardAmount: giftCardDiscount } : {}),
        ...(installmentsEnabled ? { installments: installmentCount } : {}),
        isGift,
        ...(isGift ? {
          giftRecipientPhone,
          giftMessage: giftMessage || undefined,
          senderName: senderName || "Someone special"
        } : {}),
        // Include affiliate referral code if present
        ...(typeof window !== "undefined" && localStorage.getItem("affiliate_ref")
          ? { affiliateCode: localStorage.getItem("affiliate_ref") }
          : {}),
      };

      // Save guest checkout contact in sessionStorage for payment-status polling
      if (!user) {
        try {
          if (shipping.email) sessionStorage.setItem("checkout_email", shipping.email);
          if (shipping.phone) sessionStorage.setItem("checkout_phone", shipping.phone);
        } catch {}
      }

      const idempotencyKey = idempotencyKeyRef.current;
      const data = await apiFetch("/api/checkout/create", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(payload),
      });

      setOrderId(data.orderId);

      // Save payment method if user opted in
      if (savePaymentMethod && user && mobilePhone && !selectedSavedPayment) {
        apiFetch("/api/saved-payments", {
          method: "POST",
          body: JSON.stringify({ type: "MOBILE_MONEY", network: mobileNetwork, phone: mobilePhone }),
        }).catch(() => {});
      }

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
    const maxAttempts = 40; // ~5 min total with backoff
    pollingCancelRef.current = false;

    // Backoff: 5s for first 6 attempts (30s), 10s for next 12 (~2.5min), then 15s
    const getInterval = (attempt: number) => {
      if (attempt < 6) return 5000;
      if (attempt < 18) return 10000;
      return 15000;
    };

    const checkStatus = async () => {
      if (pollingCancelRef.current) return;
      try {
        const res = await fetch(`${API_URL}/api/orders/${orderId}/payment-status`, { credentials: "include" });
        const data = await res.json();

        if (pollingCancelRef.current) return;

        if (data.paymentStatus === "SUCCESSFUL" || data.status === "CONFIRMED") {
          clearCart();
          showToast("Payment successful!", "success");
          router.push(`/orders/${orderId}?success=true`);
          return;
        }

        if (data.paymentStatus === "FAILED" || data.status === "CANCELLED") {
          setPaymentPending(false);
          setError("Payment was declined. Please try again.");
          return;
        }

        attempts++;
        if (attempts < maxAttempts && !pollingCancelRef.current) {
          pollingTimeoutRef.current = setTimeout(checkStatus, getInterval(attempts));
        } else {
          setPaymentPending(false);
          setError("Payment timeout. Please check your order status.");
        }
      } catch (err) {
        console.error("Failed to check payment status:", err);
        attempts++;
        if (attempts < maxAttempts && !pollingCancelRef.current) {
          pollingTimeoutRef.current = setTimeout(checkStatus, getInterval(attempts));
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

      {/* Store Credit Banner */}
      {user && storeCreditBalance > 0 && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <Wallet className="w-5 h-5 text-green-600 shrink-0" />
          <p className="text-sm text-green-800">
            You have <strong>{formatPrice(storeCreditBalance)}</strong> in store credit! It will be available to apply at checkout.
          </p>
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

              {/* Gift Toggle Tabs */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg mb-4">
                <button
                  type="button"
                  onClick={() => setIsGift(false)}
                  className={`py-2 px-3 text-sm font-semibold rounded-md transition-colors ${
                    !isGift ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-950"
                  }`}
                >
                  🚚 Standard Shipping
                </button>
                <button
                  type="button"
                  onClick={() => setIsGift(true)}
                  className={`py-2 px-3 text-sm font-semibold rounded-md transition-colors ${
                    isGift ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-950"
                  }`}
                >
                  🎁 Incognito Gift
                </button>
              </div>

              {!isGift ? (
                <>
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
                        if (addr.lat && addr.lng) {
                          setLatitude(addr.lat);
                          setLongitude(addr.lng);
                        }
                      }}
                      enableGeocoding={deliveryMethod === "home"}
                    />
                    
                    {deliveryMethod === "home" && (
                      <div className="space-y-4 pt-3">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={useGpsPin}
                            onChange={(e) => {
                              setUseGpsPin(e.target.checked);
                              if (!e.target.checked) {
                                setLatitude(null);
                                setLongitude(null);
                              }
                            }}
                            className="rounded border-gray-300 text-accent focus:ring-accent accent-accent w-4 h-4 cursor-pointer"
                          />
                          <span className="text-xs font-semibold text-text flex items-center gap-1">
                            📍 Pinpoint my precise delivery coordinates on a map
                          </span>
                        </label>

                        {useGpsPin && (
                          <GPSMapPicker
                            initialLat={latitude}
                            initialLng={longitude}
                            onChange={(lat, lng, addr) => {
                              setLatitude(lat);
                              setLongitude(lng);
                              updateShipping("address", addr);
                            }}
                          />
                        )}
                      </div>
                    )}
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

                  {!isGift && (
                    <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-800 space-y-4">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={billingSameAsShipping}
                          onChange={(e) => setBillingSameAsShipping(e.target.checked)}
                          className="rounded border-gray-300 text-accent focus:ring-accent accent-accent w-4 h-4 cursor-pointer"
                        />
                        <span className="text-xs font-semibold text-text">
                          Billing name matches shipping recipient
                        </span>
                      </label>

                      {!billingSameAsShipping && (
                        <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg border border-border">
                          <label htmlFor="billingName" className="block text-xs font-semibold mb-1 text-text">
                            Billing Cardholder / Corporate Account Name *
                          </label>
                          <input
                            id="billingName"
                            className="input text-xs"
                            placeholder="e.g. John Doe (as shown on corporate credit card)"
                            value={billingName}
                            onChange={(e) => setBillingName(e.target.value)}
                          />
                          <p className="text-[10px] text-text-muted mt-1 leading-tight">
                            We will use this name for payment authorization, while printing the shipping recipient alias on the package label.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Delivery Method */}
              {allowedDeliveryMethods.filter(m => m === "HOME_DELIVERY" || m === "PICKUP").length > 0 && (
                <div>
                  <span id="deliveryMethodLabel" className="block text-small font-medium mb-2">Delivery Method</span>
                  <div
                    className={`grid gap-3 ${
                      allowedDeliveryMethods.filter(m => m === "HOME_DELIVERY" || m === "PICKUP").length > 1
                        ? "grid-cols-2"
                        : "grid-cols-1"
                    }`}
                    role="group"
                    aria-labelledby="deliveryMethodLabel"
                  >
                    {allowedDeliveryMethods.includes("HOME_DELIVERY") && (
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
                    )}
                    {allowedDeliveryMethods.includes("PICKUP") && (
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
                    )}
                  </div>

                  {deliveryMethod === "pickup" && (
                    <div className="mt-3">
                      <select
                        value={selectedPickupPointId}
                        onChange={(e) => setSelectedPickupPointId(e.target.value)}
                        className="select text-sm w-full font-sans bg-white dark:bg-gray-800 border border-border rounded-lg p-2.5"
                      >
                        <option value="">-- Choose a pickup point --</option>
                        {pickupPoints.map((point) => (
                          <option key={point.id} value={point.id}>
                            {point.name} ({point.city})
                          </option>
                        ))}
                      </select>

                      {selectedPointDetails && (
                        <div className="mt-3 p-3 bg-primary/5 dark:bg-gray-800/40 rounded-lg border border-primary/10 space-y-1.5 text-xs font-sans">
                          <p className="font-bold text-primary">📍 Selected Station Details:</p>
                          <p className="text-text dark:text-gray-200">
                            <strong className="font-medium text-text-muted">Address:</strong> {selectedPointDetails?.address}, {selectedPointDetails?.city}
                          </p>
                          {selectedPointDetails?.hours && (
                            <p className="text-text dark:text-gray-200">
                              <strong className="font-medium text-text-muted">Hours:</strong> {selectedPointDetails?.hours}
                            </p>
                          )}
                          {selectedPointDetails?.phone && (
                            <p className="text-text dark:text-gray-200">
                              <strong className="font-medium text-text-muted">Phone:</strong> {selectedPointDetails?.phone}
                            </p>
                          )}
                        </div>
                      )}

                      <p className="text-xs text-text-muted mt-2">
                        <Link href="/pickup-points" target="_blank" className="text-primary hover:underline">View all pickup points →</Link>
                      </p>
                    </div>
                  )}
                </div>
              )}

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
              </>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-pink-50 dark:bg-pink-950/20 border border-pink-100 dark:border-pink-900 rounded-12">
                    <p className="text-xs text-pink-700 dark:text-pink-400 font-semibold mb-1">🎁 Incognito Gifting Mode Enabled</p>
                    <p className="text-xs text-pink-600 dark:text-pink-400">
                      The recipient will receive a WhatsApp/SMS link to enter their own delivery address.
                      No product details or prices are shown in their link, and delivery is 100% discreet in plain packaging.
                    </p>
                  </div>

                  <h4 className="font-semibold text-sm border-b pb-1 text-gray-800 dark:text-gray-200 mt-4">1. Sender Information (For Receipt/Updates)</h4>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="senderPhone" className="block text-small font-medium mb-2">Your Phone *</label>
                      <input
                        id="senderPhone"
                        className="input"
                        type="tel"
                        placeholder="Your phone number"
                        value={shipping.phone}
                        onChange={(e) => updateShipping("phone", e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="senderEmail" className="block text-small font-medium mb-2">Your Email <span className="text-xs font-normal text-gray-400 dark:text-gray-500">(optional)</span></label>
                      <input
                        id="senderEmail"
                        className="input"
                        type="email"
                        placeholder="Your email address"
                        value={shipping.email}
                        onChange={(e) => updateShipping("email", e.target.value)}
                      />
                    </div>
                  </div>

                  <h4 className="font-semibold text-sm border-b pb-1 text-gray-800 dark:text-gray-200 mt-4">2. Gift Recipient Information</h4>
                  <div>
                    <label htmlFor="recipientPhone" className="block text-small font-medium mb-2">Recipient Phone * <span className="text-xs font-normal text-gray-400 dark:text-gray-500">(Uganda format)</span></label>
                    <input
                      id="recipientPhone"
                      className="input"
                      type="tel"
                      placeholder="e.g. 07XXXXXXXX"
                      value={giftRecipientPhone}
                      onChange={(e) => setGiftRecipientPhone(e.target.value)}
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="senderName" className="block text-small font-medium mb-2">Sender Name <span className="text-xs font-normal text-gray-400 dark:text-gray-500">(optional)</span></label>
                      <input
                        id="senderName"
                        className="input"
                        placeholder="e.g. Someone special"
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="giftMessage" className="block text-small font-medium mb-2">Gift Message <span className="text-xs font-normal text-gray-400 dark:text-gray-500">(optional)</span></label>
                      <input
                        id="giftMessage"
                        className="input"
                        placeholder="e.g. Hope you love this! ❤️"
                        value={giftMessage}
                        onChange={(e) => setGiftMessage(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Stealth Packaging Customizer */}
              <div className="p-4 border border-border rounded-12 space-y-4 bg-surface dark:bg-gray-800/50">
                <h4 className="text-small font-semibold flex items-center gap-2 text-text">
                  <Shield className="w-4 h-4 text-accent animate-pulse" /> Stealth Packaging Customizer
                </h4>
                <p className="text-xs text-text-muted">
                  Select your package discretion. All options are shipped with <strong>no external store branding or contents listed</strong>.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => setPackagingType("STANDARD")}
                    className={`p-3 text-left border rounded-lg transition-all flex flex-col justify-between ${
                      packagingType === "STANDARD"
                        ? "border-accent bg-accent/5 ring-1 ring-accent"
                        : "border-border hover:border-gray-300 dark:hover:border-gray-700 bg-surface dark:bg-gray-800"
                    }`}
                  >
                    <div>
                      <span className="block text-xs font-bold text-text mb-1">📦 Standard Discreet</span>
                      <span className="block text-[10px] text-text-muted leading-relaxed">
                        Plain brown box or solid courier bag. Standard generic label.
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-600 font-semibold mt-2">Free (Included)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPackagingType("GIFT")}
                    className={`p-3 text-left border rounded-lg transition-all flex flex-col justify-between ${
                      packagingType === "GIFT"
                        ? "border-accent bg-accent/5 ring-1 ring-accent"
                        : "border-border hover:border-gray-300 dark:hover:border-gray-700 bg-surface dark:bg-gray-800"
                    }`}
                  >
                    <div>
                      <span className="block text-xs font-bold text-text mb-1">🎁 Gift Stealth</span>
                      <span className="block text-[10px] text-text-muted leading-relaxed">
                        Glossy wrapping paper, ribbon, and card envelope. Looks like a birthday gift.
                      </span>
                    </div>
                    <span className="text-[10px] text-accent font-semibold mt-2">Great for couples</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPackagingType("ULTRA_STEALTH")}
                    className={`p-3 text-left border rounded-lg transition-all flex flex-col justify-between ${
                      packagingType === "ULTRA_STEALTH"
                        ? "border-accent bg-accent/5 ring-1 ring-accent"
                        : "border-border hover:border-gray-300 dark:hover:border-gray-700 bg-surface dark:bg-gray-800"
                    }`}
                  >
                    <div>
                      <span className="block text-xs font-bold text-text mb-1">🛡️ Ultra Heavy Stealth</span>
                      <span className="block text-[10px] text-text-muted leading-relaxed">
                        Double-sealed, scent-blocked, non-rattling pack in regional courier sleeve.
                      </span>
                    </div>
                    <span className="text-[10px] text-accent font-semibold mt-2">Premium Privacy</span>
                  </button>
                </div>
              </div>

              {/* Private Dispatch Scheduler & Receipt Masking */}
              <div className="p-4 border border-border rounded-12 space-y-4 bg-surface dark:bg-gray-800/50">
                <h4 className="text-small font-semibold flex items-center gap-2 text-text">
                  <Calendar className="w-4 h-4 text-accent animate-pulse" /> Private Dispatch & Receipt Masking
                </h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-text">Dispatch Delay (Hold Queue)</label>
                    <select
                      value={dispatchDelay}
                      onChange={(e) => setDispatchDelay(e.target.value as any)}
                      className="w-full text-xs bg-surface dark:bg-gray-800 border border-border rounded-md p-2 focus:ring-1 focus:ring-accent outline-none text-text"
                    >
                      <option value="immediate">⚡ Immediate Dispatch</option>
                      <option value="24h">⏱️ Hold for 24 Hours</option>
                      <option value="3d">⏱️ Hold for 3 Days</option>
                    </select>
                    <span className="block text-[10px] text-text-muted">
                      Keeps order in held state to delay shipment as needed.
                    </span>
                  </div>

                  <div className="flex flex-col justify-end space-y-2">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={receiptMasked}
                        onChange={(e) => setReceiptMasked(e.target.checked)}
                        className="mt-1 cursor-pointer accent-accent"
                      />
                      <div>
                        <span className="block text-xs font-semibold text-text">Mask Receipt Details</span>
                        <span className="block text-[10px] text-text-muted leading-tight">
                          Replaces explicit names with codes (e.g. PZ-ABCD) on receipts/notifications.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

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
                   } ${(!codAllowed || isSplitPayment || isPayForMe) ? "opacity-40 cursor-not-allowed" : ""}`}
                 >
                   <input
                     type="radio"
                     name="payment"
                     disabled={!codAllowed || isSplitPayment || isPayForMe}
                     checked={paymentMethod === "cod"}
                     onChange={() => setPaymentMethod("cod")}
                   />
                   <Banknote className="w-6 h-6" />
                   <div>
                     <span className="font-medium">Cash on Delivery</span>
                     <p className="text-small text-text-muted">Pay when you receive your order</p>
                     {!codAllowed && (
                       <p className="text-xs text-red-500 mt-1 font-semibold">⚠️ Not available for the items in your cart</p>
                     )}
                     {(isSplitPayment || isPayForMe) && (
                       <p className="text-xs text-red-500 mt-1 font-semibold">⚠️ Not available for split payments or group checkouts</p>
                     )}
                   </div>
                 </label>
                )}
              </div>

              {/* Mobile Money Form */}
              {(paymentMethod === "mobile_money" || (paymentMethod === "cod" && codDepositMethod === "mobile_money")) && (
                <div className="space-y-4 pt-4 border-t border-border">
                  {/* Saved payment methods */}
                  {savedPayments.length > 0 && (
                    <div>
                      <label className="block text-small font-medium mb-2">Saved Numbers</label>
                      <div className="space-y-2">
                        {savedPayments.filter((m) => m.type === "MOBILE_MONEY").map((m) => (
                          <label
                            key={m.id}
                            className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                              selectedSavedPayment === m.id ? "border-accent bg-accent/5" : "border-border"
                            }`}
                          >
                            <input
                              type="radio"
                              name="savedPayment"
                              checked={selectedSavedPayment === m.id}
                              onChange={() => {
                                setSelectedSavedPayment(m.id);
                                if (m.phone) setMobilePhone(m.phone);
                                if (m.network) setMobileNetwork(m.network as any);
                              }}
                              className="accent-accent"
                            />
                            <Smartphone className="w-4 h-4 text-text-muted" />
                            <div>
                              <span className="text-sm font-medium">{m.phoneMask || m.phone}</span>
                              {m.network && <span className="text-xs text-text-muted ml-2">{m.network}</span>}
                              {m.label && <span className="text-xs text-text-muted ml-2">({m.label})</span>}
                            </div>
                            {m.isDefault && <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full ml-auto">Default</span>}
                          </label>
                        ))}
                        <label
                          className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedSavedPayment === null ? "border-accent bg-accent/5" : "border-border"
                          }`}
                        >
                          <input
                            type="radio"
                            name="savedPayment"
                            checked={selectedSavedPayment === null}
                            onChange={() => {
                              setSelectedSavedPayment(null);
                              setMobilePhone("");
                            }}
                            className="accent-accent"
                          />
                          <span className="text-sm">Use a different number</span>
                        </label>
                      </div>
                    </div>
                  )}

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
                      onChange={(e) => {
                        setMobilePhone(e.target.value);
                        setSelectedSavedPayment(null);
                      }}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter the phone number registered with {mobileNetwork} {paymentMethod === "cod" ? "to pay the 20% deposit" : ""}
                    </p>
                  </div>

                  {/* Save this number checkbox */}
                  {user && !selectedSavedPayment && mobilePhone && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={savePaymentMethod}
                        onChange={(e) => setSavePaymentMethod(e.target.checked)}
                        className="accent-accent w-4 h-4"
                      />
                      <span className="text-xs text-text-muted">Save this number for future checkouts</span>
                    </label>
                  )}
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
                <div className="p-4 bg-amber-50 rounded-8 space-y-3">
                  <div className="flex items-start gap-3">
                    <Banknote className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-900">Cash on Delivery (20% Online Deposit Required)</p>
                      <p className="text-xs text-amber-700 mt-1">
                        A 20% online commitment deposit is required to confirm your order and prevent fake checkouts. The remaining 80% is paid to the courier upon delivery.
                      </p>
                    </div>
                  </div>
                  <div className="p-3 bg-white rounded-6 border border-amber-200 text-xs font-sans space-y-2">
                    <div className="flex justify-between text-text">
                      <span className="font-medium">20% Online Deposit (Pay Now):</span>
                      <span className="font-bold text-amber-800">{formatPrice(Math.ceil(finalTotal * 0.2))}</span>
                    </div>
                    <div className="flex justify-between text-text border-t border-dashed border-gray-200 pt-2">
                      <span className="font-medium">80% Balance (Pay on Delivery):</span>
                      <span className="font-semibold">{formatPrice(finalTotal - Math.ceil(finalTotal * 0.2))}</span>
                    </div>
                  </div>
                  <div className="space-y-3 pt-2 border-t border-amber-200/50">
                    <span className="block text-xs font-semibold text-amber-900">
                      Choose Deposit Payment Method:
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCodDepositMethod("mobile_money")}
                        className={`py-2 px-3 text-xs font-medium rounded-6 border flex items-center justify-center gap-1.5 transition-all ${
                          codDepositMethod === "mobile_money"
                            ? "border-accent bg-accent/5 text-accent font-semibold"
                            : "border-gray-200 bg-white text-text hover:border-gray-300"
                        }`}
                      >
                        <Smartphone className="w-3.5 h-3.5" /> Mobile Money
                      </button>
                      <button
                        type="button"
                        onClick={() => setCodDepositMethod("card")}
                        className={`py-2 px-3 text-xs font-medium rounded-6 border flex items-center justify-center gap-1.5 transition-all ${
                          codDepositMethod === "card"
                            ? "border-accent bg-accent/5 text-accent font-semibold"
                            : "border-gray-200 bg-white text-text hover:border-gray-300"
                        }`}
                      >
                        <CreditCard className="w-3.5 h-3.5" /> Card
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Pay in Installments */}
              <div className={`border border-border rounded-8 overflow-hidden ${installmentsEligible === false ? "opacity-60 bg-gray-50 dark:bg-gray-800/10" : ""}`}>
                <label className={`flex items-center gap-3 p-4 ${installmentsEligible === false ? "cursor-not-allowed" : "cursor-pointer"}`}>
                  <input
                    type="checkbox"
                    disabled={installmentsEligible === false}
                    checked={installmentsEnabled}
                    onChange={(e) => {
                      setInstallmentsEnabled(e.target.checked);
                      if (e.target.checked) {
                        setIsPayForMe(false);
                        setIsSplitPayment(false);
                      }
                    }}
                    className="accent-accent"
                  />
                  <div>
                    <span className="font-semibold text-sm text-text">Pay in Installments</span>
                    <p className="text-xs text-text-muted">Split your payment into smaller amounts</p>
                    {installmentsEligible === false && (
                      <p className="text-[11px] text-red-500 mt-1 font-sans leading-tight">
                        ⚠️ Ineligible: {installmentsIneligibleReason}
                      </p>
                    )}
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
                    <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 font-sans">
                      <p className="text-sm font-medium text-gray-900">Payment schedule:</p>
                      {Array.from({ length: installmentCount }).map((_, i) => {
                        // FIX H6: Use Math.floor so last installment gets the remainder (never negative)
                        const baseAmount = Math.floor(finalTotal / installmentCount);
                        const remainder = finalTotal - baseAmount * installmentCount;
                        const amount = i === installmentCount - 1 ? baseAmount + remainder : baseAmount;
                        const intervalWeeks = installmentCount <= 2 ? 2 : 4;
                        const isFirst = i === 0;
                        return (
                          <p key={i} className="text-xs text-gray-600 flex justify-between">
                            <span>{isFirst ? "Today" : `In ${i * intervalWeeks} weeks`}</span>
                            <span className="font-medium">{formatPrice(amount)}</span>
                          </p>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Bill Sharing Option */}
              {paymentMethod !== "cod" && (
                <div className="border border-border rounded-8 overflow-hidden bg-surface dark:bg-gray-800/20">
                  <label className="flex items-center gap-3 p-4 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isPayForMe || isSplitPayment}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (checked) {
                          setIsSplitPayment(true); // Default to Split Payment
                          setIsPayForMe(false);
                          setInstallmentsEnabled(false);
                        } else {
                          setIsSplitPayment(false);
                          setIsPayForMe(false);
                          setSplitShowItems(false);
                        }
                      }}
                      className="accent-accent w-4 h-4 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold text-sm text-text flex items-center gap-1.5">
                        👥 Bill Sharing & Ask a Friend
                      </span>
                      <p className="text-xs text-text-muted">Split the cost 50/50 or ask a friend to pay the full bill on your behalf</p>
                    </div>
                  </label>

                  {(isPayForMe || isSplitPayment) && (
                    <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
                      {/* Sub-options for sharing */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div
                          onClick={() => {
                            setIsSplitPayment(true);
                            setIsPayForMe(false);
                          }}
                          className={`p-3 border rounded-lg cursor-pointer transition-all flex flex-col justify-between ${
                            isSplitPayment
                              ? "border-accent bg-accent/5 dark:bg-accent/10"
                              : "border-border hover:border-gray-300 bg-gray-50/50"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1 font-sans">
                            <input
                              type="radio"
                              name="sharing_type"
                              checked={isSplitPayment}
                              readOnly
                              className="accent-accent w-3.5 h-3.5"
                            />
                            <span className="font-semibold text-xs text-text">50/50 Split Payment</span>
                          </div>
                          <p className="text-[10px] text-text-muted">Pay half now, and your friend pays the other half later.</p>
                        </div>

                        <div
                          onClick={() => {
                            setIsPayForMe(true);
                            setIsSplitPayment(false);
                          }}
                          className={`p-3 border rounded-lg cursor-pointer transition-all flex flex-col justify-between ${
                            isPayForMe
                              ? "border-accent bg-accent/5 dark:bg-accent/10"
                              : "border-border hover:border-gray-300 bg-gray-50/50"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1 font-sans">
                            <input
                              type="radio"
                              name="sharing_type"
                              checked={isPayForMe}
                              readOnly
                              className="accent-accent w-3.5 h-3.5"
                            />
                            <span className="font-semibold text-xs text-text">100% Ask a Friend to Pay</span>
                          </div>
                          <p className="text-[10px] text-text-muted">Send the entire bill to a friend to pay on your behalf.</p>
                        </div>
                      </div>

                      {/* Phone input */}
                      <div>
                        <label htmlFor="splitPartnerPhone" className="block text-xs font-semibold text-text mb-1">
                          Friend&apos;s Phone Number * <span className="text-[10px] text-text-muted font-normal">(Uganda format, e.g. 07XXXXXXXX)</span>
                        </label>
                        <input
                          id="splitPartnerPhone"
                          className="input text-sm"
                          placeholder="e.g. 0771234567"
                          value={splitPartnerPhone}
                          onChange={(e) => setSplitPartnerPhone(e.target.value)}
                        />
                        <p className="text-[10px] text-text-muted mt-1.5 font-sans leading-relaxed">
                          We will send the payment link to this phone number via SMS/WhatsApp. 
                          {isSplitPayment 
                            ? " Once you pay your 50% share, your friend will receive the invite to pay the other 50%." 
                            : " The order will be processed once your friend completes the full payment."}
                        </p>
                      </div>

                      {/* Opt-in to show items to partner */}
                      <div className="flex items-center gap-2 pt-1 font-sans select-none">
                        <input
                          id="splitShowItems"
                          type="checkbox"
                          checked={splitShowItems}
                          onChange={(e) => setSplitShowItems(e.target.checked)}
                          className="accent-accent w-4 h-4 cursor-pointer"
                        />
                        <label htmlFor="splitShowItems" className="text-xs font-medium text-text cursor-pointer leading-tight">
                          Share order items (products & quantities) on the payment page 
                          <span className="block text-[10px] text-text-muted font-normal mt-0.5">By default, order items are hidden for absolute privacy.</span>
                        </label>
                      </div>

                      {/* Dynamic price breakdown details */}
                      <div className="p-3 bg-accent/5 rounded-lg border border-accent/15 space-y-1.5 font-sans">
                        <p className="text-xs font-bold text-accent">Payment Details Breakdown:</p>
                        <div className="flex justify-between text-xs text-text">
                          <span>Your Share (Pay Now):</span>
                          {/* FIX H7: Use Math.floor for initiator share so total is never exceeded */}
                          <span className="font-semibold">{isPayForMe ? formatPrice(0) : formatPrice(Math.floor(finalTotal / 2))}</span>
                        </div>
                        <div className="flex justify-between text-xs text-text border-t border-dashed border-accent/20 pt-1.5">
                          <span>Friend&apos;s Share (Awaiting Payment):</span>
                          <span className="font-semibold text-accent">
                            {/* Partner always pays the remainder to ensure total is exact */}
                            {isPayForMe ? formatPrice(finalTotal) : formatPrice(finalTotal - Math.floor(finalTotal / 2))}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                      ? `Cash on Delivery (20% Deposit via ${codDepositMethod === "mobile_money" ? "Mobile Money" : "Card"})`
                      : "Flutterwave (Card, Mobile Money, Bank & more)"}
                  </p>
                  <p className="text-small text-text-muted mt-1">
                    {paymentMethod === "mobile_money"
                      ? mobilePhone
                      : paymentMethod === "paypal"
                      ? "Secure checkout via PayPal (charged in USD)"
                      : paymentMethod === "cod"
                      ? `20% Deposit (${formatPrice(Math.ceil(finalTotal * 0.2))}) paid online, 80% balance (${formatPrice(finalTotal - Math.ceil(finalTotal * 0.2))}) paid on delivery.`
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
                      {paymentMethod === "cod"
                        ? `Pay Deposit ${formatPrice(Math.ceil(finalTotal * 0.2))}`
                        : installmentsEnabled && installmentCount >= 2
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
          <OrderSummary
            city={shipping.city}
            onCouponChange={handleCouponChange}
            storeCreditDiscount={creditDiscount}
            giftCardDiscount={giftCardDiscount}
            loyaltyDiscount={loyaltyDiscount}
          />
        </div>
      </div>
    </Section>
  );
}
