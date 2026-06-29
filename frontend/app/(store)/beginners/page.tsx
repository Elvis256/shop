"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Section from "@/components/Section";
import ProductCard from "@/components/ProductCard";
import { ChevronRight, Sparkles, Heart, Shield, HelpCircle } from "lucide-react";

const API_URL = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice?: number;
  rating: number;
  imageUrl?: string;
  category?: string;
  inStock?: boolean;
}

type Step = "interest" | "experience" | "budget" | "results";

interface Selection {
  interest: string;
  experience: string;
  budget: string;
}

const INTERESTS = [
  { id: "solo", label: "Solo Exploration", icon: "✨" },
  { id: "couples", label: "With a Partner", icon: "💕" },
  { id: "wellness", label: "Wellness & Self-Care", icon: "🌿" },
  { id: "lingerie", label: "Lingerie & Confidence", icon: "👙" },
];

const EXPERIENCE_LEVELS = [
  { id: "first-time", label: "Complete beginner" },
  { id: "some", label: "Some experience" },
  { id: "exploring", label: "Ready to explore more" },
];

const BUDGETS = [
  { id: "under-50k", label: "Under UGX 50,000", max: 50000 },
  { id: "50k-100k", label: "UGX 50,000 - 100,000", max: 100000 },
  { id: "100k-plus", label: "UGX 100,000+", max: 999999 },
];

export default function BeginnersPage() {
  const [step, setStep] = useState<Step>("interest");
  const [selection, setSelection] = useState<Selection>({ interest: "", experience: "", budget: "" });
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSelect = (field: keyof Selection, value: string) => {
    setSelection((prev) => ({ ...prev, [field]: value }));
    // Auto-advance
    if (field === "interest") setTimeout(() => setStep("experience"), 300);
    if (field === "experience") setTimeout(() => setStep("budget"), 300);
    if (field === "budget") {
      setTimeout(() => {
        setStep("results");
        loadProducts(value);
      }, 300);
    }
  };

  const loadProducts = async (budget: string) => {
    setLoading(true);
    try {
      const budgetObj = BUDGETS.find((b) => b.id === budget);
      const maxPrice = budgetObj?.max || 100000;
      const category = selection.interest === "lingerie" ? "lingerie" : selection.interest === "couples" ? "couples" : "";
      const params = new URLSearchParams({
        limit: "8",
        maxPrice: String(maxPrice),
        sort: "rating",
        ...(category ? { category } : {}),
      });
      const res = await fetch(`${API_URL}/api/products?${params}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch {}
    setLoading(false);
  };

  const restart = () => {
    setStep("interest");
    setSelection({ interest: "", experience: "", budget: "" });
    setProducts([]);
  };

  return (
    <div>
      {/* Hero */}
      <div className="bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 text-white py-16 sm:py-20">
        <div className="container text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            First Time?
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">
            Find Your Perfect Starting Point
          </h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto">
            Answer 3 quick questions and we&apos;ll recommend the best products for you.
            No judgement, just helpful guidance.
          </p>
        </div>
      </div>

      <Section>
        <div className="max-w-2xl mx-auto">
          {/* Progress */}
          <div className="flex items-center justify-center gap-2 mb-10">
            {["interest", "experience", "budget", "results"].map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  step === s ? "bg-primary text-white" :
                  ["interest", "experience", "budget", "results"].indexOf(step) > i ? "bg-green-500 text-white" :
                  "bg-gray-200 text-gray-500"
                }`}>
                  {i + 1}
                </div>
                {i < 3 && <div className="w-8 h-0.5 bg-gray-200 mx-1" />}
              </div>
            ))}
          </div>

          {/* Step 1: Interest */}
          {step === "interest" && (
            <div className="text-center">
              <h2 className="text-xl font-bold mb-6">What are you looking for?</h2>
              <div className="grid grid-cols-2 gap-4">
                {INTERESTS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect("interest", item.id)}
                    className={`p-6 rounded-xl border-2 transition-all hover:border-primary hover:shadow-md ${
                      selection.interest === item.id ? "border-primary bg-primary/5" : "border-gray-200"
                    }`}
                  >
                    <span className="text-3xl block mb-2">{item.icon}</span>
                    <span className="font-medium text-gray-900">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Experience */}
          {step === "experience" && (
            <div className="text-center">
              <h2 className="text-xl font-bold mb-6">What&apos;s your experience level?</h2>
              <div className="space-y-3">
                {EXPERIENCE_LEVELS.map((level) => (
                  <button
                    key={level.id}
                    onClick={() => handleSelect("experience", level.id)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all hover:border-primary ${
                      selection.experience === level.id ? "border-primary bg-primary/5" : "border-gray-200"
                    }`}
                  >
                    <span className="font-medium text-gray-900">{level.label}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep("interest")} className="mt-4 text-sm text-gray-500 hover:text-gray-700">
                ← Back
              </button>
            </div>
          )}

          {/* Step 3: Budget */}
          {step === "budget" && (
            <div className="text-center">
              <h2 className="text-xl font-bold mb-6">What&apos;s your budget?</h2>
              <div className="space-y-3">
                {BUDGETS.map((budget) => (
                  <button
                    key={budget.id}
                    onClick={() => handleSelect("budget", budget.id)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all hover:border-primary ${
                      selection.budget === budget.id ? "border-primary bg-primary/5" : "border-gray-200"
                    }`}
                  >
                    <span className="font-medium text-gray-900">{budget.label}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep("experience")} className="mt-4 text-sm text-gray-500 hover:text-gray-700">
                ← Back
              </button>
            </div>
          )}

          {/* Results */}
          {step === "results" && (
            <div>
              <div className="text-center mb-8">
                <h2 className="text-xl font-bold mb-2">Our Recommendations for You</h2>
                <p className="text-gray-500">Hand-picked based on your preferences</p>
                <button onClick={restart} className="mt-2 text-sm text-primary hover:underline">
                  Start over
                </button>
              </div>
              {loading ? (
                <div className="grid-products">
                  {[1,2,3,4].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="aspect-[4/5] bg-surface rounded-24 mb-4" />
                      <div className="h-4 bg-surface rounded-full mb-2" />
                      <div className="h-3 bg-surface rounded-full w-1/2" />
                    </div>
                  ))}
                </div>
              ) : products.length > 0 ? (
                <div className="grid-products">
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      id={product.id}
                      name={product.name}
                      slug={product.slug}
                      price={product.price}
                      comparePrice={product.comparePrice}
                      rating={product.rating}
                      imageUrl={product.imageUrl}
                      category={product.category}
                      inStock={product.inStock !== false}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">
                  No products found matching your criteria. Try adjusting your budget.
                </p>
              )}
            </div>
          )}
        </div>
      </Section>

      {/* Trust Section */}
      <Section>
        <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto text-center">
          <div className="p-4">
            <Shield className="w-8 h-8 text-primary mx-auto mb-3" />
            <h4 className="font-semibold mb-1">100% Discreet</h4>
            <p className="text-sm text-gray-500">Plain packaging, neutral billing</p>
          </div>
          <div className="p-4">
            <Heart className="w-8 h-8 text-primary mx-auto mb-3" />
            <h4 className="font-semibold mb-1">Body-Safe Products</h4>
            <p className="text-sm text-gray-500">Quality materials, certified safe</p>
          </div>
          <div className="p-4">
            <HelpCircle className="w-8 h-8 text-primary mx-auto mb-3" />
            <h4 className="font-semibold mb-1">Expert Support</h4>
            <p className="text-sm text-gray-500">Judgment-free help via WhatsApp</p>
          </div>
        </div>
      </Section>
    </div>
  );
}
