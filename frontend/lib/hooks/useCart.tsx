"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { api } from "../api";
import { useAuth } from "./useAuth";

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  slug: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
}

interface CartContextType {
  items: CartItem[];
  isOpen: boolean;
  itemCount: number;
  total: number;
  cartId: string | null;
  addItem: (product: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
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
        quantity: item.quantity,
      }));
      
      const result = await api.syncCart(syncItems);
      
      if (result.id) {
        setCartId(result.id);
        // Update local items with backend response (stock-adjusted quantities)
        const newItems: CartItem[] = (result.items as any[]).map((item) => ({
          id: item.id,
          productId: item.productId,
          name: item.product.name,
          slug: item.product.slug,
          price: Number(item.product.price),
          quantity: item.quantity,
          imageUrl: item.product.imageUrl,
        }));
        setItems(newItems);
      }
    } catch (error) {
      console.error("Failed to sync cart:", error);
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
    setItems((prev) => {
      const existing = prev.find((item) => item.productId === product.productId);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.productId
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { ...product, quantity, id: product.productId }];
    });
    setIsOpen(true);
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, quantity } : item
      )
    );
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const clearCart = () => {
    setItems([]);
    setCartId(null);
    localStorage.removeItem("cartId");
  };
  
  const openCart = () => setIsOpen(true);
  const closeCart = () => setIsOpen(false);
  const toggleCart = () => setIsOpen((prev) => !prev);

  return (
    <CartContext.Provider
      value={{
        items,
        isOpen,
        itemCount,
        total,
        cartId,
        addItem,
        updateQuantity,
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
