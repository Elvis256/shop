"use client";

import Link from "next/link";
import Image from "next/image";
import { Star, Heart, X, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/hooks/useCart";
import { useToast } from "@/lib/hooks/useToast";

type ProductCardProps = {
  id: string;
  name: string;
  price: number;
  rating: number;
  slug: string;
  imageUrl?: string | null;
  currency?: string;
  inStock?: boolean;
  showWishlistRemove?: boolean;
  onRemoveFromWishlist?: () => void;
};

export default function ProductCard({
  id,
  name,
  price,
  rating,
  slug,
  imageUrl,
  currency = "KES",
  inStock = true,
  showWishlistRemove,
  onRemoveFromWishlist,
}: ProductCardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const { addItem } = useCart();
  const { showToast } = useToast();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!inStock) return;

    setIsAdding(true);
    addItem({
      productId: id,
      name,
      slug,
      price: Number(price),
      imageUrl: imageUrl || null,
    });
    showToast(`${name} added to cart`, "success");
    setTimeout(() => setIsAdding(false), 1000);
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (showWishlistRemove && onRemoveFromWishlist) {
      onRemoveFromWishlist();
    } else {
      setIsWishlisted(!isWishlisted);
      showToast(isWishlisted ? "Removed from wishlist" : "Added to wishlist", "info");
    }
  };

  return (
    <div className="card group relative">
      {/* Wishlist Remove Button */}
      {showWishlistRemove && (
        <button
          onClick={handleWishlist}
          className="absolute top-4 right-4 z-10 p-1 bg-white rounded-full shadow hover:bg-red-50"
        >
          <X className="w-4 h-4 text-red-500" />
        </button>
      )}

      {/* Out of Stock Badge */}
      {!inStock && (
        <div className="absolute top-4 left-4 z-10 bg-red-500 text-white text-xs px-2 py-1 rounded">
          Out of Stock
        </div>
      )}

      {/* Image */}
      <Link href={`/product/${slug}`}>
        <div className="aspect-square bg-gray-100 rounded-lg mb-4 overflow-hidden relative">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={name}
              fill
              className="object-cover group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}

          {/* Quick Add Button */}
          <button
            onClick={handleAddToCart}
            disabled={!inStock}
            className={`absolute bottom-2 right-2 p-2 rounded-full shadow-lg transition-all transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 ${
              isAdding
                ? "bg-green-500 text-white"
                : inStock
                ? "bg-white hover:bg-accent hover:text-white"
                : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            {isAdding ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <ShoppingCart className="w-5 h-5" />
            )}
          </button>
        </div>
      </Link>

      {/* Info */}
      <Link href={`/product/${slug}`}>
        <h3 className="font-medium mb-2 line-clamp-2 hover:text-accent">{name}</h3>
      </Link>

      {/* Rating */}
      <div className="flex items-center gap-1 mb-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`w-3 h-3 ${
              i <= Math.round(Number(rating)) ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
            }`}
          />
        ))}
        <span className="text-xs text-text-muted ml-1">({Number(rating).toFixed(1)})</span>
      </div>

      {/* Price & Wishlist */}
      <div className="flex items-center justify-between">
        <span className="font-bold">{currency} {Number(price).toLocaleString()}</span>
        {!showWishlistRemove && (
          <button
            onClick={handleWishlist}
            className={`btn-icon ${isWishlisted ? "text-red-500" : ""}`}
          >
            <Heart className={`w-4 h-4 ${isWishlisted ? "fill-current" : ""}`} />
          </button>
        )}
      </div>
    </div>
  );
}
