"use client";

import { useState } from "react";
import { useCart } from "@/lib/hooks/useCart";
import Image from "next/image";

export default function OrderSummary() {
  const { items, total } = useCart();
  const [promoCode, setPromoCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [promoError, setPromoError] = useState("");
  const [promoApplied, setPromoApplied] = useState("");

  const shipping = total >= 5000 ? 0 : 300;
  const finalTotal = total - discount + shipping;

  const applyPromo = async () => {
    setPromoError("");
    if (!promoCode.trim()) {
      setPromoError("Enter a promo code");
      return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/coupons/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode, subtotal: total }),
      });
      const data = await res.json();

      if (!res.ok) {
        setPromoError(data.error || "Invalid code");
        return;
      }

      setDiscount(data.discount);
      setPromoApplied(promoCode.toUpperCase());
    } catch (e) {
      setPromoError("Failed to validate code");
    }
  };

  if (items.length === 0) {
    return (
      <div className="card sticky top-24">
        <h3 className="font-semibold mb-4">Order Summary</h3>
        <p className="text-text-muted text-center py-8">Your cart is empty</p>
      </div>
    );
  }

  return (
    <div className="card sticky top-24">
      <h3 className="font-semibold mb-4">Order Summary</h3>

      {/* Items */}
      <div className="space-y-4 mb-6 max-h-64 overflow-y-auto">
        {items.map((item) => (
          <div key={item.productId} className="flex gap-3">
            <div className="w-16 h-16 bg-gray-100 rounded flex-shrink-0 overflow-hidden relative">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-small font-medium line-clamp-1">{item.name}</p>
              <p className="text-small text-text-muted">Qty: {item.quantity}</p>
            </div>
            <p className="font-medium text-small">
              KES {(item.price * item.quantity).toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="space-y-2 pt-4 border-t border-border text-small">
        <div className="flex justify-between">
          <span className="text-text-muted">Subtotal</span>
          <span>KES {total.toLocaleString()}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount ({promoApplied})</span>
            <span>-KES {discount.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-text-muted">Shipping</span>
          {shipping === 0 ? (
            <span className="text-green-600">Free</span>
          ) : (
            <span>KES {shipping.toLocaleString()}</span>
          )}
        </div>
        {shipping === 0 && (
          <p className="text-xs text-green-600">Free shipping on orders over KES 5,000</p>
        )}
        <div className="flex justify-between pt-2 border-t border-border font-semibold text-base">
          <span>Total</span>
          <span>KES {finalTotal.toLocaleString()}</span>
        </div>
      </div>

      {/* Promo Code */}
      <div className="mt-6">
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Promo code"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            disabled={!!promoApplied}
          />
          {promoApplied ? (
            <button
              className="btn-secondary"
              onClick={() => {
                setPromoCode("");
                setPromoApplied("");
                setDiscount(0);
              }}
            >
              Remove
            </button>
          ) : (
            <button className="btn-secondary" onClick={applyPromo}>
              Apply
            </button>
          )}
        </div>
        {promoError && <p className="text-red-500 text-xs mt-1">{promoError}</p>}
        {promoApplied && (
          <p className="text-green-600 text-xs mt-1">✓ Code applied successfully</p>
        )}
      </div>
    </div>
  );
}
