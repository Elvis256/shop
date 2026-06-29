"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { apiFetch } from "@/lib/api";
import Section from "@/components/Section";
import ProductCard from "@/components/ProductCard";
import {
  Store,
  Star,
  Shield,
  Clock,
  MapPin,
  Globe,
  MessageSquare,
  Package,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  Award,
  Zap,
  TrendingUp,
  BadgeCheck,
  Truck,
} from "lucide-react";

interface SellerStore {
  id: string;
  storeName: string;
  storeSlug: string;
  description: string;
  logo: string;
  banner: string;
  city: string;
  country: string;
  rating: number;
  reviewCount: number;
  totalSales: number;
  tier: string;
  badges: Array<{ badge: string; isActive: boolean }>;
  operatingHours: Record<string, { open: string; close: string; closed: boolean }>;
  socialLinks: Record<string, string>;
  createdAt: string;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice?: number;
  images: string[];
  rating: number;
  reviewCount: number;
  status: string;
}

const badgeConfig: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  VERIFIED: { label: "Verified", icon: BadgeCheck, color: "text-blue-600 bg-blue-50" },
  TOP_RATED: { label: "Top Rated", icon: Star, color: "text-yellow-600 bg-yellow-50" },
  FAST_SHIPPER: { label: "Fast Shipper", icon: Truck, color: "text-green-600 bg-green-50" },
  RESPONSIVE: { label: "Responsive", icon: MessageSquare, color: "text-purple-600 bg-purple-50" },
  TRUSTED: { label: "Trusted", icon: Shield, color: "text-emerald-600 bg-emerald-50" },
  RISING_STAR: { label: "Rising Star", icon: TrendingUp, color: "text-orange-600 bg-orange-50" },
  NEW_SELLER: { label: "New Seller", icon: Zap, color: "text-cyan-600 bg-cyan-50" },
  PREMIUM: { label: "Premium", icon: Award, color: "text-amber-600 bg-amber-50" },
};

const tierColors: Record<string, string> = {
  BRONZE: "from-amber-600 to-amber-800",
  SILVER: "from-gray-400 to-gray-600",
  GOLD: "from-yellow-400 to-yellow-600",
};

export default function SellerStorefront() {
  const params = useParams();
  const slug = params.slug as string;

  const [seller, setSeller] = useState<SellerStore | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [productPage, setProductPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  useEffect(() => {
    fetchStore();
  }, [slug]);

  useEffect(() => {
    if (seller) fetchProducts();
  }, [seller, productPage, sortBy]);

  const fetchStore = async () => {
    try {
      const data = await apiFetch(`/api/seller/store/${slug}`);
      setSeller(data.seller || data);
    } catch (e) {
      console.error("Failed to fetch store:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const params = new URLSearchParams({
        page: String(productPage),
        limit: "12",
        sort: sortBy,
      });
      if (searchQuery) params.set("search", searchQuery);
      const data = await apiFetch(`/api/seller/store/${slug}/products?${params}`);
      setProducts(data.products || []);
      setTotalProducts(data.pagination?.total || 0);
    } catch (e) {
      console.error("Failed to fetch products:", e);
    }
  };

  const handleSearch = () => {
    setProductPage(1);
    fetchProducts();
  };

  const activeBadges = seller?.badges?.filter(b => b.isActive) || [];
  const totalPages = Math.ceil(totalProducts / 12);

  if (loading) {
    return (
      <Section>
        <div className="animate-pulse space-y-6">
          <div className="h-48 bg-gray-200 rounded-2xl" />
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-gray-200 rounded-xl" />
            <div className="space-y-2 flex-1">
              <div className="h-6 bg-gray-200 rounded w-1/3" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <div key={i} className="h-64 bg-gray-200 rounded-xl" />)}
          </div>
        </div>
      </Section>
    );
  }

  if (!seller) {
    return (
      <Section>
        <div className="text-center py-16">
          <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700">Store not found</h2>
          <p className="text-gray-500 mt-2">This store may not exist or has been removed.</p>
          <Link href="/products" className="inline-block mt-4 px-6 py-2 bg-primary text-white rounded-full">
            Browse Products
          </Link>
        </div>
      </Section>
    );
  }

  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const todayHours = seller.operatingHours?.[today];
  const isOpen = todayHours && !todayHours.closed;
  const memberSince = new Date(seller.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <Section>
      {/* Banner */}
      <div className="relative h-40 sm:h-56 rounded-2xl overflow-hidden bg-gradient-to-r from-primary/10 to-accent/10 mb-6">
        {seller.banner ? (
          <Image src={seller.banner} alt={seller.storeName} fill className="object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-r ${tierColors[seller.tier] || "from-gray-200 to-gray-400"} opacity-20`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent" />
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
          <div className="flex items-end gap-4">
            {seller.logo ? (
              <Image
                src={seller.logo}
                alt={seller.storeName}
                width={72}
                height={72}
                className="rounded-xl border-3 border-white shadow-lg object-cover"
              />
            ) : (
              <div className="w-[72px] h-[72px] rounded-xl bg-white/90 flex items-center justify-center shadow-lg">
                <Store className="w-8 h-8 text-primary" />
              </div>
            )}
            <div className="text-white mb-1">
              <h1 className="text-xl sm:text-2xl font-bold drop-shadow-md">{seller.storeName}</h1>
              <div className="flex items-center gap-3 text-sm opacity-90">
                {seller.city && (
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{seller.city}</span>
                )}
                <span className="flex items-center gap-1"><Package className="w-3 h-3" />{seller.totalSales} sales</span>
              </div>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${isOpen ? "bg-green-500 text-white" : "bg-gray-500 text-white"}`}>
            {isOpen ? `Open until ${todayHours?.close}` : "Closed"}
          </div>
        </div>
      </div>

      {/* Stats + Info Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-yellow-500 mb-1">
            <Star className="w-5 h-5 fill-current" />
            <span className="text-xl font-bold text-gray-900">{Number(seller.rating).toFixed(1)}</span>
          </div>
          <p className="text-xs text-gray-500">{seller.reviewCount} reviews</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-xl font-bold text-gray-900">{totalProducts}</p>
          <p className="text-xs text-gray-500">Products</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-xl font-bold text-gray-900">{seller.totalSales}</p>
          <p className="text-xs text-gray-500">Total Sales</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${tierColors[seller.tier] || "from-gray-400 to-gray-600"} text-white`}>
            {seller.tier}
          </span>
          <p className="text-xs text-gray-500 mt-1">Since {memberSince}</p>
        </div>
      </div>

      {/* Badges */}
      {activeBadges.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {activeBadges.map(b => {
            const cfg = badgeConfig[b.badge];
            if (!cfg) return null;
            const Icon = cfg.icon;
            return (
              <span key={b.badge} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${cfg.color}`}>
                <Icon className="w-3.5 h-3.5" />
                {cfg.label}
              </span>
            );
          })}
        </div>
      )}

      {/* About */}
      {seller.description && (
        <div className="bg-white rounded-xl border p-5 mb-6">
          <h3 className="font-semibold text-gray-900 mb-2">About</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{seller.description}</p>
        </div>
      )}

      {/* Products Section */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Products ({totalProducts})</h2>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search products..."
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setProductPage(1); }}
              className="px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="newest">Newest</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
              <option value="bestseller">Best Selling</option>
              <option value="rating">Top Rated</option>
            </select>
          </div>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No products found</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  name={product.name}
                  slug={product.slug}
                  price={product.price}
                  comparePrice={product.comparePrice}
                  imageUrl={product.images?.[0]}
                  rating={product.rating}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setProductPage(p => Math.max(1, p - 1))}
                  disabled={productPage <= 1}
                  className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600 px-3">
                  Page {productPage} of {totalPages}
                </span>
                <button
                  onClick={() => setProductPage(p => Math.min(totalPages, p + 1))}
                  disabled={productPage >= totalPages}
                  className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Section>
  );
}
