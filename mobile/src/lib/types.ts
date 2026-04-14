export interface AuthResponse {
  user: UserProfile;
  message: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice?: number | null;
  currency: string;
  rating: string;
  imageUrl: string;
  category?: string;
  inStock: boolean;
  stock: number;
  isNew: boolean;
  isBestseller: boolean;
  badgeText?: string | null;
  shippingBadge?: string;
  flashSalePrice?: number | null;
  flashSaleEndsAt?: string | null;
  createdAt: string;
}

export interface ProductDetail extends ProductListItem {
  description: string;
  images: string[];
  variants: ProductVariant[];
  specifications?: Record<string, string>;
  tags?: string[];
  hasVariants: boolean;
}

export interface ProductVariant {
  id: string;
  name: string;
  values: string[];
}

export interface ProductsResponse {
  products: ProductListItem[];
  pagination: PaginationInfo;
}

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CartItem {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    currency: string;
    imageUrl: string;
    stock: number;
    shippingBadge?: string;
  };
  quantity: number;
  subtotal: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
  total: number;
  itemCount: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  price: number;
  product?: {
    slug: string;
    images?: string[];
  };
}

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  customerName: string;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  discount: number;
  totalAmount: number;
  currency: string;
  shippingAddress?: Address;
  trackingNumber?: string;
  discreet: boolean;
  timeline?: TimelineEntry[];
  createdAt: string;
}

export interface TimelineEntry {
  status: string;
  note: string;
  createdAt: string;
}

export interface OrdersResponse {
  orders: Order[];
  pagination: PaginationInfo;
}

export interface WishlistItem {
  id: string;
  addedAt: string;
  collectionName: string;
  product: ProductListItem;
}

export interface Address {
  id: string;
  userId?: string;
  name: string;
  phone: string;
  street: string;
  city: string;
  postalCode?: string;
  isDefault?: boolean;
}

export interface ReviewItem {
  id: string;
  rating: number;
  comment: string;
  userName: string;
  createdAt: string;
}

export interface ReviewsResponse {
  reviews: ReviewItem[];
  pagination: PaginationInfo;
  averageRating: number;
  totalReviews: number;
}

export interface CouponValidation {
  valid: boolean;
  discount: number;
  discountType: string;
  message: string;
}

export interface CheckoutRequest {
  cartId?: string;
  items?: { productId: string; quantity: number; price: number }[];
  currency: string;
  amount: number;
  shipping: number;
  paymentMethod: string;
  mobileMoney?: { network: string; phone: string };
  customer: { name: string; email: string; phone: string };
  couponCode?: string;
  discreet?: boolean;
  shippingAddress: Omit<Address, 'id' | 'userId' | 'isDefault'>;
  storeCreditAmount?: number;
  installments?: number;
}

export interface CheckoutResponse {
  orderId: string;
  orderNumber: string;
  status: string;
  paymentData?: any;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  productCount?: number;
}

export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  totalProducts: number;
  recentOrders: Order[];
  lowStockProducts: ProductListItem[];
}
