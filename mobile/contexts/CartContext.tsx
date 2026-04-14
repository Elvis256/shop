import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { storage } from "@/lib/storage";
import type { Cart, CartItem } from "@/lib/types";

interface CartContextType {
  cart: Cart | null;
  isLoading: boolean;
  itemCount: number;
  total: number;
  addItem: (productId: string, quantity?: number, variantId?: string) => Promise<void>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadCart = useCallback(async () => {
    try {
      const savedCart = await storage.getCart();
      if (savedCart?.id) {
        try {
          const freshCart = await api.getCart(savedCart.id);
          setCart(freshCart);
          await storage.setCart(freshCart);
        } catch {
          // Cart may have expired, create new one
          setCart(savedCart);
        }
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  const ensureCart = useCallback(async (): Promise<string> => {
    if (cart?.id) return cart.id;
    const { id } = await api.createCart();
    const newCart: Cart = { id, items: [], total: 0, itemCount: 0 };
    setCart(newCart);
    await storage.setCart(newCart);
    return id;
  }, [cart]);

  const addItem = useCallback(
    async (productId: string, quantity = 1, variantId?: string) => {
      const cartId = await ensureCart();
      const updatedCart = await api.addToCart(cartId, productId, quantity, variantId);
      setCart(updatedCart);
      await storage.setCart(updatedCart);
    },
    [ensureCart]
  );

  const updateItem = useCallback(
    async (itemId: string, quantity: number) => {
      if (!cart?.id) return;
      const updatedCart = await api.updateCartItem(cart.id, itemId, quantity);
      setCart(updatedCart);
      await storage.setCart(updatedCart);
    },
    [cart]
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      if (!cart?.id) return;
      const updatedCart = await api.removeCartItem(cart.id, itemId);
      setCart(updatedCart);
      await storage.setCart(updatedCart);
    },
    [cart]
  );

  const clearCart = useCallback(async () => {
    setCart(null);
    await storage.clearCart();
  }, []);

  const refreshCart = useCallback(async () => {
    if (!cart?.id) return;
    try {
      const freshCart = await api.getCart(cart.id);
      setCart(freshCart);
      await storage.setCart(freshCart);
    } catch {}
  }, [cart]);

  return (
    <CartContext.Provider
      value={{
        cart,
        isLoading,
        itemCount: cart?.itemCount || 0,
        total: cart?.total || 0,
        addItem,
        updateItem,
        removeItem,
        clearCart,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
