"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { X, ChevronUp, ChevronDown, GitCompare } from "lucide-react";
import { useCompare } from "@/contexts/CompareContext";

export default function CompareBar() {
  const { compareList, removeFromCompare, clearCompare } = useCompare();
  const [isExpanded, setIsExpanded] = useState(true);

  if (compareList.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-40 transition-transform lg:bottom-0 bottom-16">
      <div className="container">
        {/* Header */}
        <div className="flex items-center justify-between py-2 border-b">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-sm font-medium"
          >
            <GitCompare className="w-4 h-4" />
            Compare ({compareList.length})
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>
          <div className="flex items-center gap-4">
            <button
              onClick={clearCompare}
              className="text-xs text-gray-500 hover:text-red-600"
            >
              Clear
            </button>
            <Link
              href="/compare"
              className="btn-primary text-sm py-1.5 px-4"
            >
              Compare Now
            </Link>
          </div>
        </div>

        {/* Products */}
        {isExpanded && (
          <div className="py-3">
            <div className="flex gap-4 overflow-x-auto">
              {compareList.map((product) => (
                <div
                  key={product.id}
                  className="flex-shrink-0 relative group"
                >
                  <button
                    onClick={() => removeFromCompare(product.id)}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center hover:bg-red-200 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <Link href={`/product/${product.slug}`}>
                    <div className="w-16 h-16 bg-gray-100 rounded overflow-hidden">
                      {product.imageUrl ? (
                        <Image
                          src={product.imageUrl}
                          alt={product.name}
                          width={64}
                          height={64}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                          No Image
                        </div>
                      )}
                    </div>
                    <p className="text-xs mt-1 w-16 truncate text-center">
                      {product.name}
                    </p>
                  </Link>
                </div>
              ))}
              
              {/* Empty slots */}
              {Array.from({ length: 4 - compareList.length }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="flex-shrink-0 w-16 h-16 border-2 border-dashed border-gray-200 rounded flex items-center justify-center"
                >
                  <span className="text-xs text-gray-400">+</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
