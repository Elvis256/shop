"use client";

import { useState, useEffect } from "react";

interface ProductSummary {
  id: string;
  name: string;
  slug: string;
  price: number;
  imageUrl?: string;
}

const STORAGE_KEY = "recently_viewed";
const MAX_ITEMS = 8;

export function useRecentlyViewed() {
  const [products, setProducts] = useState<ProductSummary[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setProducts(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, []);

  const addProduct = (product: ProductSummary) => {
    setProducts((prev) => {
      const filtered = prev.filter((p) => p.id !== product.id);
      const updated = [product, ...filtered].slice(0, MAX_ITEMS);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const getProducts = (): ProductSummary[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const clearProducts = () => {
    localStorage.removeItem(STORAGE_KEY);
    setProducts([]);
  };

  return { products, addProduct, getProducts, clearProducts };
}
