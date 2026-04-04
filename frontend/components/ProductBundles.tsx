"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Package, Plus, ShoppingCart, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCart } from "@/lib/hooks/useCart";
import { useToast } from "@/lib/hooks/useToast";

interface BundleProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  imageUrl: string | null;
}

interface Bundle {
  id: string;
  name: string;
  products: BundleProduct[];
  originalTotal: number;
  bundlePrice: number;
  discount: number;
}

interface ProductBundlesProps {
  productId: string;
}

export default function ProductBundles({ productId }: ProductBundlesProps) {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const { formatPrice } = useCurrency();
  const { addItem } = useCart();
  const { showToast } = useToast();

  useEffect(() => {
    apiFetch(`/api/bundles/for-product/${productId}`)
      .then((data: any) => setBundles(data.bundles || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [productId]);

  const handleAddBundle = (bundle: Bundle) => {
    setAddingId(bundle.id);
    bundle.products.forEach((p) => {
      addItem({
        id: p.id,
        productId: p.id,
        name: p.name,
        slug: p.slug,
        price: Number(p.price),
        imageUrl: p.imageUrl,
      });
    });
    showToast("Bundle added to cart!", "success");
    setTimeout(() => setAddingId(null), 800);
  };

  if (loading || bundles.length === 0) return null;

  return (
    <div className="mt-10">
      <div className="flex items-center gap-2 mb-6">
        <Package className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold text-gray-900">Buy Together &amp; Save</h2>
      </div>
      <div className="space-y-6">
        {bundles.map((bundle) => {
          const savingsPercent = Math.round(((bundle.originalTotal - bundle.bundlePrice) / bundle.originalTotal) * 100);
          return (
            <div key={bundle.id} className="border rounded-xl p-5 bg-white">
              <h3 className="text-sm font-medium text-gray-900 mb-4">{bundle.name}</h3>
              <div className="flex items-center gap-3 overflow-x-auto pb-2">
                {bundle.products.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3">
                    {i > 0 && <Plus className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                    <div className="flex-shrink-0 w-20">
                      <div className="aspect-square rounded-lg overflow-hidden bg-gray-50 mb-1.5">
                        {p.imageUrl ? (
                          <Image src={p.imageUrl} alt={p.name} width={80} height={80} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <Package className="w-6 h-6" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-700 truncate">{p.name}</p>
                      <p className="text-xs text-gray-500">{formatPrice(p.price)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold text-gray-900">{formatPrice(bundle.bundlePrice)}</span>
                    <span className="text-sm text-gray-400 line-through">{formatPrice(bundle.originalTotal)}</span>
                  </div>
                  {savingsPercent > 0 && (
                    <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-md">
                      Save {savingsPercent}%
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleAddBundle(bundle)}
                  disabled={addingId === bundle.id}
                  className="px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-full hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {addingId === bundle.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="w-4 h-4" />
                  )}
                  Add Bundle to Cart
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
