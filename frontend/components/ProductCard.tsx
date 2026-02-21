"use client";

import Link from "next/link";
import Image from "next/image";
import { Star, Heart, Plus, Check } from "lucide-react";
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
  isNew?: boolean;
  isBestseller?: boolean;
  badgeText?: string;
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
  inStock = true,
  isNew,
  isBestseller,
}: ProductCardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const { addItem } = useCart();
  const { showToast } = useToast();
  const { formatPrice } = useCurrency();
  const { isInWishlist, toggleItem } = useWishlist();
  
  const isWishlisted = isInWishlist(id);
  const discount = comparePrice ? Math.round((1 - Number(price) / Number(comparePrice)) * 100) : 0;

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
      price: Number(price),
      imageUrl: imageUrl || null,
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
    <div className="group">
      {/* Image Container */}
      <Link href={`/product/${slug}`} className="block relative">
        <div className="aspect-[4/5] bg-surface-secondary rounded-24 overflow-hidden relative transition-all duration-500 group-hover:shadow-lg">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={name}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-secondary to-gray-100">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-surface flex items-center justify-center">
                  <svg className="w-10 h-10 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                {category && (
                  <span className="text-xs text-text-muted">{category}</span>
                )}
              </div>
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-2">
            {!inStock && (
              <span className="text-xs font-medium bg-text text-white px-3 py-1.5 rounded-full">
                Sold Out
              </span>
            )}
            {inStock && discount > 0 && (
              <span className="text-xs font-medium bg-red-500 text-white px-3 py-1.5 rounded-full">
                Save {discount}%
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
          </div>

          {/* Action Buttons */}
          <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
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
          </div>

          {/* Quick Add Button */}
          {inStock && (
            <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
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
      </Link>

      {/* Product Info */}
      <div className="mt-4 px-1">
        {category && (
          <p className="text-xs text-text-muted mb-1">{category}</p>
        )}
        <Link href={`/product/${slug}`}>
          <h3 className="text-sm font-medium text-text line-clamp-2 hover:text-primary transition-colors duration-200">
            {name}
          </h3>
        </Link>

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
          <span className="text-base font-semibold text-text">{formatPrice(Number(price))}</span>
          {comparePrice && Number(comparePrice) > Number(price) && (
            <span className="text-sm text-text-muted line-through">
              {formatPrice(Number(comparePrice))}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
