"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { X, ShoppingCart, Star, ArrowLeft } from "lucide-react";
import { useCompare } from "@/contexts/CompareContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCart } from "@/lib/hooks/useCart";

export default function ComparePage() {
  const { compareList, removeFromCompare, clearCompare } = useCompare();
  const { formatPrice } = useCurrency();
  const { addItem } = useCart();

  const handleAddToCart = (product: typeof compareList[0]) => {
    addItem({
      id: product.id,
      productId: product.id,
      name: product.name,
      slug: product.slug || product.id,
      price: product.price,
      quantity: 1,
      imageUrl: product.imageUrl,
    });
  };

  if (compareList.length === 0) {
    return (
      <div className="container py-16 text-center">
        <h1 className="text-2xl font-head mb-4">Compare Products</h1>
        <p className="text-gray-600 mb-8">
          You haven&apos;t added any products to compare yet.
        </p>
        <Link href="/category" className="btn-primary">
          Browse Products
        </Link>
      </div>
    );
  }

  const compareFeatures = [
    { key: "price", label: "Price" },
    { key: "rating", label: "Rating" },
    { key: "category", label: "Category" },
    { key: "material", label: "Material" },
    { key: "size", label: "Size" },
    { key: "color", label: "Color" },
  ];

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/category" className="btn-icon">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-head">Compare Products ({compareList.length})</h1>
        </div>
        <button onClick={clearCompare} className="text-sm text-red-600 hover:underline">
          Clear All
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr>
              <th className="text-left py-4 px-4 bg-gray-50 w-40">Product</th>
              {compareList.map((product) => (
                <th key={product.id} className="py-4 px-4 bg-gray-50 min-w-[200px]">
                  <div className="relative">
                    <button
                      onClick={() => removeFromCompare(product.id)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center hover:bg-red-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <Link href={`/product/${product.slug}`}>
                      <div className="w-32 h-32 mx-auto mb-3 relative bg-gray-100 rounded-lg overflow-hidden">
                        {product.imageUrl ? (
                          <Image
                            src={product.imageUrl}
                            alt={product.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            No Image
                          </div>
                        )}
                      </div>
                      <h3 className="font-medium text-sm line-clamp-2 hover:text-primary">
                        {product.name}
                      </h3>
                    </Link>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Price Row */}
            <tr className="border-b">
              <td className="py-4 px-4 font-medium text-gray-700">Price</td>
              {compareList.map((product) => (
                <td key={product.id} className="py-4 px-4 text-center">
                  <div className="font-bold text-lg text-primary">
                    {formatPrice(product.price)}
                  </div>
                  {product.comparePrice && product.comparePrice > product.price && (
                    <div className="text-sm text-gray-400 line-through">
                      {formatPrice(product.comparePrice)}
                    </div>
                  )}
                </td>
              ))}
            </tr>

            {/* Rating Row */}
            <tr className="border-b">
              <td className="py-4 px-4 font-medium text-gray-700">Rating</td>
              {compareList.map((product) => (
                <td key={product.id} className="py-4 px-4 text-center">
                  {product.rating ? (
                    <div className="flex items-center justify-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span>{product.rating}</span>
                      {product.reviewCount && (
                        <span className="text-gray-400 text-sm">
                          ({product.reviewCount})
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400">No reviews</span>
                  )}
                </td>
              ))}
            </tr>

            {/* Category Row */}
            <tr className="border-b">
              <td className="py-4 px-4 font-medium text-gray-700">Category</td>
              {compareList.map((product) => (
                <td key={product.id} className="py-4 px-4 text-center">
                  {product.category || "—"}
                </td>
              ))}
            </tr>

            {/* Dynamic Feature Rows */}
            {["material", "size", "color"].map((feature) => (
              <tr key={feature} className="border-b">
                <td className="py-4 px-4 font-medium text-gray-700 capitalize">
                  {feature}
                </td>
                {compareList.map((product) => (
                  <td key={product.id} className="py-4 px-4 text-center">
                    {product.features?.[feature] || "—"}
                  </td>
                ))}
              </tr>
            ))}

            {/* Add to Cart Row */}
            <tr>
              <td className="py-6 px-4"></td>
              {compareList.map((product) => (
                <td key={product.id} className="py-6 px-4 text-center">
                  <button
                    onClick={() => handleAddToCart(product)}
                    className="btn-primary text-sm flex items-center gap-2 mx-auto"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Add to Cart
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
