"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, ShoppingCart, Heart, Star, Truck, Shield, Minus, Plus } from "lucide-react";
import { useCart } from "@/lib/hooks/useCart";
import { useCurrency } from "@/contexts/CurrencyContext";
import ProductImage from "@/components/ProductImage";

const API_URL = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");

interface QuickViewProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice?: number | null;
  description?: string;
  imageUrl?: string | null;
  images?: Array<{ url: string }>;
  stock: number;
  rating?: number | null;
  reviewCount?: number;
  category?: string | null;
  shippingBadge?: string;
  flashSalePrice?: number | null;
}

interface QuickViewProps {
  productSlug: string | null;
  onClose: () => void;
}

export default function QuickView({ productSlug, onClose }: QuickViewProps) {
  const [product, setProduct] = useState<QuickViewProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const { addItem } = useCart();
  const { formatPrice } = useCurrency();

  useEffect(() => {
    if (!productSlug) return;
    setLoading(true);
    setQuantity(1);
    setSelectedImage(0);

    fetch(`${API_URL}/api/products/${productSlug}`)
      .then((r) => r.json())
      .then((data) => {
        const p = data.product || data;
        setProduct({
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: Number(p.price),
          comparePrice: p.comparePrice ? Number(p.comparePrice) : null,
          description: p.shortDescription || p.description?.replace(/<[^>]*>/g, "").slice(0, 200) || "",
          imageUrl: p.imageUrl || p.images?.[0]?.url || null,
          images: p.images || [],
          stock: p.stock,
          rating: p.rating ? Number(p.rating) : null,
          reviewCount: p.reviewCount || 0,
          category: p.category?.name || p.category || null,
          shippingBadge: p.shippingBadge || "Express",
          flashSalePrice: p.flashSalePrice ? Number(p.flashSalePrice) : null,
        });
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [productSlug]);

  if (!productSlug) return null;

  const handleAddToCart = () => {
    if (!product) return;
    addItem({
      id: product.id,
      productId: product.id,
      name: product.name,
      slug: product.slug,
      price: product.flashSalePrice || product.price,
      imageUrl: product.imageUrl || null,
      stock: product.stock,
      quantity,
    });
    onClose();
  };

  const effectivePrice = product?.flashSalePrice || product?.price || 0;
  const hasDiscount = product?.comparePrice && product.comparePrice > effectivePrice;
  const discount = hasDiscount
    ? Math.round((1 - effectivePrice / product!.comparePrice!) * 100)
    : 0;

  const allImages = product?.images?.length
    ? product.images.map((i) => i.url)
    : product?.imageUrl
      ? [product.imageUrl]
      : [];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white shadow transition"
          >
            <X className="w-4 h-4" />
          </button>

          {loading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500">Loading product...</p>
            </div>
          ) : !product ? (
            <div className="p-12 text-center text-gray-500">
              <p>Product not found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
              {/* Images */}
              <div className="relative bg-gray-50 p-4">
                <div className="aspect-square rounded-xl overflow-hidden bg-white">
                  <ProductImage
                    src={allImages[selectedImage] || product.imageUrl}
                    alt={product.name}
                    width={400}
                    height={400}
                    className="w-full h-full object-contain"
                  />
                </div>
                {allImages.length > 1 && (
                  <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                    {allImages.slice(0, 5).map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedImage(i)}
                        className={`w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 transition ${
                          i === selectedImage ? "border-primary" : "border-transparent"
                        }`}
                      >
                        <ProductImage src={img} alt="" width={56} height={56} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                {discount > 0 && (
                  <span className="absolute top-6 left-6 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                    -{discount}%
                  </span>
                )}
              </div>

              {/* Details */}
              <div className="p-6 flex flex-col">
                {product.category && (
                  <span className="text-xs text-primary font-medium uppercase tracking-wider mb-1">
                    {product.category}
                  </span>
                )}

                <h2 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2">{product.name}</h2>

                {/* Rating */}
                {product.rating != null && product.rating > 0 && (
                  <div className="flex items-center gap-1.5 mb-3">
                    <div className="flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i < Math.round(product.rating!) ? "fill-yellow-400 text-yellow-400" : "text-gray-200"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">({product.reviewCount})</span>
                  </div>
                )}

                {/* Price */}
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-2xl font-bold text-gray-900">{formatPrice(effectivePrice)}</span>
                  {hasDiscount && (
                    <span className="text-sm text-gray-400 line-through">{formatPrice(product.comparePrice!)}</span>
                  )}
                </div>

                {/* Description */}
                {product.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-3">{product.description}</p>
                )}

                {/* Badges */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full">
                    <Truck className="w-3 h-3" /> {product.shippingBadge}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">
                    <Shield className="w-3 h-3" /> Discreet Packaging
                  </span>
                </div>

                {/* Stock */}
                {product.stock <= 0 ? (
                  <p className="text-sm text-red-600 font-medium mb-4">Out of Stock</p>
                ) : product.stock <= 10 ? (
                  <p className="text-sm text-amber-600 font-medium mb-4">Only {product.stock} left!</p>
                ) : null}

                {/* Quantity + Add to Cart */}
                <div className="mt-auto space-y-3">
                  {product.stock > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center border rounded-full">
                        <button
                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-l-full"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-10 text-center text-sm font-medium">{quantity}</span>
                        <button
                          onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                          className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-r-full"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        onClick={handleAddToCart}
                        className="flex-1 bg-primary hover:bg-primary-hover text-white font-medium py-2.5 px-4 rounded-full flex items-center justify-center gap-2 transition"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        Add to Cart
                      </button>
                    </div>
                  )}

                  <Link
                    href={`/product/${product.slug}`}
                    onClick={onClose}
                    className="block text-center text-sm text-primary hover:underline"
                  >
                    View Full Details →
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
