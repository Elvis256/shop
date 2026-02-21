"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingBag } from "lucide-react";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  imageUrl?: string;
}

const STORAGE_KEY = "recentlyViewed";
const MAX_ITEMS = 8;

export function useRecentlyViewed() {
  const [items, setItems] = useState<Product[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setItems(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse recently viewed");
      }
    }
  }, []);

  const addItem = (product: Product) => {
    setItems((prev) => {
      const filtered = prev.filter((p) => p.id !== product.id);
      const updated = [product, ...filtered].slice(0, MAX_ITEMS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const clearItems = () => {
    localStorage.removeItem(STORAGE_KEY);
    setItems([]);
  };

  return { items, addItem, clearItems };
}

interface RecentlyViewedProps {
  currentProductId?: string;
}

export default function RecentlyViewed({ currentProductId }: RecentlyViewedProps) {
  const { items } = useRecentlyViewed();

  // Filter out current product
  const displayItems = items.filter((item) => item.id !== currentProductId);

  if (displayItems.length === 0) {
    return null;
  }

  return (
    <section className="py-12">
      <div className="container">
        <h2 className="text-2xl font-bold mb-6">Recently Viewed</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {displayItems.slice(0, 6).map((product) => (
            <Link
              key={product.id}
              href={`/product/${product.slug}`}
              className="group"
            >
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-2">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    width={200}
                    height={200}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                )}
              </div>
              <h3 className="text-sm font-medium line-clamp-2 group-hover:text-accent">
                {product.name}
              </h3>
              <p className="text-sm font-semibold mt-1">
                KES {Number(product.price).toLocaleString()}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
