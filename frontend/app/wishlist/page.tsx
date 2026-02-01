"use client";

import { useState } from "react";
import Section from "@/components/Section";
import ProductCard from "@/components/ProductCard";
import { products } from "@/lib/data";
import { Lock, Unlock } from "lucide-react";

export default function WishlistPage() {
  const [isLocked, setIsLocked] = useState(true);
  const [pin, setPin] = useState("");
  const correctPin = "1234";

  const handleUnlock = () => {
    if (pin === correctPin) {
      setIsLocked(false);
    } else {
      alert("Incorrect PIN");
    }
  };

  if (isLocked) {
    return (
      <Section title="My Wishlist">
        <div className="max-w-md mx-auto text-center py-16">
          <Lock className="w-16 h-16 mx-auto mb-6 text-text-muted" />
          <h2 className="mb-4">Wishlist is Locked</h2>
          <p className="text-text-muted mb-6">
            Enter your PIN to access your private wishlist.
          </p>
          <div className="space-y-4">
            <input
              type="password"
              className="input text-center text-2xl tracking-widest"
              placeholder="• • • •"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            />
            <button onClick={handleUnlock} className="btn-primary w-full">
              <Unlock className="w-5 h-5 mr-2" />
              Unlock Wishlist
            </button>
          </div>
          <p className="text-small text-text-muted mt-4">Demo PIN: 1234</p>
        </div>
      </Section>
    );
  }

  return (
    <Section title="My Wishlist">
      <div className="flex justify-between items-center mb-8">
        <p className="text-text-muted">
          {products.length} items saved
        </p>
        <button
          onClick={() => setIsLocked(true)}
          className="btn-secondary text-small gap-2"
        >
          <Lock className="w-4 h-4" />
          Lock Wishlist
        </button>
      </div>

      <div className="grid-products">
        {products.slice(0, 4).map((product) => (
          <ProductCard key={product.slug} {...product} showWishlistRemove />
        ))}
      </div>
    </Section>
  );
}
