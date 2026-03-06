"use client";

import { useState } from "react";
import { useCart } from "@/lib/hooks/useCart";
import { useCurrency } from "@/contexts/CurrencyContext";
import Image from "next/image";
import { Plane, Zap, Truck, Tag, Minus, Plus, Trash2 } from "lucide-react";

const FREE_SHIPPING_THRESHOLD = 100000;
const LOCAL_SHIPPING_FEE = 5000;

export default function OrderSummary() {
  const { items, total, updateQuantity, removeItem } = useCart();
  const { formatPrice } = useCurrency();
  const [promoCode, setPromoCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [promoError, setPromoError] = useState("");
  const [promoApplied, setPromoApplied] = useState("");

  const hasInternational = items.some((i) => i.shippingBadge === "From Abroad");
  const hasLocal = items.some((i) => i.shippingBadge !== "From Abroad");
  const localTotal = items
    .filter((i) => i.shippingBadge !== "From Abroad")
    .reduce((s, i) => s + i.price * i.quantity, 0);

  const localShipping = localTotal >= FREE_SHIPPING_THRESHOLD || !hasLocal ? 0 : LOCAL_SHIPPING_FEE;
  const internationalShipping = 0; // Included in product price for dropship items
  const shipping = localShipping + internationalShipping;
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
      <div className="space-y-4 mb-6 max-h-80 overflow-y-auto pr-1">
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
              <div className="flex items-center gap-2 mt-1">
                {item.shippingBadge === "From Abroad" ? (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                    <Plane className="w-2.5 h-2.5" />Intl
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                    <Zap className="w-2.5 h-2.5" />Express
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <button
                  onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                  className="w-6 h-6 flex items-center justify-center rounded border border-border hover:bg-gray-100 transition-colors"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-small font-medium w-6 text-center">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                  className="w-6 h-6 flex items-center justify-center rounded border border-border hover:bg-gray-100 transition-colors"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <button
                  onClick={() => removeItem(item.productId)}
                  className="w-6 h-6 flex items-center justify-center rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors ml-1"
                  aria-label="Remove item"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
            <p className="font-medium text-small whitespace-nowrap">
              {formatPrice(item.price * item.quantity)}
            </p>
          </div>
        ))}
      </div>

      {/* Delivery Estimates */}
      <div className="space-y-2 mb-4 pb-4 border-b border-border">
        {hasLocal && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">
            <Zap className="w-3.5 h-3.5 flex-shrink-0" />
            <span><strong>Express items:</strong> 1–3 days in Kampala</span>
          </div>
        )}
        {hasInternational && (
          <div className="flex items-center gap-2 text-xs text-indigo-700 bg-indigo-50 px-3 py-2 rounded-lg">
            <Plane className="w-3.5 h-3.5 flex-shrink-0" />
            <span><strong>International items:</strong> 7–21 days shipping</span>
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="space-y-2 text-small">
        <div className="flex justify-between">
          <span className="text-text-muted">Subtotal</span>
          <span>{formatPrice(total)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount ({promoApplied})</span>
            <span>-{formatPrice(discount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-text-muted flex items-center gap-1">
            <Truck className="w-3.5 h-3.5" />Shipping
          </span>
          {shipping === 0 ? (
            <span className="text-green-600 font-medium">Free</span>
          ) : (
            <span>{formatPrice(shipping)}</span>
          )}
        </div>
        {hasLocal && localShipping === 0 && (
          <p className="text-xs text-green-600">
            ✓ Free local shipping on orders over {formatPrice(FREE_SHIPPING_THRESHOLD)}
          </p>
        )}
        {hasInternational && (
          <p className="text-xs text-indigo-600">
            ✓ International shipping included in price
          </p>
        )}
        <div className="flex justify-between pt-3 border-t border-border font-semibold text-base">
          <span>Total</span>
          <span>{formatPrice(finalTotal)}</span>
        </div>
      </div>

      {/* Promo Code */}
      <div className="mt-5 pt-4 border-t border-border">
        <label className="flex items-center gap-1.5 text-xs font-medium text-text-muted mb-2">
          <Tag className="w-3 h-3" />Promo Code
        </label>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Enter code"
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
