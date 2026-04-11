"use client";

import { useCart } from "@/lib/hooks/useCart";
import { useCurrency } from "@/contexts/CurrencyContext";
import FreeShippingBar from "@/components/FreeShippingBar";
import Link from "next/link";
import ProductImage from "@/components/ProductImage";

export default function CartDrawer() {
  const { items, isOpen, closeCart, total, updateQuantity, removeItem } = useCart();
  const { formatPrice } = useCurrency();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={closeCart}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Your Cart ({items.reduce((sum, i) => sum + i.quantity, 0)})</h2>
          <button
            onClick={closeCart}
            className="p-2 hover:bg-gray-100 rounded-full transition"
            aria-label="Close cart"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Free Shipping Bar */}
        {items.length > 0 && (
          <div className="px-4 pt-3">
            <FreeShippingBar cartTotal={total} formatPrice={formatPrice} />
          </div>
        )}

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <p>Your cart is empty</p>
              <button onClick={closeCart} className="btn-secondary mt-4">
                Continue Shopping
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.productId} className="flex gap-4 p-3 bg-gray-50 rounded-lg">
                  {/* Image */}
                  <div className="w-20 h-20 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
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
                      className="font-medium text-sm hover:text-gray-600 line-clamp-2"
                      onClick={closeCart}
                    >
                      {item.name}
                    </Link>
                    <p className="text-sm text-gray-600 mt-1">
                      {formatPrice(item.price)}
                    </p>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        className="w-7 h-7 flex items-center justify-center border rounded hover:bg-gray-100"
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        className="w-7 h-7 flex items-center justify-center border rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        disabled={item.stock !== undefined && item.quantity >= item.stock}
                        title={item.stock !== undefined && item.quantity >= item.stock ? `Max ${item.stock} available` : undefined}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                      {item.stock !== undefined && item.stock <= 10 && item.stock > 0 && (
                        <span className="text-[10px] text-orange-500 ml-1">{item.stock} left</span>
                      )}
                      <button
                        onClick={() => removeItem(item.productId)}
                        className="ml-auto text-red-500 hover:text-red-700 text-sm"
                      >
                        Remove
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
          <div className="border-t p-4 space-y-4">
            <div className="flex justify-between text-lg font-semibold">
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
