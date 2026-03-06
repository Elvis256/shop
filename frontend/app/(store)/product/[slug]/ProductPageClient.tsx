"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ProductGallery from "@/components/ProductGallery";
import ProductTabs from "@/components/ProductTabs";
import AddToCartButton from "@/components/AddToCartButton";
import VariantSelector from "@/components/VariantSelector";
import RecentlyViewed, { useRecentlyViewed } from "@/components/RecentlyViewed";
import RelatedProducts from "@/components/RelatedProducts";
import {
  Star, Heart, Shield, Truck, Package, ArrowLeft, Share2, Check, Eye,
  Users, ShoppingBag, Copy, MessageCircle, Clock, Tag, Zap, RotateCcw,
  ChevronDown, Lock, X,
} from "lucide-react";
import { api } from "@/lib/api";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useWishlist } from "@/lib/hooks/useWishlist";
import { useToast } from "@/lib/hooks/useToast";
import { useCart } from "@/lib/hooks/useCart";

interface ProductVariant {
  id: string;
  sku?: string;
  size?: string;
  color?: string;
  material?: string;
  price?: number;
  stock: number;
  imageUrl?: string;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  comparePrice?: number;
  currency: string;
  rating: number;
  reviewCount?: number;
  imageUrl: string | null;
  images?: string[];
  category: { id: string; name: string; slug: string } | null;
  inStock: boolean;
  stock: number;
  lowStockAlert: number;
  isNew?: boolean;
  isBestseller?: boolean;
  badgeText?: string;
  shippingBadge?: "From Abroad" | "Express";
  hasVariants?: boolean;
  variants?: ProductVariant[];
  tags?: string[];
}

/** Compute estimated delivery date string */
function getEstimatedDelivery(processingDays = 2, shippingDays = 5): string {
  const d = new Date();
  d.setDate(d.getDate() + processingDays + shippingDays);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function ProductPageClient() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [boughtTogether, setBoughtTogether] = useState<any[]>([]);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const { addItem: addToRecentlyViewed } = useRecentlyViewed();
  const { formatPrice } = useCurrency();
  const { isInWishlist, toggleItem: toggleWishlist } = useWishlist();
  const { showToast } = useToast();
  const { addItem: addToCart } = useCart();
  const addToCartRef = useRef<HTMLDivElement>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (slug) loadProduct();
  }, [slug]);

  // Sticky desktop bar: show when Add to Cart scrolls out of view
  useEffect(() => {
    if (!addToCartRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(addToCartRef.current);
    return () => observer.disconnect();
  }, [product]);

  // Close share menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) {
        setShowShareMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const loadProduct = async () => {
    try {
      const data: any = await api.getProduct(slug);
      setProduct(data);

      addToRecentlyViewed({
        id: data.id,
        name: data.name,
        slug: data.slug,
        price: Number(data.price),
        imageUrl: data.imageUrl,
      });

      if (data.hasVariants && data.variants?.length > 0) {
        const availableVariant = data.variants.find((v: ProductVariant) => v.stock > 0);
        setSelectedVariant(availableVariant || data.variants[0]);
      }

      api.trackProductView(data.id).then((r) => setViewerCount(r.viewerCount)).catch(() => {});
      api.getBoughtTogether(data.id).then((r) => setBoughtTogether(r.products || [])).catch(() => {});
    } catch (error) {
      console.error("Failed to load product:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleVariantChange = (variant: ProductVariant) => {
    setSelectedVariant(variant);
  };

  // ── Share helpers ──
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareText = product ? `Check out ${product.name}` : "";

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      showToast("Link copied to clipboard", "success");
      setTimeout(() => setLinkCopied(false), 2000);
    } catch { /* ignore */ }
    setShowShareMenu(false);
  };

  const handleShareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText + " " + shareUrl)}`, "_blank");
    setShowShareMenu(false);
  };

  const handleShareFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, "_blank");
    setShowShareMenu(false);
  };

  const handleShareTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, "_blank");
    setShowShareMenu(false);
  };

  const handleShareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: product?.name, url: shareUrl });
      } catch { /* user cancelled */ }
    }
    setShowShareMenu(false);
  };

  // ── Buy Now ──
  const handleBuyNow = () => {
    if (!product || effectiveStock <= 0) return;
    addToCart({
      id: product.id,
      productId: product.id,
      name: product.name,
      slug: product.slug,
      price: Number(effectivePrice),
      imageUrl: product.imageUrl || null,
      stock: effectiveStock,
      quantity: 1,
      shippingBadge: product.shippingBadge,
    });
    router.push("/checkout");
  };

  const effectivePrice = selectedVariant?.price || product?.price || 0;
  const effectiveStock = selectedVariant?.stock ?? product?.stock ?? 0;
  const isLowStock = product && effectiveStock > 0 && effectiveStock <= product.lowStockAlert;

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="container py-8">
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="aspect-square bg-gray-100 rounded-lg animate-pulse" />
            <div className="space-y-4">
              <div className="h-4 bg-gray-100 rounded w-1/4 animate-pulse" />
              <div className="h-6 bg-gray-100 rounded w-3/4 animate-pulse" />
              <div className="h-4 bg-gray-100 rounded w-1/3 animate-pulse" />
              <div className="h-8 bg-gray-100 rounded w-1/2 animate-pulse" />
              <div className="h-12 bg-gray-100 rounded animate-pulse mt-6" />
              <div className="h-12 bg-gray-100 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
        <Package className="w-12 h-12 text-gray-300 mb-4" />
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Product Not Found</h1>
        <p className="text-gray-500 mb-6 text-center">This product doesn&apos;t exist or has been removed.</p>
        <Link
          href="/category"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Shop
        </Link>
      </div>
    );
  }

  const images = product.images || (product.imageUrl ? [product.imageUrl] : []);
  const discountPercent = product.comparePrice && product.comparePrice > effectivePrice
    ? Math.round((1 - effectivePrice / product.comparePrice) * 100)
    : 0;
  const savingsAmount = discountPercent > 0 ? Number(product.comparePrice) - Number(effectivePrice) : 0;

  return (
    <div className="min-h-screen bg-white pb-20 lg:pb-8">
      {/* Breadcrumb */}
      <div className="container pt-4 pb-2">
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href="/" className="hover:text-gray-900 transition-colors">Home</Link>
          <span>/</span>
          <Link href="/category" className="hover:text-gray-900 transition-colors">Shop</Link>
          {product.category && (
            <>
              <span>/</span>
              <Link href={`/category?cat=${product.category.slug}`} className="hover:text-gray-900 transition-colors">
                {product.category.name}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-gray-900 truncate max-w-[150px]">{product.name}</span>
        </nav>
      </div>

      <div className="container py-4">
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-10">
          {/* Gallery */}
          <div className="relative">
            {/* Product Badges */}
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5">
              {discountPercent > 0 && (
                <span className="text-[11px] font-semibold bg-red-500 text-white px-2.5 py-1 rounded-md shadow-sm">
                  {discountPercent}% OFF
                </span>
              )}
              {product.isNew && (
                <span className="text-[11px] font-semibold bg-blue-500 text-white px-2.5 py-1 rounded-md shadow-sm">New</span>
              )}
              {product.isBestseller && (
                <span className="text-[11px] font-semibold bg-amber-500 text-white px-2.5 py-1 rounded-md shadow-sm">Bestseller</span>
              )}
              {product.badgeText && !product.isNew && !product.isBestseller && (
                <span className="text-[11px] font-semibold bg-gray-900 text-white px-2.5 py-1 rounded-md shadow-sm">{product.badgeText}</span>
              )}
              {product.shippingBadge === "From Abroad" && (
                <span className="text-[11px] font-semibold bg-indigo-500 text-white px-2.5 py-1 rounded-md shadow-sm">✈️ From Abroad</span>
              )}
              {product.shippingBadge === "Express" && (
                <span className="text-[11px] font-semibold bg-emerald-500 text-white px-2.5 py-1 rounded-md shadow-sm">⚡ Express</span>
              )}
            </div>
            <div className="bg-white rounded-lg border sticky top-20">
              <ProductGallery images={images} productName={product.name} />
            </div>
          </div>

          {/* Product Info */}
          <div className="h-fit">
            {/* Category & Actions */}
            <div className="flex items-start justify-between mb-3">
              {product.category && (
                <Link
                  href={`/category?cat=${product.category.slug}`}
                  className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition-colors bg-gray-50 px-2.5 py-1 rounded-md"
                >
                  {product.category.name}
                </Link>
              )}
              <div className="flex items-center gap-1">
                {/* Share button with dropdown */}
                <div className="relative" ref={shareMenuRef}>
                  <button
                    onClick={() => setShowShareMenu(!showShareMenu)}
                    className="p-2 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition-colors"
                    title="Share"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                  {showShareMenu && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border shadow-lg z-30 py-1 animate-in fade-in slide-in-from-top-1">
                      <button onClick={handleCopyLink} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        {linkCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                        {linkCopied ? "Copied!" : "Copy Link"}
                      </button>
                      <button onClick={handleShareWhatsApp} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        <MessageCircle className="w-4 h-4 text-green-500" />
                        WhatsApp
                      </button>
                      <button onClick={handleShareFacebook} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                        Facebook
                      </button>
                      <button onClick={handleShareTwitter} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                        Twitter / X
                      </button>
                      {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
                        <button onClick={handleShareNative} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t">
                          <Share2 className="w-4 h-4" />
                          More options...
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (!product) return;
                    const added = toggleWishlist({
                      productId: product.id,
                      name: product.name,
                      slug: product.slug,
                      price: Number(effectivePrice),
                      imageUrl: product.imageUrl,
                    });
                    showToast(added ? "Added to wishlist" : "Removed from wishlist", added ? "success" : "info");
                  }}
                  className={`p-2 rounded-lg transition-colors ${
                    isInWishlist(product.id) ? "text-red-500 bg-red-50" : "text-gray-400 hover:text-red-500 hover:bg-gray-50"
                  }`}
                  title={isInWishlist(product.id) ? "Remove from wishlist" : "Add to wishlist"}
                >
                  <Heart className={`w-5 h-5 ${isInWishlist(product.id) ? "fill-current" : ""}`} />
                </button>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-2xl lg:text-3xl font-semibold text-gray-900 mb-2">{product.name}</h1>

            {/* Rating */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      i <= Math.round(Number(product.rating))
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-200"
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm text-gray-500">
                {Number(product.rating).toFixed(1)}
              </span>
              <span className="text-sm text-gray-400">·</span>
              <span className="text-sm text-primary cursor-pointer hover:underline" onClick={() => {
                document.getElementById("product-tabs")?.scrollIntoView({ behavior: "smooth" });
              }}>
                {product.reviewCount || 0} reviews
              </span>
            </div>

            {/* Price block */}
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-gray-900">
                  {formatPrice(Number(effectivePrice))}
                </span>
                {discountPercent > 0 && (
                  <span className="text-lg text-gray-400 line-through">
                    {formatPrice(Number(product.comparePrice))}
                  </span>
                )}
              </div>
              {savingsAmount > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-green-700 bg-green-100 px-2.5 py-0.5 rounded-md">
                    <Tag className="w-3.5 h-3.5" />
                    You save {formatPrice(savingsAmount)} ({discountPercent}%)
                  </span>
                </div>
              )}
            </div>

            {/* Stock Status */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {effectiveStock > 0 ? (
                <>
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-green-600 text-sm font-medium">In Stock</span>
                  {isLowStock && (
                    <span className="text-orange-600 text-sm font-medium animate-pulse ml-1">
                      · Only {effectiveStock} left — order soon!
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  <span className="text-red-600 text-sm font-medium">Out of Stock</span>
                </>
              )}
            </div>

            {/* Estimated delivery */}
            {effectiveStock > 0 && (
              <div className="flex items-center gap-2 mb-4 text-sm text-gray-600">
                <Clock className="w-4 h-4 text-gray-400" />
                <span>
                  Order now, get it by{" "}
                  <strong className="text-gray-900">
                    {product.shippingBadge === "From Abroad"
                      ? getEstimatedDelivery(3, 14)
                      : getEstimatedDelivery()}
                  </strong>
                </span>
              </div>
            )}

            {/* Social proof */}
            {viewerCount > 1 && (
              <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-orange-50 border border-orange-100 rounded-lg text-sm text-orange-700">
                <Eye className="w-4 h-4 shrink-0" />
                <span><strong>{viewerCount}</strong> {viewerCount === 1 ? "person is" : "people are"} viewing this right now</span>
              </div>
            )}

            {/* Variant Selector */}
            {product.hasVariants && product.variants && product.variants.length > 0 && (
              <div className="mb-4">
                <VariantSelector
                  variants={product.variants as any}
                  selectedVariant={selectedVariant as any}
                  onSelect={handleVariantChange as any}
                  productPrice={Number(product.price)}
                />
              </div>
            )}

            {/* Description */}
            {product.description && (
              <p className="text-gray-600 text-sm mb-5 leading-relaxed whitespace-pre-line">{product.description}</p>
            )}

            {/* Tags */}
            {product.tags && product.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {product.tags.map((tag) => (
                  <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Add to Cart + Buy Now */}
            <div ref={addToCartRef} className="mb-4 space-y-2.5">
              <AddToCartButton
                product={{
                  id: product.id,
                  name: product.name,
                  slug: product.slug,
                  price: Number(effectivePrice),
                  imageUrl: product.imageUrl,
                  stock: effectiveStock,
                }}
                showQuantity
                className="w-full"
              />
              {effectiveStock > 0 && (
                <button
                  onClick={handleBuyNow}
                  className="w-full flex items-center justify-center gap-2 px-7 py-3.5 font-medium rounded-full transition-all duration-300 text-sm border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white active:scale-[0.98]"
                >
                  <Zap className="w-4 h-4" />
                  Buy Now
                </button>
              )}
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 border-t">
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50">
                <Truck className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <span className="text-xs font-medium text-gray-900 block">Free Shipping</span>
                  <span className="text-[10px] text-gray-500">Over USh 100,000</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50">
                <Lock className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <span className="text-xs font-medium text-gray-900 block">Secure Payment</span>
                  <span className="text-[10px] text-gray-500">SSL encrypted</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50">
                <Package className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <span className="text-xs font-medium text-gray-900 block">Discreet Pack</span>
                  <span className="text-[10px] text-gray-500">Plain packaging</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50">
                <RotateCcw className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <span className="text-xs font-medium text-gray-900 block">Easy Returns</span>
                  <span className="text-[10px] text-gray-500">30-day policy</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Frequently Bought Together */}
        {boughtTogether.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-2 mb-6">
              <ShoppingBag className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-gray-900">Frequently Bought Together</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {boughtTogether.slice(0, 4).map((p: any) => (
                <Link key={p.id} href={`/product/${p.slug}`} className="group">
                  <div className="aspect-square rounded-xl overflow-hidden bg-gray-50 mb-2">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300"><Package className="w-8 h-8" /></div>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate group-hover:text-primary transition-colors">{p.name}</p>
                  <p className="text-sm text-gray-600">{formatPrice(p.price)}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div id="product-tabs" className="mt-8 border rounded-xl overflow-hidden bg-white px-6 pb-6">
          <ProductTabs
            description={product.description}
            productId={product.id}
            reviewCount={product.reviewCount}
            rating={Number(product.rating)}
          />
        </div>
      </div>

      {/* Related Products */}
      {product.category && (
        <RelatedProducts
          productSlug={product.slug}
          categoryName={product.category.name}
        />
      )}

      {/* Recently Viewed */}
      <RecentlyViewed currentProductId={product.id} />

      {/* Sticky desktop bar — appears when main Add to Cart scrolls away */}
      {showStickyBar && effectiveStock > 0 && (
        <div className="hidden lg:block fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b z-30 animate-in slide-in-from-top-2 duration-200">
          <div className="container flex items-center gap-4 py-2.5">
            {product.imageUrl && (
              <img src={product.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate text-sm">{product.name}</p>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 text-sm">{formatPrice(Number(effectivePrice))}</span>
                {discountPercent > 0 && (
                  <span className="text-xs text-gray-400 line-through">{formatPrice(Number(product.comparePrice))}</span>
                )}
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                <span className="text-xs text-green-600">In Stock</span>
              </div>
            </div>
            <button
              onClick={handleBuyNow}
              className="px-5 py-2 text-sm font-medium border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white rounded-full transition-all"
            >
              Buy Now
            </button>
            <button
              onClick={() => {
                addToCart({
                  id: product.id,
                  productId: product.id,
                  name: product.name,
                  slug: product.slug,
                  price: Number(effectivePrice),
                  imageUrl: product.imageUrl || null,
                  stock: effectiveStock,
                  quantity: 1,
                  shippingBadge: product.shippingBadge,
                });
                showToast(`${product.name} added to cart`, "success");
              }}
              className="px-5 py-2 text-sm font-medium bg-primary text-white rounded-full hover:bg-primary/90 transition-all"
            >
              Add to Cart
            </button>
          </div>
        </div>
      )}

      {/* Sticky Mobile CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t p-3 lg:hidden z-20">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <p className="font-semibold text-gray-900">{formatPrice(Number(effectivePrice))}</p>
            <p className="text-xs text-gray-500">{effectiveStock > 0 ? "In Stock" : "Out of Stock"}</p>
          </div>
          <AddToCartButton
            product={{
              id: product.id,
              name: product.name,
              slug: product.slug,
              price: Number(effectivePrice),
              imageUrl: product.imageUrl,
              stock: effectiveStock,
            }}
            className="flex-1"
          />
        </div>
      </div>
    </div>
  );
}
