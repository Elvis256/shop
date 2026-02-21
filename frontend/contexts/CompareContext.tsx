"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface CompareProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice?: number;
  imageUrl: string | null;
  category?: string;
  rating?: number;
  reviewCount?: number;
  features?: Record<string, string>;
}

interface CompareContextType {
  compareList: CompareProduct[];
  addToCompare: (product: CompareProduct) => void;
  removeFromCompare: (productId: string) => void;
  clearCompare: () => void;
  isInCompare: (productId: string) => boolean;
  canAddMore: boolean;
  maxItems: number;
}

const MAX_COMPARE_ITEMS = 4;

const CompareContext = createContext<CompareContextType>({
  compareList: [],
  addToCompare: () => {},
  removeFromCompare: () => {},
  clearCompare: () => {},
  isInCompare: () => false,
  canAddMore: true,
  maxItems: MAX_COMPARE_ITEMS,
});

export function CompareProvider({ children }: { children: ReactNode }) {
  const [compareList, setCompareList] = useState<CompareProduct[]>([]);

  const addToCompare = (product: CompareProduct) => {
    if (compareList.length >= MAX_COMPARE_ITEMS) return;
    if (compareList.some((p) => p.id === product.id)) return;
    
    setCompareList((prev) => [...prev, product]);
  };

  const removeFromCompare = (productId: string) => {
    setCompareList((prev) => prev.filter((p) => p.id !== productId));
  };

  const clearCompare = () => {
    setCompareList([]);
  };

  const isInCompare = (productId: string) => {
    return compareList.some((p) => p.id === productId);
  };

  return (
    <CompareContext.Provider
      value={{
        compareList,
        addToCompare,
        removeFromCompare,
        clearCompare,
        isInCompare,
        canAddMore: compareList.length < MAX_COMPARE_ITEMS,
        maxItems: MAX_COMPARE_ITEMS,
      }}
    >
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  return useContext(CompareContext);
}
