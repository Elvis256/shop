"use client";

import { useState } from "react";
import { useCart } from "@/lib/hooks/useCart";
import { useToast } from "@/lib/hooks/useToast";

interface AddToCartButtonProps {
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    imageUrl?: string | null;
    stock?: number;
  };
  showQuantity?: boolean;
  className?: string;
}

export default function AddToCartButton({ product, showQuantity = false, className = "" }: AddToCartButtonProps) {
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const { addItem } = useCart();
  const { showToast } = useToast();

  const handleAdd = () => {
    setIsAdding(true);
    addItem({
      id: product.id,
      productId: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      imageUrl: product.imageUrl || null,
      quantity,
    });
    showToast(`${product.name} added to cart`, "success");
    setTimeout(() => setIsAdding(false), 500);
  };

  const inStock = product.stock === undefined || product.stock > 0;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {showQuantity && (
        <div className="flex items-center border rounded-lg">
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 transition"
            disabled={quantity <= 1}
          >
            −
          </button>
          <span className="w-12 text-center font-medium">{quantity}</span>
          <button
            onClick={() => setQuantity((q) => q + 1)}
            className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 transition"
            disabled={product.stock !== undefined && quantity >= product.stock}
          >
            +
          </button>
        </div>
      )}

      <button
        onClick={handleAdd}
        disabled={!inStock || isAdding}
        className={`btn-primary flex-1 flex items-center justify-center gap-2 ${
          !inStock ? "opacity-50 cursor-not-allowed" : ""
        } ${isAdding ? "bg-green-600" : ""}`}
      >
        {isAdding ? (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Added!
          </>
        ) : !inStock ? (
          "Out of Stock"
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            Add to Cart
          </>
        )}
      </button>
    </div>
  );
}
