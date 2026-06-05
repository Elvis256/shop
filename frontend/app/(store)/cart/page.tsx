"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import ProductImage from "@/components/ProductImage";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, Tag, Shield, Package, Lock, Check, Truck, Bookmark, ShoppingCart, Star, Gift } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useShippingConfig } from "@/lib/hooks/useShippingConfig";
import FreeShippingBar from "@/components/FreeShippingBar";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface CartItem {
  id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    comparePrice?: number;
    images: { url: string }[];
    stock: number;
  };
}

interface Cart {
  id: string;
  items: CartItem[];
}

export default function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState<{ code: string; discount: number } | null>(null);
  const [couponError, setCouponError] = useState("");
  const { formatPrice } = useCurrency();
  const { config: shippingCfg } = useShippingConfig();
  const [reorderToast, setReorderToast] = useState("");

  // Save for Later
  interface SavedItem {
    id: string;
    productId: string;
    name: string;
    slug: string;
    price: number;
    imageUrl?: string;
    stock: number;
  }
  const [savedForLater, setSavedForLater] = useState<SavedItem[]>([]);

  // Gift wrapping per item (itemId -> { enabled, message })
  const [giftWrapping, setGiftWrapping] = useState<Record<string, { enabled: boolean; message: string }>>({});
  const GIFT_WRAP_PRICE = 5000;

  const toggleGiftWrap = (itemId: string) => {
    setGiftWrapping((prev) => ({
      ...prev,
      [itemId]: { enabled: !prev[itemId]?.enabled, message: prev[itemId]?.message || "" },
    }));
  };

  const setGiftMessage = (itemId: string, message: string) => {
    setGiftWrapping((prev) => ({
      ...prev,
      [itemId]: { enabled: prev[itemId]?.enabled || true, message },
    }));
  };

  // Frequently Bought Together
  interface FBTProduct {
    id: string;
    name: string;
    slug: string;
    price: number;
    imageUrl?: string;
  }
  const [fbtProducts, setFbtProducts] = useState<FBTProduct[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("savedForLater") || "[]");
      setSavedForLater(saved);
    } catch {}
  }, []);

  const saveForLater = (item: CartItem) => {
    const savedItem: SavedItem = {
      id: item.id,
      productId: item.product.id,
      name: item.product.name,
      slug: item.product.slug,
      price: Number(item.product.price),
      imageUrl: item.product.images?.[0]?.url,
      stock: item.product.stock,
    };
    const updated = [...savedForLater.filter((s) => s.productId !== savedItem.productId), savedItem];
    setSavedForLater(updated);
    localStorage.setItem("savedForLater", JSON.stringify(updated));
    removeItem(item.id);
  };

  const removeSavedItem = (productId: string) => {
    const updated = savedForLater.filter((s) => s.productId !== productId);
    setSavedForLater(updated);
    localStorage.setItem("savedForLater", JSON.stringify(updated));
  };

  const moveToCart = async (saved: SavedItem) => {
    try {
      let cartId = localStorage.getItem("cartId");
      if (!cartId) {
        const createRes = await fetch(`${API_URL}/api/cart/create`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include" });
        if (createRes.ok) {
          const createData = await createRes.json();
          cartId = createData.id;
          if (cartId) localStorage.setItem("cartId", cartId);
        }
      }
      if (!cartId) return;
      const res = await fetch(`${API_URL}/api/cart/${cartId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ productId: saved.productId, quantity: 1 }),
      });
      if (res.ok) {
        removeSavedItem(saved.productId);
        loadCart();
      }
    } catch {}
  };

  useEffect(() => {
    loadCart();
  }, []);

  // Load FBT when cart changes
  useEffect(() => {
    if (!cart?.items?.length) return;
    const productIds = cart.items.map((i) => i.product.id).slice(0, 2);
    fetch(`${API_URL}/api/products?limit=4&exclude=${productIds.join(",")}&sort=rating`)
      .then((r) => r.json())
      .then((data) => {
        const products = (data.products || []).slice(0, 4).map((p: any) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: Number(p.price),
          imageUrl: p.images?.[0]?.url || p.imageUrl,
        }));
        setFbtProducts(products);
      })
      .catch(() => {});
  }, [cart?.items?.length]);

  // Handle reorder URL param: ?reorder=productId:qty
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const reorder = params.get("reorder");
    if (!reorder) return;
    const [productId, qtyStr] = reorder.split(":");
    const qty = parseInt(qtyStr) || 1;
    if (!productId) return;

    (async () => {
      try {
        let cartId = localStorage.getItem("cartId");
        if (!cartId) {
          const createRes = await fetch(`${API_URL}/api/cart/create`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include" });
          if (createRes.ok) {
            const createData = await createRes.json();
            cartId = createData.id;
            if (cartId) localStorage.setItem("cartId", cartId);
          }
        }
        if (!cartId) return;
        const res = await fetch(`${API_URL}/api/cart/${cartId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ productId, quantity: qty }),
        });
        if (res.ok) {
          setReorderToast("Product added from your reorder link!");
          loadCart();
        }
      } catch { /* ignore */ }
    })();
    // Clean URL
    window.history.replaceState({}, "", "/cart");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadCart() {
    setError(null);
    try {
      const cartId = localStorage.getItem("cartId");
      if (!cartId) {
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_URL}/api/cart/${cartId}`);
      if (res.ok) {
        const data = await res.json();
        setCart(data);
      } else {
        setError("Failed to load your cart. Please try again.");
      }
    } catch (error) {
      console.error("Failed to load cart:", error);
      setError("Failed to load your cart. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function updateQuantity(itemId: string, quantity: number) {
    if (!cart || quantity < 1) return;
    
    setUpdating(itemId);
    try {
      const res = await fetch(`${API_URL}/api/cart/${cart.id}/items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });

      if (res.ok) {
        await loadCart();
      }
    } catch (error) {
      console.error("Failed to update quantity:", error);
    } finally {
      setUpdating(null);
    }
  }

  async function removeItem(itemId: string) {
    if (!cart) return;
    
    setUpdating(itemId);
    try {
      const res = await fetch(`${API_URL}/api/cart/${cart.id}/items/${itemId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await loadCart();
      }
    } catch (error) {
      console.error("Failed to remove item:", error);
    } finally {
      setUpdating(null);
    }
  }

  async function applyCoupon() {
    if (!couponCode.trim()) return;
    
    setCouponError("");
    try {
      const subtotal = calculateSubtotal();
      const res = await fetch(
        `${API_URL}/api/coupons/validate?code=${encodeURIComponent(couponCode)}&amount=${subtotal}`
      );
      
      if (res.ok) {
        const data = await res.json();
        setCouponApplied({ code: couponCode.toUpperCase(), discount: data.discount });
        setCouponCode("");
      } else {
        const error = await res.json();
        setCouponError(error.error || "Invalid coupon code");
      }
    } catch (error) {
      setCouponError("Failed to apply coupon");
    }
  }

  function calculateSubtotal() {
    if (!cart?.items) return 0;
    return cart.items.reduce((sum, item) => {
      const p = item.product as any;
      const hasFlash = p.flashSalePrice && p.flashSaleEndsAt && new Date(p.flashSaleEndsAt) > new Date();
      const effectivePrice = hasFlash ? Number(p.flashSalePrice) : Number(p.price);
      return sum + effectivePrice * item.quantity;
    }, 0);
  }

  function calculateSavings() {
    if (!cart?.items) return 0;
    return cart.items.reduce((sum, item) => {
      if (item.product.comparePrice && Number(item.product.comparePrice) > Number(item.product.price)) {
        return sum + (Number(item.product.comparePrice) - Number(item.product.price)) * item.quantity;
      }
      return sum;
    }, 0);
  }

  async function clearCart() {
    if (!cart) return;
    if (!window.confirm("Are you sure you want to clear your entire cart?")) return;
    setUpdating("all");
    try {
      await fetch(`${API_URL}/api/cart/${cart.id}/items`, { method: "DELETE" });
      await loadCart();
    } catch (error) {
      console.error("Failed to clear cart:", error);
    } finally {
      setUpdating(null);
    }
  }

  function calculateGiftWrapTotal() {
    return Object.values(giftWrapping).filter((g) => g.enabled).length * GIFT_WRAP_PRICE;
  }

  function calculateTotal() {
    const subtotal = calculateSubtotal();
    const discount = couponApplied?.discount || 0;
    const giftWrapTotal = calculateGiftWrapTotal();
    return Math.max(0, subtotal - discount + giftWrapTotal);
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-16">
        <p className="text-red-500 mb-4">{error}</p>
        <button onClick={loadCart} className="text-sm underline text-gray-600 hover:text-gray-900">
          Try again
        </button>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-16">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <ShoppingBag className="w-12 h-12 text-gray-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h1>
        <p className="text-gray-500 mb-8 text-center max-w-md">
          Looks like you haven't added anything yet. Explore our collection and find something you'll love.
        </p>
        <Link 
          href="/category" 
          className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-hover transition-colors"
        >
          Start Shopping
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  const subtotal = calculateSubtotal();
  const savings = calculateSavings();
  const total = calculateTotal();
  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Shopping Cart</h1>
            <p className="text-gray-500 mt-1">{itemCount} {itemCount === 1 ? 'item' : 'items'} in your cart</p>
          </div>
          <button
            onClick={clearCart}
            disabled={updating === "all"}
            className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Clear Cart
          </button>
        </div>

        {/* Reorder toast */}
        {reorderToast && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
            <Check className="w-4 h-4 flex-shrink-0" />
            {reorderToast}
            <button onClick={() => setReorderToast("")} className="ml-auto text-green-500 hover:text-green-700">&times;</button>
          </div>
        )}

        {/* Free Shipping Progress Bar */}
        <div className="mb-8">
          <FreeShippingBar
            cartTotal={subtotal}
            freeAbove={shippingCfg.freeThreshold}
            formatPrice={formatPrice}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {cart.items.map((item) => (
              <div
                key={item.id}
                className={`bg-white rounded-xl border border-gray-100 p-4 sm:p-6 transition-opacity ${
                  updating === item.id ? "opacity-50 pointer-events-none" : ""
                }`}
              >
                <div className="flex gap-4 sm:gap-6">
                  {/* Product Image */}
                  <Link 
                    href={`/product/${item.product.slug}`}
                    className="w-20 h-20 sm:w-28 sm:h-28 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 group"
                  >
                    <ProductImage
                      src={item.product.images?.[0]?.url}
                      alt={item.product.name}
                      width={112}
                      height={112}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </Link>

                  {/* Product Details */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/product/${item.product.slug}`}
                      className="font-semibold text-gray-900 hover:text-primary line-clamp-2 transition-colors"
                    >
                      {item.product.name}
                    </Link>
                    
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900">
                        {formatPrice(Number(item.product.price))}
                      </span>
                      {item.product.comparePrice && Number(item.product.comparePrice) > Number(item.product.price) && (
                        <span className="text-sm text-gray-400 line-through">
                          {formatPrice(Number(item.product.comparePrice))}
                        </span>
                      )}
                    </div>

                    {/* Quantity Controls - Mobile */}
                    <div className="mt-4 flex items-center justify-between sm:hidden">
                      <div className="flex items-center border border-gray-200 rounded-lg">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className="p-2 hover:bg-gray-100 disabled:opacity-50 rounded-l-lg transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-10 text-center font-medium text-sm">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={item.quantity >= item.product.stock}
                          className="p-2 hover:bg-gray-100 disabled:opacity-50 rounded-r-lg transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="font-bold text-gray-900">
                        {formatPrice(Number(item.product.price) * item.quantity)}
                      </p>
                    </div>

                    {item.product.stock <= 5 && (
                      <p className="mt-2 text-sm text-orange-600 font-medium">
                        Only {item.product.stock} left in stock!
                      </p>
                    )}

                    {/* Gift Wrapping */}
                    <div className="mt-3">
                      <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={giftWrapping[item.id]?.enabled || false}
                          onChange={() => toggleGiftWrap(item.id)}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <Gift className="w-3.5 h-3.5 text-pink-500" />
                        <span className="text-gray-600">Gift wrap (+{formatPrice(GIFT_WRAP_PRICE)})</span>
                      </label>
                      {giftWrapping[item.id]?.enabled && (
                        <input
                          type="text"
                          placeholder="Add a gift message (optional)"
                          value={giftWrapping[item.id]?.message || ""}
                          onChange={(e) => setGiftMessage(item.id, e.target.value)}
                          maxLength={150}
                          className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      )}
                    </div>
                  </div>

                  {/* Desktop: Quantity & Total */}
                  <div className="hidden sm:flex flex-col items-end justify-between">
                    <div className="flex items-center border border-gray-200 rounded-lg">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        className="p-2.5 hover:bg-gray-100 disabled:opacity-50 rounded-l-lg transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-12 text-center font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        disabled={item.quantity >= item.product.stock}
                        className="p-2.5 hover:bg-gray-100 disabled:opacity-50 rounded-r-lg transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">
                        {formatPrice(Number(item.product.price) * item.quantity)}
                      </p>
                      <div className="mt-1 flex items-center gap-3">
                        <button
                          onClick={() => saveForLater(item)}
                          className="text-sm text-gray-400 hover:text-primary transition-colors inline-flex items-center gap-1"
                        >
                          <Bookmark className="w-3.5 h-3.5" />
                          Save for Later
                        </button>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-sm text-gray-400 hover:text-red-500 transition-colors inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Mobile Remove Button */}
                  <button
                    onClick={() => removeItem(item.id)}
                    className="sm:hidden p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors self-start"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}

            {/* Continue Shopping Link */}
            <Link
              href="/category"
              className="inline-flex items-center gap-2 text-primary hover:text-primary-hover font-medium transition-colors"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
              Continue Shopping
            </Link>

            {/* Frequently Bought Together */}
            {fbtProducts.length > 0 && (
              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Customers Also Bought</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {fbtProducts.map((p) => (
                    <Link key={p.id} href={`/product/${p.slug}`} className="bg-white rounded-xl border border-gray-100 p-3 hover:shadow-md transition-shadow group">
                      <div className="aspect-square bg-gray-50 rounded-lg overflow-hidden mb-2">
                        <ProductImage
                          src={p.imageUrl}
                          alt={p.name}
                          width={120}
                          height={120}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <p className="text-xs font-medium text-gray-900 line-clamp-2">{p.name}</p>
                      <p className="text-sm font-bold text-primary mt-1">{formatPrice(p.price)}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Saved for Later */}
            {savedForLater.length > 0 && (
              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Bookmark className="w-5 h-5 text-primary" />
                  Saved for Later ({savedForLater.length})
                </h3>
                <div className="space-y-3">
                  {savedForLater.map((saved) => (
                    <div key={saved.productId} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
                      <Link href={`/product/${saved.slug}`} className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        {saved.imageUrl && <Image src={saved.imageUrl} alt={saved.name} width={64} height={64} className="w-full h-full object-cover" />}
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link href={`/product/${saved.slug}`} className="font-medium text-gray-900 hover:text-primary text-sm line-clamp-1">
                          {saved.name}
                        </Link>
                        <p className="text-sm font-bold text-gray-900 mt-1">{formatPrice(saved.price)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => moveToCart(saved)}
                          className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          Move to Cart
                        </button>
                        <button
                          onClick={() => removeSavedItem(saved.productId)}
                          className="text-sm text-gray-400 hover:text-red-500 ml-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-100 p-6 sticky top-24">
              <h2 className="text-lg font-bold text-gray-900 mb-6">Order Summary</h2>

              {/* Coupon Code */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Have a coupon?</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Enter code"
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  />
                  <button
                    onClick={applyCoupon}
                    className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Tag className="w-4 h-4" />
                  </button>
                </div>
                {couponError && (
                  <p className="text-sm text-red-500 mt-2">{couponError}</p>
                )}
                {couponApplied && (
                  <div className="mt-2 flex items-center justify-between bg-green-50 text-green-700 px-3 py-2 rounded-lg text-sm">
                    <span className="flex items-center gap-1">
                      <Check className="w-4 h-4" />
                      {couponApplied.code} applied!
                    </span>
                    <button
                      onClick={() => setCouponApplied(null)}
                      className="text-green-800 hover:underline text-xs"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3 text-sm border-t border-gray-100 pt-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatPrice(subtotal)}</span>
                </div>
                
                {savings > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>You Save</span>
                    <span className="font-medium">-{formatPrice(savings)}</span>
                  </div>
                )}

                {couponApplied && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-{formatPrice(couponApplied.discount)}</span>
                  </div>
                )}

                {calculateGiftWrapTotal() > 0 && (
                  <div className="flex justify-between text-pink-600">
                    <span className="flex items-center gap-1"><Gift className="w-3.5 h-3.5" /> Gift Wrapping</span>
                    <span>+{formatPrice(calculateGiftWrapTotal())}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping</span>
                  <span className="text-gray-500 text-xs">Calculated at checkout</span>
                </div>
                
                <div className="flex justify-between text-lg font-bold border-t border-gray-100 pt-4 mt-4">
                  <span>Total</span>
                  <span className="text-primary">{formatPrice(total)}</span>
                </div>
              </div>

              {/* Loyalty Points Preview */}
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                <p className="text-amber-800 font-medium flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-500" />
                  You&apos;ll earn <span className="font-bold">{Math.floor(subtotal / 1000)}</span> loyalty points with this purchase
                </p>
              </div>

              <Link
                href="/checkout"
                className="w-full mt-6 bg-primary text-white py-3.5 rounded-lg font-semibold hover:bg-primary-hover transition-colors flex items-center justify-center gap-2"
              >
                Proceed to Checkout
                <ArrowRight className="w-4 h-4" />
              </Link>

              {/* Trust Badges */}
              <div className="mt-6 pt-4 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Lock, label: "Secure Checkout" },
                    { icon: Package, label: "Discreet Packaging" },
                    { icon: Shield, label: "Privacy Protected" },
                    { icon: ArrowRight, label: "Easy Returns", rotate: true },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
                      <item.icon className={`w-4 h-4 text-green-500 ${item.rotate ? 'rotate-180' : ''}`} />
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
