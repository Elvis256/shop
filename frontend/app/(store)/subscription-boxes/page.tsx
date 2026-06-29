"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, CheckCircle, Loader2, Lock, RefreshCw, Star, X, Shield, Sparkles, Sliders, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";

const API_URL = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");

const BOX_DEFS = [
  {
    slug: "solo-wellness-box",
    emoji: "✨",
    name: "Discover Mystery Box",
    tagline: "Your monthly self-care ritual",
    description: "Curated wellness essentials delivered discreetly every month. Products chosen for your personal pleasure and wellbeing.",
    features: ["4–6 curated products", "10% subscriber discount", "Plain packaging", "Cancel anytime"],
    color: "from-pink-500/10 to-purple-500/10",
    border: "border-pink-500/30",
    badge: "Solo & Self-Care",
    badgeColor: "bg-pink-600",
  },
  {
    slug: "couples-box",
    emoji: "💑",
    name: "Explore Mystery Box",
    tagline: "Reconnect every month",
    description: "A thoughtfully curated monthly package designed to enhance intimacy and bring couples closer together.",
    features: ["6–8 products for two", "15% subscriber discount", "Discreet packaging", "Skip or cancel anytime"],
    color: "from-red-500/10 to-pink-500/10",
    border: "border-red-500/30",
    badge: "Best Value for Couples",
    badgeColor: "bg-red-600",
  },
  {
    slug: "skincare-box",
    emoji: "🌿",
    name: "Elevate Luxury Box",
    tagline: "Ultra-premium indulgence",
    description: "Our highest tier mystery box containing elite wellness accessories, top-shelf serums, and custom accessories.",
    features: ["4–5 luxury products", "15% subscriber discount", "Plain packaging", "Cancel anytime"],
    color: "from-amber-500/10 to-orange-500/10",
    border: "border-amber-500/30",
    badge: "Luxury Tier",
    badgeColor: "bg-amber-600",
  },
];

interface BoxProduct {
  id: string;
  slug: string;
  name: string;
  price: number;
  subscriptionDiscount: number | null;
  imageUrl: string | null;
}

interface UserSub {
  productId: string;
  status: string;
  nextDelivery: string;
}

export default function SubscriptionBoxesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isLoggedIn = !!user;
  const [products, setProducts] = useState<Record<string, BoxProduct>>({});
  const [userSubs, setUserSubs] = useState<UserSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Preference Quiz Modal State
  const [selectedBoxSlug, setSelectedBoxSlug] = useState<string | null>(null);
  const [quizStep, setQuizStep] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState({
    goal: "",
    experience: "",
    packaging: "STANDARD",
  });

  useEffect(() => {
    // Fetch all subscribable products
    Promise.all([
      fetch(`${API_URL}/api/products?subscribable=true&limit=20`, { credentials: "include" })
        .then((r) => r.json())
        .then((d) => {
          const map: Record<string, BoxProduct> = {};
          (d.products || []).forEach((p: any) => {
            map[p.slug] = {
              id: p.id,
              slug: p.slug,
              name: p.name,
              price: Number(p.price),
              subscriptionDiscount: p.subscriptionDiscount ? Number(p.subscriptionDiscount) : null,
              imageUrl: p.images?.[0]?.url || null,
            };
          });
          setProducts(map);
        }),
      fetch(`${API_URL}/api/subscriptions`, { credentials: "include" })
        .then((r) => r.ok ? r.json() : { subscriptions: [] })
        .then((d) => setUserSubs(d.subscriptions || [])),
    ]).finally(() => setLoading(false));
  }, []);

  function getSubForBox(slug: string) {
    const product = products[slug];
    if (!product) return null;
    return userSubs.find((s) => s.productId === product.id) || null;
  }

  const handleStartSubscribe = (slug: string) => {
    if (!isLoggedIn) {
      router.push("/auth/login?redirect=/subscription-boxes");
      return;
    }
    setSelectedBoxSlug(slug);
    setQuizStep(1);
  };

  async function handleConfirmSubscribe() {
    if (!selectedBoxSlug) return;
    const product = products[selectedBoxSlug];
    if (!product) return;

    setSubscribing(selectedBoxSlug);
    setError(null);
    setSelectedBoxSlug(null); // close modal

    try {
      const res = await fetch(`${API_URL}/api/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          productId: product.id, 
          quantity: 1, 
          intervalDays: 30,
          preferences: quizAnswers 
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to subscribe");

      setSuccess(selectedBoxSlug);
      setUserSubs((prev) => [
        ...prev,
        {
          productId: product.id,
          status: "ACTIVE",
          nextDelivery: data.subscription.nextDelivery,
        },
      ]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubscribing(null);
    }
  }

  const fmt = (n: number) => `UGX ${n.toLocaleString()}`;
  const discounted = (price: number, discount: number | null) =>
    discount ? price * (1 - discount / 100) : price;

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50/20 via-white to-rose-50/10 dark:from-gray-950 dark:to-gray-900 px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-500 bg-rose-50 dark:bg-rose-950/20 px-3 py-1 rounded-full">
            <Sparkles className="w-3.5 h-3.5" /> Curated Mystery Tiers
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">Wellness Subscription Boxes</h1>
          <p className="text-xs text-text-muted max-w-sm mx-auto">
            Discreetly delivered monthly boxes. Tailor your preferences and let our intimacy experts curate your package.
          </p>
        </div>

        {/* Trust badges */}
        <div className="flex justify-center gap-6 text-xs text-text-muted">
          <span className="flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Discreet packaging</span>
          <span className="flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" /> Cancel anytime</span>
          <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5" /> Save up to 15%</span>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm flex items-center justify-between gap-3">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0" aria-label="Dismiss">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Box cards */}
        <div className="space-y-4">
          {BOX_DEFS.map((box) => {
            const product = products[box.slug];
            const sub = getSubForBox(box.slug);
            const price = product ? discounted(product.price, product.subscriptionDiscount) : null;
            const isSubscribed = !!sub;
            const isThisSubscribing = subscribing === box.slug;
            const isThisSuccess = success === box.slug;

            return (
              <div
                key={box.slug}
                className={`relative bg-gradient-to-br ${box.color} border ${box.border} rounded-2xl p-5 space-y-4`}
              >
                {/* Badge */}
                {box.badge && (
                  <span className={`absolute top-4 right-4 ${box.badgeColor} text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide`}>
                    {box.badge}
                  </span>
                )}

                {/* Header */}
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{box.emoji}</span>
                  <div>
                    <h2 className="text-lg font-bold text-text">{box.name}</h2>
                    <p className="text-sm text-text-muted">{box.tagline}</p>
                  </div>
                </div>

                <p className="text-sm text-text-muted">{box.description}</p>

                {/* Features */}
                <ul className="space-y-1">
                  {box.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-text-muted">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* Price + CTA */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    {loading ? (
                      <div className="h-6 w-32 bg-border rounded animate-pulse" />
                    ) : price ? (
                      <div>
                        <span className="text-xl font-bold text-text">{fmt(price)}</span>
                        <span className="text-xs text-text-muted">/month</span>
                        {product?.subscriptionDiscount && (
                          <div className="text-xs text-green-600 mt-0.5">
                            Save {product.subscriptionDiscount}% vs buying separately
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-text-muted">Coming soon</span>
                    )}
                  </div>

                  {isSubscribed ? (
                    <div className="text-right">
                      <div className="flex items-center gap-1.5 text-green-600 text-sm font-semibold">
                        <CheckCircle className="w-4 h-4" />
                        Subscribed
                      </div>
                      <p className="text-[10px] text-text-muted mt-0.5">
                        Next: {new Date(sub!.nextDelivery).toLocaleDateString("en-UG", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                  ) : isThisSuccess ? (
                    <div className="flex items-center gap-1.5 text-green-600 text-sm font-semibold">
                      <CheckCircle className="w-4 h-4" />
                      You're in!
                    </div>
                  ) : (
                    <button
                      onClick={() => handleStartSubscribe(box.slug)}
                      disabled={isThisSubscribing || !product}
                      className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2 min-w-[110px] justify-center shadow-sm"
                    >
                      {isThisSubscribing ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Subscribing...</>
                      ) : !product ? (
                        "Coming Soon"
                      ) : (
                        "Subscribe"
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Preference Setup Modal */}
        {quizStep > 0 && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-md w-full p-6 border border-border shadow-2xl space-y-6 animate-scale-in">
              <div className="flex items-center justify-between border-b pb-3 border-border">
                <span className="text-xs font-semibold text-rose-500 flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5" /> Customize Your Curation
                </span>
                <button 
                  onClick={() => setQuizStep(0)} 
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {quizStep === 1 && (
                <div className="space-y-4">
                  <h3 className="font-bold text-base text-gray-900 dark:text-white">Q1: What is your primary wellness goal?</h3>
                  <div className="space-y-2">
                    {["Sensory self-care & pleasure", "Deepening physical partner connection", "Exploring wild novelty & adventure"].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => {
                          setQuizAnswers({ ...quizAnswers, goal: opt });
                          setQuizStep(2);
                        }}
                        className="w-full text-left p-3.5 text-xs font-medium border border-border rounded-xl hover:border-accent hover:bg-accent/5 transition-all text-gray-700 dark:text-gray-300"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {quizStep === 2 && (
                <div className="space-y-4">
                  <h3 className="font-bold text-base text-gray-900 dark:text-white">Q2: What is your comfort/experience level?</h3>
                  <div className="space-y-2">
                    {["Curious Beginner: light items", "Comfortable Intermediate: standard accessories", "Experienced Connoisseur: advanced products"].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => {
                          setQuizAnswers({ ...quizAnswers, experience: opt });
                          setQuizStep(3);
                        }}
                        className="w-full text-left p-3.5 text-xs font-medium border border-border rounded-xl hover:border-accent hover:bg-accent/5 transition-all text-gray-700 dark:text-gray-300"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setQuizStep(1)} className="text-[10px] text-gray-500 hover:underline">
                    ← Back to Question 1
                  </button>
                </div>
              )}

              {quizStep === 3 && (
                <div className="space-y-4">
                  <h3 className="font-bold text-base text-gray-900 dark:text-white">Q3: Preferred stealth packaging style?</h3>
                  <div className="space-y-2">
                    {[
                      { value: "STANDARD", label: "📦 Plain brown box / generic label" },
                      { value: "GIFT", label: "🎁 Birthday present wrap / greeting envelope" },
                      { value: "ULTRA_STEALTH", label: "🛡️ Double vacuum-sealed scent-blocked pack" }
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setQuizAnswers({ ...quizAnswers, packaging: opt.value });
                        }}
                        className={`w-full text-left p-3.5 text-xs font-semibold border rounded-xl hover:border-accent transition-all flex justify-between items-center ${
                          quizAnswers.packaging === opt.value 
                            ? "border-accent bg-accent/5 text-accent"
                            : "border-border text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        <span>{opt.label}</span>
                        {quizAnswers.packaging === opt.value && <CheckCircle className="w-4 h-4 text-accent" />}
                      </button>
                    ))}
                  </div>
                  
                  <div className="flex gap-3 pt-3">
                    <button 
                      onClick={() => setQuizStep(2)} 
                      className="flex-1 py-2.5 border border-border rounded-lg text-xs font-semibold text-gray-600"
                    >
                      Back
                    </button>
                    <button 
                      onClick={handleConfirmSubscribe} 
                      className="flex-1 py-2.5 bg-primary text-white rounded-lg text-xs font-semibold hover:opacity-90 flex items-center justify-center gap-1"
                    >
                      Confirm Curation <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* How it works */}
        <div className="bg-surface-secondary border border-border rounded-2xl p-5 space-y-4">
          <h3 className="text-text font-semibold">How it works</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { step: "1", title: "Setup Profile", desc: "Select tier & answer setup quiz" },
              { step: "2", title: "We curate", desc: "Our team curates your physical items" },
              { step: "3", title: "Delivered", desc: "100% plain discreet outer package" },
            ].map((s) => (
              <div key={s.step} className="space-y-1">
                <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center mx-auto text-primary font-bold text-sm">
                  {s.step}
                </div>
                <p className="text-xs font-medium text-text">{s.title}</p>
                <p className="text-[10px] text-text-muted">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="space-y-3">
          {[
            { q: "How is it delivered?", a: "In plain, unmarked packaging with no logos or product names visible. Fully discreet." },
            { q: "Can I cancel anytime?", a: "Yes — reply CANCEL to the WhatsApp notification or contact support. No cancellation fees." },
            { q: "When will my box arrive?", a: "First box within 2–4 days of subscribing. Renewals process automatically every 30 days." },
            { q: "Can I choose what's inside?", a: "We curate each box for maximum value. Specific requests can be made via WhatsApp support." },
          ].map((item) => (
            <details key={item.q} className="bg-surface-secondary border border-border rounded-xl">
              <summary className="px-4 py-3 text-sm text-text font-medium cursor-pointer select-none">
                {item.q}
              </summary>
              <p className="px-4 pb-3 text-sm text-text-muted">{item.a}</p>
            </details>
          ))}
        </div>

        {/* Bottom note */}
        <p className="text-center text-xs text-text-muted pb-4">
          Charged monthly via MTN MoMo / Airtel Money · Payments are discreet
        </p>
      </div>
    </div>
  );
}
