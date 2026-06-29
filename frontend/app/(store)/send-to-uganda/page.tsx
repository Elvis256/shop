"use client";

import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Globe, MapPin, Gift, CheckCircle, Loader2, ChevronDown } from "lucide-react";

const API_URL = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");
const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

const stripePromise = STRIPE_PK ? loadStripe(STRIPE_PK) : null;

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  imageUrl: string | null;
}

const CURRENCIES = [
  { code: "USD", symbol: "$", flag: "🇺🇸", name: "US Dollar" },
  { code: "GBP", symbol: "£", flag: "🇬🇧", name: "British Pound" },
  { code: "EUR", symbol: "€", flag: "🇪🇺", name: "Euro" },
  { code: "CAD", symbol: "CA$", flag: "🇨🇦", name: "Canadian Dollar" },
];

// Payment form (shown after creating the PaymentIntent)
function StripePaymentForm({
  clientSecret,
  currency,
  foreignAmount,
  orderNumber,
  onSuccess,
}: {
  clientSecret: string;
  currency: string;
  foreignAmount: number;
  orderNumber: string;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setPaying(true);
    setError("");
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.origin + "/send-to-uganda?success=1" },
      redirect: "if_required",
    });
    if (stripeError) {
      setError(stripeError.message || "Payment failed");
      setPaying(false);
    } else {
      onSuccess();
    }
  }

  const sym = CURRENCIES.find((c) => c.code === currency)?.symbol || "$";

  return (
    <form onSubmit={handlePay} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={paying || !stripe}
        className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2"
      >
        {paying ? <><Loader2 className="w-4 h-4 animate-spin" />Processing...</> : `Pay ${sym}${foreignAmount.toFixed(2)} ${currency}`}
      </button>
      <p className="text-xs text-gray-400 text-center">
        Secured by Stripe · Order {orderNumber}
      </p>
    </form>
  );
}

export default function SendToUgandaPage() {
  const [step, setStep] = useState<"products" | "details" | "payment" | "done">("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [currency, setCurrency] = useState("USD");
  const [rates, setRates] = useState<Record<string, number>>({ USD: 3700, GBP: 4700, EUR: 4100, CAD: 2700 });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [orderResult, setOrderResult] = useState<{ orderNumber: string; foreignAmount: number; currency: string } | null>(null);

  const [form, setForm] = useState({
    senderName: "", senderEmail: "",
    recipientName: "", recipientPhone: "", recipientStreet: "", recipientCity: "", recipientCounty: "",
    message: "",
  });

  useEffect(() => {
    // Check URL for Stripe redirect success
    if (window.location.search.includes("success=1")) {
      setStep("done");
    }

    Promise.all([
      fetch(`${API_URL}/api/products?limit=30&status=ACTIVE`, { credentials: "include" })
        .then((r) => r.json())
        .then((d) => {
          setProducts((d.products || []).map((p: any) => ({
            id: p.id, name: p.name, slug: p.slug,
            price: Number(p.price),
            imageUrl: p.images?.[0]?.url || null,
          })));
        }),
      fetch(`${API_URL}/api/diaspora/rates`)
        .then((r) => r.json())
        .then((d) => { if (d.rates) setRates(d.rates); }),
    ]).finally(() => setLoading(false));
  }, []);

  function cartTotal() {
    return Object.entries(cart).reduce((sum, [id, qty]) => {
      const p = products.find((pr) => pr.id === id);
      return sum + (p ? p.price * qty : 0);
    }, 0);
  }

  function toForeign(ugx: number) {
    const rate = rates[currency] || 3700;
    return (ugx / rate);
  }

  const ugxTotal = cartTotal() + 5000; // 5000 shipping
  const foreignTotal = toForeign(ugxTotal);
  const sym = CURRENCIES.find((c) => c.code === currency)?.symbol || "$";
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  async function handleSubmitOrder() {
    setSubmitting(true);
    setSubmitError("");
    try {
      const items = Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([productId, quantity]) => ({ productId, quantity }));

      const res = await fetch(`${API_URL}/api/diaspora/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          currency,
          sender: { name: form.senderName, email: form.senderEmail },
          recipient: {
            name: form.recipientName, phone: form.recipientPhone,
            street: form.recipientStreet, city: form.recipientCity,
            county: form.recipientCounty || undefined,
          },
          message: form.message || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");

      setClientSecret(data.clientSecret);
      setOrderResult({ orderNumber: data.orderNumber, foreignAmount: data.foreignAmount, currency: data.currency });
      setStep("payment");
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "done") return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-pink-50 to-white">
      <div className="text-center max-w-sm space-y-4">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
        <h1 className="text-2xl font-bold text-gray-900">Gift sent! 🎉</h1>
        <p className="text-gray-600">Your payment was successful. We'll send you an email receipt and notify the recipient via WhatsApp when their gift ships.</p>
        <p className="text-sm text-gray-400">Plain packaging — fully discreet 🔒</p>
        <a href="/" className="inline-block mt-4 text-primary hover:underline text-sm">Back to store</a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white px-4 py-10">
      <div className="max-w-lg mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
            <Globe className="w-7 h-7 text-purple-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Send a Gift to Uganda</h1>
          <p className="text-gray-500 text-sm">Order from anywhere in the world — delivered discreetly in Kampala.</p>
        </div>

        {/* Steps indicator */}
        <div className="flex justify-center gap-2">
          {["products", "details", "payment"].map((s, i) => (
            <div key={s} className={`w-2 h-2 rounded-full transition-colors ${step === s ? "bg-primary" : (["products", "details", "payment"].indexOf(step) > i ? "bg-primary/50" : "bg-gray-200")}`} />
          ))}
        </div>

        {/* Step 1: Products */}
        {step === "products" && (
          <div className="space-y-4">
            {/* Currency picker */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-sm font-semibold text-gray-700 mb-3">Pay in your currency</p>
              <div className="grid grid-cols-4 gap-2">
                {CURRENCIES.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => setCurrency(c.code)}
                    className={`p-2 rounded-lg border text-center transition-colors ${currency === c.code ? "border-primary bg-primary/5" : "border-gray-200 hover:border-primary/50"}`}
                  >
                    <div className="text-xl">{c.flag}</div>
                    <div className="text-xs font-medium text-gray-700 mt-0.5">{c.code}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Products */}
            {loading ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />Loading products...
              </div>
            ) : (
              <div className="space-y-2">
                {products.map((p) => {
                  const qty = cart[p.id] || 0;
                  const foreignPrice = toForeign(p.price);
                  return (
                    <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm flex items-center gap-3">
                      {p.imageUrl
                        ? <img src={p.imageUrl} alt={p.name} className="w-14 h-14 object-cover rounded-lg flex-shrink-0" />
                        : <div className="w-14 h-14 bg-purple-50 rounded-lg flex-shrink-0 flex items-center justify-center text-2xl">🎁</div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 leading-tight">{p.name}</p>
                        <p className="text-xs text-primary font-bold mt-0.5">
                          {sym}{foreignPrice.toFixed(2)} {currency}
                          <span className="text-gray-400 font-normal ml-1">(UGX {p.price.toLocaleString()})</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => setCart((c) => ({ ...c, [p.id]: Math.max(0, (c[p.id] || 0) - 1) }))}
                          className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors text-lg leading-none">−</button>
                        <span className="w-5 text-center text-sm font-medium">{qty}</span>
                        <button onClick={() => setCart((c) => ({ ...c, [p.id]: (c[p.id] || 0) + 1 }))}
                          className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors text-lg leading-none">+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Cart total + next */}
            {cartCount > 0 && (
              <div className="bg-primary rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-white text-sm">{cartCount} item{cartCount !== 1 ? "s" : ""} · incl. delivery</p>
                  <p className="text-white font-bold text-xl">{sym}{foreignTotal.toFixed(2)} {currency}</p>
                </div>
                <button
                  onClick={() => setStep("details")}
                  className="bg-white text-primary font-semibold px-5 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                >
                  Continue →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Details */}
        {step === "details" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-3">
              <p className="font-semibold text-gray-900 flex items-center gap-2">
                <Gift className="w-4 h-4 text-primary" />Your details (sender)
              </p>
              {[
                { key: "senderName", label: "Your Name", placeholder: "Full name", type: "text" },
                { key: "senderEmail", label: "Your Email", placeholder: "you@email.com", type: "email" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                  <input type={f.type} required placeholder={f.placeholder}
                    value={form[f.key as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-3">
              <p className="font-semibold text-gray-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />Recipient in Uganda
              </p>
              {[
                { key: "recipientName", label: "Recipient's Name", placeholder: "Full name" },
                { key: "recipientPhone", label: "Recipient's WhatsApp / Phone", placeholder: "+256 7XX XXX XXX" },
                { key: "recipientStreet", label: "Street / Area", placeholder: "e.g. Ntinda, near Shell" },
                { key: "recipientCity", label: "City / Town", placeholder: "e.g. Kampala" },
                { key: "recipientCounty", label: "District (optional)", placeholder: "e.g. Wakiso" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                  <input type="text" required={f.key !== "recipientCounty"} placeholder={f.placeholder}
                    value={form[f.key as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <label className="block text-xs text-gray-500 mb-1">Personal Message (optional)</label>
              <textarea
                rows={3} placeholder="Write a personal message to include..."
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                maxLength={500}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary resize-none"
              />
              <p className="text-xs text-gray-400 text-right mt-1">{form.message.length}/500</p>
            </div>

            {submitError && <p className="text-red-500 text-sm text-center">{submitError}</p>}

            <div className="flex gap-3">
              <button onClick={() => setStep("products")}
                className="flex-1 border border-gray-200 text-gray-700 rounded-xl py-3 text-sm font-medium hover:bg-gray-50 transition-colors">
                ← Back
              </button>
              <button
                onClick={handleSubmitOrder}
                disabled={submitting || !form.senderName || !form.senderEmail || !form.recipientName || !form.recipientPhone || !form.recipientStreet || !form.recipientCity}
                className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors"
              >
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" />Processing...</> : `Pay ${sym}${foreignTotal.toFixed(2)} →`}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Stripe payment */}
        {step === "payment" && clientSecret && orderResult && (
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
            <p className="font-semibold text-gray-900 text-center">Complete Payment</p>
            {stripePromise ? (
              <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
                <StripePaymentForm
                  clientSecret={clientSecret}
                  currency={orderResult.currency}
                  foreignAmount={orderResult.foreignAmount}
                  orderNumber={orderResult.orderNumber}
                  onSuccess={() => setStep("done")}
                />
              </Elements>
            ) : (
              <div className="text-center text-gray-500 text-sm py-4">
                Stripe not configured. Contact support to complete payment.<br />
                <span className="font-mono text-xs text-gray-400">Order: {orderResult.orderNumber}</span>
              </div>
            )}
          </div>
        )}

        {/* Info footer */}
        <div className="text-center text-xs text-gray-400 space-y-1">
          <p>🔒 Plain packaging · No product names on label</p>
          <p>Kampala delivery 2–4 business days</p>
          <p>Payments powered by Stripe · SSL secured</p>
        </div>
      </div>
    </div>
  );
}
