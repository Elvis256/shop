"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Section from "@/components/Section";
import ProductCard from "@/components/ProductCard";
import { Heart, Gift, Share2, Lock, Sparkles, Loader2 } from "lucide-react";
import { useCart } from "@/lib/hooks/useCart";
import { useToast } from "@/lib/hooks/useToast";
import { apiFetch } from "@/lib/api";

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

interface BundleItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
}

interface Bundle {
  id: string;
  name: string;
  description: string;
  price: number;
  items: BundleItem[];
}

export default function CouplesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [bundlesLoading, setBundlesLoading] = useState(true);
  const [addingBundle, setAddingBundle] = useState<string | null>(null);
  const { addItem } = useCart();
  const { showToast } = useToast();

  useEffect(() => {
    fetch(`${API_URL}/api/products?category=couples&limit=12`)
      .then((r) => r.json())
      .then((data) => setProducts(data.products || []))
      .catch(() => {})
      .finally(() => setLoading(false));

    apiFetch("/api/bundles")
      .then((data: any) => setBundles(data.bundles || []))
      .catch(() => {})
      .finally(() => setBundlesLoading(false));
  }, []);

  const handleAddBundle = async (bundle: Bundle) => {
    setAddingBundle(bundle.id);
    try {
      for (const item of bundle.items) {
        addItem({
          id: item.productId,
          productId: item.productId,
          name: item.productName,
          price: item.price,
          slug: "",
          imageUrl: "",
        });
      }
      showToast(`${bundle.name} added to cart!`, "success");
    } catch {
      showToast("Failed to add bundle to cart", "error");
    } finally {
      setAddingBundle(null);
    }
  };

  // Fallback bundles when API has none
  const fallbackBundles = [
    { id: "fb1", name: "Date Night Bundle", description: "Everything for a perfect evening together", price: 89000, items: [] },
    { id: "fb2", name: "Starter Kit for Couples", description: "New to exploring together? Start here", price: 65000, items: [] },
    { id: "fb3", name: "Anniversary Special", description: "Make it a night to remember", price: 120000, items: [] },
  ];

  const displayBundles = bundles.length > 0 ? bundles : fallbackBundles;

  return (
    <div>
      {/* Hero */}
      <div className="bg-gradient-to-br from-rose-500 via-pink-500 to-purple-600 text-white py-16 sm:py-24">
        <div className="container text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <Heart className="w-4 h-4 fill-current" />
            Couples Shopping
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold mb-4">
            Explore Together
          </h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto mb-8">
            Curated products for couples. Share wishlists, suggest items to your partner,
            and discover new ways to connect.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="#products" className="px-6 py-3 bg-white text-pink-600 rounded-full font-semibold hover:bg-white/90 transition-colors">
              Browse Products
            </Link>
            <Link href="#bundles" className="px-6 py-3 border-2 border-white/50 text-white rounded-full font-semibold hover:bg-white/10 transition-colors">
              View Bundles
            </Link>
          </div>
        </div>
      </div>

      {/* Features */}
      <Section>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            { icon: Share2, title: "Suggest to Partner", desc: "Send product links with a personal note" },
            { icon: Lock, title: "Shared Wishlist", desc: "PIN-protected shared list for both of you" },
            { icon: Gift, title: "Curated Bundles", desc: "Pre-made kits for every experience level" },
          ].map((feature) => (
            <div key={feature.title} className="text-center p-6">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-pink-100 flex items-center justify-center">
                <feature.icon className="w-6 h-6 text-pink-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{feature.title}</h3>
              <p className="text-sm text-gray-500">{feature.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Curated Bundles */}
      <Section>
        <div id="bundles" className="scroll-mt-8">
          <h2 className="text-2xl font-bold text-center mb-8">
            <Sparkles className="inline w-6 h-6 text-pink-500 mr-2" />
            Couples Bundles
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {bundlesLoading ? (
              [1,2,3].map((i) => (
                <div key={i} className="animate-pulse card text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full" />
                  <div className="h-5 bg-gray-200 rounded w-2/3 mx-auto mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-3" />
                  <div className="h-6 bg-gray-200 rounded w-1/3 mx-auto mb-4" />
                  <div className="h-10 bg-gray-200 rounded" />
                </div>
              ))
            ) : (
              displayBundles.map((bundle) => (
                <div key={bundle.id || bundle.name} className="card hover:shadow-lg transition-shadow text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-pink-100 to-purple-100 rounded-full flex items-center justify-center">
                    <Gift className="w-8 h-8 text-pink-500" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1">{bundle.name}</h3>
                  <p className="text-sm text-gray-500 mb-3">{bundle.description}</p>
                  <p className="text-lg font-bold text-pink-600 mb-4">UGX {Number(bundle.price).toLocaleString()}</p>
                  <button
                    className="btn-primary w-full disabled:opacity-50"
                    disabled={addingBundle === bundle.id || bundle.items.length === 0}
                    onClick={() => handleAddBundle(bundle)}
                  >
                    {addingBundle === bundle.id ? (
                      <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Adding...</>
                    ) : bundle.items.length === 0 ? "Coming Soon" : "Add to Cart"}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </Section>

      {/* Products */}
      <Section>
        <div id="products" className="scroll-mt-8">
          <h2 className="text-2xl font-bold text-center mb-8">Products for Couples</h2>
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
            <p className="text-center text-gray-500 py-12">Couples products coming soon!</p>
          )}
        </div>
      </Section>
    </div>
  );
}
