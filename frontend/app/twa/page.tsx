"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import Script from "next/script";
import { useAuth } from "@/lib/hooks/useAuth";
import { useCart } from "@/lib/hooks/useCart";
import { useToast } from "@/lib/hooks/useToast";
import { useTheme } from "@/lib/hooks/useTheme";
import { api } from "@/lib/api";
import { 
  ShoppingBag, 
  Search, 
  User as UserIcon, 
  ChevronRight, 
  Plus, 
  Minus, 
  Trash2, 
  X, 
  Check, 
  Loader2,
  Sparkles,
  ShoppingBag as CartIcon,
  Info,
  CreditCard,
  Truck,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Package,
  Calendar,
  MapPin,
  PlusCircle,
  Heart,
  Star,
  Tag,
  Terminal,
  Copy,
  Gift,
  Clock,
  MessageCircle,
  Smartphone,
  ArrowLeft,
  AlertCircle,
  ChevronDown,
  Mail,
  RefreshCw,
  SlidersHorizontal,
  Sliders,
  Scissors,
  Calculator,
  ThumbsUp,
  AlertTriangle,
  Shield,
  PiggyBank,
  FileText,
  ShoppingCart
} from "lucide-react";

interface TelegramUser {
  id: string;
  telegramChatId: string;
  telegramUserId?: string;
  ageVerified: boolean;
}

export default function TwaStorefront() {
  const { user, login, register, checkAuth, logout } = useAuth();
  const { items, itemCount, total, addItem, updateQuantity, removeItem, clearCart } = useCart();
  const { showToast } = useToast();
  const { resolvedTheme, setTheme } = useTheme();

  // Payment polling ref
  const pollingRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingCancelRef = React.useRef(false);

  // Cleanup polling on unmount
  React.useEffect(() => {
    return () => {
      pollingCancelRef.current = true;
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
  }, []);

  // Debug Logger states
  const [logs, setLogs] = useState<Array<{ timestamp: string; message: string; type: "info" | "success" | "error" | "warning" }>>([]);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [showDebugControl, setShowDebugControl] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const isDebugParam = params.get("debug") === "true";
      const isDev = process.env.NODE_ENV !== "production";
      setShowDebugControl(isDebugParam || isDev);
    }
  }, []);

  const addLog = (message: string, type: "info" | "success" | "error" | "warning" = "info") => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
    if (type === "error") {
      console.error(`[TWA] [${type.toUpperCase()}] ${message}`);
    } else {
      console.log(`[TWA] [${type.toUpperCase()}] ${message}`);
    }
  };

  // Enhanced Checkout states
  const [pickupPoints, setPickupPoints] = useState<any[]>([]);
  const [selectedPickupPointId, setSelectedPickupPointId] = useState<string>("");
  const [allowedDeliveryMethods, setAllowedDeliveryMethods] = useState<string[]>(["HOME_DELIVERY", "PICKUP", "SELLER_PICKUP"]);
  const [codAllowedByProducts, setCodAllowedByProducts] = useState<boolean>(true);
  const [sellerPickupInfo, setSellerPickupInfo] = useState<any>(null);

  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");

  const [storeCreditBalance, setStoreCreditBalance] = useState(0);
  const [storeCreditAmount, setStoreCreditAmount] = useState(0);
  const [storeCreditApplied, setStoreCreditApplied] = useState(false);

  const [loyaltyBalance, setLoyaltyBalance] = useState(0);
  const [loyaltyRedeem, setLoyaltyRedeem] = useState(0);
  const [loyaltyApplied, setLoyaltyApplied] = useState(false);

  const [giftCardCodeInput, setGiftCardCodeInput] = useState("");
  const [giftCardBalance, setGiftCardBalance] = useState(0);
  const [giftCardApplied, setGiftCardApplied] = useState(false);
  const [giftCardLoading, setGiftCardLoading] = useState(false);
  const [giftCardDiscount, setGiftCardDiscount] = useState(0);

  const [installmentsEnabled, setInstallmentsEnabled] = useState(false);
  const [installmentCount, setInstallmentCount] = useState(2);

  // Additional checkout fields (matching main site)
  const [shippingEmail, setShippingEmail] = useState("");
  const [shippingCounty, setShippingCounty] = useState("");
  const [shippingPostalCode, setShippingPostalCode] = useState("");
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState("");
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [taxInfo, setTaxInfo] = useState<{ taxName: string | null; taxRate: number; taxAmount: number } | null>(null);
  const [paymentPending, setPaymentPending] = useState(false);
  const [paymentPendingPhone, setPaymentPendingPhone] = useState("");
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [usingSavedAddress, setUsingSavedAddress] = useState(false);

  // Idempotency key (stable per checkout session, regenerated on payment changes)
  const idempotencyKeyRef = useRef(`twa_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`);

  // Navigation state
  const [activeTab, setActiveTab] = useState<"catalog" | "deals" | "wishlist" | "orders" | "profile">("catalog");

  // Telegram Web App SDK context
  const [tgSdk, setTgSdk] = useState<any>(null);
  const [initDataStr, setInitDataStr] = useState<string>("");

  // Store states
  const [isInitializing, setIsInitializing] = useState(true);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [telegramUserId, setTelegramUserId] = useState<string>("");

  // Catalog states
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [loadingProductDetail, setLoadingProductDetail] = useState(false);

  // Wishlist state
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [loadingWishlist, setLoadingWishlist] = useState(false);

  // Selected Product variants
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});

  // Authentication states
  const [authTab, setAuthTab] = useState<"guest" | "login" | "register">("guest");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Cart / Checkout drawer states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<"cart" | "shipping" | "payment" | "success">("cart");
  
  // Checkout Form states
  const [shippingName, setShippingName] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingCity, setShippingCity] = useState("Kampala");
  const [deliveryMethod, setDeliveryMethod] = useState<"home" | "pickup" | "seller_pickup">("home");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "mobile_money">("cod");
  const [momoNetwork, setMomoNetwork] = useState<"MTN" | "AIRTEL">("MTN");
  const [momoPhone, setMomoPhone] = useState("");
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<any>(null);

  // Orders tab states
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any | null>(null);
  const [loadingOrderDetailId, setLoadingOrderDetailId] = useState<string | null>(null);

  // Catalog sorting & filtering states
  const [sortBy, setSortBy] = useState<"featured" | "price-asc" | "price-desc" | "rating" | "newest">("featured");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [minRating, setMinRating] = useState<number | null>(null);
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [shippingFilter, setShippingFilter] = useState<"ALL" | "EXPRESS" | "ABROAD">("ALL");
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);

  // Orders modifications & escrow states
  const [escrow, setEscrow] = useState<any | null>(null);
  const [confirmingDelivery, setConfirmingDelivery] = useState<boolean>(false);
  const [deliveryConfirmed, setDeliveryConfirmed] = useState<boolean>(false);
  const [showModifyOrder, setShowModifyOrder] = useState<boolean>(false);
  const [modifyOrderAddress, setModifyOrderAddress] = useState<string>("");
  const [modifyOrderNotes, setModifyOrderNotes] = useState<string>("");
  const [isModifyingOrder, setIsModifyingOrder] = useState<boolean>(false);
  const [isCancellingOrder, setIsCancellingOrder] = useState<boolean>(false);

  // Deals tab states
  const [activeDealsSubTab, setActiveDealsSubTab] = useState<"group-buy" | "price-slash" | "box-builder">("group-buy");
  const [activeGroupBuys, setActiveGroupBuys] = useState<any[]>([]);
  const [loadingGroupBuys, setLoadingGroupBuys] = useState<boolean>(false);
  const [myPriceSlashes, setMyPriceSlashes] = useState<any[]>([]);
  const [loadingPriceSlashes, setLoadingPriceSlashes] = useState<boolean>(false);
  const [boxItems, setBoxItems] = useState<any[]>([]);
  const [joiningGroupId, setJoiningGroupId] = useState<string | null>(null);
  const [startingSlashId, setStartingSlashId] = useState<string | null>(null);

  // Profile tab states
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [newStreet, setNewStreet] = useState("");
  const [newCity, setNewCity] = useState("Kampala");
  const [isAddingAddress, setIsAddingAddress] = useState(false);

  // Load Telegram SDK and sync theme
  useEffect(() => {
    addLog("Initializing Telegram Mini App...", "info");
    if (typeof window !== "undefined") {
      if ((window as any).Telegram?.WebApp) {
        const tg = (window as any).Telegram.WebApp;
        setTgSdk(tg);
        tg.ready();
        tg.expand();
        addLog("Telegram WebApp SDK loaded successfully.", "success");
        
        const initData = tg.initData || "";
        setInitDataStr(initData);
        if (initData) {
          addLog("Telegram initData payload extracted.", "info");
        } else {
          addLog("No Telegram initData payload found (running outside Telegram?).", "warning");
        }
        
        const tgColorScheme = tg.colorScheme;
        addLog(`Telegram theme sync: ${tgColorScheme || "default"}`, "info");
        if (tgColorScheme === "light" || tgColorScheme === "dark") {
          setTheme(tgColorScheme);
        }
      } else {
        addLog("Telegram WebApp SDK not found on window object.", "warning");
      }
    }
  }, [setTheme]);

  // Read URL search params
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const search = params.get("search");
      if (search) {
        addLog(`Search query passed via URL: "${search}"`, "info");
        setSearchQuery(search);
      }
    }
  }, []);

  // Run TWA authentication when initData is ready
  useEffect(() => {
    if (!initDataStr) {
      const timer = setTimeout(() => {
        if (isInitializing) {
          addLog("Initializing with guest fallback due to missing initData.", "info");
          setIsInitializing(false);
        }
      }, 1500);
      return () => clearTimeout(timer);
    }

    const authenticateTwa = async () => {
      addLog("Authenticating Telegram Mini App user session with backend...", "info");
      try {
        const res = await api.telegramTwaLogin(initDataStr);
        addLog(`TWA Login response success: ${res.success}`, "success");
        if (res.success) {
          setTelegramUserId(res.telegramUserId || "");
          addLog(`Telegram User ID: ${res.telegramUserId || "Not provided"}`, "info");
          if (res.authenticated && res.user) {
            addLog(`TWA Session authenticated! Logged in as: ${res.user.email}`, "success");
            await checkAuth();
            showToast(`Welcome back, ${res.user.name || "Member"}!`, "success");
          } else {
            addLog("TWA user is unlinked/guest. Prompting login/register conversion.", "info");
            setAuthTab("guest");
          }
        }
      } catch (err: any) {
        addLog(`TWA Authentication failed: ${err.message || err}`, "error");
        showToast("Session verification failed. Browsing as Guest.", "warning");
        setIsGuestMode(true);
      } finally {
        setIsInitializing(false);
      }
    };

    authenticateTwa();
  }, [initDataStr]);

  // Load Catalog Data
  useEffect(() => {
    if (isInitializing) return;

    const loadCatalog = async () => {
      addLog("Fetching categories and products catalog...", "info");
      setLoadingProducts(true);
      try {
        const catRes = await fetch("/api/categories");
        if (catRes.ok) {
          const catData = await catRes.json();
          setCategories(catData.categories || []);
          addLog(`Successfully loaded ${catData.categories?.length || 0} categories.`, "success");
        }

        const prodRes = await api.getProducts({ limit: "50", status: "ACTIVE" });
        setProducts(prodRes.products || []);
        addLog(`Successfully loaded ${prodRes.products?.length || 0} products from catalog.`, "success");
      } catch (err: any) {
        addLog(`Error loading catalog data: ${err.message || err}`, "error");
        showToast("Error loading products catalog", "error");
      } finally {
        setLoadingProducts(false);
      }
    };

    loadCatalog();
  }, [isInitializing]);

  // Fetch pickup points for dropdown
  useEffect(() => {
    addLog("Fetching pickup points from server...", "info");
    fetch("/api/pickup-points")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setPickupPoints(data);
          addLog(`Loaded ${data.length} active pickup points.`, "success");
        }
      })
      .catch(err => {
        addLog(`Failed to fetch pickup points: ${err.message || err}`, "error");
      });
  }, []);

  // Fetch store credit + loyalty balance and addresses for authenticated users
  useEffect(() => {
    if (user) {
      addLog("User logged in. Fetching store credit and loyalty point balances...", "info");
      
      // Prefill customer name, phone, and email
      setShippingName(user.name || "");
      setShippingPhone(user.phone || "");
      setShippingEmail(user.email || "");

      // Fetch balances
      fetch("/api/store-credit", { credentials: "include" })
        .then(res => res.json())
        .then(data => {
          if (data && typeof data.balance === "number") {
            setStoreCreditBalance(data.balance);
            addLog(`Store credit balance loaded: ${data.balance} UGX`, "success");
          }
        })
        .catch(err => addLog(`Failed to load store credit: ${err.message || err}`, "error"));

      fetch("/api/loyalty/balance", { credentials: "include" })
        .then(res => res.json())
        .then(data => {
          if (data && typeof data.points === "number") {
            setLoyaltyBalance(data.points);
            addLog(`Loyalty points balance loaded: ${data.points} points`, "success");
          }
        })
        .catch(err => addLog(`Failed to load loyalty points: ${err.message || err}`, "error"));

      // Fetch saved addresses to pre-fill
      api.getAddresses()
        .then(data => {
          const addrs = Array.isArray(data) ? data : (Array.isArray((data as any)?.addresses) ? (data as any).addresses : []);
          setAddresses(addrs);
          setSavedAddresses(addrs);
          addLog(`Loaded ${addrs.length} saved addresses for pre-fill.`, "info");
          const defaultAddr = addrs.length > 0 ? (addrs.find((a: any) => a.isDefault) || addrs[0]) : null;
          if (defaultAddr) {
            setShippingAddress(defaultAddr.street || defaultAddr.address || "");
            setShippingCity(defaultAddr.city || "Kampala");
            setShippingCounty(defaultAddr.county || defaultAddr.state || "");
            setShippingPostalCode(defaultAddr.postalCode || defaultAddr.zip || "");
            setUsingSavedAddress(true);
            addLog(`Pre-filled address using default: ${defaultAddr.street || defaultAddr.address}, ${defaultAddr.city}`, "info");
          }
        })
        .catch(err => addLog(`Failed to load addresses: ${err.message || err}`, "error"));
    } else {
      setStoreCreditBalance(0);
      setStoreCreditAmount(0);
      setStoreCreditApplied(false);
      setLoyaltyBalance(0);
      setLoyaltyRedeem(0);
      setLoyaltyApplied(false);
      setAddresses([]);
      setSavedAddresses([]);
    }
  }, [user]);

  // Fetch delivery options based on cart items
  useEffect(() => {
    if (items.length === 0) return;
    const productIds = items.map((i) => i.productId).join(",");
    addLog(`Calculating delivery options for ${items.length} cart items...`, "info");
    
    fetch(`/api/checkout/delivery-options?productIds=${productIds}`)
      .then(res => res.json())
      .then(data => {
        if (data.allowedMethods) {
          setAllowedDeliveryMethods(data.allowedMethods);
          addLog(`Allowed delivery methods: ${data.allowedMethods.join(", ")}`, "info");
        }
        if (data.codAllowed !== undefined) {
          setCodAllowedByProducts(data.codAllowed);
          addLog(`Cash on Delivery allowed: ${data.codAllowed}`, "info");
          if (!data.codAllowed && paymentMethod === "cod") {
            setPaymentMethod("mobile_money");
            addLog("COD is disabled for these items. Auto-switched to Mobile Money.", "warning");
          }
        }
        if (data.sellerPickupInfo) {
          setSellerPickupInfo(data.sellerPickupInfo);
          addLog(`Seller pickup store details loaded: ${data.sellerPickupInfo.storeName}`, "info");
        } else {
          setSellerPickupInfo(null);
        }
      })
      .catch(err => {
        addLog(`Failed to fetch delivery options: ${err.message || err}`, "error");
      });
  }, [items]);

  // Load Wishlist (from LocalStorage or DB depending on auth status)
  useEffect(() => {
    if (isInitializing) return;

    const loadWishlist = async () => {
      setLoadingWishlist(true);
      try {
        if (user) {
          const res = await api.getWishlist();
          setWishlist(res.items.map(item => item.product) || []);
        } else {
          const savedWishlist = localStorage.getItem("twa_wishlist");
          if (savedWishlist) {
            setWishlist(JSON.parse(savedWishlist));
          }
        }
      } catch (err) {
        console.error("Failed to load wishlist:", err);
      } finally {
        setLoadingWishlist(false);
      }
    };

    loadWishlist();
  }, [user, isInitializing]);

  // Load Orders (when user clicks Orders tab and is logged in)
  useEffect(() => {
    if (activeTab === "orders" && user) {
      const loadOrders = async () => {
        setLoadingOrders(true);
        try {
          const res = await api.getOrders();
          setOrders(res.orders || []);
        } catch (err) {
          console.error("Failed to load orders:", err);
          showToast("Error loading your orders history", "error");
        } finally {
          setLoadingOrders(false);
        }
      };
      loadOrders();
    }
  }, [activeTab, user]);

  // Load Deals data (active Group Buys & Price Slashes)
  useEffect(() => {
    if (activeTab === "deals") {
      const loadDealsData = async () => {
        addLog("Loading deals data...", "info");
        setLoadingGroupBuys(true);
        setLoadingPriceSlashes(true);

        // Fetch Group Buys
        try {
          const gRes = await fetch("/api/social/group-buy", { credentials: "include" });
          if (gRes.ok) {
            const gData = await gRes.json();
            setActiveGroupBuys(gData.groupBuys || []);
            addLog(`Loaded ${gData.groupBuys?.length || 0} active group buy campaigns.`, "success");
          }
        } catch (err: any) {
          addLog(`Error loading group buys: ${err.message || err}`, "error");
        } finally {
          setLoadingGroupBuys(false);
        }

        // Fetch user's Price Slashes (only if logged in)
        if (user) {
          try {
            const pRes = await fetch("/api/social/price-slash/my", { credentials: "include" });
            if (pRes.ok) {
              const pData = await pRes.json();
              setMyPriceSlashes(pData.slashes || []);
              addLog(`Loaded ${pData.slashes?.length || 0} user price slashes.`, "success");
            }
          } catch (err: any) {
            addLog(`Error loading price slashes: ${err.message || err}`, "error");
          } finally {
            setLoadingPriceSlashes(false);
          }
        } else {
          setMyPriceSlashes([]);
          setLoadingPriceSlashes(false);
        }
      };
      loadDealsData();
    }
  }, [activeTab, user]);

  // Load Profile Addresses (when user clicks Profile tab and is logged in)
  useEffect(() => {
    if (activeTab === "profile" && user) {
      const loadAddresses = async () => {
        setLoadingAddresses(true);
        try {
          const res = await api.getAddresses();
          // Handle both array and object response shapes safely
          const addrs = Array.isArray(res) ? res : (Array.isArray((res as any)?.addresses) ? (res as any).addresses : []);
          setAddresses(addrs);
        } catch (err) {
          console.error("Failed to load addresses:", err);
          setAddresses([]);
        } finally {
          setLoadingAddresses(false);
        }
      };
      loadAddresses();
    }
  }, [activeTab, user]);

  // Fetch tax info based on subtotal
  useEffect(() => {
    if (total <= 0) { setTaxInfo(null); return; }
    fetch(`/api/checkout/tax-info?country=Uganda&subtotal=${total}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.taxName) {
          setTaxInfo(data);
          addLog(`Tax info loaded: ${data.taxName} @ ${data.taxRate}%`, "info");
        } else {
          setTaxInfo(null);
        }
      })
      .catch(() => setTaxInfo(null));
  }, [total]);

  // Regenerate idempotency key when payment-affecting settings change
  useEffect(() => {
    idempotencyKeyRef.current = `twa_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
  }, [installmentsEnabled, installmentCount, paymentMethod, storeCreditApplied]);

  // Prefill checkout details
  useEffect(() => {
    if (user) {
      setShippingName(user.name || "");
      setShippingPhone(user.phone || "");
      setShippingEmail(user.email || "");
      setMomoPhone(user.phone || "");
    }
  }, [user]);

  // Select saved address helper
  const selectSavedAddr = (addr: any) => {
    setShippingAddress(addr.street || addr.address || "");
    setShippingCity(addr.city || "Kampala");
    setShippingCounty(addr.county || addr.state || "");
    setShippingPostalCode(addr.postalCode || addr.zip || "");
    const nameParts = (addr.name || "").split(" ");
    if (nameParts.length > 0 && nameParts[0]) setShippingName(addr.name || shippingName);
    if (addr.phone) setShippingPhone(addr.phone);
    setUsingSavedAddress(true);
    addLog(`Selected saved address: ${addr.street || addr.address}, ${addr.city}`, "info");
  };

  // Payment status polling for Mobile Money
  const pollPaymentStatus = (orderId: string) => {
    let attempts = 0;
    const maxAttempts = 60;
    pollingCancelRef.current = false;

    const checkStatus = async () => {
      if (pollingCancelRef.current) return;
      try {
        const res = await fetch(`/api/orders/${orderId}/payment-status`, { credentials: "include" });
        const data = await res.json();
        if (pollingCancelRef.current) return;

        if (data.paymentStatus === "SUCCESSFUL") {
          setPaymentPending(false);
          clearCart();
          setCreatedOrder({ ...createdOrder, orderId, status: "PAID" });
          setCheckoutStep("success");
          showToast("Payment confirmed! 🎉", "success");
          addLog(`Payment confirmed for order ${orderId}!`, "success");
          return;
        }
        if (data.paymentStatus === "FAILED") {
          setPaymentPending(false);
          showToast("Payment declined. Please try again.", "error");
          addLog(`Payment declined for order ${orderId}`, "error");
          return;
        }

        attempts++;
        if (attempts < maxAttempts && !pollingCancelRef.current) {
          pollingRef.current = setTimeout(checkStatus, 5000);
        } else {
          setPaymentPending(false);
          showToast("Payment timeout. Check your order status.", "warning");
          addLog("Payment polling timed out", "warning");
        }
      } catch (err) {
        attempts++;
        if (attempts < maxAttempts && !pollingCancelRef.current) {
          pollingRef.current = setTimeout(checkStatus, 5000);
        }
      }
    };

    checkStatus();
  };

  // Handle manual login & link
  const handleLoginLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      showToast("Email and Password are required", "error");
      return;
    }
    setIsAuthLoading(true);
    try {
      await login(authEmail, authPassword, telegramUserId || undefined);
      showToast("Account linked successfully!", "success");
      await checkAuth();
    } catch (err: any) {
      showToast(err.message || "Failed to log in", "error");
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Handle manual registration & link
  const handleRegisterLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword || !authName) {
      showToast("All fields are required", "error");
      return;
    }
    setIsAuthLoading(true);
    try {
      await register(authEmail, authPassword, authName, telegramUserId || undefined);
      showToast("Account registered and linked!", "success");
      await checkAuth();
    } catch (err: any) {
      showToast(err.message || "Registration failed", "error");
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Filter products by selected category, search query, sorting, and advanced filters
  const filteredProducts = useMemo(() => {
    let result = products.filter((product) => {
      const pCat = product.category || product.categoryName || "";
      const matchesCategory = selectedCategory === "All" || 
                              (pCat && pCat.toLowerCase() === selectedCategory.toLowerCase());
      
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()));
      
      if (!matchesCategory || !matchesSearch) return false;

      // Price filters
      const price = Number(product.price) || 0;
      if (minPrice !== "" && price < Number(minPrice)) return false;
      if (maxPrice !== "" && price > Number(maxPrice)) return false;

      // Rating filter
      const rating = Number(product.rating) || 0;
      if (minRating !== null && rating < minRating) return false;

      // Stock filter
      const stock = product.stock ?? 0;
      if (inStockOnly && stock <= 0) return false;

      // Shipping filters
      const isAbroad = product.badgeText === "From Abroad" || product.slug?.includes("dropship");
      if (shippingFilter === "EXPRESS" && isAbroad) return false;
      if (shippingFilter === "ABROAD" && !isAbroad) return false;

      return true;
    });

    // Sorting
    if (sortBy === "price-asc") {
      result = [...result].sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    } else if (sortBy === "price-desc") {
      result = [...result].sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    } else if (sortBy === "rating") {
      result = [...result].sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
    } else if (sortBy === "newest") {
      result = [...result].sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (dateA !== dateB) return dateB - dateA;
        return String(b.id).localeCompare(String(a.id));
      });
    }

    return result;
  }, [products, selectedCategory, searchQuery, sortBy, minPrice, maxPrice, minRating, inStockOnly, shippingFilter]);

  const isAnyFilterActive = useMemo(() => {
    return sortBy !== "featured" || minPrice !== "" || maxPrice !== "" || minRating !== null || inStockOnly || shippingFilter !== "ALL";
  }, [sortBy, minPrice, maxPrice, minRating, inStockOnly, shippingFilter]);

  // Handle detailed product card select and async load specs/description
  const handleProductSelect = async (product: any) => {
    // Check if there is an active price slash for this product in user's active slashes list
    const activeSlash = myPriceSlashes.find(s => s.productId === product.id && !s.isExpired && s.status === "active");
    
    // 1. Pop basic list product info to show sheet instantly
    setSelectedProduct({ 
      ...product, 
      images: [product.imageUrl].filter(Boolean),
      activeSlash: activeSlash || null
    });
    setLoadingProductDetail(true);
    setSelectedVariants({}); // Reset selections
    
    // 2. Load detailed metadata (images list, variants list, description overview)
    try {
      const fullProduct = await api.getProduct(product.slug);
      if (fullProduct) {
        setSelectedProduct((prev: any) => {
          if (prev?.slug === product.slug) {
            // Apply default variant selections
            if (fullProduct.hasVariants && fullProduct.variants && fullProduct.variants.length > 0) {
              const defaults: Record<string, string> = {};
              const uniqueSizes = Array.from(new Set(fullProduct.variants.map((v: any) => v.size).filter(Boolean))) as string[];
              const uniqueColors = Array.from(new Set(fullProduct.variants.map((v: any) => v.color).filter(Boolean))) as string[];
              const uniqueMaterials = Array.from(new Set(fullProduct.variants.map((v: any) => v.material).filter(Boolean))) as string[];
              
              if (uniqueSizes.length > 0) defaults["Size"] = uniqueSizes[0];
              if (uniqueColors.length > 0) defaults["Color"] = uniqueColors[0];
              if (uniqueMaterials.length > 0) defaults["Material"] = uniqueMaterials[0];
              setSelectedVariants(defaults);
            }
            return { ...prev, ...fullProduct };
          }
          return prev;
        });
      }
    } catch (err) {
      console.error("Failed to load product details:", err);
    } finally {
      setLoadingProductDetail(false);
    }
  };

  // Toggle wishlist state
  const toggleWishlist = async (product: any) => {
    const isWishlisted = wishlist.some((item) => item.id === product.id);
    try {
      if (user) {
        if (isWishlisted) {
          await api.removeFromWishlist(product.id);
          setWishlist((prev) => prev.filter((item) => item.id !== product.id));
          showToast(`${product.name} removed from wishlist`, "info");
        } else {
          await api.addToWishlist(product.id);
          setWishlist((prev) => [...prev, product]);
          showToast(`${product.name} saved to wishlist`, "success");
        }
      } else {
        // Localstorage sync for guests
        let newWishlist;
        if (isWishlisted) {
          newWishlist = wishlist.filter((item) => item.id !== product.id);
          showToast(`${product.name} removed from wishlist`, "info");
        } else {
          newWishlist = [...wishlist, product];
          showToast(`${product.name} saved to wishlist`, "success");
        }
        setWishlist(newWishlist);
        localStorage.setItem("twa_wishlist", JSON.stringify(newWishlist));
      }
    } catch (err) {
      console.error("Failed to toggle wishlist item:", err);
      showToast("Could not update wishlist", "error");
    }
  };

  // Unique variants groups for active product sheet
  const uniqueSizes = useMemo(() => {
    if (!selectedProduct?.variants) return [];
    return Array.from(new Set(selectedProduct.variants.map((v: any) => v.size).filter(Boolean))) as string[];
  }, [selectedProduct]);

  const uniqueColors = useMemo(() => {
    if (!selectedProduct?.variants) return [];
    return Array.from(new Set(selectedProduct.variants.map((v: any) => v.color).filter(Boolean))) as string[];
  }, [selectedProduct]);

  const uniqueMaterials = useMemo(() => {
    if (!selectedProduct?.variants) return [];
    return Array.from(new Set(selectedProduct.variants.map((v: any) => v.material).filter(Boolean))) as string[];
  }, [selectedProduct]);

  const getSelectedVariantString = () => {
    const parts = Object.entries(selectedVariants).map(([_, val]) => val);
    return parts.length > 0 ? ` (${parts.join(", ")})` : "";
  };

  // Checkout Calculations
  const shippingCost = (deliveryMethod === "pickup" || deliveryMethod === "seller_pickup") ? 0 : 5000;
  const couponDiscountAmount = couponApplied ? couponDiscount : 0;
  const taxAmount = taxInfo ? taxInfo.taxAmount : 0;
  const remainingAfterCoupon = Math.max(0, total - couponDiscountAmount);
  
  const storeCreditDiscount = storeCreditApplied 
    ? Math.min(storeCreditAmount, remainingAfterCoupon) 
    : 0;
    
  const remainingAfterCredit = Math.max(0, remainingAfterCoupon - storeCreditDiscount);
  
  const loyaltyDiscount = loyaltyApplied 
    ? Math.min(loyaltyRedeem, remainingAfterCredit) 
    : 0;
    
  const remainingAfterLoyalty = Math.max(0, remainingAfterCredit - loyaltyDiscount);
  
  const giftCardDiscountVal = giftCardApplied 
    ? Math.min(giftCardBalance, remainingAfterLoyalty) 
    : 0;
    
  const totalDiscount = couponDiscountAmount + storeCreditDiscount + loyaltyDiscount + giftCardDiscountVal;
  const finalTotal = Math.max(0, total - totalDiscount + shippingCost + taxAmount);

  const firstInstallmentAmount = (installmentsEnabled && installmentCount >= 2)
    ? Math.ceil(finalTotal / installmentCount)
    : finalTotal;

  // Sync gift card discount
  useEffect(() => {
    setGiftCardDiscount(giftCardDiscountVal);
  }, [giftCardDiscountVal]);

  // Apply Coupon Code
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError("");
    addLog(`Validating coupon code: "${couponCode}"...`, "info");
    try {
      const res = await api.validateCoupon(couponCode.trim(), total);
      if (res.valid) {
        setCouponDiscount(res.discount);
        setCouponApplied(true);
        addLog(`Coupon valid! Discount applied: -${res.discount} UGX`, "success");
        showToast(`Promo code applied! Saved ${res.discount} UGX`, "success");
      } else {
        setCouponError(res.message || "Invalid coupon");
        addLog(`Coupon validation failed: ${res.message || "Invalid coupon"}`, "warning");
        showToast(res.message || "Invalid coupon", "error");
      }
    } catch (err: any) {
      setCouponError(err.message || "Failed to validate coupon");
      addLog(`Coupon validation API failed: ${err.message || err}`, "error");
      showToast(err.message || "Failed to validate coupon", "error");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    addLog("Removing coupon code.", "info");
    setCouponCode("");
    setCouponDiscount(0);
    setCouponApplied(false);
    setCouponError("");
  };

  // Apply Gift Card
  const handleApplyGiftCard = async () => {
    if (!giftCardCodeInput.trim()) return;
    setGiftCardLoading(true);
    addLog(`Checking gift card code: "${giftCardCodeInput.trim()}"...`, "info");
    try {
      const res = await fetch(`/api/gift-cards/check/${giftCardCodeInput.trim()}`, { credentials: "include" });
      const data = await res.json();
      if (res.ok && typeof data.balance === "number") {
        setGiftCardBalance(data.balance);
        setGiftCardApplied(true);
        addLog(`Gift card balance checked: ${data.balance} UGX available`, "success");
        showToast(`Gift card applied! Balance: ${data.balance} UGX`, "success");
      } else {
        addLog(`Gift card check failed: ${data.error || "Invalid card"}`, "warning");
        showToast(data.error || "Gift card invalid or expired", "error");
      }
    } catch (err: any) {
      addLog(`Gift card API error: ${err.message || err}`, "error");
      showToast("Could not check gift card balance", "error");
    } finally {
      setGiftCardLoading(false);
    }
  };

  const handleRemoveGiftCard = () => {
    addLog("Removing gift card.", "info");
    setGiftCardCodeInput("");
    setGiftCardBalance(0);
    setGiftCardApplied(false);
    setGiftCardDiscount(0);
  };

  // Handle Checkout submission
  const handlePlaceOrder = async () => {
    if (!shippingName.trim() || !shippingPhone.trim()) {
      showToast("Name and Phone number are required", "error");
      return;
    }
    if (deliveryMethod === "home" && !shippingAddress.trim()) {
      showToast("Delivery address is required", "error");
      return;
    }
    if (deliveryMethod === "pickup" && !selectedPickupPointId) {
      showToast("Please select a pickup point", "error");
      return;
    }
    if (paymentMethod === "mobile_money" && !momoPhone.trim()) {
      showToast("Mobile Money phone number is required", "error");
      return;
    }

    setIsPlacingOrder(true);
    addLog("Constructing order checkout payload...", "info");
    try {
      const checkoutItems = items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price
      }));

      const customerEmail = shippingEmail.trim() || user?.email || `${shippingPhone.replace(/\s+/g, "")}@telegram.com`;

      const payload: any = {
        items: checkoutItems,
        amount: finalTotal,
        currency: "UGX",
        shipping: shippingCost,
        paymentMethod,
        ...(paymentMethod === "mobile_money" && {
          mobileMoney: {
            network: momoNetwork,
            phone: momoPhone,
          },
        }),
        customer: {
          name: shippingName.trim(),
          phone: shippingPhone.trim(),
          email: customerEmail,
        },
        shippingAddress: {
          name: shippingName.trim(),
          address: shippingAddress.trim(),
          city: shippingCity.trim(),
          county: shippingCounty.trim() || undefined,
          postalCode: shippingPostalCode.trim() || undefined,
          country: "Uganda",
          phone: shippingPhone.trim(),
        },
        deliveryMethod,
        discreet: true,
        whatsappOptIn,
        ...(deliveryTimeSlot ? { deliveryTimeSlot } : {}),
        ...(deliveryMethod === "pickup" && selectedPickupPointId ? { pickupPointId: selectedPickupPointId } : {}),
        ...(deliveryMethod === "seller_pickup" && sellerPickupInfo ? { sellerPickupId: sellerPickupInfo.sellerId } : {}),
        ...(couponApplied && couponCode ? { couponCode: couponCode.trim() } : {}),
        ...(storeCreditApplied && storeCreditDiscount > 0 ? { storeCreditAmount: storeCreditDiscount } : {}),
        ...(loyaltyApplied && loyaltyDiscount > 0 ? { loyaltyPointsRedeem: loyaltyDiscount } : {}),
        ...(giftCardApplied && giftCardDiscountVal > 0 ? { giftCardCode: giftCardCodeInput.trim(), giftCardAmount: giftCardDiscountVal } : {}),
        ...(installmentsEnabled && installmentCount >= 2 ? { installments: installmentCount } : {}),
        // Include affiliate referral code if present
        ...(typeof window !== "undefined" && localStorage.getItem("affiliate_ref")
          ? { affiliateCode: localStorage.getItem("affiliate_ref") }
          : {}),
      };

      addLog(`Payload: ${JSON.stringify(payload)}`, "info");
      addLog("Sending checkout payload to /api/checkout/create...", "info");

      const idempotencyKey = idempotencyKeyRef.current;

      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify(payload)
      });

      const resData = await res.json();

      if (!res.ok) {
        throw new Error(resData.error || "Failed to place order");
      }

      addLog(`Checkout succeeded! Order ID: ${resData.orderId}, Order #: ${resData.orderNumber}`, "success");
      setCreatedOrder(resData);
      clearCart();
      
      if (resData.paymentLink) {
        // Redirect to payment gateway
        addLog(`Opening payment redirect gateway link: ${resData.paymentLink}`, "info");
        if (tgSdk) {
          tgSdk.openLink(resData.paymentLink);
        } else {
          window.open(resData.paymentLink, "_blank");
        }
        setCheckoutStep("success");
      } else if (resData.status === "SUCCESSFUL") {
        // Fully paid (e.g. store credit covered everything)
        setCheckoutStep("success");
        showToast("Payment successful! 🎉", "success");
      } else if (paymentMethod === "cod") {
        // Cash on delivery
        setCheckoutStep("success");
        showToast("Order placed! Pay on delivery.", "success");
      } else if (paymentMethod === "mobile_money") {
        // Mobile money - show pending screen and start polling
        setPaymentPending(true);
        setPaymentPendingPhone(momoPhone);
        showToast("Please approve the payment on your phone", "info");
        addLog("Waiting for Mobile Money payment approval...", "info");
        pollPaymentStatus(resData.orderId);
      } else {
        setCheckoutStep("success");
      }
    } catch (err: any) {
      addLog(`Checkout failed: ${err.message || err}`, "error");
      showToast(err.message || "Failed to place order. Check stock levels.", "error");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // View detailed status of a specific order
  const handleViewOrderDetails = async (orderId: string) => {
    setLoadingOrderDetailId(orderId);
    setEscrow(null);
    setDeliveryConfirmed(false);
    setShowModifyOrder(false);
    setModifyOrderAddress("");
    setModifyOrderNotes("");
    try {
      const res = await api.getOrder(orderId);
      setSelectedOrderDetails(res);
      if (res && res.shippingAddress) {
        let addrStr = "";
        try {
          const parsed = typeof res.shippingAddress === "string" ? JSON.parse(res.shippingAddress) : res.shippingAddress;
          addrStr = parsed.address || parsed.street || "";
          if (parsed.city) addrStr += `, ${parsed.city}`;
        } catch {
          addrStr = String(res.shippingAddress);
        }
        setModifyOrderAddress(addrStr);
      }
      
      // Load escrow status
      try {
        const escRes = await fetch(`/api/orders/${orderId}/escrow`, { credentials: "include" });
        if (escRes.ok) {
          const escData = await escRes.json();
          if (escData.escrow) setEscrow(escData.escrow);
        }
      } catch (escErr) {
        addLog(`No escrow status found for order ${orderId}`, "warning");
      }
    } catch (err) {
      console.error("Error loading order details:", err);
      showToast("Could not load details for this order", "error");
    } finally {
      setLoadingOrderDetailId(null);
    }
  };

  // Confirm Delivery & Release Escrow Funds
  const handleConfirmDelivery = async (orderId: string) => {
    setConfirmingDelivery(true);
    addLog(`Confirming delivery for order ${orderId}...`, "info");
    try {
      const res = await fetch(`/api/orders/${orderId}/confirm-delivery`, {
        method: "POST",
        credentials: "include"
      });
      if (res.ok) {
        setDeliveryConfirmed(true);
        showToast("Delivery confirmed! Payment released.", "success");
        addLog(`Delivery successfully confirmed for order ${orderId}.`, "success");
        // Reload details
        const updated = await api.getOrder(orderId);
        setSelectedOrderDetails(updated);
        // Reload escrow
        const escRes = await fetch(`/api/orders/${orderId}/escrow`, { credentials: "include" });
        if (escRes.ok) {
          const escData = await escRes.json();
          if (escData.escrow) setEscrow(escData.escrow);
        }
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Failed to confirm delivery", "error");
        addLog(`Failed to confirm delivery: ${data.error || "unknown"}`, "error");
      }
    } catch (err: any) {
      showToast("Failed to confirm delivery", "error");
      addLog(`Error confirming delivery: ${err.message || err}`, "error");
    } finally {
      setConfirmingDelivery(false);
    }
  };

  // Cancel Order
  const handleCancelOrder = async (orderId: string) => {
    setIsCancellingOrder(true);
    addLog(`Cancelling order ${orderId}...`, "info");
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: "POST",
        credentials: "include"
      });
      if (res.ok) {
        showToast("Order cancelled successfully", "info");
        addLog(`Order ${orderId} successfully cancelled.`, "success");
        // Refresh orders list
        try {
          const ordRes = await api.getOrders();
          setOrders(ordRes.orders || []);
        } catch {}
        setSelectedOrderDetails(null);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Failed to cancel order", "error");
        addLog(`Failed to cancel order: ${data.error || "unknown"}`, "error");
      }
    } catch (err: any) {
      showToast("Failed to cancel order", "error");
      addLog(`Error cancelling order: ${err.message || err}`, "error");
    } finally {
      setIsCancellingOrder(false);
    }
  };

  // Modify Pending Order Details
  const handleModifyOrder = async (orderId: string) => {
    if (!modifyOrderAddress.trim() && !modifyOrderNotes.trim()) {
      showToast("Please enter new address or notes", "warning");
      return;
    }
    setIsModifyingOrder(true);
    addLog(`Modifying delivery details for order ${orderId}...`, "info");
    try {
      const res = await fetch(`/api/orders/${orderId}/modify`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          shippingAddress: modifyOrderAddress || undefined,
          notes: modifyOrderNotes || undefined
        }),
        credentials: "include"
      });
      if (res.ok) {
        showToast("Order updated successfully", "success");
        addLog(`Order ${orderId} successfully modified.`, "success");
        setShowModifyOrder(false);
        // Reload details
        const updated = await api.getOrder(orderId);
        setSelectedOrderDetails(updated);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Failed to update order", "error");
        addLog(`Failed to update order: ${data.error || "unknown"}`, "error");
      }
    } catch (err: any) {
      showToast("Failed to update order", "error");
      addLog(`Error modifying order: ${err.message || err}`, "error");
    } finally {
      setIsModifyingOrder(false);
    }
  };

  // Reorder Items back into Cart
  const handleReorder = async (orderId: string) => {
    addLog(`Reordering items from order ${orderId}...`, "info");
    try {
      const res = await fetch(`/api/orders/${orderId}/reorder`, {
        method: "POST",
        credentials: "include"
      });
      if (res.ok) {
        showToast("Items added to cart! Redirecting...", "success");
        addLog(`Reorder successful for order ${orderId}.`, "success");
        setSelectedOrderDetails(null);
        setCheckoutStep("cart");
        setIsDrawerOpen(true);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Failed to reorder", "error");
        addLog(`Failed to reorder: ${data.error || "unknown"}`, "error");
      }
    } catch (err: any) {
      showToast("Failed to reorder", "error");
      addLog(`Error reordering: ${err.message || err}`, "error");
    }
  };

  // Open invoice download print view
  const handleDownloadInvoice = (orderId: string) => {
    addLog(`Opening HTML print invoice for order ${orderId}`, "info");
    if (tgSdk) {
      tgSdk.openLink(`${window.location.origin}/api/invoices/${orderId}?format=html`);
    } else {
      window.open(`/api/invoices/${orderId}?format=html`, "_blank");
    }
  };

  // Join a Group Buy campaign
  const handleJoinGroupBuy = async (id: string) => {
    if (!user) {
      showToast("Please log in to join group buys", "warning");
      setActiveTab("profile");
      return;
    }
    setJoiningGroupId(id);
    addLog(`Joining group buy campaign ${id}...`, "info");
    try {
      const res = await fetch(`/api/social/group-buy/${id}/join`, {
        method: "POST",
        credentials: "include"
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Successfully joined group buy! 🎉", "success");
        addLog(data.message || `Successfully joined group buy ${id}`, "success");
        // Reload active group buys list
        const gRes = await fetch("/api/social/group-buy", { credentials: "include" });
        if (gRes.ok) {
          const gData = await gRes.json();
          setActiveGroupBuys(gData.groupBuys || []);
        }
      } else {
        showToast(data.error || "Failed to join group buy", "error");
        addLog(`Failed to join group buy: ${data.error || "unknown"}`, "error");
      }
    } catch (err: any) {
      showToast("Error joining group buy", "error");
      addLog(`Error joining group buy: ${err.message || err}`, "error");
    } finally {
      setJoiningGroupId(null);
    }
  };

  // Start a new Price Slash campaign for a product
  const handleStartPriceSlash = async (productId: string) => {
    if (!user) {
      showToast("Please log in to start a price slash", "warning");
      setSelectedProduct(null);
      setActiveTab("profile");
      return;
    }
    setStartingSlashId(productId);
    addLog(`Initiating new Price Slash for product ${productId}...`, "info");
    try {
      const res = await fetch("/api/social/price-slash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
        credentials: "include"
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Price slash started! Share with friends to slash further! ✂️", "success");
        addLog(`Price slash started successfully: code is ${data.priceSlash?.slashCode}`, "success");
        
        // Reload user price slashes list
        const pRes = await fetch("/api/social/price-slash/my", { credentials: "include" });
        if (pRes.ok) {
          const pData = await pRes.json();
          setMyPriceSlashes(pData.slashes || []);
        }

        // Apply slash session details inline to active product details sheet
        if (selectedProduct && selectedProduct.id === productId) {
          setSelectedProduct((prev: any) => ({
            ...prev,
            activeSlash: data.priceSlash
          }));
        }
      } else {
        showToast(data.error || "Failed to start price slash", "error");
        addLog(`Failed to start price slash: ${data.error || "unknown"}`, "error");
      }
    } catch (err: any) {
      showToast("Error starting price slash", "error");
      addLog(`Error starting price slash: ${err.message || err}`, "error");
    } finally {
      setStartingSlashId(null);
    }
  };

  // Add Address inside TWA Profile
  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStreet.trim()) return;
    setIsAddingAddress(true);
    try {
      const newAddr = await api.createAddress({
        name: user?.name || "Home Address",
        phone: user?.phone || "",
        street: newStreet,
        city: newCity,
        county: null,
        postalCode: null,
        country: "Uganda"
      });
      setAddresses(prev => [...prev, (newAddr as any).address || newAddr]);
      setNewStreet("");
      showToast("Address added successfully", "success");
    } catch (err) {
      showToast("Failed to add address", "error");
    } finally {
      setIsAddingAddress(false);
    }
  };

  // Delete Address inside TWA Profile
  const handleDeleteAddress = async (id: string) => {
    try {
      await api.deleteAddress(id);
      setAddresses(prev => prev.filter(a => a.id !== id));
      showToast("Address deleted", "info");
    } catch (err) {
      showToast("Failed to delete address", "error");
    }
  };

  const showAuthPortal = !user && !isGuestMode;

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] dark:bg-black flex flex-col items-center justify-center text-gray-800 dark:text-gray-100 transition-colors duration-200">
        <div className="relative flex flex-col items-center">
          <div className="w-12 h-12 border-t-4 border-blue-600 border-solid rounded-full animate-spin"></div>
          <Sparkles className="w-5 h-5 text-blue-500 absolute top-3.5 animate-pulse" />
          <h2 className="mt-6 font-bold text-base text-blue-600 dark:text-blue-400 tracking-wider">PleasureZone</h2>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">Loading Secure TWA Environment...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#fbfbfd] text-gray-900 dark:bg-black dark:text-[#f5f5f7] flex flex-col font-sans select-none antialiased pb-24 transition-colors duration-200 animate-fade-in">
      <Script 
        src="https://telegram.org/js/telegram-web-app.js" 
        strategy="afterInteractive"
        onLoad={() => {
          if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
            const tg = (window as any).Telegram.WebApp;
            setTgSdk(tg);
            tg.ready();
            tg.expand();
            const initData = tg.initData || "";
            setInitDataStr(initData);
            const tgColorScheme = tg.colorScheme;
            if (tgColorScheme === "light" || tgColorScheme === "dark") {
              setTheme(tgColorScheme);
            }
          }
        }}
      />
      
      {/* TWA Authentication Portal */}
      {showAuthPortal ? (
        <div className="flex-1 flex flex-col justify-center items-center px-6 py-8">
          <div className="w-full max-w-sm bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full filter blur-xl"></div>
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-500/10 rounded-full filter blur-xl"></div>

            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg mb-3">
                <Sparkles className="w-7 h-7 text-white animate-pulse" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">PleasureZone</h1>
              <p className="text-xs text-gray-500 dark:text-[#98989f] mt-1">Premium Adult Store Uganda</p>
            </div>

            {/* Tabs Selector */}
            <div className="flex bg-[#f6f6f8] dark:bg-[#2c2c2e] rounded-xl p-1 mb-6 border border-gray-250/10 dark:border-white/5">
              <button 
                onClick={() => setAuthTab("guest")}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${authTab === "guest" ? "bg-white text-gray-900 dark:bg-white/10 dark:text-white shadow-sm" : "text-gray-500 dark:text-[#98989f] hover:text-gray-900 dark:hover:text-white"}`}
              >
                Guest Mode
              </button>
              <button 
                onClick={() => setAuthTab("login")}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${authTab === "login" ? "bg-white text-gray-900 dark:bg-white/10 dark:text-white shadow-sm" : "text-gray-500 dark:text-[#98989f] hover:text-gray-900 dark:hover:text-white"}`}
              >
                Log In
              </button>
              <button 
                onClick={() => setAuthTab("register")}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${authTab === "register" ? "bg-white text-gray-900 dark:bg-white/10 dark:text-white shadow-sm" : "text-gray-500 dark:text-[#98989f] hover:text-gray-900 dark:hover:text-white"}`}
              >
                Register
              </button>
            </div>

            {/* Auth Tab Content */}
            {authTab === "guest" && (
              <div className="text-center">
                <p className="text-sm text-gray-650 dark:text-[#98989f] mb-6 leading-relaxed">
                  Browse the store anonymously as a guest. You can register or link your PleasureZone account later during checkout.
                </p>
                <button
                  onClick={() => setIsGuestMode(true)}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md active:scale-95 transition-all text-xs flex items-center justify-center gap-2"
                >
                  Start Browsing <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {authTab === "login" && (
              <form onSubmit={handleLoginLink} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 dark:text-[#98989f] uppercase font-semibold">Email Address</label>
                  <input 
                    type="email" 
                    value={authEmail} 
                    onChange={e => setAuthEmail(e.target.value)}
                    placeholder="Enter email"
                    className="w-full bg-[#f6f6f8] dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 dark:text-[#98989f] uppercase font-semibold">Password</label>
                  <input 
                    type="password" 
                    value={authPassword} 
                    onChange={e => setAuthPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full bg-[#f6f6f8] dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isAuthLoading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md active:scale-95 transition-all text-xs flex items-center justify-center gap-2 mt-4"
                >
                  {isAuthLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>Link Account <ShieldCheck className="w-4 h-4" /></>
                  )}
                </button>
              </form>
            )}

            {authTab === "register" && (
              <form onSubmit={handleRegisterLink} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 dark:text-[#98989f] uppercase font-semibold">Full Name</label>
                  <input 
                    type="text" 
                    value={authName} 
                    onChange={e => setAuthName(e.target.value)}
                    placeholder="Enter full name"
                    className="w-full bg-[#f6f6f8] dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 dark:text-[#98989f] uppercase font-semibold">Email Address</label>
                  <input 
                    type="email" 
                    value={authEmail} 
                    onChange={e => setAuthEmail(e.target.value)}
                    placeholder="Enter email"
                    className="w-full bg-[#f6f6f8] dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 dark:text-[#98989f] uppercase font-semibold">Password</label>
                  <input 
                    type="password" 
                    value={authPassword} 
                    onChange={e => setAuthPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full bg-[#f6f6f8] dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isAuthLoading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md active:scale-95 transition-all text-xs flex items-center justify-center gap-2 mt-4"
                >
                  {isAuthLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>Register & Link <ShieldCheck className="w-4 h-4" /></>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : (
        /* Storefront Layout */
        <div className="flex-1 flex flex-col">
          
          {/* Header */}
          <header className="px-5 py-4 flex items-center justify-between border-b border-gray-150 dark:border-white/5 bg-white/95 dark:bg-black/90 backdrop-blur-md sticky top-0 z-30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-white shadow-md text-sm">
                PZ
              </div>
              <div>
                <h2 className="text-sm font-bold leading-tight">PleasureZone</h2>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                  <span className="text-[10px] text-gray-500 dark:text-[#98989f]">
                    {user ? `Linked: ${user.name}` : "Browsing: Guest Mode"}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {user && (
                <button 
                  onClick={() => {
                    logout();
                    setIsGuestMode(false);
                    showToast("Logged out successfully", "info");
                  }}
                  title="Logout / Unlink"
                  className="p-2 bg-[#f6f6f8] dark:bg-[#121214] border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 active:scale-95 transition"
                >
                  <RotateCcw className="w-4 h-4 text-gray-500 dark:text-[#98989f]" />
                </button>
              )}
              <button 
                onClick={() => {
                  setCheckoutStep("cart");
                  setIsDrawerOpen(true);
                }}
                className="relative p-2 bg-[#f6f6f8] dark:bg-[#121214] border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 active:scale-95 transition"
              >
                <CartIcon className="w-4 h-4 text-blue-600" />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                    {itemCount}
                  </span>
                )}
              </button>
            </div>
          </header>

          {/* Catalog Tab Content */}
          {activeTab === "catalog" && (
            <div className="animate-fade-in flex flex-col flex-1">
              {/* Search bar & Filter */}
              <div className="px-5 mt-4 flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    placeholder="Search premium wellness toys, lubes..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-[#f6f6f8] dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-2xl pl-10 pr-10 py-3 text-xs focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery("")}
                      className="p-1 absolute right-3.5 top-3 text-gray-400 hover:text-gray-900"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(true)}
                  className={`p-3 rounded-2xl border flex items-center justify-center transition-colors relative ${
                    isAnyFilterActive 
                      ? "bg-blue-600 border-blue-600 text-white" 
                      : "bg-[#f6f6f8] dark:bg-[#121214] border-gray-200 dark:border-white/5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
                  }`}
                  title="Filter & Sort"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  {isAnyFilterActive && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white dark:ring-black animate-pulse" />
                  )}
                </button>
              </div>

              {/* Category Pills */}
              <div className="mt-4 px-5 overflow-x-auto whitespace-nowrap scrollbar-hide py-1 flex gap-2">
                <button
                  onClick={() => setSelectedCategory("All")}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${selectedCategory === "All" ? "bg-blue-600 text-white shadow-md" : "bg-[#f6f6f8] dark:bg-[#121214] text-gray-500 dark:text-[#98989f] hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-white/5"}`}
                >
                  All Products
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.name)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${selectedCategory === cat.name ? "bg-blue-600 text-white shadow-md" : "bg-[#f6f6f8] dark:bg-[#121214] text-gray-500 dark:text-[#98989f] hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-white/5"}`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Weekly Bestsellers Carousel (Visible when category is "All" and no active search) */}
              {products.length > 0 && searchQuery === "" && selectedCategory === "All" && (
                <div className="mt-5 space-y-2.5 animate-fade-in">
                  <div className="px-5 flex items-center justify-between">
                    <h3 className="text-[10px] text-gray-400 dark:text-[#98989f] uppercase font-bold tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Weekly Bestsellers
                    </h3>
                  </div>
                  <div className="flex gap-3.5 overflow-x-auto px-5 pb-2 scrollbar-hide">
                    {products.slice(0, 8).map((prod) => {
                      const discountPct = prod.comparePrice && prod.comparePrice > prod.price 
                        ? Math.round(((prod.comparePrice - prod.price) / prod.comparePrice) * 100)
                        : null;
                      return (
                        <div 
                          key={`best-${prod.id}`}
                          onClick={() => handleProductSelect(prod)}
                          className="bg-white dark:bg-[#121214] border border-gray-150 dark:border-white/5 p-3 rounded-2xl flex-shrink-0 w-36 shadow-sm flex flex-col justify-between cursor-pointer hover:scale-[1.02] transition duration-300"
                        >
                          <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-50 dark:bg-[#2c2c2e]">
                            {prod.imageUrl ? (
                              <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-650">
                                <Sparkles className="w-4 h-4 opacity-20" />
                              </div>
                            )}
                            {discountPct && (
                              <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-red-500 text-white font-extrabold rounded text-[7px] tracking-wider uppercase">
                                -{discountPct}%
                              </span>
                            )}
                          </div>
                          <div className="mt-2 space-y-1 flex-1 flex flex-col justify-between">
                            <div>
                              <h4 className="text-[10px] font-bold line-clamp-1 leading-tight text-gray-800 dark:text-[#f5f5f7]">{prod.name}</h4>
                              <div className="flex items-center gap-1 mt-0.5">
                                {prod.rating > 0 && (
                                  <div className="flex items-center text-amber-500 gap-0.5">
                                    <Star className="w-2.5 h-2.5 fill-amber-500" />
                                    <span className="text-[8px] font-extrabold">{Number(prod.rating).toFixed(1)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-baseline gap-1 mt-1.5">
                              <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400">{Number(prod.price).toLocaleString()}</span>
                              <span className="text-[7px] text-gray-400 uppercase">UGX</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Product Grid */}
              <div className="flex-1 px-5 mt-5">
                {loadingProducts ? (
                  <div className="h-64 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    <p className="text-xs text-gray-400">Loading catalog items...</p>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center gap-2 text-center">
                    <ShoppingBag className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-2" />
                    <p className="text-sm font-semibold text-gray-500">No products found</p>
                    <p className="text-xs text-gray-400">Try adjusting your filters or search keywords</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {filteredProducts.map((product) => {
                      const hasStock = product.stock > 0;
                      const isAbroad = product.badgeText === "From Abroad" || product.slug.includes("dropship");
                      const isWishlisted = wishlist.some((w) => w.id === product.id);
                      const discountPct = product.comparePrice && product.comparePrice > product.price 
                        ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
                        : null;
                      
                      return (
                        <div 
                          key={product.id} 
                          onClick={() => handleProductSelect(product)}
                          className="bg-white dark:bg-[#121214] border border-gray-150 dark:border-white/5 rounded-2xl overflow-hidden flex flex-col shadow-sm dark:shadow-md relative group cursor-pointer hover:border-blue-500/20 transition-all duration-300"
                        >
                          {/* Product Image */}
                          <div className="relative aspect-square w-full bg-[#f6f6f8] dark:bg-[#2c2c2e] overflow-hidden">
                            {product.imageUrl ? (
                              <img 
                                src={product.imageUrl} 
                                alt={product.name}
                                className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                                onError={(e) => {
                                  (e.target as any).src = "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=300&auto=format&fit=crop";
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                                <Sparkles className="w-8 h-8 opacity-20" />
                              </div>
                            )}

                            {/* Badges */}
                            <div className="absolute top-2 left-2 flex flex-col gap-1">
                              {discountPct && (
                                <span className="px-2 py-0.5 bg-red-500/90 backdrop-blur-md text-[8px] font-bold text-white rounded-md uppercase tracking-wider">
                                  -{discountPct}% OFF
                                </span>
                              )}
                              {isAbroad ? (
                                <span className="px-2 py-0.5 bg-blue-600/90 backdrop-blur-md text-[9px] font-bold text-white rounded-md uppercase tracking-wider">
                                  ✈️ Abroad
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-blue-600/90 backdrop-blur-md text-[9px] font-bold text-white rounded-md uppercase tracking-wider">
                                  ⚡ Express
                                </span>
                              )}
                              {!hasStock && (
                                <span className="px-2 py-0.5 bg-red-600/90 backdrop-blur-md text-[9px] font-bold text-white rounded-md uppercase tracking-wider">
                                  Out of Stock
                                </span>
                              )}
                            </div>

                            {/* Wishlist Icon */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleWishlist(product);
                              }}
                              className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 dark:bg-black/50 backdrop-blur-md border border-gray-100 dark:border-white/10 text-gray-500 hover:text-red-500 active:scale-95 transition z-10"
                            >
                              <Heart className={`w-3.5 h-3.5 ${isWishlisted ? "fill-red-500 text-red-500" : "text-gray-500"}`} />
                            </button>
                          </div>

                          {/* Details */}
                          <div className="p-3 flex-1 flex flex-col justify-between">
                            <div className="space-y-1">
                              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold tracking-wider uppercase block">
                                {product.category || "General"}
                              </span>
                              <h3 className="text-xs font-bold line-clamp-2 leading-snug text-gray-800 dark:text-[#f5f5f7] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {product.name}
                              </h3>

                              {/* Ratings & Sales stats */}
                              <div className="flex items-center gap-2 mt-1">
                                {product.rating > 0 && (
                                  <div className="flex items-center text-amber-500 gap-0.5">
                                    <Star className="w-2.5 h-2.5 fill-amber-500" />
                                    <span className="text-[9px] font-extrabold">{Number(product.rating).toFixed(1)}</span>
                                  </div>
                                )}
                                {product.soldRecently > 0 && (
                                  <span className="text-[9px] text-gray-400">({product.soldRecently} sold)</span>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-1">
                              <div className="flex flex-col">
                                <span className="text-[9px] text-gray-400">Price</span>
                                <div className="flex items-baseline gap-1.5 flex-wrap">
                                  <span className="text-xs font-extrabold text-gray-900 dark:text-white">
                                    {Number(product.price).toLocaleString()} UGX
                                  </span>
                                  {product.comparePrice && product.comparePrice > product.price && (
                                    <span className="text-[9px] text-gray-400 line-through">
                                      {Number(product.comparePrice).toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addItem({
                                    id: product.id,
                                    productId: product.id,
                                    name: product.name,
                                    slug: product.slug,
                                    price: Number(product.price),
                                    imageUrl: product.imageUrl,
                                    stock: product.stock
                                  });
                                  showToast(`${product.name} added to cart`, "success");
                                }}
                                disabled={!hasStock}
                                className={`p-2 rounded-xl transition-all active:scale-95 z-10 ${hasStock ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md" : "bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed"}`}
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Deals Tab Content */}
          {activeTab === "deals" && (
            <div className="animate-fade-in flex flex-col flex-1 px-5 mt-4 space-y-4 pb-24">
              <h2 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-blue-600 animate-pulse-soft" /> Exclusive Deals & Social Store
              </h2>

              {/* Deals sub-tabs navigation */}
              <div className="flex bg-[#f6f6f8] dark:bg-[#2c2c2e] rounded-2xl p-1 border border-gray-200/10 dark:border-white/5">
                {[
                  { value: "group-buy", label: "Group Buys 👥" },
                  { value: "price-slash", label: "Price Slashes ✂️" },
                  { value: "box-builder", label: "Box Builder 📦" }
                ].map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setActiveDealsSubTab(tab.value as any)}
                    className={`flex-1 py-2 text-[10px] font-bold rounded-xl transition-all ${
                      activeDealsSubTab === tab.value
                        ? "bg-white text-gray-900 dark:bg-white/10 dark:text-white shadow-sm"
                        : "text-gray-500 dark:text-[#98989f] hover:text-gray-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Sub-tab 1: Group Buy campaigns list */}
              {activeDealsSubTab === "group-buy" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 p-4 rounded-2xl border border-blue-500/10">
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 font-extrabold uppercase tracking-wider flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> Group Buy Deals</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 leading-normal">Join active buying groups to lock in steep volume discounts together!</p>
                  </div>

                  {loadingGroupBuys ? (
                    <div className="h-48 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                    </div>
                  ) : activeGroupBuys.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 bg-white dark:bg-[#121214] border border-gray-100 dark:border-white/5 rounded-2xl p-6">
                      <ShoppingBag className="w-10 h-10 text-gray-300 dark:text-gray-650 mx-auto mb-2" />
                      <p className="text-xs font-semibold">No active Group Buys</p>
                      <p className="text-[9px] text-gray-400 mt-1">Check back later or start one from product details page.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeGroupBuys.map((gb) => {
                        const productImg = gb.product?.images?.[0]?.url || gb.product?.imageUrl || "";
                        const regularPrice = Number(gb.product?.price) || 0;
                        const groupPrice = Number(gb.discountPrice) || 0;
                        const savings = regularPrice - groupPrice;
                        const savingsPercent = regularPrice > 0 ? Math.round((savings / regularPrice) * 100) : 0;
                        
                        return (
                          <div key={gb.id} className="bg-white dark:bg-[#121214] border border-gray-150 dark:border-white/5 p-4 rounded-2xl flex gap-3.5 items-center relative overflow-hidden shadow-sm">
                            <img 
                              src={productImg} 
                              alt={gb.product?.name} 
                              className="w-16 h-16 rounded-xl object-cover bg-gray-50 flex-shrink-0"
                              onError={(e) => {
                                (e.target as any).src = "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=300&auto=format&fit=crop";
                              }}
                            />
                            <div className="flex-1 min-w-0 space-y-1">
                              <h3 className="font-bold text-gray-900 dark:text-white truncate text-xs">{gb.product?.name}</h3>
                              
                              <div className="flex items-baseline gap-2">
                                <span className="text-blue-600 dark:text-blue-400 font-extrabold text-xs">{groupPrice.toLocaleString()} UGX</span>
                                <span className="text-[9px] text-gray-400 line-through">{regularPrice.toLocaleString()} UGX</span>
                                {savingsPercent > 0 && (
                                  <span className="text-[8px] font-bold bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded">-{savingsPercent}%</span>
                                )}
                              </div>

                              {/* Progress bar */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-[8px] text-gray-400 font-bold">
                                  <span>{gb.currentCount} / {gb.targetCount} joined</span>
                                  <span>{gb.spotsLeft} spot{gb.spotsLeft > 1 ? "s" : ""} left</span>
                                </div>
                                <div className="w-full bg-gray-100 dark:bg-white/5 h-1.5 rounded-full overflow-hidden">
                                  <div 
                                    className="bg-blue-600 h-full rounded-full transition-all duration-300"
                                    style={{ width: `${Math.min(100, gb.progress)}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => handleJoinGroupBuy(gb.id)}
                              disabled={joiningGroupId === gb.id || gb.spotsLeft <= 0}
                              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-[10px] transition active:scale-95 flex-shrink-0 self-center flex items-center justify-center gap-1 shadow-sm disabled:opacity-50"
                            >
                              {joiningGroupId === gb.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                "Join"
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab 2: User Price Slashes list */}
              {activeDealsSubTab === "price-slash" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="bg-gradient-to-r from-red-500/10 to-pink-500/10 p-4 rounded-2xl border border-red-500/10">
                    <p className="text-[10px] text-red-600 dark:text-red-400 font-extrabold uppercase tracking-wider flex items-center gap-1"><Scissors className="w-3.5 h-3.5" /> Price Slashes</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 leading-normal">Start price slash campaigns on products and invite friends to slash prices down to 50%!</p>
                  </div>

                  {!user ? (
                    <div className="bg-white dark:bg-[#121214] border border-gray-100 dark:border-white/5 p-6 rounded-2xl text-center space-y-3">
                      <UserIcon className="w-10 h-10 text-gray-450 mx-auto" />
                      <p className="text-xs text-gray-500">Please Log In or Register on the *Profile* tab to view your active price slashes.</p>
                      <button 
                        onClick={() => setActiveTab("profile")}
                        className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700"
                      >
                        Go to Profile
                      </button>
                    </div>
                  ) : loadingPriceSlashes ? (
                    <div className="h-48 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                    </div>
                  ) : myPriceSlashes.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 bg-white dark:bg-[#121214] border border-gray-100 dark:border-white/5 rounded-2xl p-6">
                      <Scissors className="w-10 h-10 text-gray-300 dark:text-gray-650 mx-auto mb-2" />
                      <p className="text-xs font-semibold">No active Price Slashes</p>
                      <p className="text-[9px] text-gray-400 mt-1">Start a slash from any product catalog details page.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myPriceSlashes.map((slash) => {
                        const productImg = slash.product?.images?.[0]?.url || slash.product?.imageUrl || "";
                        const progressPercent = (slash.currentSlashes / slash.maxSlashes) * 100;
                        const isDone = slash.currentSlashes >= slash.maxSlashes;
                        
                        return (
                          <div key={slash.id} className="bg-white dark:bg-[#121214] border border-gray-150 dark:border-white/5 p-4 rounded-2xl flex flex-col gap-3 relative shadow-sm">
                            <div className="flex gap-3 items-center">
                              <img 
                                src={productImg} 
                                alt={slash.product?.name} 
                                className="w-12 h-12 rounded-xl object-cover bg-gray-50 flex-shrink-0"
                                onError={(e) => {
                                  (e.target as any).src = "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=300&auto=format&fit=crop";
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-gray-900 dark:text-white truncate text-xs">{slash.product?.name}</h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-red-500 dark:text-red-400 font-extrabold text-[11px]">{Number(slash.currentPrice).toLocaleString()} UGX</span>
                                  <span className="text-[9px] text-gray-400 line-through">{Number(slash.originalPrice).toLocaleString()} UGX</span>
                                  <span className="text-[8px] font-bold bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded">{slash.savingsPercent}% off</span>
                                </div>
                              </div>
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                                slash.isExpired ? "bg-gray-100 text-gray-500 dark:bg-white/5" :
                                isDone ? "bg-green-500/15 text-green-500" :
                                "bg-red-500/15 text-red-500 animate-pulse"
                              }`}>
                                {slash.isExpired ? "Expired" : isDone ? "Finished" : "Active"}
                              </span>
                            </div>

                            {/* Progress bar */}
                            <div className="space-y-1">
                              <div className="flex justify-between text-[8px] text-gray-400 font-bold">
                                <span>{slash.currentSlashes} / {slash.maxSlashes} cuts applied</span>
                                <span>Target: {Number(slash.targetPrice).toLocaleString()} UGX</span>
                              </div>
                              <div className="w-full bg-gray-100 dark:bg-white/5 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className="bg-gradient-to-r from-red-500 to-pink-500 h-full rounded-full transition-all duration-300"
                                  style={{ width: `${Math.min(100, progressPercent)}%` }}
                                ></div>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => {
                                  const shareText = `✂️ Help me slash the price of ${slash.product?.name}! Click this link to cut it down: ${window.location.origin}/slash/${slash.slashCode}`;
                                  const shareUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
                                  if (tgSdk) {
                                    tgSdk.openLink(shareUrl);
                                  } else {
                                    window.open(shareUrl, "_blank");
                                  }
                                  showToast("WhatsApp sharing opened!", "success");
                                }}
                                className="flex-1 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold rounded-xl text-[10px] transition active:scale-95 flex items-center justify-center gap-1 shadow-sm"
                              >
                                <Copy className="w-3 h-3" /> Share Link
                              </button>

                              <button
                                onClick={() => {
                                  addItem({
                                    id: slash.product.id + "_slashed",
                                    productId: slash.product.id,
                                    name: slash.product.name + " (Slashed Deal ✂️)",
                                    slug: slash.product.slug,
                                    price: Number(slash.currentPrice),
                                    imageUrl: productImg,
                                    stock: 5
                                  });
                                  showToast("Slashed item added to cart!", "success");
                                  setCheckoutStep("cart");
                                  setIsDrawerOpen(true);
                                }}
                                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-[10px] transition active:scale-95 flex items-center justify-center gap-1 shadow-sm"
                              >
                                <ShoppingBag className="w-3 h-3" /> Buy Slashed Price
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab 3: Custom Box Builder */}
              {activeDealsSubTab === "box-builder" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 p-4 rounded-2xl border border-purple-500/10">
                    <p className="text-[10px] text-purple-600 dark:text-purple-400 font-extrabold uppercase tracking-wider flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Custom Box Builder</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 leading-normal">Build your custom bundle box. Add more items to unlock deeper tiered discounts:</p>
                    <div className="grid grid-cols-3 gap-2 mt-3 text-center text-[8px] font-bold text-gray-650 dark:text-gray-300">
                      <div className="bg-white/50 dark:bg-white/5 border border-purple-500/20 p-1.5 rounded-lg">
                        <p className="text-purple-600 dark:text-purple-400 font-black">3-4 Items</p>
                        <p className="opacity-80">10% OFF</p>
                      </div>
                      <div className="bg-white/50 dark:bg-white/5 border border-purple-500/20 p-1.5 rounded-lg">
                        <p className="text-purple-600 dark:text-purple-400 font-black">5-6 Items</p>
                        <p className="opacity-80">15% OFF</p>
                      </div>
                      <div className="bg-white/50 dark:bg-white/5 border border-purple-500/20 p-1.5 rounded-lg">
                        <p className="text-purple-600 dark:text-purple-400 font-black">7+ Items</p>
                        <p className="opacity-80">20% OFF</p>
                      </div>
                    </div>
                  </div>

                  {/* Active Box Items Summary */}
                  <div className="bg-white dark:bg-[#121214] border border-gray-150 dark:border-white/5 p-4 rounded-2xl space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-[10px] uppercase text-gray-400 tracking-wider">Your Custom Box Bundle</h3>
                      <span className="text-[9px] font-extrabold text-purple-600 dark:text-purple-400">
                        {boxItems.reduce((acc, curr) => acc + curr.quantity, 0)} Items Added
                      </span>
                    </div>

                    {boxItems.length === 0 ? (
                      <p className="text-[10px] text-gray-400 text-center py-4 italic">Your custom box is empty. Add products below! 👇</p>
                    ) : (
                      <div className="space-y-2.5">
                        <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                          {boxItems.map((item) => (
                            <div key={item.product.id} className="flex justify-between items-center text-[10px] border-b border-gray-100 dark:border-white/5 pb-2">
                              <span className="truncate font-bold text-gray-808 dark:text-white pr-4">{item.product.name}</span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setBoxItems(prev => prev.map(p => p.product.id === item.product.id ? { ...p, quantity: Math.max(1, p.quantity - 1) } : p));
                                  }}
                                  className="w-5 h-5 bg-[#f6f6f8] dark:bg-[#2c2c2e] hover:bg-gray-300 dark:hover:bg-white/10 rounded-full flex items-center justify-center text-gray-500 dark:text-white"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="font-extrabold">{item.quantity}</span>
                                <button
                                  onClick={() => {
                                    setBoxItems(prev => prev.map(p => p.product.id === item.product.id ? { ...p, quantity: p.quantity + 1 } : p));
                                  }}
                                  className="w-5 h-5 bg-[#f6f6f8] dark:bg-[#2c2c2e] hover:bg-gray-300 dark:hover:bg-white/10 rounded-full flex items-center justify-center text-gray-500 dark:text-white"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => {
                                    setBoxItems(prev => prev.filter(p => p.product.id !== item.product.id));
                                  }}
                                  className="p-1.5 text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition ml-1"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Calculated pricing details */}
                        {(() => {
                          const totalItems = boxItems.reduce((acc, curr) => acc + curr.quantity, 0);
                          const boxSubtotal = boxItems.reduce((acc, curr) => acc + Number(curr.product.price) * curr.quantity, 0);
                          const discountPct = totalItems >= 7 ? 20 : totalItems >= 5 ? 15 : totalItems >= 3 ? 10 : 0;
                          const discountAmt = boxSubtotal * (discountPct / 100);
                          const boxTotal = boxSubtotal - discountAmt;
                          
                          return (
                            <div className="bg-[#f6f6f8] dark:bg-[#2c2c2e]/60 p-3 rounded-xl space-y-1.5 text-[10px]">
                              <div className="flex justify-between text-gray-500">
                                <span>Subtotal</span>
                                <span>{boxSubtotal.toLocaleString()} UGX</span>
                              </div>
                              {discountPct > 0 && (
                                <div className="flex justify-between text-green-500 font-bold">
                                  <span>Box Discount ({discountPct}%)</span>
                                  <span>-{discountAmt.toLocaleString()} UGX</span>
                                </div>
                              )}
                              <hr className="border-gray-200/50 dark:border-white/5 my-1" />
                              <div className="flex justify-between font-black text-gray-900 dark:text-white text-xs">
                                <span>Box Total</span>
                                <span className="text-purple-600 dark:text-purple-400">{boxTotal.toLocaleString()} UGX</span>
                              </div>

                              <button
                                onClick={() => {
                                  const boxDiscountCode = discountPct === 10 ? "BOX10" : discountPct === 15 ? "BOX15" : "BOX20";
                                  clearCart();
                                  boxItems.forEach(item => {
                                    addItem({
                                      id: item.product.id,
                                      productId: item.product.id,
                                      name: item.product.name,
                                      slug: item.product.slug,
                                      price: Number(item.product.price),
                                      imageUrl: item.product.imageUrl,
                                      stock: item.product.stock,
                                      quantity: item.quantity
                                    });
                                  });
                                  setCouponCode(boxDiscountCode);
                                  setCouponApplied(false);
                                  showToast(`Added Custom Box to Cart! Applied ${discountPct}% Discount code.`, "success");
                                  setCheckoutStep("cart");
                                  setIsDrawerOpen(true);
                                }}
                                disabled={totalItems < 3}
                                className="w-full mt-2 py-3 bg-purple-600 hover:bg-purple-700 text-white font-extrabold rounded-xl text-xs transition active:scale-95 shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <ShoppingCart className="w-4 h-4" /> Add Box to Cart {totalItems < 3 ? `(Add ${3 - totalItems} more)` : ""}
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Grid of Products to add to Box */}
                  <h3 className="font-bold text-[10px] text-gray-400 uppercase tracking-wider">Select Products for Box</h3>
                  <div className="grid grid-cols-2 gap-3.5">
                    {products.slice(0, 10).map((product) => {
                      const inBox = boxItems.find(p => p.product.id === product.id);
                      
                      return (
                        <div key={product.id} className="bg-white dark:bg-[#121214] border border-gray-150 dark:border-white/5 rounded-2xl p-2.5 flex flex-col justify-between shadow-sm relative">
                          <img 
                            src={product.imageUrl} 
                            alt={product.name} 
                            className="w-full aspect-square object-cover rounded-xl bg-gray-50 mb-2"
                            onError={(e) => {
                              (e.target as any).src = "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=300&auto=format&fit=crop";
                            }}
                          />
                          <div className="space-y-1 flex-1 flex flex-col justify-between">
                            <div>
                              <h4 className="font-bold text-[10px] line-clamp-2 text-gray-805 dark:text-white leading-tight">{product.name}</h4>
                              <p className="text-[9px] text-gray-400 mt-0.5">{Number(product.price).toLocaleString()} UGX</p>
                            </div>
                            
                            <button
                              onClick={() => {
                                setBoxItems(prev => {
                                  const exists = prev.find(p => p.product.id === product.id);
                                  if (exists) {
                                    return prev.map(p => p.product.id === product.id ? { ...p, quantity: p.quantity + 1 } : p);
                                  }
                                  return [...prev, { product, quantity: 1 }];
                                });
                                showToast(`Added ${product.name} to box!`, "success");
                              }}
                              className={`w-full mt-2 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 ${
                                inBox 
                                  ? "bg-purple-500/10 text-purple-605 border border-purple-500/20"
                                  : "bg-[#f6f6f8] dark:bg-[#2c2c2e] hover:bg-purple-600 hover:text-white text-gray-650 dark:text-gray-300"
                              }`}
                            >
                              <Plus className="w-3 h-3" /> {inBox ? `Add More (${inBox.quantity})` : "Add to Box"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Wishlist Tab Content */}
          {activeTab === "wishlist" && (
            <div className="animate-fade-in flex flex-col flex-1 px-5 mt-4 space-y-4">
              <h2 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-500" /> Saved Items
              </h2>

              {loadingWishlist ? (
                <div className="h-48 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                </div>
              ) : wishlist.length === 0 ? (
                <div className="text-center py-12 text-gray-500 bg-white dark:bg-[#121214] rounded-2xl p-6 border border-gray-100 dark:border-white/5">
                  <Heart className="w-10 h-10 text-gray-300 dark:text-gray-650 mx-auto mb-2 animate-pulse" />
                  <p className="text-xs font-bold text-gray-800 dark:text-white">Your wishlist is currently empty</p>
                  <p className="text-[10px] text-gray-400 mt-1">Tap the heart on any product in the Catalog to save it here.</p>
                  <button 
                    onClick={() => setActiveTab("catalog")}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl active:scale-95 transition hover:bg-blue-700"
                  >
                    Explore Catalog
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 animate-fade-in">
                  {wishlist.map((product) => {
                    const hasStock = product.stock > 0;
                    
                    return (
                      <div 
                        key={product.id} 
                        onClick={() => handleProductSelect(product)}
                        className="bg-white dark:bg-[#121214] border border-gray-100 dark:border-white/5 rounded-2xl overflow-hidden flex flex-col shadow-sm relative cursor-pointer hover:border-blue-500/20 transition-all duration-300"
                      >
                        {/* Image */}
                        <div className="relative aspect-square w-full bg-[#f6f6f8] dark:bg-[#2c2c2e] overflow-hidden">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} className="object-cover w-full h-full" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                              <Sparkles className="w-8 h-8 opacity-20" />
                            </div>
                          )}
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleWishlist(product);
                            }}
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-white/70 dark:bg-black/55 backdrop-blur-md border border-gray-150 dark:border-white/10 text-red-500 z-10"
                          >
                            <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" />
                          </button>
                        </div>

                        {/* Details */}
                        <div className="p-3 flex-1 flex flex-col justify-between">
                          <div className="space-y-1">
                            <span className="text-[10px] text-blue-600 font-semibold tracking-wider uppercase block">{product.category || "General"}</span>
                            <h3 className="text-xs font-bold line-clamp-2 leading-snug text-gray-800 dark:text-[#f5f5f7]">{product.name}</h3>
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-1">
                            <div className="flex flex-col">
                              <span className="text-[9px] text-gray-400">Price</span>
                              <span className="text-xs font-extrabold text-gray-900 dark:text-white">
                                {Number(product.price).toLocaleString()} UGX
                              </span>
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                addItem({
                                  id: product.id,
                                  productId: product.id,
                                  name: product.name,
                                  slug: product.slug,
                                  price: Number(product.price),
                                  imageUrl: product.imageUrl,
                                  stock: product.stock
                                });
                                showToast(`${product.name} added to cart`, "success");
                              }}
                              disabled={!hasStock}
                              className={`p-2 rounded-xl transition-all active:scale-95 z-10 ${hasStock ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-200 text-gray-400 dark:bg-gray-800 cursor-not-allowed"}`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Orders Tab Content */}
          {activeTab === "orders" && (
            <div className="animate-fade-in px-5 mt-4 flex-1 space-y-4">
              <h2 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" /> Order History
              </h2>

              {!user ? (
                <div className="bg-white dark:bg-[#121214] border border-gray-100 dark:border-white/5 p-6 rounded-2xl text-center space-y-3">
                  <UserIcon className="w-10 h-10 text-gray-450 mx-auto" />
                  <p className="text-xs text-gray-500">Please Log In or Register on the *Profile* tab to view your order history timeline.</p>
                  <button 
                    onClick={() => setActiveTab("profile")}
                    className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700"
                  >
                    Go to Profile
                  </button>
                </div>
              ) : loadingOrders ? (
                <div className="h-48 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Package className="w-10 h-10 text-gray-300 dark:text-gray-650 mx-auto mb-2 animate-pulse" />
                  <p className="text-xs">You have not placed any orders yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div 
                      key={order.id}
                      onClick={() => handleViewOrderDetails(order.id)}
                      className="bg-white dark:bg-[#121214] border border-gray-100 dark:border-white/5 p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:border-blue-500/20 transition shadow-sm"
                    >
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-900 dark:text-white">{order.orderNumber}</p>
                        <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-[#98989f]">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(order.createdAt).toLocaleDateString()}</span>
                          <span>• {order.itemCount} items</span>
                        </div>
                      </div>
                      
                      <div className="text-right flex items-center gap-2">
                        <div className="space-y-1">
                          <p className="text-xs font-black text-blue-600 dark:text-blue-400">{order.totalAmount.toLocaleString()} {order.currency}</p>
                          <span className={`inline-block px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${order.status === "DELIVERED" ? "bg-green-500/10 text-green-500" : order.status === "CANCELLED" ? "bg-red-500/10 text-red-500" : "bg-yellow-500/10 text-yellow-500"}`}>
                            {order.status}
                          </span>
                        </div>
                        {loadingOrderDetailId === order.id ? (
                          <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Profile Tab Content */}
          {activeTab === "profile" && (
            <div className="animate-fade-in px-5 mt-4 flex-1 space-y-6">
              
              {/* Profile Card */}
              {user ? (
                <div className="bg-white dark:bg-[#121214] border border-gray-100 dark:border-white/5 p-4 rounded-2xl space-y-4 shadow-sm animate-fade-in">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-600">
                      <UserIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">{user.name || "PleasureZone Member"}</h3>
                      <p className="text-[10px] text-gray-500 dark:text-[#98989f]">{user.email}</p>
                    </div>
                  </div>
                  
                  {user.phone && (
                    <div className="text-xs text-gray-650 dark:text-gray-300 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-green-500" />
                      <span>Linked Phone: <b>{user.phone}</b></span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden animate-fade-in">
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full filter blur-xl"></div>
                  <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-500/10 rounded-full filter blur-xl"></div>

                  <div className="text-center mb-6">
                    <h2 className="text-sm font-bold text-gray-800 dark:text-white">Account Association</h2>
                    <p className="text-[10px] text-gray-500 dark:text-[#98989f] mt-1">Log in or register to track orders and save addresses book</p>
                  </div>
                  
                  {/* Selector tabs for Profile login/register */}
                  <div className="flex bg-[#f6f6f8] dark:bg-[#2c2c2e] rounded-xl p-1 mb-6 border border-gray-200/10 dark:border-white/5">
                    <button 
                      onClick={() => setAuthTab("login")}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${authTab === "login" || authTab === "guest" ? "bg-white text-gray-900 dark:bg-white/10 dark:text-white shadow-sm" : "text-gray-500 dark:text-[#98989f] hover:text-gray-900 dark:hover:text-white"}`}
                    >
                      Log In
                    </button>
                    <button 
                      onClick={() => setAuthTab("register")}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${authTab === "register" ? "bg-white text-gray-900 dark:bg-white/10 dark:text-white shadow-sm" : "text-gray-500 dark:text-[#98989f] hover:text-gray-900"}`}
                    >
                      Register
                    </button>
                  </div>

                  {authTab === "login" || authTab === "guest" ? (
                    <form onSubmit={handleLoginLink} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-500 dark:text-[#98989f] uppercase font-semibold">Email Address</label>
                        <input 
                          type="email" 
                          value={authEmail} 
                          onChange={e => setAuthEmail(e.target.value)}
                          placeholder="Enter email"
                          className="w-full bg-[#f6f6f8] dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-500 dark:text-[#98989f] uppercase font-semibold">Password</label>
                        <input 
                          type="password" 
                          value={authPassword} 
                          onChange={e => setAuthPassword(e.target.value)}
                          placeholder="Enter password"
                          className="w-full bg-[#f6f6f8] dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isAuthLoading}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md active:scale-95 transition-all text-xs flex items-center justify-center gap-2 mt-4"
                      >
                        {isAuthLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>Link Account <ShieldCheck className="w-4 h-4" /></>
                        )}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleRegisterLink} className="space-y-4 animate-fade-in">
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-500 dark:text-[#98989f] uppercase font-semibold">Full Name</label>
                        <input 
                          type="text" 
                          value={authName} 
                          onChange={e => setAuthName(e.target.value)}
                          placeholder="Enter full name"
                          className="w-full bg-[#f6f6f8] dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-500 dark:text-[#98989f] uppercase font-semibold">Email Address</label>
                        <input 
                          type="email" 
                          value={authEmail} 
                          onChange={e => setAuthEmail(e.target.value)}
                          placeholder="Enter email"
                          className="w-full bg-[#f6f6f8] dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-500 dark:text-[#98989f] uppercase font-semibold">Password</label>
                        <input 
                          type="password" 
                          value={authPassword} 
                          onChange={e => setAuthPassword(e.target.value)}
                          placeholder="Minimum 8 characters"
                          className="w-full bg-[#f6f6f8] dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isAuthLoading}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md active:scale-95 transition-all text-xs flex items-center justify-center gap-2 mt-4"
                      >
                        {isAuthLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>Register & Link <ShieldCheck className="w-4 h-4" /></>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Address Book Manager */}
              {user && (
                <div className="space-y-4 animate-fade-in">
                  <h3 className="text-[10px] text-gray-400 dark:text-[#98989f] uppercase font-bold tracking-wider flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-600" /> Saved Addresses
                  </h3>

                  {loadingAddresses ? (
                    <div className="h-16 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                    </div>
                  ) : addresses.length === 0 ? (
                    <p className="text-[10px] text-gray-400 text-center py-2">No addresses saved yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {addresses.map((addr) => (
                        <div key={addr.id} className="bg-white dark:bg-[#121214] border border-gray-100 dark:border-white/5 p-3 rounded-xl flex items-center justify-between text-xs animate-fade-in">
                          <div>
                            <p className="font-bold text-gray-800 dark:text-white">{addr.street}</p>
                            <p className="text-[10px] text-gray-450 mt-0.5">{addr.city}, Uganda</p>
                          </div>
                          <button 
                            onClick={() => handleDeleteAddress(addr.id)}
                            className="p-1.5 text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Address Form */}
                  <form onSubmit={handleAddAddress} className="bg-[#f6f6f8] dark:bg-[#2c2c2e] border border-gray-250 dark:border-white/5 p-4 rounded-2xl space-y-3">
                    <p className="text-[10px] font-bold text-gray-800 dark:text-white flex items-center gap-1.5"><PlusCircle className="w-3.5 h-3.5 text-blue-600" /> Add New Address</p>
                    <div className="space-y-1">
                      <input 
                        type="text"
                        placeholder="Street Address / Room"
                        value={newStreet}
                        onChange={e => setNewStreet(e.target.value)}
                        className="w-full bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="City"
                        value={newCity}
                        onChange={e => setNewCity(e.target.value)}
                        className="flex-1 bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white"
                      />
                      <button 
                        type="submit"
                        disabled={isAddingAddress || !newStreet.trim()}
                        className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:opacity-90 active:scale-95 transition hover:bg-blue-700"
                      >
                        {isAddingAddress ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

            </div>
          )}

          {/* Floating Cart Bar */}
          {itemCount > 0 && activeTab === "catalog" && (
            <div className="fixed bottom-16 left-0 right-0 p-4 bg-gradient-to-t from-[#fbfbfd] via-[#fbfbfd]/95 to-transparent dark:from-black dark:via-black/95 z-20 transition-colors animate-fade-in">
              <button
                onClick={() => {
                  setCheckoutStep("cart");
                  setIsDrawerOpen(true);
                }}
                className="w-full max-w-md mx-auto py-3.5 px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-xl active:scale-95 transition-all text-xs flex items-between items-center"
              >
                <div className="flex items-center gap-2">
                  <div className="bg-white/20 p-1.5 rounded-lg">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <span className="text-[10px]">{itemCount} items in Cart</span>
                </div>
                <div className="flex items-center gap-1 ml-auto">
                  <span>View Cart: {total.toLocaleString()} UGX</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>
            </div>
          )}

          {/* Bottom Navigation Tab Bar */}
          <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#121214] border-t border-gray-150 dark:border-white/5 py-2 px-6 flex justify-around items-center z-45 shadow-lg transition-colors">
            <button 
              onClick={() => setActiveTab("catalog")}
              className={`flex flex-col items-center gap-1 transition ${activeTab === "catalog" ? "text-blue-600" : "text-gray-400"}`}
            >
              <ShoppingBag className="w-5 h-5" />
              <span className="text-[9px] font-bold">Catalog</span>
            </button>
            <button 
              onClick={() => setActiveTab("deals")}
              className={`flex flex-col items-center gap-1 transition ${activeTab === "deals" ? "text-blue-600" : "text-gray-400"}`}
            >
              <Tag className="w-5 h-5" />
              <span className="text-[9px] font-bold">Deals</span>
            </button>
            <button 
              onClick={() => setActiveTab("wishlist")}
              className={`flex flex-col items-center gap-1 transition ${activeTab === "wishlist" ? "text-blue-600" : "text-gray-400"}`}
            >
              <Heart className="w-5 h-5" />
              <span className="text-[9px] font-bold">Wishlist</span>
            </button>
            <button 
              onClick={() => setActiveTab("orders")}
              className={`flex flex-col items-center gap-1 transition ${activeTab === "orders" ? "text-blue-600" : "text-gray-400"}`}
            >
              <Package className="w-5 h-5" />
              <span className="text-[9px] font-bold">Orders</span>
            </button>
            <button 
              onClick={() => setActiveTab("profile")}
              className={`flex flex-col items-center gap-1 transition ${activeTab === "profile" ? "text-blue-600" : "text-gray-400"}`}
            >
              <UserIcon className="w-5 h-5" />
              <span className="text-[9px] font-bold">Profile</span>
            </button>
          </div>

        </div>
      )}

      {/* Product Details Slide-up Sheet */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 ${selectedProduct ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setSelectedProduct(null)}
      />
      
      <div 
        className={`fixed bottom-0 left-0 right-0 bg-white dark:bg-[#121214] border-t border-gray-150 dark:border-white/10 rounded-t-3xl max-h-[90vh] flex flex-col shadow-2xl z-50 transition-transform duration-300 ease-out transform ${selectedProduct ? "translate-y-0" : "translate-y-full"}`}
      >
        {selectedProduct && (
          <>
            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-[#2c2c2e]">
              <h2 className="text-sm font-bold text-gray-800 dark:text-white truncate pr-6">{selectedProduct.name}</h2>
              <button 
                onClick={() => setSelectedProduct(null)}
                className="p-1.5 bg-[#f6f6f8] dark:bg-[#2c2c2e] rounded-xl hover:bg-gray-300 dark:hover:bg-white/10 text-gray-500 dark:text-[#98989f] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable details */}
            <div className="overflow-y-auto p-5 space-y-6 flex-1">
              
              {/* Image Gallery */}
              <div className="relative aspect-square w-full max-w-sm mx-auto bg-gray-50 dark:bg-[#2c2c2e] rounded-2xl overflow-hidden shadow-md group">
                {selectedProduct.images && selectedProduct.images.length > 0 ? (
                  <div className="w-full h-full flex overflow-x-auto snap-x snap-mandatory scrollbar-hide">
                    {selectedProduct.images.map((img: string, idx: number) => (
                      <img 
                        key={idx} 
                        src={img} 
                        alt={`${selectedProduct.name} - image ${idx + 1}`} 
                        className="w-full h-full object-cover snap-center flex-shrink-0" 
                        onError={(e) => {
                          (e.target as any).src = "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=300&auto=format&fit=crop";
                        }}
                      />
                    ))}
                  </div>
                ) : selectedProduct.imageUrl ? (
                  <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <Sparkles className="w-12 h-12 opacity-20" />
                  </div>
                )}
                
                <span className={`absolute top-3 left-3 px-2.5 py-1 text-[9px] font-bold text-white rounded-md uppercase tracking-wider ${selectedProduct.stock > 0 ? "bg-blue-600" : "bg-red-600"} z-10`}>
                  {selectedProduct.stock > 0 ? "⚡ In Stock" : "❌ Out of Stock"}
                </span>

                {/* Dots indicator for gallery */}
                {selectedProduct.images && selectedProduct.images.length > 1 && (
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
                    {selectedProduct.images.map((_: any, idx: number) => (
                      <div key={idx} className="w-1.5 h-1.5 rounded-full bg-white/60 backdrop-blur-md" />
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <span className="text-xs text-blue-600 dark:text-blue-400 font-bold tracking-wider uppercase">{selectedProduct.category || "General"}</span>
                <h3 className="text-base font-black text-gray-900 dark:text-white leading-tight">{selectedProduct.name}</h3>
                
                <div className="flex items-baseline gap-3 pt-2">
                  <span className="text-lg font-black text-blue-600 dark:text-blue-400">{Number(selectedProduct.price).toLocaleString()} UGX</span>
                  {selectedProduct.comparePrice && (
                    <span className="text-xs text-gray-400 line-through">{Number(selectedProduct.comparePrice).toLocaleString()} UGX</span>
                  )}
                </div>
              </div>

              {/* Delivery Speed Card */}
              <div className="bg-gray-50 dark:bg-white/5 border border-gray-150 dark:border-white/5 p-4 rounded-2xl flex items-center gap-3">
                <Truck className="w-5 h-5 text-blue-600" />
                <div className="text-xs">
                  <p className="font-bold text-gray-800 dark:text-white">
                    {selectedProduct.badgeText === "From Abroad" || selectedProduct.slug.includes("dropship") ? "Standard Shipping (From Abroad)" : "Same-day Express Delivery"}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Discreet packaging with plain wrapper labels 🔒</p>
                </div>
              </div>

              {/* Variants Selector */}
              {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                <div className="space-y-4 bg-gray-50 dark:bg-white/5 p-4 rounded-2xl border border-gray-150 dark:border-white/5">
                  <h4 className="font-bold text-gray-800 dark:text-white uppercase tracking-wider text-[10px]">Select Options</h4>
                  
                  {uniqueSizes.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] text-gray-400 font-semibold">Size</p>
                      <div className="flex flex-wrap gap-2">
                        {uniqueSizes.map((size) => (
                          <button
                            key={size}
                            onClick={() => setSelectedVariants(prev => ({ ...prev, "Size": size }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${selectedVariants["Size"] === size ? "bg-blue-600 border-blue-600 text-white shadow-sm" : "bg-white dark:bg-black/30 border-gray-200 dark:border-white/5 text-gray-650 dark:text-gray-300"}`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {uniqueColors.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] text-gray-400 font-semibold">Color</p>
                      <div className="flex flex-wrap gap-2">
                        {uniqueColors.map((color) => (
                          <button
                            key={color}
                            onClick={() => setSelectedVariants(prev => ({ ...prev, "Color": color }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${selectedVariants["Color"] === color ? "bg-blue-600 border-blue-600 text-white shadow-sm" : "bg-white dark:bg-black/30 border-gray-200 dark:border-white/5 text-gray-650 dark:text-gray-300"}`}
                          >
                            {color}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {uniqueMaterials.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] text-gray-400 font-semibold">Material</p>
                      <div className="flex flex-wrap gap-2">
                        {uniqueMaterials.map((material) => (
                          <button
                            key={material}
                            onClick={() => setSelectedVariants(prev => ({ ...prev, "Material": material }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${selectedVariants["Material"] === material ? "bg-blue-600 border-blue-600 text-white shadow-sm" : "bg-white dark:bg-black/30 border-gray-200 dark:border-white/5 text-gray-655 dark:text-gray-300"}`}
                          >
                            {material}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Product description */}
              {loadingProductDetail ? (
                <div className="space-y-2 py-4">
                  <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-1/3 animate-pulse"></div>
                  <div className="h-16 bg-gray-200 dark:bg-white/10 rounded w-full animate-pulse"></div>
                </div>
              ) : selectedProduct.description ? (
                <div className="space-y-2 text-xs leading-relaxed text-gray-605 dark:text-gray-300 animate-fade-in">
                  <h4 className="font-bold text-gray-800 dark:text-white uppercase tracking-wider text-[10px]">Product Overview</h4>
                  <p className="bg-gray-50 dark:bg-black/10 p-3 rounded-xl whitespace-pre-wrap">{selectedProduct.description}</p>
                </div>
              ) : null}

              {/* Price Slash Section */}
              {selectedProduct.activeSlash ? (
                <div className="bg-gradient-to-r from-red-500/10 to-pink-500/10 dark:from-red-955/20 dark:to-pink-955/20 border border-red-200 dark:border-red-900/30 p-4 rounded-2xl space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase text-red-650 dark:text-red-400 tracking-wider flex items-center gap-1">
                      <Scissors className="w-3.5 h-3.5 animate-bounce" /> Active Price Slash
                    </span>
                    <span className="text-[8px] font-black bg-red-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
                      {Math.round(((Number(selectedProduct.price) - Number(selectedProduct.activeSlash.currentPrice)) / Number(selectedProduct.price)) * 100)}% Cut
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">Slashed Price:</span>
                    <span className="text-sm font-black text-red-600 dark:text-red-400">{Number(selectedProduct.activeSlash.currentPrice).toLocaleString()} UGX</span>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[8px] text-gray-400 font-semibold">
                      <span>Cuts: {selectedProduct.activeSlash.slashCount || selectedProduct.activeSlash.currentSlashes || 0} / {selectedProduct.activeSlash.maxSlashes || 5}</span>
                      <span>Target: {Number(selectedProduct.activeSlash.targetPrice || (Number(selectedProduct.price) * 0.5)).toLocaleString()} UGX</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-red-500 to-pink-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, ((selectedProduct.activeSlash.slashCount || selectedProduct.activeSlash.currentSlashes || 0) / (selectedProduct.activeSlash.maxSlashes || 5)) * 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const shareText = `✂️ Help me slash the price of ${selectedProduct.name}! Click this link to cut it down: ${window.location.origin}/slash/${selectedProduct.activeSlash.slashCode}`;
                      const shareUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
                      if (tgSdk) {
                        tgSdk.openLink(shareUrl);
                      } else {
                        window.open(shareUrl, "_blank");
                      }
                      showToast("WhatsApp sharing opened!", "success");
                    }}
                    className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-[10px] transition active:scale-95 flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <Copy className="w-3.5 h-3.5" /> Share Slash to WhatsApp
                  </button>
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-white/5 border border-dashed border-gray-200 dark:border-white/10 p-4 rounded-2xl flex items-center justify-between gap-3 animate-fade-in">
                  <div className="flex-1 text-left">
                    <p className="font-bold text-gray-808 dark:text-white flex items-center gap-1 text-[10px] uppercase tracking-wider">
                      <Scissors className="w-3.5 h-3.5 text-red-500" /> Start Price Slash
                    </p>
                    <p className="text-[9px] text-gray-400 mt-0.5 leading-normal">Slash this price by up to 50% by sharing it with friends!</p>
                  </div>
                  <button
                    onClick={() => handleStartPriceSlash(selectedProduct.id)}
                    disabled={startingSlashId === selectedProduct.id}
                    className="py-2.5 px-4 bg-gradient-to-r from-red-500 to-pink-500 text-white font-black rounded-xl text-[10px] hover:opacity-90 active:scale-95 transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    {startingSlashId === selectedProduct.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>Slash ✂️</>
                    )}
                  </button>
                </div>
              )}

              {/* Add to Cart button */}
              <button
                onClick={() => {
                  const variantString = getSelectedVariantString();
                  let price = Number(selectedProduct.price);
                  let stock = selectedProduct.stock;
                  
                  if (selectedProduct.variants && selectedProduct.variants.length > 0) {
                    const match = selectedProduct.variants.find((v: any) => {
                      const sizeMatch = !v.size || selectedVariants["Size"] === v.size;
                      const colorMatch = !v.color || selectedVariants["Color"] === v.color;
                      const matMatch = !v.material || selectedVariants["Material"] === v.material;
                      return sizeMatch && colorMatch && matMatch;
                    });
                    if (match) {
                      if (match.price !== null && match.price !== undefined) {
                        price = Number(match.price);
                      }
                      stock = match.stock;
                    }
                  }

                  addItem({
                    id: selectedProduct.id + variantString,
                    productId: selectedProduct.id,
                    name: selectedProduct.name + variantString,
                    slug: selectedProduct.slug,
                    price: price,
                    imageUrl: selectedProduct.imageUrl,
                    stock: stock
                  });
                  showToast(`${selectedProduct.name}${variantString} added to cart`, "success");
                  setSelectedProduct(null);
                }}
                disabled={selectedProduct.stock <= 0}
                className={`w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-all text-xs flex items-center justify-center gap-2 ${selectedProduct.stock > 0 ? "" : "opacity-50 cursor-not-allowed"}`}
              >
                <Plus className="w-4 h-4" /> Add to Cart — {Number(selectedProduct.price).toLocaleString()} UGX
              </button>
            </div>
          </>
        )}
      </div>

      {/* Cart & Checkout Slide-up Bottom Sheet Drawer */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 ${isDrawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setIsDrawerOpen(false)}
      />
      
      <div 
        className={`fixed bottom-0 left-0 right-0 bg-white dark:bg-[#121214] border-t border-gray-150 dark:border-white/10 rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl z-50 transition-transform duration-300 ease-out transform ${isDrawerOpen ? "translate-y-0" : "translate-y-full"}`}
      >
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-[#2c2c2e]">
          <div className="flex items-center gap-2">
            {(checkoutStep === "shipping" || checkoutStep === "payment") && (
              <button 
                onClick={() => setCheckoutStep(checkoutStep === "payment" ? "shipping" : "cart")}
                className="p-1 text-gray-400 hover:text-gray-800 dark:hover:text-white transition mr-1"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-sm font-bold flex items-center gap-2 text-gray-800 dark:text-white">
              {checkoutStep === "cart" && <><CartIcon className="w-4 h-4 text-blue-600" /> Shopping Cart</>}
              {checkoutStep === "shipping" && <><Truck className="w-4 h-4 text-blue-600" /> Shipping Details</>}
              {checkoutStep === "payment" && <><CreditCard className="w-4 h-4 text-blue-600" /> Payment & Review</>}
              {checkoutStep === "success" && <><Check className="w-4 h-4 text-green-500" /> Order Placed!</>}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {/* Step dots indicator */}
            {checkoutStep !== "success" && (
              <div className="flex items-center gap-1.5">
                {["cart", "shipping", "payment"].map((step, i) => (
                  <div key={step} className={`w-1.5 h-1.5 rounded-full transition-all ${
                    checkoutStep === step ? "w-4 bg-blue-600" : 
                    ["cart", "shipping", "payment"].indexOf(checkoutStep) > i ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
                  }`} />
                ))}
              </div>
            )}
            <button 
              onClick={() => setIsDrawerOpen(false)}
              className="p-1.5 bg-[#f6f6f8] dark:bg-[#2c2c2e] rounded-xl hover:bg-gray-300 dark:hover:bg-white/10 text-gray-500 dark:text-[#98989f] transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Drawer Content */}
        <div className="overflow-y-auto p-5 space-y-6 flex-1">
          
          {/* Step 1: Cart Items List */}
          {checkoutStep === "cart" && (
            <>
              {items.length === 0 ? (
                <div className="text-center py-12 space-y-3 animate-fade-in">
                  <ShoppingBag className="w-12 h-12 text-gray-300 dark:text-gray-650 mx-auto" />
                  <p className="text-sm font-bold text-gray-400">Your cart is empty</p>
                  <button 
                    onClick={() => setIsDrawerOpen(false)}
                    className="px-4 py-2 bg-blue-600/10 text-blue-600 text-xs font-bold rounded-xl hover:bg-blue-600/20"
                  >
                    Explore Catalog
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-4 animate-fade-in">
                    {items.map((item) => (
                      <div key={item.id} className="flex gap-3 items-center bg-[#f6f6f8] dark:bg-[#2c2c2e] border border-gray-100 dark:border-white/5 p-3 rounded-2xl animate-fade-in">
                        <div className="w-12 h-12 bg-white dark:bg-[#121214] rounded-xl overflow-hidden flex-shrink-0">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-600">
                              <Sparkles className="w-4 h-4 opacity-30" />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold truncate text-gray-800 dark:text-white leading-tight">{item.name}</h4>
                          <p className="text-[10px] text-gray-500 dark:text-[#98989f] mt-0.5">{item.price.toLocaleString()} UGX</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="p-1 bg-gray-200 dark:bg-white/5 rounded-lg text-gray-500 dark:text-gray-400"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-bold text-gray-800 dark:text-white w-4 text-center">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="p-1 bg-gray-200 dark:bg-white/5 rounded-lg text-gray-500 dark:text-gray-400"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => removeItem(item.id)}
                            className="p-1 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-500 ml-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total Summary */}
                  <div className="bg-[#f6f6f8] dark:bg-[#2c2c2e] border border-gray-100 dark:border-white/5 p-4 rounded-2xl space-y-2">
                    <div className="flex justify-between text-xs text-gray-500 dark:text-[#98989f]">
                      <span>Subtotal</span>
                      <span>{total.toLocaleString()} UGX</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 dark:text-[#98989f]">
                      <span>Shipping</span>
                      <span>Calculated next step</span>
                    </div>
                    <hr className="border-gray-200 dark:border-white/5 my-1" />
                    <div className="flex justify-between text-sm font-extrabold text-gray-800 dark:text-white">
                      <span>Grand Total</span>
                      <span className="text-blue-600 dark:text-blue-400">{total.toLocaleString()} UGX</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setCheckoutStep("shipping")}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-all text-xs flex items-center justify-center gap-2"
                  >
                    Proceed to Delivery <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </>
          )}

          {/* Step 2: Shipping Details Form */}
          {checkoutStep === "shipping" && (
            <div className="space-y-5 animate-fade-in text-xs pb-4">
              {/* Receiver Info */}
              <div className="space-y-3 bg-gray-50 dark:bg-black/20 p-4 rounded-2xl border border-gray-150 dark:border-white/5">
                <h3 className="text-[10px] text-gray-400 dark:text-[#98989f] uppercase font-bold tracking-wider">Receiver Info</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 font-medium">Contact Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. John Doe"
                      value={shippingName}
                      onChange={e => setShippingName(e.target.value)}
                      className="w-full bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-xl px-3 py-2.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 font-medium">Phone Number</label>
                    <input 
                      type="text" 
                      placeholder="e.g. +2567..."
                      value={shippingPhone}
                      onChange={e => setShippingPhone(e.target.value)}
                      className="w-full bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-xl px-3 py-2.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Saved Addresses quick pre-fill */}
              {user && savedAddresses.length > 0 && (
                <div className="space-y-2 bg-gray-50 dark:bg-black/20 p-4 rounded-2xl border border-gray-150 dark:border-white/5 animate-fade-in">
                  <h4 className="text-[10px] text-gray-450 dark:text-[#98989f] uppercase font-bold tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-600" /> Use Saved Address
                  </h4>
                  <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide">
                    {savedAddresses.map((addr) => {
                      const isSelected = shippingAddress === (addr.street || addr.address) && shippingCity === (addr.city || "Kampala");
                      return (
                        <button
                          key={addr.id}
                          type="button"
                          onClick={() => selectSavedAddr(addr)}
                          className={`p-3 rounded-2xl border text-left flex-shrink-0 w-48 transition-all active:scale-98 ${
                            isSelected
                              ? "bg-blue-600/10 border-blue-600 text-blue-600 dark:text-blue-400 font-bold"
                              : "bg-white dark:bg-black/30 border-gray-200 dark:border-white/5 text-gray-650 dark:text-gray-300"
                          }`}
                        >
                          <p className="text-[10px] font-bold truncate">{addr.street || addr.address}</p>
                          <p className="text-[9px] text-gray-500 dark:text-[#98989f] truncate mt-0.5">{addr.city}, Uganda</p>
                          {addr.isDefault && (
                            <span className="inline-block mt-2 px-1.5 py-0.5 bg-blue-600 text-white rounded text-[8px] uppercase tracking-wider font-extrabold">Default</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Delivery Method */}
              <div className="space-y-2">
                <h3 className="text-[10px] text-gray-400 dark:text-[#98989f] uppercase font-bold tracking-wider">Delivery Option</h3>
                <div className="grid grid-cols-3 gap-2">
                  {allowedDeliveryMethods.includes("HOME_DELIVERY") && (
                    <button 
                      type="button"
                      onClick={() => setDeliveryMethod("home")}
                      className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${deliveryMethod === "home" ? "bg-blue-600/10 border-blue-600 text-blue-600 dark:text-blue-400 font-bold" : "bg-[#f6f6f8] dark:bg-[#121214] border-gray-200 dark:border-white/5 text-gray-400"}`}
                    >
                      <Truck className="w-4 h-4" />
                      <span className="text-[9px]">Standard</span>
                    </button>
                  )}
                  
                  {allowedDeliveryMethods.includes("PICKUP") && (
                    <button 
                      type="button"
                      onClick={() => setDeliveryMethod("pickup")}
                      className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${deliveryMethod === "pickup" ? "bg-blue-600/10 border-blue-600 text-blue-600 dark:text-blue-400 font-bold" : "bg-[#f6f6f8] dark:bg-[#121214] border-gray-200 dark:border-white/5 text-gray-400"}`}
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span className="text-[9px]">Pickup Point</span>
                    </button>
                  )}
                  
                  {allowedDeliveryMethods.includes("SELLER_PICKUP") && sellerPickupInfo && (
                    <button 
                      type="button"
                      onClick={() => setDeliveryMethod("seller_pickup")}
                      className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${deliveryMethod === "seller_pickup" ? "bg-blue-600/10 border-blue-600 text-blue-600 dark:text-blue-400 font-bold" : "bg-[#f6f6f8] dark:bg-[#121214] border-gray-200 dark:border-white/5 text-gray-400"}`}
                    >
                      <UserIcon className="w-4 h-4" />
                      <span className="text-[9px]">Seller Store</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Delivery Address Details */}
              {deliveryMethod === "home" && (
                <div className="space-y-3 bg-gray-50 dark:bg-black/20 p-4 rounded-2xl border border-gray-150 dark:border-white/5">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 font-medium">Street / Delivery Address</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Plot 12 Kampala Road, Room 4"
                      value={shippingAddress}
                      onChange={e => setShippingAddress(e.target.value)}
                      className="w-full bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-xl px-3 py-2.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 font-medium">City</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Kampala"
                      value={shippingCity}
                      onChange={e => setShippingCity(e.target.value)}
                      className="w-full bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-xl px-3 py-2.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Pickup Point Selection */}
              {deliveryMethod === "pickup" && (
                <div className="space-y-2 bg-gray-50 dark:bg-black/20 p-4 rounded-2xl border border-gray-150 dark:border-white/5">
                  <label className="text-[10px] text-gray-500 font-medium flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-blue-600" /> Select Pickup Point Location
                  </label>
                  {pickupPoints.length > 0 ? (
                    <select
                      value={selectedPickupPointId}
                      onChange={(e) => {
                        setSelectedPickupPointId(e.target.value);
                        addLog(`Selected Pickup Point ID: ${e.target.value}`, "info");
                      }}
                      className="w-full bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-xl px-3 py-2.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="">-- Select location --</option>
                      {pickupPoints.map((point) => (
                        <option key={point.id} value={point.id}>
                          {point.name} ({point.city}) - {point.address}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-[10px] text-gray-400">Loading pickup locations...</p>
                  )}
                </div>
              )}

              {/* Seller Pickup Info */}
              {deliveryMethod === "seller_pickup" && sellerPickupInfo && (
                <div className="bg-blue-500/5 border border-blue-600/10 p-4 rounded-2xl space-y-2 leading-relaxed text-gray-700 dark:text-gray-300 animate-fade-in">
                  <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 tracking-wider">
                    <Info className="w-3.5 h-3.5" /> Pickup Store Details
                  </div>
                  <p className="text-xs font-bold text-gray-900 dark:text-white">{sellerPickupInfo.storeName}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    <strong className="text-gray-700 dark:text-gray-200">Address:</strong> {sellerPickupInfo.address}, {sellerPickupInfo.city}
                  </p>
                  {sellerPickupInfo.hours && (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      <strong className="text-gray-700 dark:text-gray-200">Hours:</strong> {sellerPickupInfo.hours}
                    </p>
                  )}
                  {sellerPickupInfo.phone && (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      <strong className="text-gray-700 dark:text-gray-200">Phone:</strong> {sellerPickupInfo.phone}
                    </p>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  if (!shippingName.trim() || !shippingPhone.trim()) {
                    showToast("Receiver name and phone number are required", "error");
                    return;
                  }
                  if (deliveryMethod === "home" && !shippingAddress.trim()) {
                    showToast("Delivery address is required", "error");
                    return;
                  }
                  if (deliveryMethod === "pickup" && !selectedPickupPointId) {
                    showToast("Please select a pickup point", "error");
                    return;
                  }
                  setCheckoutStep("payment");
                  addLog(`Selected delivery method: ${deliveryMethod}. Proceeded to payment.`, "info");
                }}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-all text-xs flex items-center justify-center gap-2 mt-4"
              >
                Continue to Payment <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 3: Payment & Review Form */}
          {checkoutStep === "payment" && (
            <div className="space-y-5 animate-fade-in text-xs pb-4">
              {/* Promo Code Coupon Input */}
              <div className="space-y-2 bg-gray-50 dark:bg-black/20 p-4 rounded-2xl border border-gray-150 dark:border-white/5">
                <label className="text-[10px] text-gray-500 dark:text-[#98989f] uppercase font-bold tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-blue-600" /> Apply Promo Code
                </label>
                {!couponApplied ? (
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Enter code (e.g. TEST10)"
                      value={couponCode}
                      onChange={e => setCouponCode(e.target.value.toUpperCase())}
                      className="flex-1 bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white uppercase focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={couponLoading || !couponCode.trim()}
                      className="px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl active:scale-95 transition text-xs flex items-center justify-center min-w-[70px] disabled:opacity-50"
                    >
                      {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-green-500/5 border border-green-500/10 p-2.5 rounded-xl">
                    <span className="text-green-600 dark:text-green-400 font-bold flex items-center gap-1">
                      <Check className="w-4 h-4" /> Code applied (-{couponDiscount.toLocaleString()} UGX)
                    </span>
                    <button 
                      type="button" 
                      onClick={handleRemoveCoupon} 
                      className="text-red-500 font-bold hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                )}
                {couponError && <p className="text-[10px] text-red-500 mt-1">{couponError}</p>}
              </div>

              {/* Store Credit */}
              {user && storeCreditBalance > 0 && (
                <div className="space-y-2 bg-gray-50 dark:bg-black/20 p-4 rounded-2xl border border-gray-150 dark:border-white/5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-gray-500 dark:text-[#98989f] uppercase font-bold tracking-wider flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-blue-600" /> Apply Store Credit
                    </label>
                    <span className="text-[10px] text-gray-400 font-semibold">Available: {storeCreditBalance.toLocaleString()} UGX</span>
                  </div>
                  {!storeCreditApplied ? (
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        placeholder="Amount to use"
                        max={Math.min(storeCreditBalance, remainingAfterCoupon)}
                        value={storeCreditAmount || ""}
                        onChange={e => setStoreCreditAmount(Math.min(Number(e.target.value), storeCreditBalance, remainingAfterCoupon))}
                        className="flex-1 bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (storeCreditAmount > 0) {
                            setStoreCreditApplied(true);
                            addLog(`Applied ${storeCreditAmount} UGX from store credit.`, "success");
                          }
                        }}
                        disabled={storeCreditAmount <= 0}
                        className="px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl active:scale-95 transition text-xs"
                      >
                        Apply
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-green-500/5 border border-green-500/10 p-2.5 rounded-xl">
                      <span className="text-green-600 dark:text-green-400 font-bold">
                        Credit applied: -{storeCreditDiscount.toLocaleString()} UGX
                      </span>
                      <button 
                        type="button" 
                        onClick={() => {
                          setStoreCreditApplied(false);
                          setStoreCreditAmount(0);
                          addLog("Removed store credit.", "info");
                        }} 
                        className="text-red-500 font-bold hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Loyalty Points */}
              {user && loyaltyBalance > 0 && (
                <div className="space-y-3 bg-gray-50 dark:bg-black/20 p-4 rounded-2xl border border-gray-150 dark:border-white/5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-gray-500 dark:text-[#98989f] uppercase font-bold tracking-wider flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-blue-600" /> Redeem Loyalty Points
                    </label>
                    <span className="text-[10px] text-gray-400 font-semibold">Available: {loyaltyBalance.toLocaleString()} points</span>
                  </div>
                  {!loyaltyApplied ? (
                    <div className="space-y-2">
                      <input 
                        type="range" 
                        min={0}
                        max={Math.min(loyaltyBalance, Math.floor(remainingAfterCoupon - storeCreditDiscount))}
                        value={loyaltyRedeem}
                        onChange={e => setLoyaltyRedeem(Number(e.target.value))}
                        className="w-full accent-blue-600"
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                          Redeem: {loyaltyRedeem.toLocaleString()} points (worth {loyaltyRedeem.toLocaleString()} UGX)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (loyaltyRedeem > 0) {
                              setLoyaltyApplied(true);
                              addLog(`Redeemed ${loyaltyRedeem} loyalty points.`, "success");
                            }
                          }}
                          disabled={loyaltyRedeem <= 0}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg active:scale-95 transition text-[10px]"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-green-500/5 border border-green-500/10 p-2.5 rounded-xl">
                      <span className="text-green-600 dark:text-green-400 font-bold">
                        Points applied: -{loyaltyDiscount.toLocaleString()} UGX
                      </span>
                      <button 
                        type="button" 
                        onClick={() => {
                          setLoyaltyApplied(false);
                          setLoyaltyRedeem(0);
                          addLog("Removed loyalty points redemption.", "info");
                        }} 
                        className="text-red-500 font-bold hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Gift Card */}
              <div className="space-y-2 bg-gray-50 dark:bg-black/20 p-4 rounded-2xl border border-gray-150 dark:border-white/5">
                <label className="text-[10px] text-gray-500 dark:text-[#98989f] uppercase font-bold tracking-wider flex items-center gap-1.5">
                  <Gift className="w-3.5 h-3.5 text-blue-600" /> Redeem Gift Card
                </label>
                {!giftCardApplied ? (
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Gift Card Code"
                      value={giftCardCodeInput}
                      onChange={e => setGiftCardCodeInput(e.target.value.toUpperCase())}
                      className="flex-1 bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white uppercase focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleApplyGiftCard}
                      disabled={giftCardLoading || !giftCardCodeInput.trim()}
                      className="px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl active:scale-95 transition text-xs disabled:opacity-50"
                    >
                      {giftCardLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Check"}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-green-500/5 border border-green-500/10 p-2.5 rounded-xl">
                    <span className="text-green-600 dark:text-green-400 font-bold">
                      Gift Card applied: -{giftCardDiscountVal.toLocaleString()} UGX (Balance: {giftCardBalance.toLocaleString()} UGX)
                    </span>
                    <button 
                      type="button" 
                      onClick={handleRemoveGiftCard} 
                      className="text-red-500 font-bold hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* Installments split */}
              {paymentMethod !== "cod" && total >= 100000 && (
                <div className="space-y-3 bg-gray-50 dark:bg-black/20 p-4 rounded-2xl border border-gray-150 dark:border-white/5 transition-all">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={installmentsEnabled}
                      onChange={e => {
                        setInstallmentsEnabled(e.target.checked);
                        addLog(`Split payment / installments enabled: ${e.target.checked}`, "info");
                      }}
                      className="accent-blue-600 w-4 h-4"
                    />
                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-white">Pay in Installments</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Split order into smaller payments</p>
                    </div>
                  </label>
                  {installmentsEnabled && (
                    <div className="space-y-2 border-t border-gray-200/40 dark:border-white/5 pt-2 animate-fade-in">
                      <p className="text-[10px] text-gray-400 font-medium">Select number of payments:</p>
                      <div className="flex gap-2">
                        {[2, 3, 4].map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => {
                              setInstallmentCount(n);
                              addLog(`Set installment plan count: ${n} payments`, "info");
                            }}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${installmentCount === n ? "bg-blue-600 border-blue-600 text-white shadow-sm" : "bg-white dark:bg-black/30 border-gray-200 dark:border-white/5 text-gray-500"}`}
                          >
                            {n} payments
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold bg-blue-600/5 p-2 rounded-xl">
                        First installment to pay today: {firstInstallmentAmount.toLocaleString()} UGX
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Payment Method */}
              <div className="space-y-2">
                <h3 className="text-[10px] text-gray-400 dark:text-[#98989f] uppercase font-bold tracking-wider">Payment Method</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    type="button"
                    onClick={() => {
                      if (!codAllowedByProducts) {
                        showToast("Cash on Delivery not allowed for some items in cart", "warning");
                        return;
                      }
                      setPaymentMethod("cod");
                      setInstallmentsEnabled(false);
                      addLog("Switched payment method to Cash on Delivery.", "info");
                    }}
                    className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${paymentMethod === "cod" ? "bg-blue-600/10 border-blue-600 text-blue-600 dark:text-blue-400 font-bold" : "bg-[#f6f6f8] dark:bg-[#121214] border-gray-200 dark:border-white/5 text-gray-400"} ${!codAllowedByProducts ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    <div>
                      <p className="text-xs">Cash On Delivery</p>
                      <p className="text-[9px] text-gray-500 font-normal mt-0.5">Pay when you receive</p>
                    </div>
                    <CreditCard className="w-4 h-4 opacity-55" />
                  </button>
                  
                  <button 
                    type="button"
                    onClick={() => {
                      setPaymentMethod("mobile_money");
                      addLog("Switched payment method to Mobile Money online checkout.", "info");
                    }}
                    className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${paymentMethod === "mobile_money" ? "bg-blue-600/10 border-blue-600 text-blue-600 dark:text-blue-400 font-bold" : "bg-[#f6f6f8] dark:bg-[#121214] border-gray-200 dark:border-white/5 text-gray-400"}`}
                  >
                    <div>
                      <p className="text-xs">Mobile Money / Cards</p>
                      <p className="text-[9px] text-gray-500 font-normal mt-0.5">MTN / Airtel instant</p>
                    </div>
                    <Sparkles className="w-4 h-4 opacity-55" />
                  </button>
                </div>
                {!codAllowedByProducts && (
                  <p className="text-[9px] text-red-500/80 mt-1 leading-tight flex items-start gap-1">
                    <Info className="w-3.5 h-3.5 flex-shrink-0" /> Note: Cash on Delivery is disabled because one or more products in your cart require online pre-payment.
                  </p>
                )}
              </div>

              {/* Mobile Money Details */}
              {paymentMethod === "mobile_money" && (
                <div className="bg-[#f6f6f8] dark:bg-[#2c2c2e] border border-gray-200 dark:border-white/5 p-4 rounded-2xl space-y-3">
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setMomoNetwork("MTN")}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition ${momoNetwork === "MTN" ? "bg-yellow-400/10 border-yellow-400 text-yellow-600 font-bold" : "bg-white dark:bg-[#121214] border-gray-200 dark:border-white/5 text-gray-500"}`}
                    >
                      MTN MoMo
                    </button>
                    <button 
                      type="button"
                      onClick={() => setMomoNetwork("AIRTEL")}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition ${momoNetwork === "AIRTEL" ? "bg-red-500/10 border-red-400 text-red-500 font-bold" : "bg-white dark:bg-[#121214] border-gray-200 dark:border-white/5 text-gray-500"}`}
                    >
                      Airtel Money
                    </button>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 font-medium">MoMo Phone Number</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 0770000000"
                      value={momoPhone}
                      onChange={e => setMomoPhone(e.target.value)}
                      className="w-full bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-xl px-3 py-2.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Detailed Total Breakdown review */}
              <div className="bg-[#f6f6f8] dark:bg-[#2c2c2e] border border-gray-200 dark:border-white/5 p-4 rounded-2xl space-y-2 mt-4 leading-relaxed text-xs">
                <div className="flex justify-between text-gray-500 dark:text-gray-400 font-medium">
                  <span>Subtotal ({itemCount} items)</span>
                  <span>{total.toLocaleString()} UGX</span>
                </div>
                
                {couponApplied && (
                  <div className="flex justify-between text-green-600 dark:text-green-400 font-medium">
                    <span>Promo Code Discount</span>
                    <span>-{couponDiscountAmount.toLocaleString()} UGX</span>
                  </div>
                )}
                
                {storeCreditApplied && storeCreditDiscount > 0 && (
                  <div className="flex justify-between text-green-600 dark:text-green-400 font-medium">
                    <span>Store Credit Applied</span>
                    <span>-{storeCreditDiscount.toLocaleString()} UGX</span>
                  </div>
                )}
                
                {loyaltyApplied && loyaltyDiscount > 0 && (
                  <div className="flex justify-between text-green-600 dark:text-green-400 font-medium">
                    <span>Loyalty Points Applied</span>
                    <span>-{loyaltyDiscount.toLocaleString()} UGX</span>
                  </div>
                )}
                
                {giftCardApplied && giftCardDiscountVal > 0 && (
                  <div className="flex justify-between text-green-600 dark:text-green-400 font-medium">
                    <span>Gift Card Used</span>
                    <span>-{giftCardDiscountVal.toLocaleString()} UGX</span>
                  </div>
                )}

                <div className="flex justify-between text-gray-500 dark:text-gray-400 font-medium">
                  <span>Delivery Fee</span>
                  <span>{shippingCost > 0 ? `${shippingCost.toLocaleString()} UGX` : "Free"}</span>
                </div>

                <hr className="border-gray-200 dark:border-white/5 my-1" />
                
                <div className="flex justify-between font-black text-gray-900 dark:text-white">
                  <span>Total Amount</span>
                  <span className="text-blue-600 dark:text-blue-400 font-extrabold text-sm">
                    {finalTotal.toLocaleString()} UGX
                  </span>
                </div>

                {installmentsEnabled && installmentCount >= 2 && (
                  <div className="mt-2 bg-blue-500/5 p-2.5 rounded-xl border border-blue-600/10 text-[10px] text-blue-600 dark:text-blue-300 font-medium space-y-1">
                    <div className="flex justify-between">
                      <span>Split Payment Plan:</span>
                      <span>{installmentCount} installments</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>First Payment Due Today:</span>
                      <span>{firstInstallmentAmount.toLocaleString()} UGX</span>
                    </div>
                    <div className="flex justify-between text-gray-400 font-normal">
                      <span>Remaining balance:</span>
                      <span>{(finalTotal - firstInstallmentAmount).toLocaleString()} UGX</span>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={isPlacingOrder}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-all text-xs flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
              >
                {isPlacingOrder ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {installmentsEnabled && installmentCount >= 2 ? (
                      <>Place Order & Pay Installment — {firstInstallmentAmount.toLocaleString()} UGX</>
                    ) : (
                      <>Place Order & Pay — {finalTotal.toLocaleString()} UGX</>
                    )}
                    <Check className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* Step 3: Success Screen */}
          {checkoutStep === "success" && createdOrder && (
            <div className="text-center py-8 space-y-5 flex flex-col items-center justify-center animate-fade-in">
              <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center text-green-500 mb-2">
                <Check className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-gray-900 dark:text-white">Thank You for your Order!</h3>
                <p className="text-xs text-gray-500">Discreet package preparation is starting immediately.</p>
              </div>
              
              <div className="bg-[#f6f6f8] dark:bg-[#2c2c2e] border border-gray-200 dark:border-white/5 rounded-2xl p-4 w-full text-left space-y-2.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Order ID:</span>
                  <span className="font-mono text-gray-900 dark:text-white select-text">{createdOrder.orderId || "Pending"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Status:</span>
                  <span className="text-green-550 font-bold uppercase tracking-wider">{createdOrder.status || "CONFIRMED"}</span>
                </div>
                {paymentMethod === "mobile_money" && (
                  <div className="text-[10px] text-yellow-600 dark:text-yellow-400 bg-yellow-400/5 border border-yellow-400/10 p-2.5 rounded-xl flex items-start gap-2 mt-2 leading-relaxed">
                    <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>Please check your phone for the Mobile Money payment prompt to complete transaction.</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setIsDrawerOpen(false);
                  setCheckoutStep("cart");
                }}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-all text-xs"
              >
                Continue Shopping
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Catalog Filter & Sort Slide-up Sheet */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 ${isFilterOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setIsFilterOpen(false)}
      />
      
      <div 
        className={`fixed bottom-0 left-0 right-0 bg-white dark:bg-[#121214] border-t border-gray-150 dark:border-white/10 rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl z-50 transition-transform duration-300 ease-out transform ${isFilterOpen ? "translate-y-0" : "translate-y-full"}`}
      >
        <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-[#2c2c2e] rounded-t-3xl">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-gray-800 dark:text-white">Filter & Sort</h2>
          </div>
          <button 
            type="button"
            onClick={() => setIsFilterOpen(false)}
            className="p-1.5 bg-[#f6f6f8] dark:bg-[#2c2c2e] rounded-xl hover:bg-gray-300 dark:hover:bg-white/10 text-gray-500 dark:text-[#98989f] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-6 flex-1 text-xs">
          {/* Sorting Option Group */}
          <div className="space-y-2.5">
            <h3 className="font-bold text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">Sort Products By</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "featured", label: "Featured" },
                { value: "price-asc", label: "Price: Low to High" },
                { value: "price-desc", label: "Price: High to Low" },
                { value: "rating", label: "Top Rated" },
                { value: "newest", label: "New Arrivals" }
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSortBy(opt.value as any)}
                  className={`py-2 px-3 rounded-xl border text-center font-semibold transition-all ${
                    sortBy === opt.value
                      ? "bg-blue-600/10 border-blue-600 text-blue-600 dark:bg-blue-500/20"
                      : "bg-[#f6f6f8] dark:bg-[#2c2c2e] border-gray-250 dark:border-white/5 text-gray-650 dark:text-gray-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <hr className="border-gray-150 dark:border-white/5" />

          {/* Price Range Filter */}
          <div className="space-y-2.5">
            <h3 className="font-bold text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">Price Range (UGX)</h3>
            <div className="flex items-center gap-3">
              <input
                type="number"
                placeholder="Min Price"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-full bg-[#f6f6f8] dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white"
              />
              <span className="text-gray-400">—</span>
              <input
                type="number"
                placeholder="Max Price"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-full bg-[#f6f6f8] dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <hr className="border-gray-150 dark:border-white/5" />

          {/* Minimum Rating */}
          <div className="space-y-2.5">
            <h3 className="font-bold text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">Customer Rating</h3>
            <div className="flex gap-2">
              {[
                { value: null, label: "Any Rating" },
                { value: 4, label: "4★ & above" },
                { value: 3, label: "3★ & above" }
              ].map((opt) => (
                <button
                  key={opt.value ?? "any"}
                  type="button"
                  onClick={() => setMinRating(opt.value)}
                  className={`flex-1 py-2 rounded-xl border text-center font-semibold transition-all ${
                    minRating === opt.value
                      ? "bg-blue-600/10 border-blue-600 text-blue-600 dark:bg-blue-500/20"
                      : "bg-[#f6f6f8] dark:bg-[#2c2c2e] border-gray-250 dark:border-white/5 text-gray-650 dark:text-gray-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <hr className="border-gray-150 dark:border-white/5" />

          {/* Delivery & Availability */}
          <div className="space-y-4">
            <h3 className="font-bold text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">Delivery & Availability</h3>
            
            {/* Stock Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-800 dark:text-white">In Stock Only</p>
                <p className="text-[10px] text-gray-500 mt-0.5">Hide items currently unavailable</p>
              </div>
              <button
                type="button"
                onClick={() => setInStockOnly(!inStockOnly)}
                className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${inStockOnly ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-700"}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${inStockOnly ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>

            {/* Shipping badges filter */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-800 dark:text-white">Shipping Badge</p>
                <p className="text-[10px] text-gray-500 mt-0.5">Filter by fulfillment origin</p>
              </div>
              <div className="flex bg-[#f6f6f8] dark:bg-[#2c2c2e] rounded-xl p-1 border border-gray-250 dark:border-white/5">
                {[
                  { value: "ALL", label: "All" },
                  { value: "EXPRESS", label: "Express" },
                  { value: "ABROAD", label: "Abroad" }
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setShippingFilter(opt.value as any)}
                    className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-all ${
                      shippingFilter === opt.value
                        ? "bg-white text-gray-900 dark:bg-white/10 dark:text-white shadow-sm"
                        : "text-gray-500 dark:text-[#98989f]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Drawer footer actions */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-[#2c2c2e] flex gap-3">
          <button
            type="button"
            onClick={() => {
              setSortBy("featured");
              setMinPrice("");
              setMaxPrice("");
              setMinRating(null);
              setInStockOnly(false);
              setShippingFilter("ALL");
              showToast("Filters reset", "info");
            }}
            className="flex-1 py-3 border border-gray-250 dark:border-white/5 text-gray-700 dark:text-gray-300 font-semibold rounded-2xl bg-white dark:bg-[#121214] hover:bg-gray-100 transition active:scale-95 text-xs"
          >
            Reset All
          </button>
          <button
            type="button"
            onClick={() => setIsFilterOpen(false)}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl shadow-md transition active:scale-95 text-xs"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Order Details drill-down sheet */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 ${selectedOrderDetails ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setSelectedOrderDetails(null)}
      />
      
      <div 
        className={`fixed bottom-0 left-0 right-0 bg-white dark:bg-[#121214] border-t border-gray-150 dark:border-white/10 rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl z-50 transition-transform duration-300 ease-out transform ${selectedOrderDetails ? "translate-y-0" : "translate-y-full"}`}
      >
        {selectedOrderDetails && (
          <>
            <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-[#2c2c2e]">
              <h2 className="text-sm font-bold text-gray-800 dark:text-white">Order Details: {selectedOrderDetails.orderNumber}</h2>
              <button 
                onClick={() => setSelectedOrderDetails(null)}
                className="p-1.5 bg-[#f6f6f8] dark:bg-[#2c2c2e] rounded-xl hover:bg-gray-300 dark:hover:bg-white/10 text-gray-500 dark:text-[#98989f] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-6 flex-1 text-xs">
              
              {/* Buyer Protection / Escrow Banner */}
              {escrow && (
                <div className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
                  escrow.status === "HELD" ? "bg-blue-500/10 border-blue-500/20 text-blue-800 dark:text-blue-300" :
                  escrow.status === "RELEASED" ? "bg-green-500/10 border-green-500/20 text-green-800 dark:text-green-300" :
                  escrow.status === "DISPUTED" ? "bg-orange-500/10 border-orange-500/20 text-orange-800 dark:text-orange-300" :
                  "bg-gray-500/10 border-gray-500/20 text-gray-800 dark:text-gray-300"
                }`}>
                  <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold uppercase tracking-wider text-[9px]">Buyer Protection Active</span>
                      <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10">
                        {escrow.status === "HELD" ? "Payment Held" :
                         escrow.status === "RELEASED" ? "Released" :
                         escrow.status === "DISPUTED" ? "In Dispute" : escrow.status}
                      </span>
                    </div>
                    <p className="text-[10px] leading-normal opacity-85">
                      {escrow.status === "HELD"
                        ? "Your payment is held securely in escrow until you receive the package. Confirm delivery once you receive your order."
                        : escrow.status === "RELEASED"
                        ? "Payment has been released to the seller. Thank you for confirming!"
                        : escrow.status === "DISPUTED"
                        ? "This order is currently under dispute review. Your funds are protected."
                        : "Escrow Status: " + escrow.status}
                    </p>
                  </div>
                </div>
              )}

              {/* Escrow Confirm Delivery / Issue Reporting Actions */}
              {["SHIPPED", "DELIVERED"].includes(selectedOrderDetails.status) && escrow?.status === "HELD" && !deliveryConfirmed && (
                <div className="bg-[#f6f6f8] dark:bg-[#2c2c2e] p-4 rounded-2xl border border-gray-150 dark:border-white/5 space-y-3">
                  <p className="font-bold text-[10px] text-gray-800 dark:text-white uppercase tracking-wider">Received Your Order?</p>
                  <p className="text-[10px] text-gray-500 dark:text-[#98989f] leading-normal">Confirm delivery to release payment to the seller. If there are issues, you can report a dispute.</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleConfirmDelivery(selectedOrderDetails.id)}
                      disabled={confirmingDelivery}
                      className="flex-1 py-2.5 px-3 bg-green-605 hover:bg-green-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition active:scale-95 text-[10px]"
                    >
                      {confirmingDelivery ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ThumbsUp className="w-3.5 h-3.5" />}
                      Confirm Delivery
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (tgSdk) {
                          tgSdk.openTelegramLink("https://t.me/PleasureZoneSupportBot");
                        } else {
                          window.open("https://wa.me/256700000000?text=I%20have%20an%20issue%20with%20order%20" + selectedOrderDetails.orderNumber, "_blank");
                        }
                      }}
                      className="flex-1 py-2.5 px-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition active:scale-95 text-[10px]"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Report Issue
                    </button>
                  </div>
                </div>
              )}

              {/* Status & Payment info */}
              <div className="bg-[#f6f6f8] dark:bg-[#2c2c2e] border border-gray-150 dark:border-white/5 p-4 rounded-2xl grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Order Status</p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide bg-blue-500/10 text-blue-605">
                    {selectedOrderDetails.status}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Payment Status</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide ${selectedOrderDetails.paymentStatus === "SUCCESSFUL" ? "bg-green-500/10 text-green-555" : "bg-yellow-500/10 text-yellow-555"}`}>
                    {selectedOrderDetails.paymentStatus}
                  </span>
                </div>
              </div>

              {/* Modify Pending Order (Address & Notes) */}
              {selectedOrderDetails.status === "PENDING" && (
                <div className="space-y-3 bg-[#f6f6f8] dark:bg-[#2c2c2e] p-4 rounded-2xl border border-gray-150 dark:border-white/5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-[10px] text-gray-808 dark:text-white uppercase tracking-wider">Delivery Details</p>
                    <button
                      type="button"
                      onClick={() => setShowModifyOrder(!showModifyOrder)}
                      className="text-blue-600 font-bold hover:underline text-[10px]"
                    >
                      {showModifyOrder ? "Cancel Edit" : "Edit Details"}
                    </button>
                  </div>

                  {showModifyOrder ? (
                    <div className="space-y-3 pt-2">
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase tracking-wider text-gray-400 font-bold">Shipping Address</label>
                        <textarea
                          value={modifyOrderAddress}
                          onChange={(e) => setModifyOrderAddress(e.target.value)}
                          placeholder="Enter shipping address..."
                          rows={2}
                          className="w-full bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-xl px-3 py-2 text-[10px] focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase tracking-wider text-gray-400 font-bold">Order Notes</label>
                        <textarea
                          value={modifyOrderNotes}
                          onChange={(e) => setModifyOrderNotes(e.target.value)}
                          placeholder="Add delivery instructions or notes..."
                          rows={1}
                          className="w-full bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-xl px-3 py-2 text-[10px] focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleModifyOrder(selectedOrderDetails.id)}
                        disabled={isModifyingOrder}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition active:scale-95 text-[10px]"
                      >
                        {isModifyingOrder ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save Changes"}
                      </button>
                    </div>
                  ) : (
                    <div className="text-[10px] text-gray-650 dark:text-gray-300 leading-normal space-y-1">
                      {modifyOrderAddress && (
                        <p><b>Address:</b> {modifyOrderAddress}</p>
                      )}
                      {selectedOrderDetails.notes && (
                        <p><b>Notes:</b> {selectedOrderDetails.notes}</p>
                      )}
                      {!modifyOrderAddress && !selectedOrderDetails.notes && (
                        <p className="text-gray-400 italic">No custom delivery address/notes provided.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Order Items list */}
              <div className="space-y-2">
                <h4 className="font-bold text-[10px] text-gray-400 uppercase tracking-wider">Items Ordered</h4>
                <div className="space-y-2">
                  {selectedOrderDetails.items.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-white/5">
                      <div>
                        <p className="font-bold text-gray-808 dark:text-white">{item.name}</p>
                        <p className="text-[10px] text-gray-450 mt-0.5">{item.quantity} x {Number(item.price).toLocaleString()} UGX</p>
                      </div>
                      <span className="font-bold text-gray-900 dark:text-white">{(item.quantity * Number(item.price)).toLocaleString()} UGX</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order totals */}
              <div className="space-y-2 bg-[#f6f6f8] dark:bg-[#2c2c2e] p-4 rounded-xl border border-gray-100 dark:border-white/5">
                <div className="flex justify-between text-gray-500 dark:text-[#98989f]">
                  <span>Subtotal</span>
                  <span>{Number(selectedOrderDetails.subtotal).toLocaleString()} UGX</span>
                </div>
                {selectedOrderDetails.discount > 0 && (
                  <div className="flex justify-between text-green-550">
                    <span>Discount</span>
                    <span>-{Number(selectedOrderDetails.discount).toLocaleString()} UGX</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-500 dark:text-[#98989f]">
                  <span>Shipping Cost</span>
                  <span>{Number(selectedOrderDetails.shippingCost).toLocaleString()} UGX</span>
                </div>
                <hr className="border-gray-150 dark:border-white/5 my-1" />
                <div className="flex justify-between font-black text-gray-900 dark:text-white text-sm">
                  <span>Total Paid</span>
                  <span className="text-blue-600">{Number(selectedOrderDetails.totalAmount).toLocaleString()} UGX</span>
                </div>
              </div>

              {/* Order Events Timeline */}
              {selectedOrderDetails.timeline && selectedOrderDetails.timeline.length > 0 && (
                <div className="space-y-3 animate-fade-in">
                  <h4 className="font-bold text-[10px] text-gray-400 uppercase tracking-wider">Status History</h4>
                  <div className="relative border-l border-blue-500/20 ml-2 pl-4 space-y-4 py-2">
                    {selectedOrderDetails.timeline.map((event: any) => (
                      <div key={event.id} className="relative">
                        <span className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-blue-600 ring-4 ring-blue-500/10 animate-pulse-soft"></span>
                        <div>
                          <p className="font-bold text-gray-800 dark:text-white uppercase tracking-wider text-[9px]">{event.status}</p>
                          {event.note && <p className="text-[10px] text-gray-500 dark:text-[#98989f] mt-0.5 leading-relaxed">{event.note}</p>}
                          <span className="text-[8px] text-gray-400 block mt-1">{new Date(event.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Order Footer Actions */}
              <div className="flex gap-2.5 flex-wrap pt-2">
                <button
                  type="button"
                  onClick={() => handleReorder(selectedOrderDetails.id)}
                  className="flex-1 min-w-[100px] py-2.5 px-3 border border-gray-250 dark:border-white/5 text-gray-800 dark:text-gray-300 bg-[#f6f6f8] dark:bg-[#2c2c2e] hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl font-bold flex items-center justify-center gap-1.5 transition active:scale-95 text-[10px]"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Reorder Items
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadInvoice(selectedOrderDetails.id)}
                  className="flex-1 min-w-[100px] py-2.5 px-3 border border-gray-250 dark:border-white/5 text-gray-800 dark:text-gray-300 bg-[#f6f6f8] dark:bg-[#2c2c2e] hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl font-bold flex items-center justify-center gap-1.5 transition active:scale-95 text-[10px]"
                >
                  <FileText className="w-3.5 h-3.5" /> Invoice HTML
                </button>
                {["PENDING", "CONFIRMED"].includes(selectedOrderDetails.status) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Are you sure you want to cancel this order?")) {
                        handleCancelOrder(selectedOrderDetails.id);
                      }
                    }}
                    disabled={isCancellingOrder}
                    className="flex-1 min-w-[100px] py-2.5 px-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 dark:bg-red-950/20 dark:border-red-900/40 rounded-xl font-bold flex items-center justify-center gap-1.5 transition active:scale-95 text-[10px] disabled:opacity-50"
                  >
                    {isCancellingOrder ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Cancel Order"}
                  </button>
                )}
              </div>

            </div>
          </>
        )}
      </div>

      {/* Visual Debug Console Floating Toggle Button */}
      {showDebugControl && (
        <>
          <button 
            type="button"
            onClick={() => {
              setIsConsoleOpen(true);
              addLog("Opened Visual Debug Console.", "info");
            }}
            className="fixed bottom-20 right-4 p-3.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full shadow-2xl active:scale-95 transition-all z-40 flex items-center justify-center border border-gray-800 dark:border-gray-200"
            title="View logs"
          >
            <Terminal className="w-5 h-5" />
          </button>

          {/* Visual Debug Console Bottom Sheet Modal */}
          <div 
            className={`fixed inset-0 bg-black/70 backdrop-blur-sm z-50 transition-opacity duration-300 ${isConsoleOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
            onClick={() => setIsConsoleOpen(false)}
          />
          
          <div 
            className={`fixed bottom-0 left-0 right-0 bg-[#0f172a] text-[#f8fafc] border-t border-slate-800 rounded-t-3xl h-[70vh] flex flex-col shadow-2xl z-50 font-mono transition-transform duration-300 ease-out transform ${isConsoleOpen ? "translate-y-0" : "translate-y-full"}`}
          >
            {/* Console Header */}
            <div className="px-5 py-4 flex items-center justify-between border-b border-slate-800 bg-[#1e293b]">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">System Log Console</h3>
                <span className="bg-slate-700 text-[10px] text-slate-300 px-1.5 py-0.5 rounded-md font-bold">
                  {logs.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const logsText = logs.map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`).join("\n");
                    if (typeof navigator !== "undefined" && navigator.clipboard) {
                      navigator.clipboard.writeText(logsText);
                      showToast("Logs copied to clipboard!", "success");
                      addLog("Logs copied to clipboard.", "success");
                    }
                  }}
                  className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors flex items-center gap-1 text-[9px] font-bold"
                  title="Copy all logs"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy
                </button>
                <button
                  onClick={() => {
                    setLogs([]);
                    showToast("Console cleared", "info");
                  }}
                  className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-[#f8fafc] hover:text-red-400 transition-colors text-[9px] font-bold"
                  title="Clear console"
                >
                  Clear
                </button>
                <button 
                  onClick={() => setIsConsoleOpen(false)}
                   className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Console Logs List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 text-[11px] leading-relaxed">
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                  <Terminal className="w-8 h-8 opacity-20" />
                  <p>No system log messages yet.</p>
                </div>
              ) : (
                logs.map((log, index) => {
                  let colorClass = "text-slate-300";
                  if (log.type === "success") colorClass = "text-emerald-400";
                  if (log.type === "error") colorClass = "text-rose-400 font-bold";
                  if (log.type === "warning") colorClass = "text-amber-400";

                  return (
                    <div key={index} className="flex items-start gap-2 border-b border-slate-900/60 pb-1.5">
                      <span className="text-slate-500 select-none flex-shrink-0">[{log.timestamp}]</span>
                      <span className={`flex-shrink-0 uppercase font-bold text-[9px] tracking-wide px-1 rounded bg-slate-800 ${colorClass}`}>
                        {log.type}
                      </span>
                      <span className={`break-all ${colorClass}`}>{log.message}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

    </main>
  );
}
