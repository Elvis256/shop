"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ProductGallery from "@/components/ProductGallery";
import ProductTabs from "@/components/ProductTabs";
import AddToCartButton from "@/components/AddToCartButton";
import VariantSelector from "@/components/VariantSelector";
import RecentlyViewed, { useRecentlyViewed } from "@/components/RecentlyViewed";
import RelatedProducts from "@/components/RelatedProducts";
import { Star, Heart, Shield, Truck, Package, ArrowLeft, Share2, Check } from "lucide-react";
import { api } from "@/lib/api";
import { useCurrency } from "@/contexts/CurrencyContext";

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
  hasVariants?: boolean;
  variants?: ProductVariant[];
  tags?: string[];
}

export default function ProductPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [copied, setCopied] = useState(false);
  const { addItem: addToRecentlyViewed } = useRecentlyViewed();
  const { formatPrice } = useCurrency();

  useEffect(() => {
    if (slug) {
      loadProduct();
    }
  }, [slug]);

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
    } catch (error) {
      console.error("Failed to load product:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleVariantChange = (variant: ProductVariant) => {
    setSelectedVariant(variant);
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: product?.name, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (e) {
      console.error("Share failed:", e);
    }
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
        <p className="text-gray-500 mb-6 text-center">This product doesn't exist or has been removed.</p>
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

  return (
    <div className="min-h-screen bg-white pb-20 lg:pb-8">
      {/* Breadcrumb */}
      <div className="container pt-4 pb-2">
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href="/" className="hover:text-gray-900">Home</Link>
          <span>/</span>
          <Link href="/category" className="hover:text-gray-900">Shop</Link>
          {product.category && (
            <>
              <span>/</span>
              <Link href={`/category?cat=${product.category.slug}`} className="hover:text-gray-900">
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
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-1">
              {discountPercent > 0 && (
                <span className="text-[10px] font-medium bg-gray-900 text-white px-2 py-0.5 rounded">{discountPercent}% OFF</span>
              )}
              {product.isNew && (
                <span className="text-[10px] font-medium bg-gray-900 text-white px-2 py-0.5 rounded">New</span>
              )}
              {product.isBestseller && (
                <span className="text-[10px] font-medium bg-gray-900 text-white px-2 py-0.5 rounded">Bestseller</span>
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
                  className="text-sm text-gray-500 hover:text-gray-900"
                >
                  {product.category.name}
                </Link>
              )}
              <div className="flex items-center gap-1">
                <button
                  onClick={handleShare}
                  className="p-2 text-gray-400 hover:text-gray-900 rounded-lg"
                  title="Share"
                >
                  {copied ? <Check className="w-5 h-5 text-green-600" /> : <Share2 className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => setIsWishlisted(!isWishlisted)}
                  className={`p-2 rounded-lg ${
                    isWishlisted ? "text-red-500" : "text-gray-400 hover:text-red-500"
                  }`}
                  title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                >
                  <Heart className={`w-5 h-5 ${isWishlisted ? "fill-current" : ""}`} />
                </button>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">{product.name}</h1>

            {/* Rating */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={`w-3.5 h-3.5 ${
                      i <= Math.round(Number(product.rating))
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-200"
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm text-gray-500">
                {Number(product.rating).toFixed(1)} ({product.reviewCount || 0} reviews)
              </span>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-2xl font-bold text-gray-900">
                {formatPrice(Number(effectivePrice))}
              </span>
              {discountPercent > 0 && (
                <span className="text-lg text-gray-400 line-through">
                  {formatPrice(Number(product.comparePrice))}
                </span>
              )}
            </div>

            {/* Stock Status */}
            <div className="flex items-center gap-2 mb-4">
              {effectiveStock > 0 ? (
                <>
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                  <span className="text-green-600 text-sm">In Stock</span>
                  {isLowStock && (
                    <span className="text-orange-600 text-sm">
                      · Only {effectiveStock} left
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                  <span className="text-red-600 text-sm">Out of Stock</span>
                </>
              )}
            </div>

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
              <p className="text-gray-600 text-sm mb-6 leading-relaxed">{product.description}</p>
            )}

            {/* Add to Cart */}
            <div className="mb-6">
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
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-3 pt-6 border-t text-center">
              <div>
                <Truck className="w-5 h-5 mx-auto mb-1 text-gray-400" />
                <span className="text-xs text-gray-500">Free Shipping</span>
              </div>
              <div>
                <Shield className="w-5 h-5 mx-auto mb-1 text-gray-400" />
                <span className="text-xs text-gray-500">Secure Payment</span>
              </div>
              <div>
                <Package className="w-5 h-5 mx-auto mb-1 text-gray-400" />
                <span className="text-xs text-gray-500">Discreet Pack</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-8 border rounded-xl overflow-hidden bg-white px-6 pb-6">
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

      {/* Sticky Mobile CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 lg:hidden z-20">
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
