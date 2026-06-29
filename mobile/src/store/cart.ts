// src/store/cart.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import create from 'zustand';
import {persist} from 'zustand/middleware';
import {CartItem, ProductListItem} from '../lib/types';

type CartState = {
  items: CartItem[];
  addItem: (product: ProductListItem, quantity?: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get): CartState => ({
      items: [],
      addItem: (product: ProductListItem, quantity = 1) => {
        const existing = get().items.find(i => i.product.id === product.id);
        if (existing) {
          set(state => ({
            items: state.items.map(i =>
              i.product.id === product.id
                ? {
                    ...i,
                    quantity: i.quantity + quantity,
                    subtotal: i.product.price * (i.quantity + quantity),
                  }
                : i,
            ),
          }));
        } else {
          const newItem: CartItem = {
            id: `${product.id}-${Date.now()}`,
            productId: product.id,
            product: {
              id: product.id,
              name: product.name,
              slug: product.slug,
              price: product.price,
              currency: product.currency,
              imageUrl: product.imageUrl,
              stock: product.stock,
              shippingBadge: product.shippingBadge,
            },
            quantity,
            subtotal: product.price * quantity,
          };
          set(state => ({items: [...state.items, newItem]}));
        }
      },
      removeItem: productId => {
        set(state => ({items: state.items.filter(i => i.product.id !== productId)}));
      },
      clearCart: () => set({items: []}),
      total: 0,
      itemCount: 0,
    }),
    {
      name: 'cart-store',
      getStorage: () => AsyncStorage,
    },
  ),
);

// Derive totals via selectors (can be used in components)
export const useCartSelectors = () => {
  const items = useCartStore(state => state.items);
  const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const itemCount = items.reduce((c, i) => c + i.quantity, 0);
  return {items, total, itemCount};
};
