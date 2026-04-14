import {storage} from './storage';
import type {
  AuthResponse,
  UserProfile,
  ProductsResponse,
  ProductDetail,
  ProductListItem,
  Cart,
  OrdersResponse,
  Order,
  WishlistItem,
  Address,
  ReviewsResponse,
  CouponValidation,
  CheckoutRequest,
  CheckoutResponse,
  Category,
  DashboardStats,
} from './types';

const API_URL = 'https://ugsex.com';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) return refreshPromise;
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = await storage.getRefreshToken();
      if (!refreshToken) return false;
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({refreshToken}),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.accessToken) await storage.setAccessToken(data.accessToken);
      if (data.refreshToken) await storage.setRefreshToken(data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = 0,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const token = await storage.getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (res.status === 401 && retry === 0) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return request<T>(path, options, 1);
      await storage.clearTokens();
      await storage.clearUser();
      throw new Error('Session expired');
    }

    if (res.status >= 500 && retry < MAX_RETRIES) {
      await new Promise<void>(r => setTimeout(r, 1000 * Math.pow(2, retry)));
      return request<T>(path, options, retry + 1);
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}

// Auth
export const api = {
  auth: {
    register(data: {name: string; email: string; password: string; phone?: string}) {
      return request<AuthResponse>('/api/auth/register', {method: 'POST', body: JSON.stringify(data)});
    },
    login(data: {email: string; password: string}) {
      return request<AuthResponse>('/api/auth/login', {method: 'POST', body: JSON.stringify(data)});
    },
    logout() {
      return request<{message: string}>('/api/auth/logout', {method: 'POST'});
    },
    me() {
      return request<UserProfile>('/api/auth/me');
    },
    updateProfile(data: Partial<UserProfile>) {
      return request<{message: string; user: UserProfile}>('/api/auth/me', {method: 'PUT', body: JSON.stringify(data)});
    },
    changePassword(data: {currentPassword: string; newPassword: string}) {
      return request<{message: string}>('/api/auth/change-password', {method: 'POST', body: JSON.stringify(data)});
    },
    forgotPassword(email: string) {
      return request<{message: string}>('/api/auth/forgot-password', {method: 'POST', body: JSON.stringify({email})});
    },
    refresh() {
      return refreshAccessToken();
    },
  },

  products: {
    list(params?: Record<string, string>) {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<ProductsResponse>(`/api/products${qs}`);
    },
    get(slug: string) {
      return request<ProductDetail>(`/api/products/${slug}`);
    },
    related(slug: string) {
      return request<{products: ProductListItem[]}>(`/api/products/${slug}/related`);
    },
    categories() {
      return request<Category[]>('/api/products/categories/list');
    },
    search(query: string, params?: Record<string, string>) {
      const qs = new URLSearchParams({q: query, ...params}).toString();
      return request<ProductsResponse>(`/api/search?${qs}`);
    },
    suggestions(query: string) {
      return request<{suggestions: string[]}>(`/api/search/suggestions?q=${encodeURIComponent(query)}`);
    },
  },

  cart: {
    create() {
      return request<{id: string}>('/api/cart/create', {method: 'POST'});
    },
    get(cartId: string) {
      return request<Cart>(`/api/cart/${cartId}`);
    },
    addItem(cartId: string, data: {productId: string; quantity: number}) {
      return request<Cart>(`/api/cart/${cartId}/items`, {method: 'POST', body: JSON.stringify(data)});
    },
    updateItem(cartId: string, itemId: string, data: {quantity: number}) {
      return request<Cart>(`/api/cart/${cartId}/items/${itemId}`, {method: 'PUT', body: JSON.stringify(data)});
    },
    removeItem(cartId: string, itemId: string) {
      return request<Cart>(`/api/cart/${cartId}/items/${itemId}`, {method: 'DELETE'});
    },
    clear(cartId: string) {
      return request<{success: boolean}>(`/api/cart/${cartId}/items`, {method: 'DELETE'});
    },
  },

  checkout: {
    create(data: CheckoutRequest) {
      return request<CheckoutResponse>('/api/checkout/create', {method: 'POST', body: JSON.stringify(data)});
    },
  },

  orders: {
    list(params?: Record<string, string>) {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<OrdersResponse>(`/api/orders${qs}`);
    },
    get(id: string) {
      return request<Order>(`/api/orders/${id}`);
    },
    track(orderNumber: string) {
      return request<Order>(`/api/orders/track/${orderNumber}`);
    },
    cancel(id: string) {
      return request<{message: string; order: Order}>(`/api/orders/${id}/cancel`, {method: 'POST'});
    },
  },

  wishlist: {
    list(collection?: string) {
      const qs = collection ? `?collection=${encodeURIComponent(collection)}` : '';
      return request<{items: WishlistItem[]; count: number}>(`/api/wishlist${qs}`);
    },
    add(productId: string, collection?: string) {
      return request<{message: string; id: string}>('/api/wishlist', {
        method: 'POST',
        body: JSON.stringify({productId, collectionName: collection || 'Wishlist'}),
      });
    },
    remove(productId: string) {
      return request<{message: string}>(`/api/wishlist/${productId}`, {method: 'DELETE'});
    },
    pinStatus() {
      return request<{hasPin: boolean}>('/api/wishlist/pin-status');
    },
    verifyPin(pin: string) {
      return request<{valid: boolean}>('/api/wishlist/verify-pin', {method: 'POST', body: JSON.stringify({pin})});
    },
  },

  addresses: {
    list() {
      return request<{addresses: Address[]}>('/api/addresses');
    },
    create(data: Omit<Address, 'id' | 'userId'>) {
      return request<{message: string; address: Address}>('/api/addresses', {method: 'POST', body: JSON.stringify(data)});
    },
    update(id: string, data: Partial<Address>) {
      return request<{message: string; address: Address}>(`/api/addresses/${id}`, {method: 'PUT', body: JSON.stringify(data)});
    },
    delete(id: string) {
      return request<{message: string}>(`/api/addresses/${id}`, {method: 'DELETE'});
    },
  },

  reviews: {
    list(productId: string, params?: Record<string, string>) {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<ReviewsResponse>(`/api/reviews/product/${productId}${qs}`);
    },
    submit(data: {productId: string; rating: number; comment: string}) {
      return request<{message: string}>('/api/reviews', {method: 'POST', body: JSON.stringify(data)});
    },
  },

  coupons: {
    validate(code: string, cartTotal: number) {
      return request<CouponValidation>('/api/coupons/validate', {method: 'POST', body: JSON.stringify({code, cartTotal})});
    },
  },

  recommendations: {
    trending() {
      return request<ProductListItem[]>('/api/recommendations/trending');
    },
    newArrivals() {
      return request<ProductListItem[]>('/api/recommendations/new-arrivals');
    },
  },
};
