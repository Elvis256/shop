"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Section from "@/components/Section";
import Breadcrumbs from "@/components/Breadcrumbs";
import EmptyState from "@/components/EmptyState";
import { useWishlist } from "@/lib/hooks/useWishlist";
import { useCart } from "@/lib/hooks/useCart";
import { useToast } from "@/lib/hooks/useToast";
import { useAuth } from "@/lib/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { api } from "@/lib/api";
import { Heart, Trash2, ShoppingCart, Lock, X, Share2, Grid, List, Plus, FolderPlus } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

export default function WishlistPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { items: localItems, removeItem, clearWishlist } = useWishlist();
  const { addItem: addToCart } = useCart();
  const { showToast } = useToast();
  const { formatPrice } = useCurrency();
  
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // For authenticated users with PIN protection
  const [serverItems, setServerItems] = useState<any[]>([]);
  const [hasPin, setHasPin] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [pinError, setPinError] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Collections
  const [collections, setCollections] = useState<string[]>([]);
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");

  // Check if user has PIN-protected wishlist
  useEffect(() => {
    if (user) {
      checkPinStatus();
    }
  }, [user]);

  const checkPinStatus = async () => {
    setLoading(true);
    try {
      const { hasPin: hasPinSet } = await api.getWishlistPinStatus();
      setHasPin(hasPinSet);
      if (!hasPinSet) {
        setPinVerified(true);
        await loadCollections();
        await loadServerWishlist();
      }
    } catch (error) {
      console.error("Error checking PIN:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadCollections = async () => {
    try {
      const csrf = getCsrfToken();
      const headers: Record<string, string> = {};
      if (csrf) headers["x-csrf-token"] = csrf;
      const res = await fetch(`${API_URL}/api/wishlist/collections`, {
        credentials: "include",
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setCollections(data.collections || []);
      }
    } catch (error) {
      console.error("Error loading collections:", error);
    }
  };

  const loadServerWishlist = async (collection?: string | null) => {
    try {
      const params = collection ? `?collection=${encodeURIComponent(collection)}` : "";
      const csrf = getCsrfToken();
      const headers: Record<string, string> = {};
      if (csrf) headers["x-csrf-token"] = csrf;
      const res = await fetch(`${API_URL}/api/wishlist${params}`, {
        credentials: "include",
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setServerItems(data.items || []);
      }
    } catch (error) {
      console.error("Error loading wishlist:", error);
    }
  };

  const handleCollectionChange = async (collection: string | null) => {
    setActiveCollection(collection);
    await loadServerWishlist(collection);
  };

  const handleCreateCollection = async () => {
    const trimmed = newCollectionName.trim();
    if (!trimmed) return;
    if (collections.includes(trimmed)) {
      showToast("Collection already exists", "error");
      return;
    }
    setCollections((prev) => [...prev, trimmed]);
    setActiveCollection(trimmed);
    setNewCollectionName("");
    setShowNewCollection(false);
    await loadServerWishlist(trimmed);
    showToast(`Collection "${trimmed}" created`, "success");
  };

  const handlePinInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newPinArray = [...pin];
    newPinArray[index] = value.slice(-1);
    setPin(newPinArray);
    setPinError("");

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    const fullPin = newPinArray.join("");
    if (fullPin.length >= 4 && newPinArray.slice(0, fullPin.length).every(d => d)) {
      verifyPin(fullPin);
    }
  };

  const verifyPin = async (enteredPin: string) => {
    try {
      await api.verifyWishlistPin(enteredPin);
      setPinVerified(true);
      await loadCollections();
      await loadServerWishlist();
    } catch {
      setPinError("Invalid PIN. Please try again.");
      setPin(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    }
  };

  const handleAddToCart = (item: any) => {
    addToCart({
      id: item.productId,
      productId: item.productId,
      name: item.name,
      slug: item.slug,
      price: item.price,
      imageUrl: item.imageUrl,
    });
    showToast("Added to cart!", "success");
  };

  const handleRemove = (productId: string) => {
    removeItem(productId);
    showToast("Removed from wishlist", "info");
  };

  const handleClearAll = () => {
    clearWishlist();
    setShowClearConfirm(false);
    showToast("Wishlist cleared", "info");
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: "My Wishlist", url });
    } else {
      await navigator.clipboard.writeText(url);
      showToast("Link copied to clipboard!", "success");
    }
  };

  // Use local items for non-authenticated users, server items for authenticated
  const displayItems: Array<{
    productId: string;
    name: string;
    slug: string;
    price: number;
    imageUrl: string | null;
    addedAt: string;
    inStock?: boolean;
    comparePrice?: number;
    collectionName?: string;
  }> = user && hasPin ? serverItems.map(item => ({
    productId: item.product.id,
    name: item.product.name,
    slug: item.product.slug,
    price: parseFloat(item.product.price),
    imageUrl: item.product.imageUrl,
    addedAt: item.addedAt,
    inStock: item.product.inStock,
    comparePrice: item.product.comparePrice ? parseFloat(item.product.comparePrice) : undefined,
    collectionName: item.collectionName,
  })) : user ? serverItems.map(item => ({
    productId: item.product.id,
    name: item.product.name,
    slug: item.product.slug,
    price: parseFloat(item.product.price),
    imageUrl: item.product.imageUrl,
    addedAt: item.addedAt,
    inStock: item.product.inStock,
    comparePrice: item.product.comparePrice ? parseFloat(item.product.comparePrice) : undefined,
    collectionName: item.collectionName,
  })) : localItems.map(item => ({ ...item, collectionName: undefined }));

  const showCollections = user && collections.length > 0;

  // PIN Entry Screen for authenticated users
  if (user && hasPin && !pinVerified) {
    return (
      <Section>
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border p-8 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Enter PIN</h1>
            <p className="text-gray-500 mb-6">Your wishlist is protected with a PIN</p>

            <div className="flex justify-center gap-2 mb-6">
              {pin.map((digit, index) => (
                <input
                  key={index}
                  ref={el => { inputRefs.current[index] = el; }}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handlePinInput(index, e.target.value)}
                  className="w-12 h-14 text-center text-2xl font-bold border-2 rounded-xl focus:border-primary focus:outline-none transition-colors"
                />
              ))}
            </div>

            {pinError && (
              <p className="text-red-500 text-sm mb-4">{pinError}</p>
            )}

            <p className="text-sm text-gray-400">Enter your 4-6 digit PIN</p>
          </div>
        </div>
      </Section>
    );
  }

  return (
    <Section>
      <div className="max-w-6xl mx-auto">
        <Breadcrumbs items={[{ label: "Wishlist" }]} />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Wishlist</h1>
            <p className="text-gray-500 mt-1">{displayItems.length} saved items</p>
          </div>
          
          {displayItems.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleShare}
                className="p-2 text-gray-500 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                title="Share wishlist"
              >
                <Share2 className="w-5 h-5" />
              </button>
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded-md transition-colors ${viewMode === "grid" ? "bg-white shadow-sm" : "hover:bg-gray-200"}`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded-md transition-colors ${viewMode === "list" ? "bg-white shadow-sm" : "hover:bg-gray-200"}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={() => setShowClearConfirm(true)}
                className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* Collections Tabs (for authenticated users) */}
        {user && (
          <div className="mb-6">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleCollectionChange(null)}
                className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                  activeCollection === null
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                All
              </button>
              {collections.map((col) => (
                <button
                  key={col}
                  onClick={() => handleCollectionChange(col)}
                  className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                    activeCollection === col
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {col}
                </button>
              ))}
              {showNewCollection ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Collection name"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateCollection()}
                    className="px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                    autoFocus
                  />
                  <button
                    onClick={handleCreateCollection}
                    className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => { setShowNewCollection(false); setNewCollectionName(""); }}
                    className="p-1.5 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewCollection(true)}
                  className="flex items-center gap-1 px-4 py-2 text-sm rounded-lg border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
                >
                  <FolderPlus className="w-4 h-4" />
                  New Collection
                </button>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {displayItems.length === 0 ? (
          <div className="bg-white rounded-2xl border p-8">
            <EmptyState 
              type="wishlist"
              action={{
                label: "Browse Products",
                href: "/category"
              }}
            />
          </div>
        ) : (
          <>
            {/* Grid View */}
            {viewMode === "grid" && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {displayItems.map((item) => (
                  <div key={item.productId + (item.collectionName || "")} className="bg-white rounded-xl border overflow-hidden group hover:shadow-lg transition-shadow">
                    <Link href={`/product/${item.slug}`} className="block">
                      <div className="aspect-square bg-gray-100 relative overflow-hidden">
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={item.name}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                            <Heart className="w-12 h-12 text-gray-300" />
                          </div>
                        )}
                        {item.collectionName && item.collectionName !== "Wishlist" && (
                          <span className="absolute top-2 left-2 px-2 py-0.5 text-xs bg-white/90 rounded-full text-gray-600">
                            {item.collectionName}
                          </span>
                        )}
                      </div>
                    </Link>
                    <div className="p-4">
                      <Link href={`/product/${item.slug}`}>
                        <h3 className="font-medium text-gray-900 hover:text-primary transition-colors line-clamp-2 mb-2">
                          {item.name}
                        </h3>
                      </Link>
                      <div className="flex items-center gap-2 mb-4">
                        <span className="font-bold text-gray-900">{formatPrice(item.price)}</span>
                        {item.comparePrice && (
                          <span className="text-sm text-gray-400 line-through">{formatPrice(item.comparePrice)}</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAddToCart(item)}
                          className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-2.5 px-3 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                        >
                          <ShoppingCart className="w-4 h-4" />
                          Add to Cart
                        </button>
                        <button
                          onClick={() => handleRemove(item.productId)}
                          className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* List View */}
            {viewMode === "list" && (
              <div className="space-y-4">
                {displayItems.map((item) => (
                  <div key={item.productId + (item.collectionName || "")} className="bg-white rounded-xl border p-4 flex gap-4 hover:shadow-lg transition-shadow">
                    <Link href={`/product/${item.slug}`} className="flex-shrink-0">
                      <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gray-100 rounded-lg overflow-hidden relative">
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={item.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Heart className="w-8 h-8 text-gray-300" />
                          </div>
                        )}
                      </div>
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/product/${item.slug}`}>
                          <h3 className="font-medium text-gray-900 hover:text-primary transition-colors mb-1">
                            {item.name}
                          </h3>
                        </Link>
                        {item.collectionName && item.collectionName !== "Wishlist" && (
                          <span className="flex-shrink-0 px-2 py-0.5 text-xs bg-gray-100 rounded-full text-gray-500">
                            {item.collectionName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="font-bold text-lg text-gray-900">{formatPrice(item.price)}</span>
                        {item.comparePrice && (
                          <span className="text-sm text-gray-400 line-through">{formatPrice(item.comparePrice)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAddToCart(item)}
                          className="flex items-center gap-2 bg-primary text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                        >
                          <ShoppingCart className="w-4 h-4" />
                          Add to Cart
                        </button>
                        <button
                          onClick={() => handleRemove(item.productId)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Clear Confirmation Modal */}
        {showClearConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 animate-fade-in">
              <div className="text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Clear Wishlist?</h3>
                <p className="text-gray-500 mb-6">This will remove all {displayItems.length} items from your wishlist.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
