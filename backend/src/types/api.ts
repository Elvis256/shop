/**
 * Shared API Types
 * These types define the shape of API responses and can be imported by the frontend
 */

// ============ User & Auth ============

export interface User {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: "CUSTOMER" | "ADMIN" | "MANAGER";
  emailVerified: boolean;
  createdAt: string;
}

export interface AuthResponse {
  message: string;
  user: Pick<User, "id" | "email" | "name" | "role">;
}

export interface UserProfile extends User {
  _count: {
    orders: number;
    wishlist: number;
  };
}

// ============ Products ============

export interface ProductImage {
  id: string;
  url: string;
  alt: string | null;
  position: number;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string | null;
  price: number | null;
  stock: number;
  size: string | null;
  color: string | null;
  material: string | null;
}

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice: number | null;
  currency: string;
  rating: number;
  imageUrl: string | null;
  category: string | null;
  inStock: boolean;
  stock: number;
  isNew: boolean;
  isBestseller: boolean;
  badgeText: string | null;
}

export interface ProductDetail extends Omit<ProductListItem, "category"> {
  description: string | null;
  reviewCount: number;
  images: string[];
  lowStockAlert: number;
  hasVariants: boolean;
  variants: ProductVariant[];
  tags: string[];
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export interface ProductsResponse {
  products: ProductListItem[];
  pagination: PaginationInfo;
}

// ============ Categories ============

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  productCount?: number;
}

// ============ Cart ============

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  slug: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
}

export interface Cart {
  id: string;
  items: CartItem[];
  total: number;
  itemCount: number;
}

// ============ Orders ============

export type OrderStatus = 
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export type PaymentStatus = "PENDING" | "SUCCESSFUL" | "FAILED" | "REFUNDED";
export type PaymentMethod = "CARD" | "MOBILE_MONEY";

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface OrderListItem {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  currency: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  itemCount: number;
  discreet: boolean;
  createdAt: string;
}

export interface OrderDetail extends OrderListItem {
  subtotal: number;
  discount: number;
  tax: number;
  shippingCost: number;
  shippingAddress: string;
  trackingNumber: string | null;
  items: OrderItem[];
  timeline: OrderEvent[];
}

export interface OrderEvent {
  id: string;
  status: string;
  note: string | null;
  createdAt: string;
}

export interface OrdersResponse {
  orders: OrderListItem[];
  pagination: PaginationInfo;
}

// ============ Wishlist ============

export interface WishlistItem {
  id: string;
  productId: string;
  product: ProductListItem;
  createdAt: string;
}

// ============ Reviews ============

export interface Review {
  id: string;
  rating: number;
  title: string | null;
  content: string | null;
  verified: boolean;
  approved: boolean;
  createdAt: string;
  user: {
    name: string | null;
  };
}

export interface ReviewsResponse {
  reviews: Review[];
  pagination: PaginationInfo;
  stats: {
    average: number;
    total: number;
    distribution: Record<number, number>;
  };
}

// ============ Addresses ============

export interface Address {
  id: string;
  name: string;
  phone: string;
  street: string;
  city: string;
  county: string | null;
  postalCode: string | null;
  country: string;
  isDefault: boolean;
}

// ============ Coupons ============

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  type: "PERCENTAGE" | "FIXED";
  value: number;
  minOrderAmount: number | null;
  maxDiscount: number | null;
  validFrom: string;
  validUntil: string;
  active: boolean;
}

export interface CouponValidation {
  valid: boolean;
  discount: number;
  message: string;
}

// ============ Checkout ============

export interface CheckoutRequest {
  cartId: string;
  currency: string;
  amount: number;
  paymentMethod: "card" | "mobile_money";
  mobileMoney?: {
    network: "MPESA" | "AIRTEL" | "MTN";
    phone: string;
  };
  customer: {
    name: string;
    email: string;
  };
  discreet?: boolean;
  shippingAddress?: string;
  couponCode?: string;
}

export interface CheckoutResponse {
  orderId: string;
  paymentId: string;
  paymentLink: string | null;
  status: string;
}

// ============ Admin ============

export interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  totalCustomers: number;
  totalProducts: number;
  pendingOrders: number;
  lowStockProducts: number;
  recentOrders: OrderListItem[];
  topProducts: ProductListItem[];
}

export interface CustomerListItem {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  orderCount: number;
  totalSpent: number;
  wishlistCount: number;
  reviewCount: number;
  createdAt: string;
}

export interface CustomersResponse {
  customers: CustomerListItem[];
  pagination: PaginationInfo;
}

// ============ Common ============

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  error: string;
  details?: unknown;
}

export interface SuccessMessage {
  message: string;
}
