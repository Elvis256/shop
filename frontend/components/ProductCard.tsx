"use client";

import ProductImage from "@/components/ProductImage";
import { Star, Heart, Plus, Check, Eye } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/hooks/useCart";
import { useToast } from "@/lib/hooks/useToast";
import { useWishlist } from "@/lib/hooks/useWishlist";
import { useCurrency } from "@/contexts/CurrencyContext";

type ProductCardProps = {
  id: string;
  name: string;
  price: number;
  comparePrice?: number;
  rating: number;
  slug: string;
  imageUrl?: string | null;
  category?: string;
  inStock?: boolean;
  stock?: number;
  lowStockThreshold?: number;
  isNew?: boolean;
  isBestseller?: boolean;
  badgeText?: string;
  shippingBadge?: "From Abroad" | "Express";
  flashSalePrice?: number | null;
  flashSaleEndsAt?: string | null;
  isSponsored?: boolean;
  onQuickView?: (slug: string) => void;
};

export default function ProductCard({
  id,
  name,
  price,
  comparePrice,
  rating,
  slug,
  imageUrl,
  category,
  stock,
  inStock = true,
  lowStockThreshold = 5,
  isNew,
  isBestseller,
  badgeText,
  shippingBadge,
  flashSalePrice,
  flashSaleEndsAt,
  isSponsored,
  onQuickView,
}: ProductCardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const { addItem } = useCart();
  const { showToast } = useToast();
  const { formatPrice } = useCurrency();
  const { isInWishlist, toggleItem } = useWishlist();
  
  const isWishlisted = isInWishlist(id);
  const hasFlashSale = flashSalePrice && flashSaleEndsAt && new Date(flashSaleEndsAt) > new Date();
  const effectivePrice = hasFlashSale ? flashSalePrice : price;
  const originalPrice = hasFlashSale ? price : (comparePrice || 0);
  const discount = originalPrice > effectivePrice ? Math.round((1 - Number(effectivePrice) / Number(originalPrice)) * 100) : 0;

  const productUrl = `/product/${slug}`;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!inStock) return;

    setIsAdding(true);
    addItem({
      id,
      productId: id,
      name,
      slug,
      price: Number(effectivePrice),
      imageUrl: imageUrl || null,
      shippingBadge,
    });
    showToast(`Added to cart`, "success");
    setTimeout(() => setIsAdding(false), 800);
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const added = toggleItem({
      productId: id,
      name,
      slug,
      price: Number(price),
      imageUrl: imageUrl || null,
    });
    showToast(added ? "Added to wishlist" : "Removed from wishlist", added ? "success" : "info");
  };

  return (
    <a href={productUrl} className="group hover-lift block cursor-pointer no-underline text-inherit">
      {/* Image Container */}
      <div className="aspect-[4/5] bg-surface-secondary rounded-24 overflow-hidden relative transition-all duration-500 group-hover:shadow-lg">
        <ProductImage
          src={imageUrl}
          alt={name}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-2">
            {!inStock && (
              <span className="text-xs font-medium bg-text text-white px-3 py-1.5 rounded-full">
                Sold Out
              </span>
            )}
            {inStock && discount > 0 && (
              <span className="text-xs font-medium bg-red-500 text-white px-3 py-1.5 rounded-full">
                {hasFlashSale ? '⚡' : ''} Save {discount}%
              </span>
            )}
            {isNew && (
              <span className="text-xs font-medium bg-primary text-white px-3 py-1.5 rounded-full">
                New
              </span>
            )}
            {isBestseller && (
              <span className="text-xs font-medium bg-amber-500 text-white px-3 py-1.5 rounded-full">
                Popular
              </span>
            )}
            {badgeText && (
              <span className="text-xs font-medium bg-red-500 text-white px-3 py-1.5 rounded-full">
                {badgeText}
              </span>
            )}
            {shippingBadge === "From Abroad" && (
              <span className="text-xs font-medium bg-indigo-500 text-white px-3 py-1.5 rounded-full flex items-center gap-1">
                ✈️ From Abroad
              </span>
            )}
            {shippingBadge === "Express" && (
              <span className="text-xs font-medium bg-emerald-500 text-white px-3 py-1.5 rounded-full flex items-center gap-1">
                ⚡ Express
              </span>
            )}
            {isSponsored && (
              <span className="text-xs font-medium bg-blue-500 text-white px-3 py-1.5 rounded-full">
                Sponsored
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 pointer-events-none group-hover:pointer-events-auto [@media(hover:none)]:pointer-events-auto transition-all duration-300 translate-x-2 group-hover:translate-x-0 [@media(hover:none)]:translate-x-0">
            <button
              onClick={handleWishlist}
              className={`p-2.5 rounded-full shadow-soft backdrop-blur-sm transition-all duration-200 ${
                isWishlisted 
                  ? "bg-red-500 text-white" 
                  : "bg-white/90 text-text-muted hover:text-red-500 hover:bg-white"
              }`}
              aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            >
              <Heart className={`w-4 h-4 ${isWishlisted ? "fill-current" : ""}`} />
            </button>
            {onQuickView && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onQuickView(slug);
                }}
                className="p-2.5 rounded-full shadow-soft backdrop-blur-sm bg-white/90 text-text-muted hover:text-primary hover:bg-white transition-all duration-200"
                aria-label="Quick view"
              >
                <Eye className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Add Button */}
          {inStock && (
            <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 pointer-events-none group-hover:pointer-events-auto [@media(hover:none)]:pointer-events-auto transition-all duration-300 translate-y-2 group-hover:translate-y-0 [@media(hover:none)]:translate-y-0">
              <button
                onClick={handleAddToCart}
                disabled={isAdding}
                className={`w-full py-3 px-4 rounded-full font-medium text-sm flex items-center justify-center gap-2 transition-all duration-200 backdrop-blur-sm ${
                  isAdding 
                    ? "bg-emerald-500 text-white" 
                    : "bg-white/95 text-text hover:bg-white shadow-soft"
                }`}
              >
                {isAdding ? (
                  <>
                    <Check className="w-4 h-4" />
                    Added
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add to Cart
                  </>
                )}
              </button>
            </div>
          )}
        </div>

      {/* Product Info */}
      <div className="mt-4 px-1">
        {category && (
          <p className="text-xs text-text-muted mb-1">{category}</p>
        )}
        <h3 className="text-sm font-medium text-text line-clamp-2 hover:text-primary transition-colors duration-200">
          {name}
        </h3>

        {/* Rating */}
        <div className="flex items-center gap-1 mt-2">
          <div className="flex items-center">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={`w-3 h-3 ${
                  i <= Math.round(Number(rating)) 
                    ? "text-amber-400 fill-amber-400" 
                    : "text-gray-200 fill-gray-200"
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-text-muted">({Number(rating).toFixed(1)})</span>
        </div>

        {/* Price */}
        <div className="mt-2 flex items-baseline gap-2">
          <span className={`text-base font-semibold ${hasFlashSale ? 'text-red-600' : 'text-text'}`}>{formatPrice(Number(effectivePrice))}</span>
          {discount > 0 && (
            <span className="text-sm text-text-muted line-through">
              {formatPrice(Number(originalPrice))}
            </span>
          )}
        </div>

        {/* Low stock badge */}
        {inStock && stock != null && stock > 0 && stock <= lowStockThreshold && (
          <span className="mt-1.5 inline-flex items-center text-xs font-medium text-orange-700 bg-orange-50 px-2 py-0.5 rounded-md">
            Only {stock} left!
          </span>
        )}
      </div>
    </a>
  );
}
