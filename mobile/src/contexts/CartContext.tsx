import React, {createContext, useContext, useState, useCallback} from 'react';
import {api} from '../lib/api';
import {storage} from '../lib/storage';
import type {Cart, CartItem} from '../lib/types';

interface CartContextType {
  cart: Cart | null;
  isLoading: boolean;
  addItem: (productId: string, quantity?: number) => Promise<void>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  itemCount: number;
  total: number;
}

const CartContext = createContext<CartContextType>({
  cart: null,
  isLoading: false,
  addItem: async () => {},
  updateItem: async () => {},
  removeItem: async () => {},
  clearCart: async () => {},
  refreshCart: async () => {},
  itemCount: 0,
  total: 0,
});

export function CartProvider({children}: {children: React.ReactNode}) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const getOrCreateCartId = useCallback(async (): Promise<string> => {
    let cartId = await storage.getCartId();
    if (!cartId) {
      const res = await api.cart.create();
      cartId = res.id;
      await storage.setCartId(cartId);
    }
    return cartId;
  }, []);

  const refreshCart = useCallback(async () => {
    try {
      const cartId = await storage.getCartId();
      if (cartId) {
        const data = await api.cart.get(cartId);
        setCart(data);
      }
    } catch {}
  }, []);

  const addItem = useCallback(async (productId: string, quantity = 1) => {
    setIsLoading(true);
    try {
      const cartId = await getOrCreateCartId();
      const data = await api.cart.addItem(cartId, {productId, quantity});
      setCart(data);
    } finally {
      setIsLoading(false);
    }
  }, [getOrCreateCartId]);

  const updateItem = useCallback(async (itemId: string, quantity: number) => {
    const cartId = await storage.getCartId();
    if (!cartId) return;
    const data = await api.cart.updateItem(cartId, itemId, {quantity});
    setCart(data);
  }, []);

  const removeItem = useCallback(async (itemId: string) => {
    const cartId = await storage.getCartId();
    if (!cartId) return;
    const data = await api.cart.removeItem(cartId, itemId);
    setCart(data);
  }, []);

  const clearCart = useCallback(async () => {
    const cartId = await storage.getCartId();
    if (!cartId) return;
    await api.cart.clear(cartId);
    setCart(null);
    await storage.clearCartId();
  }, []);

  return (
    <CartContext.Provider
      value={{
        cart,
        isLoading,
        addItem,
        updateItem,
        removeItem,
        clearCart,
        refreshCart,
        itemCount: cart?.itemCount || 0,
        total: cart?.total || 0,
      }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
