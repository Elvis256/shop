"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Gift, Heart, User, PartyPopper, Sparkles, ArrowRight, ArrowLeft, ShoppingBag, Check } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useCart } from "@/lib/hooks/useCart";
import { useToast } from "@/lib/hooks/useToast";
import { useCurrency } from "@/contexts/CurrencyContext";
import ProductImage from "@/components/ProductImage";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice?: number | null;
  imageUrl: string | null;
  category: string | null;
  rating: number | null;
  reviewCount: number;
  stock: number;
}

const steps = ["Who", "Occasion", "Budget", "Results"];

const recipientOptions = [
  { value: "female", label: "Partner (Female)", icon: Heart },
  { value: "male", label: "Partner (Male)", icon: Heart },
  { value: "friend", label: "Friend", icon: User },
  { value: "self", label: "Self-care", icon: Sparkles },
];

const occasionOptions = [
  { value: "birthday", label: "Birthday", icon: PartyPopper },
  { value: "anniversary", label: "Anniversary", icon: Heart },
  { value: "justbecause", label: "Just Because", icon: Gift },
  { value: "surprise", label: "Surprise", icon: Sparkles },
];

const budgetOptions = [
  { value: "0-30000", label: "Under 30K" },
  { value: "30000-60000", label: "30K - 60K" },
  { value: "60000-100000", label: "60K - 100K" },
  { value: "100000-999999999", label: "100K+" },
];

export default function GiftFinderPage() {
  const router = useRouter();
  const { addItem } = useCart();
  const { showToast } = useToast();
  const { formatPrice } = useCurrency();
  const [step, setStep] = useState(0);
  const [recipient, setRecipient] = useState("");
  const [occasion, setOccasion] = useState("");
  const [budget, setBudget] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const fetchResults = async (budgetVal: string) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/recommendations/gift-finder?budget=${budgetVal}&minRating=3`);
      setProducts(res.products || []);
    } catch {
      setProducts([]);
    }
    setLoading(false);
  };

  const handleBudgetSelect = async (val: string) => {
    setBudget(val);
    await fetchResults(val);
    setStep(3);
  };

  const handleAddToGiftBox = (product: Product) => {
    try {
      addItem({
        id: product.id,
        productId: product.id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        imageUrl: product.imageUrl,
        stock: product.stock,
        quantity: 1,
      });
      setAddedIds(prev => new Set(prev).add(product.id));
      showToast("Added to gift box!", "success");
    } catch {
      showToast("Failed to add", "error");
    }
  };

  return (
    <div className="min-h-screen bg-bg">
      <div className="container py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Gift className="w-4 h-4" /> Gift Finder
          </div>
          <h1 className="text-3xl font-bold text-text mb-2">Find the Perfect Gift</h1>
          <p className="text-text-muted">Answer a few questions and we&apos;ll suggest the best products.</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                i <= step ? "bg-primary text-white" : "bg-gray-200 dark:bg-gray-700 text-text-muted"
              }`}>
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-8 h-0.5 ${i < step ? "bg-primary" : "bg-gray-200 dark:bg-gray-700"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Who */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-center mb-6">Who&apos;s the gift for?</h2>
            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
              {recipientOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setRecipient(opt.value); setStep(1); }}
                  className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border hover:border-primary transition-colors bg-surface"
                >
                  <opt.icon className="w-8 h-8 text-primary" />
                  <span className="font-medium text-text">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Occasion */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-center mb-6">What&apos;s the occasion?</h2>
            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
              {occasionOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setOccasion(opt.value); setStep(2); }}
                  className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border hover:border-primary transition-colors bg-surface"
                >
                  <opt.icon className="w-8 h-8 text-primary" />
                  <span className="font-medium text-text">{opt.label}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setStep(0)} className="flex items-center gap-1 mx-auto text-sm text-text-muted hover:text-text mt-4">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          </div>
        )}

        {/* Step 3: Budget */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-center mb-6">What&apos;s your budget?</h2>
            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
              {budgetOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleBudgetSelect(opt.value)}
                  className="p-6 rounded-xl border-2 border-border hover:border-primary transition-colors bg-surface text-center"
                >
                  <span className="font-medium text-text text-lg">UGX {opt.label}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setStep(1)} className="flex items-center gap-1 mx-auto text-sm text-text-muted hover:text-text mt-4">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          </div>
        )}

        {/* Step 4: Results */}
        {step === 3 && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Our Gift Suggestions</h2>
              <button onClick={() => setStep(2)} className="flex items-center gap-1 text-sm text-text-muted hover:text-text">
                <ArrowLeft className="w-4 h-4" /> Change budget
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12 text-text-muted">Loading suggestions...</div>
            ) : products.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-text-muted mb-4">No products match your criteria. Try a different budget.</p>
                <button onClick={() => setStep(2)} className="btn-primary">Change Budget</button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {products.map(product => (
                    <div key={product.id} className="bg-surface rounded-xl border border-border overflow-hidden group">
                      <Link href={`/product/${product.slug}`}>
                        <div className="aspect-square bg-gray-100 dark:bg-gray-800 relative overflow-hidden">
                          {product.imageUrl ? (
                            <ProductImage src={product.imageUrl} alt={product.name} fill className="object-cover group-hover:scale-105 transition-transform" />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-text-muted">No image</div>
                          )}
                        </div>
                      </Link>
                      <div className="p-3">
                        <Link href={`/product/${product.slug}`}>
                          <h3 className="text-sm font-medium text-text line-clamp-2 mb-1 hover:text-primary transition-colors">{product.name}</h3>
                        </Link>
                        <p className="text-sm font-bold text-primary mb-2">{formatPrice(product.price)}</p>
                        <button
                          onClick={() => handleAddToGiftBox(product)}
                          disabled={addedIds.has(product.id)}
                          className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                            addedIds.has(product.id)
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-primary text-white hover:bg-primary/90"
                          }`}
                        >
                          {addedIds.has(product.id) ? (
                            <span className="flex items-center justify-center gap-1"><Check className="w-4 h-4" /> Added</span>
                          ) : (
                            <span className="flex items-center justify-center gap-1"><Gift className="w-4 h-4" /> Add to Gift Box</span>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-center mt-8">
                  <Link
                    href="/checkout?gift=true"
                    className="inline-flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors"
                  >
                    <ShoppingBag className="w-5 h-5" /> Proceed to Gift Checkout <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
