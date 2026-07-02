"use client";

import { useEffect, useRef, useCallback } from "react";
import { useCart } from "@/lib/hooks/useCart";
import { useCurrency } from "@/contexts/CurrencyContext";
import FreeShippingBar from "@/components/FreeShippingBar";
import Link from "next/link";
import ProductImage from "@/components/ProductImage";
import { X, ShoppingBag, Minus, Plus, Trash2 } from "lucide-react";

export default function CartDrawer() {
  const { items, isOpen, closeCart, total, updateQuantity, removeItem, syncError, dismissSyncError } = useCart();
  const { formatPrice } = useCurrency();
  const drawerRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when cart is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCart();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, closeCart]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !drawerRef.current) return;
    const drawer = drawerRef.current;
    const focusable = drawer.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) focusable[0].focus();

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleTab);
    return () => document.removeEventListener("keydown", handleTab);
  }, [isOpen, items.length]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={closeCart}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className="fixed right-0 top-0 h-full w-full max-w-md bg-surface z-50 shadow-xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text">Your Cart ({items.reduce((sum, i) => sum + i.quantity, 0)})</h2>
          <button
            onClick={closeCart}
            className="p-2 hover:bg-surface-secondary rounded-full transition-colors"
            aria-label="Close cart"
          >
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        {/* Sync Error */}
        {syncError && (
          <div className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <span className="text-amber-600 text-sm flex-1">{syncError}</span>
            <button onClick={dismissSyncError} className="text-amber-400 hover:text-amber-600 text-lg leading-none">&times;</button>
          </div>
        )}

        {/* Free Shipping Bar */}
        {items.length > 0 && (
          <div className="px-4 pt-3">
            <FreeShippingBar cartTotal={total} formatPrice={formatPrice} />
          </div>
        )}

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="text-center py-12 text-text-muted">
              <ShoppingBag className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium mb-1">Your cart is empty</p>
              <p className="text-sm mb-6">Add items to get started</p>
              <button onClick={closeCart} className="btn-secondary">
                Continue Shopping
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.productId} className="flex gap-3 p-3 bg-surface-secondary rounded-12">
                  {/* Image */}
                  <div className="w-20 h-20 bg-surface rounded-lg overflow-hidden flex-shrink-0">
                    <ProductImage
                      src={item.imageUrl}
                      alt={item.name}
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/product/${item.slug}`}
                      className="font-medium text-sm text-text hover:text-primary line-clamp-2 transition-colors"
                      onClick={closeCart}
                    >
                      {item.name}
                    </Link>
                    <p className="text-sm text-text-muted mt-1">
                      {formatPrice(item.price)}
                    </p>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center border border-border rounded-lg overflow-hidden">
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantId)}
                          className="w-7 h-7 flex items-center justify-center hover:bg-surface-secondary transition-colors"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium text-text">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantId)}
                          className="w-7 h-7 flex items-center justify-center hover:bg-surface-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          disabled={item.stock !== undefined && item.quantity >= item.stock}
                          title={item.stock !== undefined && item.quantity >= item.stock ? `Max ${item.stock} available` : undefined}
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      {item.stock !== undefined && item.stock <= 10 && item.stock > 0 && (
                        <span className="text-[10px] text-orange-500">{item.stock} left</span>
                      )}
                      <button
                        onClick={() => removeItem(item.productId, item.variantId)}
                        className="ml-auto p-1 text-text-muted hover:text-red-500 transition-colors"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-border p-4 space-y-4">
            <div className="flex justify-between text-lg font-semibold text-text">
              <span>Total</span>
              <span>{formatPrice(total)}</span>
            </div>
            <Link
              href="/checkout"
              onClick={closeCart}
              className="btn-primary w-full text-center block"
            >
              Checkout
            </Link>
            <button onClick={closeCart} className="btn-secondary w-full">
              Continue Shopping
            </button>
          </div>
        )}
      </div>
    </>
  );
}
