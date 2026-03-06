"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  Search,
  Star,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Sparkles,
  Shield,
  Truck,
  Globe,
  ArrowRight,
  ShoppingCart,
  Plane,
} from "lucide-react";

type ImportedProduct = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  originalPrice?: number | null;
  currency: string;
  imageUrl?: string | null;
  source: string;
  category?: { name: string; slug: string } | null;
  tags: string[];
  rating?: number | null;
  reviewCount: number;
  shippingBadge: string;
  isImported: boolean;
};

const sourceInfo: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  CJ: { label: "CJ Dropshipping", color: "text-blue-700", bg: "bg-blue-50", icon: "🏭" },
  ALIEXPRESS: { label: "AliExpress", color: "text-red-700", bg: "bg-red-50", icon: "🛒" },
};

function formatPrice(price: number) {
  return `USh ${Math.round(price).toLocaleString()}`;
}

export default function AffiliateBrowsePage() {
  const [products, setProducts] = useState<ImportedProduct[]>([]);
  const [featured, setFeatured] = useState<ImportedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    api.getFeaturedAffiliateProducts().then((res) => setFeatured(res.products || [])).catch(() => {});
  }, []);

  useEffect(() => {
    loadProducts();
  }, [page, search, source, sort]);

  async function loadProducts() {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: "24", sort };
      if (search) params.search = search;
      if (source) params.source = source;
      const res = await api.getAffiliateProducts(params);
      setProducts(res.products || []);
      setTotalPages(res.pagination?.totalPages || 0);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 text-white">
        <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-6 h-6" />
              <span className="text-sm font-medium bg-white/20 px-3 py-1 rounded-full">International Store</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3">
              Products From Around the World
            </h1>
            <p className="text-white/80 text-lg mb-6">
              Curated international products shipped directly to your door in Uganda. 
              Pay with Mobile Money, we handle the rest.
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur rounded-full px-4 py-2">
                <Shield className="w-4 h-4" /> Secure Checkout
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur rounded-full px-4 py-2">
                <Truck className="w-4 h-4" /> Ships to Uganda
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur rounded-full px-4 py-2">
                <Plane className="w-4 h-4" /> 7-21 Day Delivery
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
              <h2 className="text-xl font-bold">Featured International Products</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {featured.slice(0, 4).map((p) => (
                <Link
                  key={p.id}
                  href={`/product/${p.slug}`}
                  className="group bg-white rounded-xl border overflow-hidden hover:shadow-lg transition"
                >
                  <div className="relative aspect-square bg-gray-100">
                    {p.imageUrl ? (
                      <Image src={p.imageUrl} alt={p.name} fill className="object-cover group-hover:scale-105 transition" sizes="(max-width: 768px) 50vw, 25vw" />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <ShoppingBag className="w-12 h-12 text-gray-300" />
                      </div>
                    )}
                    <span className="absolute top-2 left-2 bg-indigo-500 text-white text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1">
                      ✈️ From Abroad
                    </span>
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-medium line-clamp-2 group-hover:text-indigo-600 transition">{p.name}</h3>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-lg font-bold">{formatPrice(p.price)}</span>
                      {p.originalPrice && (
                        <span className="text-sm text-gray-400 line-through">{formatPrice(p.originalPrice)}</span>
                      )}
                    </div>
                    <div className="mt-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${sourceInfo[p.source]?.bg} ${sourceInfo[p.source]?.color}`}>
                        {sourceInfo[p.source]?.icon} {sourceInfo[p.source]?.label}
                      </span>
                    </div>
                  </div>
                </Link>
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
              placeholder="Search international products..."
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
            <option value="">All Sources</option>
            <option value="CJ">CJ Dropshipping</option>
            <option value="ALIEXPRESS">AliExpress</option>
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
            <Globe className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No international products yet</p>
            <p className="text-sm mt-2">Import products from CJ Dropshipping or AliExpress in the admin panel</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((p) => (
                <Link
                  key={p.id}
                  href={`/product/${p.slug}`}
                  className="group bg-white rounded-xl border overflow-hidden hover:shadow-lg transition flex flex-col"
                >
                  <div className="relative aspect-square bg-gray-100">
                    {p.imageUrl ? (
                      <Image src={p.imageUrl} alt={p.name} fill className="object-cover group-hover:scale-105 transition" sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw" />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <ShoppingBag className="w-10 h-10 text-gray-300" />
                      </div>
                    )}
                    <span className="absolute top-2 left-2 bg-indigo-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                      ✈️ From Abroad
                    </span>
                  </div>
                  <div className="p-3 flex-1 flex flex-col">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium w-fit mb-1.5 ${sourceInfo[p.source]?.bg} ${sourceInfo[p.source]?.color}`}>
                      {sourceInfo[p.source]?.icon} {sourceInfo[p.source]?.label}
                    </span>
                    <h3 className="text-sm font-medium line-clamp-2 group-hover:text-indigo-600 transition flex-1">{p.name}</h3>
                    {p.rating && p.rating > 0 && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs text-gray-500">{Number(p.rating).toFixed(1)} ({p.reviewCount})</span>
                      </div>
                    )}
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-base font-bold">{formatPrice(p.price)}</span>
                      {p.originalPrice && (
                        <span className="text-xs text-gray-400 line-through">{formatPrice(p.originalPrice)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-2 bg-indigo-50 text-indigo-600 text-xs font-medium px-2 py-1.5 rounded-lg">
                      <ShoppingCart className="w-3 h-3" /> View Product
                    </div>
                  </div>
                </Link>
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

        {/* How it works */}
        <section className="mt-16 mb-8">
          <h2 className="text-xl font-bold text-center mb-8">How International Shopping Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 border text-center">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingCart className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="font-semibold mb-2">1. Browse & Order</h3>
              <p className="text-sm text-gray-500">Choose from our curated international products and pay with Mobile Money or card.</p>
            </div>
            <div className="bg-white rounded-xl p-6 border text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Globe className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold mb-2">2. We Source & Ship</h3>
              <p className="text-sm text-gray-500">We order from international suppliers and ship directly to your address in Uganda.</p>
            </div>
            <div className="bg-white rounded-xl p-6 border text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Truck className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold mb-2">3. Discreet Delivery</h3>
              <p className="text-sm text-gray-500">Receive your order in plain packaging. Typical delivery: 7-21 business days.</p>
            </div>
          </div>
        </section>

        {/* Become an Affiliate CTA */}
        <section className="mb-8 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl text-white p-8 md:p-12">
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
