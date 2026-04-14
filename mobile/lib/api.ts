import { secureStorage } from "./storage";
import type {
  AuthResponse,
  UserProfile,
  ProductsResponse,
  ProductDetail,
  ProductListItem,
  Cart,
  OrdersResponse,
  OrderDetail,
  WishlistItem,
  Address,
  ReviewsResponse,
  CouponValidation,
  CheckoutRequest,
  CheckoutResponse,
  DashboardStats,
  CustomersResponse,
  CustomerListItem,
  Coupon,
  Category,
  SuccessMessage,
  PaginationInfo,
} from "./types";

// Update this to your backend URL
const API_URL = "http://localhost:4000";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1_000;

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) return refreshPromise;

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = await secureStorage.getRefreshToken();
      if (!refreshToken) return false;

      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${refreshToken}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.token) await secureStorage.setToken(data.token);
        if (data.refreshToken) await secureStorage.setRefreshToken(data.refreshToken);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiFetch(
  endpoint: string,
  options: RequestInit = {},
  retry = true
): Promise<any> {
  const isFormData = options.body instanceof FormData;
  const token = await secureStorage.getToken();

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let lastError: Error | null = null;
  const maxAttempts = retry ? MAX_RETRIES : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
        signal: options.signal || controller.signal,
      });

      clearTimeout(timeout);

      // Handle 401 with automatic token refresh
      if (res.status === 401 && retry && !endpoint.includes("/auth/refresh")) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return apiFetch(endpoint, options, false);
        }
        throw new Error("Session expired. Please log in again.");
      }

      // Retry on 5xx
      if (res.status >= 500 && attempt < maxAttempts - 1) {
        await new Promise((r) =>
          setTimeout(r, RETRY_BASE_DELAY_MS * Math.pow(2, attempt))
        );
        continue;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      return data;
    } catch (err: any) {
      clearTimeout(timeout);
      lastError = err;

      if (err.name === "AbortError") throw new Error("Request timed out");

      if (attempt < maxAttempts - 1) {
        await new Promise((r) =>
          setTimeout(r, RETRY_BASE_DELAY_MS * Math.pow(2, attempt))
        );
        continue;
      }
    }
  }

  throw lastError || new Error("Request failed after retries");
}

export const api = {
  // ============ Auth ============
  login: (email: string, password: string): Promise<AuthResponse> =>
    apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string, name?: string): Promise<AuthResponse> =>
    apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    }),

  forgotPassword: (email: string): Promise<SuccessMessage> =>
    apiFetch("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string): Promise<SuccessMessage> =>
    apiFetch("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),

  getProfile: (): Promise<UserProfile> => apiFetch("/api/auth/me"),

  updateProfile: (data: Partial<{ name: string; phone: string }>): Promise<SuccessMessage> =>
    apiFetch("/api/auth/me", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  changePassword: (currentPassword: string, newPassword: string): Promise<SuccessMessage> =>
    apiFetch("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  logout: (): Promise<SuccessMessage> =>
    apiFetch("/api/auth/logout", { method: "POST" }),

  refresh: (): Promise<AuthResponse> =>
    apiFetch("/api/auth/refresh", { method: "POST" }),

  // ============ Products ============
  getProducts: (params?: Record<string, string>): Promise<ProductsResponse> => {
    const query = params ? `?${new URLSearchParams(params)}` : "";
    return apiFetch(`/api/products${query}`);
  },

  getProduct: (slug: string): Promise<ProductDetail> =>
    apiFetch(`/api/products/${slug}`),

  getRelatedProducts: (slug: string, limit = 4): Promise<{ products: ProductListItem[] }> =>
    apiFetch(`/api/products/${slug}/related?limit=${limit}`),

  // ============ Cart ============
  createCart: (): Promise<{ id: string }> =>
    apiFetch("/api/cart/create", { method: "POST" }),

  getCart: (cartId: string): Promise<Cart> =>
    apiFetch(`/api/cart/${cartId}`),

  addToCart: (cartId: string, productId: string, quantity = 1, variantId?: string): Promise<Cart> =>
    apiFetch(`/api/cart/${cartId}/items`, {
      method: "POST",
      body: JSON.stringify({ productId, quantity, variantId }),
    }),

  updateCartItem: (cartId: string, itemId: string, quantity: number): Promise<Cart> =>
    apiFetch(`/api/cart/${cartId}/items/${itemId}`, {
      method: "PUT",
      body: JSON.stringify({ quantity }),
    }),

  removeCartItem: (cartId: string, itemId: string): Promise<Cart> =>
    apiFetch(`/api/cart/${cartId}/items/${itemId}`, { method: "DELETE" }),

  syncCart: (items: Array<{ productId: string; quantity: number }>): Promise<Cart> =>
    apiFetch("/api/cart/sync", {
      method: "POST",
      body: JSON.stringify({ items }),
    }),

  // ============ Wishlist ============
  getWishlist: (): Promise<{ items: WishlistItem[] }> =>
    apiFetch("/api/wishlist"),

  addToWishlist: (productId: string): Promise<SuccessMessage> =>
    apiFetch("/api/wishlist", {
      method: "POST",
      body: JSON.stringify({ productId }),
    }),

  removeFromWishlist: (productId: string): Promise<SuccessMessage> =>
    apiFetch(`/api/wishlist/${productId}`, { method: "DELETE" }),

  moveToCart: (productId: string): Promise<SuccessMessage> =>
    apiFetch(`/api/wishlist/${productId}/move-to-cart`, { method: "POST" }),

  getWishlistPinStatus: (): Promise<{ hasPin: boolean }> =>
    apiFetch("/api/wishlist/pin-status"),

  setWishlistPin: (pin: string, currentPin?: string): Promise<SuccessMessage> =>
    apiFetch("/api/wishlist/set-pin", {
      method: "POST",
      body: JSON.stringify({ pin, currentPin }),
    }),

  verifyWishlistPin: (pin: string): Promise<{ valid: boolean }> =>
    apiFetch("/api/wishlist/verify-pin", {
      method: "POST",
      body: JSON.stringify({ pin }),
    }),

  removeWishlistPin: (pin: string): Promise<SuccessMessage> =>
    apiFetch("/api/wishlist/remove-pin", {
      method: "DELETE",
      body: JSON.stringify({ pin }),
    }),

  // ============ Orders ============
  getOrders: (params?: Record<string, string>): Promise<OrdersResponse> => {
    const query = params ? `?${new URLSearchParams(params)}` : "";
    return apiFetch(`/api/orders${query}`);
  },

  getOrder: (orderId: string): Promise<OrderDetail> =>
    apiFetch(`/api/orders/${orderId}`),

  // ============ Addresses ============
  getAddresses: (): Promise<Address[]> => apiFetch("/api/addresses"),

  createAddress: (data: Omit<Address, "id" | "isDefault">): Promise<Address> =>
    apiFetch("/api/addresses", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateAddress: (id: string, data: Partial<Address>): Promise<Address> =>
    apiFetch(`/api/addresses/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteAddress: (id: string): Promise<SuccessMessage> =>
    apiFetch(`/api/addresses/${id}`, { method: "DELETE" }),

  setDefaultAddress: (id: string): Promise<SuccessMessage> =>
    apiFetch(`/api/addresses/${id}/set-default`, { method: "POST" }),

  // ============ Search ============
  search: (query: string, params?: Record<string, string>): Promise<ProductsResponse> => {
    const allParams = { q: query, ...params };
    return apiFetch(`/api/search?${new URLSearchParams(allParams)}`);
  },

  searchSuggestions: (query: string): Promise<{ suggestions: string[] }> =>
    apiFetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`),

  // ============ Categories ============
  getCategories: (): Promise<Category[]> => apiFetch("/api/categories"),

  // ============ Coupons ============
  validateCoupon: (code: string, amount: number): Promise<CouponValidation> =>
    apiFetch(`/api/coupons/validate?code=${encodeURIComponent(code)}&amount=${amount}`),

  applyCoupon: (code: string, amount: number): Promise<CouponValidation> =>
    apiFetch("/api/coupons/apply", {
      method: "POST",
      body: JSON.stringify({ code, amount }),
    }),

  // ============ Reviews ============
  getProductReviews: (productId: string, params?: Record<string, string>): Promise<ReviewsResponse> => {
    const query = params ? `?${new URLSearchParams(params)}` : "";
    return apiFetch(`/api/reviews/product/${productId}${query}`);
  },

  createReview: (productId: string, rating: number, title?: string, content?: string): Promise<SuccessMessage> =>
    apiFetch("/api/reviews", {
      method: "POST",
      body: JSON.stringify({ productId, rating, title, content }),
    }),

  // ============ Checkout ============
  createCheckout: (data: CheckoutRequest): Promise<CheckoutResponse> =>
    apiFetch("/api/checkout/create", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ============ Recommendations ============
  getTrending: (): Promise<{ products: ProductListItem[] }> =>
    apiFetch("/api/recommendations/trending"),

  getNewArrivals: (): Promise<{ products: ProductListItem[] }> =>
    apiFetch("/api/recommendations/new-arrivals"),

  getTopRated: (): Promise<{ products: ProductListItem[] }> =>
    apiFetch("/api/recommendations/top-rated"),

  getSimilar: (productId: string): Promise<{ products: ProductListItem[] }> =>
    apiFetch(`/api/recommendations/similar/${productId}`),

  getBoughtTogether: (productId: string): Promise<{ products: ProductListItem[] }> =>
    apiFetch(`/api/recommendations/bought-together/${productId}`),

  // ============ Admin ============
  admin: {
    getDashboard: (): Promise<DashboardStats> =>
      apiFetch("/api/admin/dashboard"),

    getAnalytics: (period?: number) =>
      apiFetch(`/api/admin/dashboard/analytics?period=${period || 30}`),

    // Products
    getProducts: (params?: Record<string, string>): Promise<ProductsResponse> => {
      const query = params ? `?${new URLSearchParams(params)}` : "";
      return apiFetch(`/api/admin/products${query}`);
    },

    getProduct: (id: string): Promise<ProductDetail> =>
      apiFetch(`/api/admin/products/${id}`),

    createProduct: (data: Partial<ProductDetail>): Promise<ProductDetail> =>
      apiFetch("/api/admin/products", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    updateProduct: (id: string, data: Partial<ProductDetail>): Promise<ProductDetail> =>
      apiFetch(`/api/admin/products/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    deleteProduct: (id: string): Promise<SuccessMessage> =>
      apiFetch(`/api/admin/products/${id}`, { method: "DELETE" }),

    bulkProductAction: (action: string, ids: string[]): Promise<SuccessMessage> =>
      apiFetch("/api/admin/products/bulk", {
        method: "POST",
        body: JSON.stringify({ action, ids }),
      }),

    // Orders
    getOrders: (params?: Record<string, string>): Promise<OrdersResponse> => {
      const query = params ? `?${new URLSearchParams(params)}` : "";
      return apiFetch(`/api/admin/orders${query}`);
    },

    getOrder: (id: string): Promise<OrderDetail> =>
      apiFetch(`/api/admin/orders/${id}`),

    updateOrderStatus: (id: string, status: string, note?: string, trackingNumber?: string): Promise<SuccessMessage> =>
      apiFetch(`/api/admin/orders/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status, note, trackingNumber }),
      }),

    refundOrder: (id: string, amount?: number, reason?: string): Promise<SuccessMessage> =>
      apiFetch(`/api/admin/orders/${id}/refund`, {
        method: "POST",
        body: JSON.stringify({ amount, reason }),
      }),

    markOrderPaid: (id: string): Promise<SuccessMessage> =>
      apiFetch(`/api/admin/orders/${id}/mark-paid`, { method: "POST" }),

    // Customers
    getCustomers: (params?: Record<string, string>): Promise<CustomersResponse> => {
      const query = params ? `?${new URLSearchParams(params)}` : "";
      return apiFetch(`/api/admin/customers${query}`);
    },

    getCustomer: (id: string): Promise<CustomerListItem> =>
      apiFetch(`/api/admin/customers/${id}`),

    updateCustomer: (id: string, data: Partial<CustomerListItem>): Promise<SuccessMessage> =>
      apiFetch(`/api/admin/customers/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    // Coupons
    getCoupons: (params?: Record<string, string>): Promise<{ coupons: Coupon[]; pagination: PaginationInfo }> => {
      const query = params ? `?${new URLSearchParams(params)}` : "";
      return apiFetch(`/api/admin/coupons${query}`);
    },

    createCoupon: (data: Partial<Coupon>): Promise<Coupon> =>
      apiFetch("/api/admin/coupons", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    updateCoupon: (id: string, data: Partial<Coupon>): Promise<Coupon> =>
      apiFetch(`/api/admin/coupons/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    deleteCoupon: (id: string): Promise<SuccessMessage> =>
      apiFetch(`/api/admin/coupons/${id}`, { method: "DELETE" }),

    // Categories
    getCategories: (): Promise<Category[]> =>
      apiFetch("/api/admin/categories"),

    createCategory: (data: Partial<Category>): Promise<Category> =>
      apiFetch("/api/admin/categories", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    updateCategory: (id: string, data: Partial<Category>): Promise<Category> =>
      apiFetch(`/api/admin/categories/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    deleteCategory: (id: string): Promise<SuccessMessage> =>
      apiFetch(`/api/admin/categories/${id}`, { method: "DELETE" }),

    // Settings
    getSettings: (): Promise<any> => apiFetch("/api/admin/settings"),

    updateSettings: (data: any): Promise<SuccessMessage> =>
      apiFetch("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
  },
};
