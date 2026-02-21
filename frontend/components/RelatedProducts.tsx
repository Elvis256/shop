"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingBag } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice?: number;
  currency?: string;
  rating?: number;
  imageUrl?: string;
  category?: string;
}

interface RelatedProductsProps {
  productSlug: string;
  categoryName?: string;
  title?: string;
  limit?: number;
}

export default function RelatedProducts({ 
  productSlug,
  categoryName,
  title = "You May Also Like",
  limit = 4,
}: RelatedProductsProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRelatedProducts = async () => {
      try {
        const res = await fetch(`${API_URL}/api/products/${productSlug}/related?limit=${limit}`);
        if (res.ok) {
          const data = await res.json();
          setProducts(data.products || []);
        }
      } catch (error) {
        console.error("Failed to fetch related products:", error);
      } finally {
        setLoading(false);
      }
    };

    if (productSlug) {
      fetchRelatedProducts();
    }
  }, [productSlug, limit]);

  if (loading) {
    return (
      <section className="py-12 border-t">
        <div className="container">
          <h2 className="text-2xl font-bold mb-6">{title}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square bg-gray-200 rounded-lg mb-3" />
                <div className="h-4 bg-gray-200 rounded mb-2" />
                <div className="h-4 bg-gray-200 rounded w-2/3" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!products || products.length === 0) {
    return null;
  }

  return (
    <section className="py-12 border-t">
      <div className="container">
        <h2 className="text-2xl font-bold mb-6">{title}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
          {products.slice(0, limit).map((product) => (
            <Link
              key={product.id}
              href={`/product/${product.slug}`}
              className="group"
            >
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-3 relative">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    width={300}
                    height={300}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <ShoppingBag className="w-12 h-12" />
                  </div>
                )}
                
                {/* Sale badge */}
                {product.comparePrice && (
                  <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-medium px-2 py-1 rounded">
                    {Math.round((1 - Number(product.price) / Number(product.comparePrice)) * 100)}% OFF
                  </span>
                )}
              </div>
              
              {product.category && (
                <p className="text-xs text-gray-500 mb-1">{product.category}</p>
              )}
              
              <h3 className="font-medium line-clamp-2 group-hover:text-accent transition-colors">
                {product.name}
              </h3>
              
              <div className="mt-2 flex items-center gap-2">
                <span className="font-semibold">
                  KES {Number(product.price).toLocaleString()}
                </span>
                {product.comparePrice && (
                  <span className="text-sm text-gray-400 line-through">
                    KES {Number(product.comparePrice).toLocaleString()}
                  </span>
                )}
              </div>
              
              {product.rating && (
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-yellow-400">★</span>
                  <span className="text-sm text-gray-600">{product.rating}</span>
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
