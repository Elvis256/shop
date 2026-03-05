"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  Search,
  ExternalLink,
  Star,
  ShoppingBag,
  Filter,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Sparkles,
  Shield,
  Truck,
  ArrowRight,
} from "lucide-react";

type AffiliateProduct = {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  comparePrice?: number;
  commission: number;
  source: string;
  affiliateUrl: string;
  imageUrl?: string;
  images: string[];
  rating?: number;
  reviewCount?: number;
  category?: { id: string; name: string };
};

const sourceLogos: Record<string, { label: string; color: string; bg: string }> = {
  AMAZON: { label: "Amazon", color: "text-orange-700", bg: "bg-orange-50" },
  ALIEXPRESS: { label: "AliExpress", color: "text-red-700", bg: "bg-red-50" },
  ALIBABA: { label: "Alibaba", color: "text-amber-700", bg: "bg-amber-50" },
  OTHER: { label: "Partner Store", color: "text-gray-700", bg: "bg-gray-50" },
};

export default function AffiliateBrowsePage() {
  const [products, setProducts] = useState<AffiliateProduct[]>([]);
  const [featured, setFeatured] = useState<AffiliateProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    api.getFeaturedAffiliateProducts().then((res) => setFeatured(res.products || [])).catch(() => {});
  }, []);

  useEffect(() => {
    loadProducts();
  }, [page, search, source, category, sort]);

  async function loadProducts() {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: "24", sort };
      if (search) params.search = search;
      if (source) params.source = source;
      if (category) params.category = category;
      const res = await api.getAffiliateProducts(params);
      setProducts(res.products || []);
      setTotal(res.total || 0);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function handleProductClick(product: AffiliateProduct) {
    try {
      const res = await api.trackAffiliateClick(product.id);
      window.open(res.affiliateUrl || product.affiliateUrl, "_blank", "noopener,noreferrer");
    } catch {
      window.open(product.affiliateUrl, "_blank", "noopener,noreferrer");
    }
  }

  const discount = (p: AffiliateProduct) =>
    p.comparePrice ? Math.round(((p.comparePrice - p.price) / p.comparePrice) * 100) : 0;

  const totalPages = Math.ceil(total / 24);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 text-white">
        <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
          <div className="max-w-2xl">
            <h1 className="text-3xl md:text-4xl font-bold mb-3">
              Curated Deals from Top Stores
            </h1>
            <p className="text-white/80 text-lg mb-6">
              We handpick the best products from Amazon, AliExpress & more. 
              Shop directly from trusted sellers with amazing prices.
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur rounded-full px-4 py-2">
                <Shield className="w-4 h-4" /> Trusted Sellers Only
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur rounded-full px-4 py-2">
                <Truck className="w-4 h-4" /> Direct Shipping
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur rounded-full px-4 py-2">
                <Star className="w-4 h-4" /> Best Prices
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Featured Products */}
        {featured.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <Sparkles className="w-5 h-5 text-yellow-500" />
              <h2 className="text-xl font-bold">Featured Deals</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {featured.slice(0, 4).map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleProductClick(p)}
                  className="group bg-white rounded-xl border overflow-hidden hover:shadow-lg transition text-left"
                >
                  <div className="relative aspect-square bg-gray-100">
                    {p.imageUrl ? (
                      <Image src={p.imageUrl} alt={p.title} fill className="object-cover group-hover:scale-105 transition" />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <ShoppingBag className="w-12 h-12 text-gray-300" />
                      </div>
                    )}
                    {discount(p) > 0 && (
                      <span className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                        -{discount(p)}%
                      </span>
                    )}
                    <span className={`absolute top-2 right-2 text-xs px-2 py-1 rounded-full font-medium ${sourceLogos[p.source]?.bg} ${sourceLogos[p.source]?.color}`}>
                      {sourceLogos[p.source]?.label}
                    </span>
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-medium line-clamp-2 group-hover:text-blue-600 transition">{p.title}</h3>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-lg font-bold">${p.price.toFixed(2)}</span>
                      {p.comparePrice && (
                        <span className="text-sm text-gray-400 line-through">${p.comparePrice.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center mb-6">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search deals..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm bg-white"
            />
          </div>
          <select
            value={source}
            onChange={(e) => { setSource(e.target.value); setPage(1); }}
            className="border rounded-xl px-3 py-2.5 text-sm bg-white"
          >
            <option value="">All Stores</option>
            <option value="AMAZON">Amazon</option>
            <option value="ALIEXPRESS">AliExpress</option>
            <option value="ALIBABA">Alibaba</option>
            <option value="OTHER">Other</option>
          </select>
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value); setPage(1); }}
            className="border rounded-xl px-3 py-2.5 text-sm bg-white"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="popular">Most Popular</option>
          </select>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="flex justify-center py-16">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <ShoppingBag className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No products found</p>
            <p className="text-sm mt-2">Try adjusting your search or filters</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleProductClick(p)}
                  className="group bg-white rounded-xl border overflow-hidden hover:shadow-lg transition text-left flex flex-col"
                >
                  <div className="relative aspect-square bg-gray-100">
                    {p.imageUrl ? (
                      <Image src={p.imageUrl} alt={p.title} fill className="object-cover group-hover:scale-105 transition" />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <ShoppingBag className="w-10 h-10 text-gray-300" />
                      </div>
                    )}
                    {discount(p) > 0 && (
                      <span className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                        -{discount(p)}%
                      </span>
                    )}
                  </div>
                  <div className="p-3 flex-1 flex flex-col">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium w-fit mb-1.5 ${sourceLogos[p.source]?.bg} ${sourceLogos[p.source]?.color}`}>
                      {sourceLogos[p.source]?.label}
                    </span>
                    <h3 className="text-sm font-medium line-clamp-2 group-hover:text-blue-600 transition flex-1">{p.title}</h3>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-base font-bold">${p.price.toFixed(2)}</span>
                      {p.comparePrice && (
                        <span className="text-xs text-gray-400 line-through">${p.comparePrice.toFixed(2)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-2 text-blue-600 text-xs font-medium">
                      Shop Now <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-4 py-2 border rounded-lg text-sm disabled:opacity-50 bg-white"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 px-4 py-2 border rounded-lg text-sm disabled:opacity-50 bg-white"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}

        {/* Become an Affiliate CTA */}
        <section className="mt-16 mb-8 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl text-white p-8 md:p-12">
          <div className="max-w-2xl">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Earn Money Promoting Our Products</h2>
            <p className="text-white/80 mb-6">
              Join our affiliate program and earn commissions for every sale you refer. 
              Get your unique referral link and start earning today.
            </p>
            <Link
              href="/affiliate/signup"
              className="inline-flex items-center gap-2 bg-white text-green-700 font-semibold px-6 py-3 rounded-xl hover:bg-green-50 transition"
            >
              Join Affiliate Program <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
