"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import Section from "@/components/Section";
import ProductCard from "@/components/ProductCard";
import { PiggyBank, Calculator, ArrowRight, Loader2 } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useToast } from "@/lib/hooks/useToast";
import { useAuth } from "@/lib/hooks/useAuth";
import { apiFetch } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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
  stock?: number;
}

export default function LayawayPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [frequency, setFrequency] = useState("WEEKLY");
  const [creating, setCreating] = useState(false);
  const { formatPrice } = useCurrency();
  const { showToast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetch(`${API_URL}/api/products?limit=20&sort=popular`)
      .then((r) => r.json())
      .then((data) => setProducts(data.products || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getInstallmentAmount = (price: number, freq: string) => {
    const payments = freq === "DAILY" ? 30 : freq === "WEEKLY" ? 4 : 2;
    return Math.ceil(price / payments);
  };

  const getPaymentLabel = (freq: string) => {
    return freq === "DAILY" ? "per day for 30 days" : freq === "WEEKLY" ? "per week for 4 weeks" : "every 2 weeks (2 payments)";
  };

  const handleStartPlan = async () => {
    if (!selectedProduct || !user) {
      showToast("Please log in to start a layaway plan", "error");
      return;
    }

    setCreating(true);
    try {
      await apiFetch("/api/layaway", {
        method: "POST",
        body: JSON.stringify({ productId: selectedProduct.id, frequency }),
      });
      showToast(`Layaway plan created for ${selectedProduct.name}!`, "success");
      setSelectedProduct(null);
    } catch (err: any) {
      showToast(err.message || "Failed to create plan", "error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      {/* Hero */}
      <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 text-white py-16 sm:py-24">
        <div className="container text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <PiggyBank className="w-4 h-4" />
            Save & Pay Later
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold mb-4">Layaway Plans</h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto mb-8">
            Can&apos;t afford it all at once? Pay in small amounts daily, weekly, or biweekly.
            Once fully paid, your item ships automatically!
          </p>
          {user && (
            <Link href="/account/layaway" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-teal-700 rounded-full font-semibold hover:bg-white/90 transition-colors">
              My Plans <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Calculator */}
      {selectedProduct && (
        <Section bgColor="gray">
          <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Calculator className="w-5 h-5 text-teal-600" />
              <h3 className="font-bold text-gray-900">Payment Calculator</h3>
            </div>

            <p className="text-gray-700 mb-1">{selectedProduct.name}</p>
            <p className="text-2xl font-bold text-gray-900 mb-4">{formatPrice(selectedProduct.price)}</p>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {["DAILY", "WEEKLY", "BIWEEKLY"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFrequency(f)}
                  className={`py-3 rounded-xl text-sm font-medium transition-colors ${
                    frequency === f ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {f === "BIWEEKLY" ? "Bi-weekly" : f.charAt(0) + f.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            <div className="bg-teal-50 rounded-xl p-4 text-center mb-4">
              <p className="text-sm text-teal-600">You pay</p>
              <p className="text-3xl font-bold text-teal-700">
                {formatPrice(getInstallmentAmount(selectedProduct.price, frequency))}
              </p>
              <p className="text-sm text-teal-600">{getPaymentLabel(frequency)}</p>
            </div>

            <button
              onClick={handleStartPlan}
              disabled={creating}
              className="w-full py-3 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {creating ? <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Creating Plan...</> : "Start Layaway Plan"}
            </button>

            <button onClick={() => setSelectedProduct(null)} className="w-full py-2 text-gray-500 text-sm mt-2 hover:text-gray-700">
              Cancel
            </button>
          </div>
        </Section>
      )}

      {/* Products */}
      <Section>
        <h2 className="text-2xl font-bold text-center mb-2">Browse Products</h2>
        <p className="text-center text-gray-500 mb-8">Tap any product, then click &quot;Save &amp; Pay Later&quot;</p>

        {loading ? (
          <div className="grid-products">
            {[1,2,3,4].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[4/5] bg-gray-200 rounded-2xl mb-4" />
                <div className="h-4 bg-gray-200 rounded-full mb-2" />
                <div className="h-3 bg-gray-200 rounded-full w-1/2" />
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="grid-products">
            {products.map((product) => (
              <div key={product.id} className="relative group">
                <ProductCard
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
                <button
                  onClick={() => setSelectedProduct(product)}
                  className="mt-2 w-full py-2 bg-teal-50 text-teal-700 rounded-xl text-sm font-medium hover:bg-teal-100 transition-colors"
                >
                  <PiggyBank className="w-4 h-4 inline mr-1" />
                  Save & Pay Later
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-12">Products coming soon!</p>
        )}
      </Section>
    </div>
  );
}
