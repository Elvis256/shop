const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function apiFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  register: (email: string, password: string, name?: string) =>
    apiFetch("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password, name }) }),
  forgotPassword: (email: string) =>
    apiFetch("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (token: string, password: string) =>
    apiFetch("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) }),
  getProfile: () => apiFetch("/api/auth/me"),
  updateProfile: (data: any) => apiFetch("/api/auth/me", { method: "PUT", body: JSON.stringify(data) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch("/api/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }),

  // Products
  getProducts: (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params)}` : "";
    return apiFetch(`/api/products${query}`);
  },
  getProduct: (slug: string) => apiFetch(`/api/products/${slug}`),
  
  // Cart
  createCart: () => apiFetch("/api/cart/create", { method: "POST" }),
  getCart: (cartId: string) => apiFetch(`/api/cart/${cartId}`),
  addToCart: (cartId: string, productId: string, quantity = 1) =>
    apiFetch(`/api/cart/${cartId}/items`, { method: "POST", body: JSON.stringify({ productId, quantity }) }),
  updateCartItem: (cartId: string, itemId: string, quantity: number) =>
    apiFetch(`/api/cart/${cartId}/items/${itemId}`, { method: "PUT", body: JSON.stringify({ quantity }) }),
  removeCartItem: (cartId: string, itemId: string) =>
    apiFetch(`/api/cart/${cartId}/items/${itemId}`, { method: "DELETE" }),

  // Wishlist
  getWishlist: () => apiFetch("/api/wishlist"),
  addToWishlist: (productId: string) =>
    apiFetch("/api/wishlist", { method: "POST", body: JSON.stringify({ productId }) }),
  removeFromWishlist: (productId: string) =>
    apiFetch(`/api/wishlist/${productId}`, { method: "DELETE" }),

  // Orders
  getOrders: () => apiFetch("/api/orders"),
  getOrder: (orderId: string) => apiFetch(`/api/orders/${orderId}`),

  // Addresses
  getAddresses: () => apiFetch("/api/addresses"),
  createAddress: (data: any) => apiFetch("/api/addresses", { method: "POST", body: JSON.stringify(data) }),
  updateAddress: (id: string, data: any) =>
    apiFetch(`/api/addresses/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteAddress: (id: string) => apiFetch(`/api/addresses/${id}`, { method: "DELETE" }),
  setDefaultAddress: (id: string) =>
    apiFetch(`/api/addresses/${id}/set-default`, { method: "POST" }),

  // Search
  search: (query: string, params?: Record<string, string>) => {
    const allParams = { q: query, ...params };
    return apiFetch(`/api/search?${new URLSearchParams(allParams)}`);
  },
  searchSuggestions: (query: string) => apiFetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`),

  // Coupons
  validateCoupon: (code: string, amount: number) =>
    apiFetch(`/api/coupons/validate?code=${encodeURIComponent(code)}&amount=${amount}`),
  applyCoupon: (code: string, amount: number) =>
    apiFetch("/api/coupons/apply", { method: "POST", body: JSON.stringify({ code, amount }) }),

  // Reviews
  getProductReviews: (productId: string, params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params)}` : "";
    return apiFetch(`/api/reviews/product/${productId}${query}`);
  },
  createReview: (productId: string, rating: number, title?: string, content?: string) =>
    apiFetch("/api/reviews", { method: "POST", body: JSON.stringify({ productId, rating, title, content }) }),

  // Checkout
  createCheckout: (data: any) => apiFetch("/api/checkout/create", { method: "POST", body: JSON.stringify(data) }),

  // Admin
  admin: {
    getDashboard: () => apiFetch("/api/admin/dashboard"),
    getAnalytics: (period?: number) => apiFetch(`/api/admin/dashboard/analytics?period=${period || 30}`),
    
    // Products
    getProducts: (params?: Record<string, string>) => {
      const query = params ? `?${new URLSearchParams(params)}` : "";
      return apiFetch(`/api/admin/products${query}`);
    },
    getProduct: (id: string) => apiFetch(`/api/admin/products/${id}`),
    createProduct: (data: any) => apiFetch("/api/admin/products", { method: "POST", body: JSON.stringify(data) }),
    updateProduct: (id: string, data: any) =>
      apiFetch(`/api/admin/products/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteProduct: (id: string) => apiFetch(`/api/admin/products/${id}`, { method: "DELETE" }),
    bulkProductAction: (action: string, ids: string[]) =>
      apiFetch("/api/admin/products/bulk", { method: "POST", body: JSON.stringify({ action, ids }) }),

    // Orders
    getOrders: (params?: Record<string, string>) => {
      const query = params ? `?${new URLSearchParams(params)}` : "";
      return apiFetch(`/api/admin/orders${query}`);
    },
    getOrder: (id: string) => apiFetch(`/api/admin/orders/${id}`),
    updateOrderStatus: (id: string, status: string, note?: string, trackingNumber?: string) =>
      apiFetch(`/api/admin/orders/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status, note, trackingNumber }),
      }),
    refundOrder: (id: string, amount?: number, reason?: string) =>
      apiFetch(`/api/admin/orders/${id}/refund`, { method: "POST", body: JSON.stringify({ amount, reason }) }),

    // Customers
    getCustomers: (params?: Record<string, string>) => {
      const query = params ? `?${new URLSearchParams(params)}` : "";
      return apiFetch(`/api/admin/customers${query}`);
    },
    getCustomer: (id: string) => apiFetch(`/api/admin/customers/${id}`),
    updateCustomer: (id: string, data: any) =>
      apiFetch(`/api/admin/customers/${id}`, { method: "PUT", body: JSON.stringify(data) }),

    // Coupons
    getCoupons: (params?: Record<string, string>) => {
      const query = params ? `?${new URLSearchParams(params)}` : "";
      return apiFetch(`/api/admin/coupons${query}`);
    },
    createCoupon: (data: any) => apiFetch("/api/admin/coupons", { method: "POST", body: JSON.stringify(data) }),
    updateCoupon: (id: string, data: any) =>
      apiFetch(`/api/admin/coupons/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteCoupon: (id: string) => apiFetch(`/api/admin/coupons/${id}`, { method: "DELETE" }),

    // Categories
    getCategories: () => apiFetch("/api/admin/categories"),
    createCategory: (data: any) => apiFetch("/api/admin/categories", { method: "POST", body: JSON.stringify(data) }),
    updateCategory: (id: string, data: any) =>
      apiFetch(`/api/admin/categories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteCategory: (id: string) => apiFetch(`/api/admin/categories/${id}`, { method: "DELETE" }),

    // Settings
    getSettings: () => apiFetch("/api/admin/settings"),
    updateSettings: (data: Record<string, string>) =>
      apiFetch("/api/admin/settings", { method: "PUT", body: JSON.stringify(data) }),
    getInventory: () => apiFetch("/api/admin/settings/inventory"),
    updateInventory: (productId: string, data: any) =>
      apiFetch(`/api/admin/settings/inventory/${productId}`, { method: "PUT", body: JSON.stringify(data) }),
  },
};
