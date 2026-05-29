"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Package, Plus, Minus, Trash2, ShoppingBag, Search, X, Tag, ArrowRight, Check } from "lucide-react";
import { api } from "@/lib/api";
import { useCart } from "@/lib/hooks/useCart";
import { useToast } from "@/lib/hooks/useToast";
import { useCurrency } from "@/contexts/CurrencyContext";
import ProductImage from "@/components/ProductImage";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  imageUrl: string | null;
  category: string | null;
  stock: number;
}

interface BoxItem {
  product: Product;
  quantity: number;
}

function getDiscountTier(totalItems: number) {
  if (totalItems >= 7) return { percent: 20, label: "7+ items: 20% off", next: null };
  if (totalItems >= 5) return { percent: 15, label: "5+ items: 15% off", next: { need: 7 - totalItems, percent: 20 } };
  if (totalItems >= 3) return { percent: 10, label: "3+ items: 10% off", next: { need: 5 - totalItems, percent: 15 } };
  return { percent: 0, label: "", next: { need: 3 - totalItems, percent: 10 } };
}

export default function BuildYourBoxPage() {
  const { addItem } = useCart();
  const { showToast } = useToast();
  const { formatPrice } = useCurrency();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [boxItems, setBoxItems] = useState<BoxItem[]>([]);
  const [addingToCart, setAddingToCart] = useState(false);

  useEffect(() => {
    api.getProducts({ limit: "50" })
      .then(res => {
        const prods = (res.products || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: Number(p.price),
          imageUrl: p.images?.[0]?.url || p.imageUrl || null,
          category: p.category?.name || null,
          stock: p.stock ?? 0,
        }));
        setProducts(prods);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filteredProducts = useMemo(() => {
    if (!search) return products;
    const q = search.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q)
    );
  }, [products, search]);

  const totalItems = boxItems.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = boxItems.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const tier = getDiscountTier(totalItems);
  const discountAmount = Math.round(subtotal * tier.percent / 100);
  const total = subtotal - discountAmount;

  const addToBox = (product: Product) => {
    setBoxItems(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setBoxItems(prev => {
      return prev.map(i => {
        if (i.product.id === productId) {
          const newQty = i.quantity + delta;
          return newQty > 0 ? { ...i, quantity: newQty } : i;
        }
        return i;
      }).filter(i => i.quantity > 0);
    });
  };

  const removeFromBox = (productId: string) => {
    setBoxItems(prev => prev.filter(i => i.product.id !== productId));
  };

  const handleAddAllToCart = async () => {
    if (boxItems.length === 0) return;
    setAddingToCart(true);
    try {
      for (const item of boxItems) {
        addItem({
          id: item.product.id,
          productId: item.product.id,
          name: item.product.name,
          slug: item.product.slug,
          price: item.product.price,
          imageUrl: item.product.imageUrl,
          stock: item.product.stock,
          quantity: item.quantity,
        });
      }
      showToast(`Added ${totalItems} items to cart with ${tier.percent}% discount!`, "success");
      setBoxItems([]);
    } catch {
      showToast("Failed to add items to cart", "error");
    }
    setAddingToCart(false);
  };

  const isInBox = (productId: string) => boxItems.some(i => i.product.id === productId);

  return (
    <div className="min-h-screen bg-bg">
      <div className="container py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Package className="w-4 h-4" /> Build Your Box
          </div>
          <h1 className="text-3xl font-bold text-text mb-2">Build Your Custom Box</h1>
          <p className="text-text-muted">Pick 3+ items and unlock discounts. The more you add, the more you save!</p>
        </div>

        {/* Discount tier indicator */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {[
            { items: "3-4", pct: 10 },
            { items: "5-6", pct: 15 },
            { items: "7+", pct: 20 },
          ].map(t => (
            <div key={t.pct} className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-colors ${
              tier.percent >= t.pct
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-text-muted"
            }`}>
              <Tag className="w-3.5 h-3.5 inline mr-1" />{t.items} items: {t.pct}% off
            </div>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Product grid */}
          <div className="flex-1">
            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-surface text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4 text-text-muted" />
                </button>
              )}
            </div>

            {loading ? (
              <div className="text-center py-12 text-text-muted">Loading products...</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {filteredProducts.map(product => (
                  <div key={product.id} className="bg-surface rounded-xl border border-border overflow-hidden group">
                    <Link href={`/product/${product.slug}`}>
                      <div className="aspect-square bg-gray-100 dark:bg-gray-800 relative overflow-hidden">
                        {product.imageUrl ? (
                          <ProductImage src={product.imageUrl} alt={product.name} fill className="object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-text-muted text-xs">No image</div>
                        )}
                      </div>
                    </Link>
                    <div className="p-3">
                      <h3 className="text-sm font-medium text-text line-clamp-1 mb-1">{product.name}</h3>
                      <p className="text-sm font-bold text-primary mb-2">{formatPrice(product.price)}</p>
                      <button
                        onClick={() => addToBox(product)}
                        className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                          isInBox(product.id)
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-primary/10 text-primary hover:bg-primary/20"
                        }`}
                      >
                        {isInBox(product.id) ? (
                          <span className="flex items-center justify-center gap-1"><Plus className="w-4 h-4" /> Add More</span>
                        ) : (
                          <span className="flex items-center justify-center gap-1"><Plus className="w-4 h-4" /> Add to Box</span>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sticky sidebar */}
          <div className="lg:w-80 flex-shrink-0">
            <div className="sticky top-20 bg-surface rounded-xl border border-border p-5">
              <h3 className="font-semibold text-text mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" /> Your Box ({totalItems} items)
              </h3>

              {boxItems.length === 0 ? (
                <p className="text-sm text-text-muted py-4">Add products to build your custom box.</p>
              ) : (
                <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                  {boxItems.map(item => (
                    <div key={item.product.id} className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0">
                        {item.product.imageUrl && (
                          <ProductImage src={item.product.imageUrl} alt={item.product.name} width={48} height={48} className="object-cover w-full h-full" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text truncate">{item.product.name}</p>
                        <p className="text-xs text-text-muted">{formatPrice(item.product.price)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQuantity(item.product.id, -1)} className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:bg-gray-100 dark:hover:bg-gray-800">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-medium w-5 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.product.id, 1)} className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:bg-gray-100 dark:hover:bg-gray-800">
                          <Plus className="w-3 h-3" />
                        </button>
                        <button onClick={() => removeFromBox(item.product.id)} className="w-6 h-6 rounded flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 ml-1">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pricing */}
              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Subtotal</span>
                  <span className="text-text">{formatPrice(subtotal)}</span>
                </div>
                {tier.percent > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount ({tier.percent}%)</span>
                    <span>-{formatPrice(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-lg border-t border-border pt-2">
                  <span>Total</span>
                  <span className="text-primary">{formatPrice(total)}</span>
                </div>
              </div>

              {/* Next tier nudge */}
              {tier.next && (
                <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm text-yellow-700 dark:text-yellow-400">
                  Add {tier.next.need} more item{tier.next.need > 1 ? "s" : ""} to unlock {tier.next.percent}% off!
                </div>
              )}

              {/* Add all to cart */}
              <button
                onClick={handleAddAllToCart}
                disabled={boxItems.length === 0 || addingToCart}
                className="w-full mt-4 py-3 bg-primary text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingToCart ? (
                  "Adding..."
                ) : (
                  <>
                    <ShoppingBag className="w-5 h-5" /> Add All to Cart
                    {tier.percent > 0 && <span className="bg-white/20 px-2 py-0.5 rounded text-xs">{tier.percent}% off</span>}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
