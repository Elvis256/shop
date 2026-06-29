"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { api } from "../api";
import { useAuth } from "./useAuth";
import { trackAddToCart } from "@/components/GoogleAnalytics";

export interface CartItem {
  id: string;
  productId: string;
  variantId?: string | null;
  variantName?: string | null;
  name: string;
  slug: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
  stock?: number;
  shippingBadge?: "From Abroad" | "Express";
}

interface CartContextType {
  items: CartItem[];
  isOpen: boolean;
  itemCount: number;
  total: number;
  cartId: string | null;
  syncError: string | null;
  dismissSyncError: () => void;
  addItem: (product: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string | null | undefined) => void;
  updateItemBadge: (productId: string, badge: "From Abroad" | "Express") => void;
  removeItem: (productId: string, variantId?: string | null) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  syncCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [cartId, setCartId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const { user } = useAuth();

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem("cart");
    const savedCartId = localStorage.getItem("cartId");
    if (savedCart) {
      try {
        setItems(JSON.parse(savedCart));
      } catch (e) {
        console.error("Failed to parse cart:", e);
      }
    }
    if (savedCartId) {
      setCartId(savedCartId);
    }
    setIsLoaded(true);
  }, []);

  // Save cart to localStorage on change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("cart", JSON.stringify(items));
      if (cartId) {
        localStorage.setItem("cartId", cartId);
      }
    }
  }, [items, cartId, isLoaded]);

  // Sync cart to backend when user logs in
  const syncCart = useCallback(async () => {
    if (items.length === 0) return;
    
    try {
      const syncItems = items.map(item => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      }));
      
      const result = await api.syncCart(syncItems);
      
      if (result.id) {
        setCartId(result.id);
        setSyncError(null);
        // Update local items with backend response (stock-adjusted quantities)
        const newItems: CartItem[] = (result.items as any[]).map((item) => ({
          id: item.id,
          productId: item.productId,
          variantId: item.variantId,
          variantName: item.variant?.name || null,
          name: item.product.name,
          slug: item.product.slug,
          price: Number(item.product.price),
          quantity: item.quantity,
          imageUrl: item.product.imageUrl,
          shippingBadge: item.product.shippingBadge || undefined,
        }));
        setItems(newItems);
      }
    } catch (error) {
      console.error("Failed to sync cart:", error);
      setSyncError("Some items in your cart may have changed. Please review your cart.");
    }
  }, [items]);

  // Auto-sync when user logs in
  useEffect(() => {
    if (user && isLoaded && items.length > 0 && !cartId) {
      syncCart();
    }
  }, [user, isLoaded, items.length, cartId, syncCart]);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const addItem = (product: Omit<CartItem, "quantity"> & { quantity?: number }) => {
    const quantity = product.quantity || 1;
    const stock = product.stock;
    const variantId = product.variantId || null;
    const itemId = variantId || product.productId;

    // Trigger GA4 AddToCart event
    trackAddToCart({
      id: product.productId,
      name: product.name,
      price: product.price,
      quantity,
      category: undefined, // category can be expanded if passed in the hook
    });

    setItems((prev) => {
      const existing = prev.find((item) => item.id === itemId);
      if (existing) {
        const newQty = existing.quantity + quantity;
        const cappedQty = stock !== undefined ? Math.min(newQty, stock) : newQty;
        return prev.map((item) =>
          item.id === itemId
            ? { ...item, quantity: cappedQty, stock }
            : item
        );
      }
      const cappedQty = stock !== undefined ? Math.min(quantity, stock) : quantity;
      return [...prev, { ...product, quantity: cappedQty, stock, id: itemId, variantId }];
    });
    setIsOpen(true);
  };

  const updateQuantity = (productId: string, quantity: number, variantId?: string | null | undefined) => {
    const itemId = variantId || productId;
    if (quantity <= 0) {
      removeItem(productId, variantId);
      return;
    }
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const cappedQty = item.stock !== undefined ? Math.min(quantity, item.stock) : quantity;
        return { ...item, quantity: cappedQty };
      })
    );
  };

  const updateItemBadge = (productId: string, badge: "From Abroad" | "Express") => {
    setItems((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, shippingBadge: badge } : item
      )
    );
  };

  const removeItem = (productId: string, variantId?: string | null) => {
    const itemId = variantId || productId;
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const clearCart = () => {
    setItems([]);
    setCartId(null);
    localStorage.removeItem("cartId");
  };
  
  const openCart = () => setIsOpen(true);
  const closeCart = () => setIsOpen(false);
  const toggleCart = () => setIsOpen((prev) => !prev);
  const dismissSyncError = () => setSyncError(null);

  return (
    <CartContext.Provider
      value={{
        items,
        isOpen,
        itemCount,
        total,
        cartId,
        syncError,
        dismissSyncError,
        addItem,
        updateQuantity,
        updateItemBadge,
        removeItem,
        clearCart,
        openCart,
        closeCart,
        toggleCart,
        syncCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
