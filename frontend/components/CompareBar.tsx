"use client";

import Link from "next/link";
import { X, ArrowLeftRight } from "lucide-react";
import { useCompare } from "@/contexts/CompareContext";
import ProductImage from "@/components/ProductImage";

export default function CompareBar() {
  const { compareList, removeFromCompare, clearCompare } = useCompare();

  if (compareList.length === 0) return null;

  return (
    <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 shadow-lg p-3 animate-in slide-in-from-bottom-2">
      <div className="container flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <ArrowLeftRight className="w-4 h-4 text-primary" />
          Compare ({compareList.length})
        </div>

        <div className="flex items-center gap-2 flex-1 overflow-x-auto">
          {compareList.map((product) => (
            <div key={product.id} className="relative flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-gray-200">
              <ProductImage
                src={product.imageUrl}
                alt={product.name}
                width={48}
                height={48}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => removeFromCompare(product.id)}
                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={clearCompare}
            className="text-xs text-gray-500 hover:text-red-500 transition-colors"
          >
            Clear
          </button>
          <Link
            href="/compare"
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              compareList.length >= 2
                ? "bg-primary text-white hover:bg-primary/90"
                : "bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none"
            }`}
          >
            Compare Now
          </Link>
        </div>
      </div>
    </div>
  );
}
