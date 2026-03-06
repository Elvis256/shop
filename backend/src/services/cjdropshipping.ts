/**
 * CJ Dropshipping API Service
 * https://developers.cjdropshipping.com/api2.0/v1/
 * Auth: Exchange email + API key for an access token, then use token in header
 */

import axios from "axios";
import { withRetryAndCircuitBreaker } from "../utils/retry";

const CJ_BASE_URL = "https://developers.cjdropshipping.com/api2.0/v1";

const CJ_RETRY_OPTIONS = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 8000,
  shouldRetry: (error: any) => {
    if (error?.code === "ECONNREFUSED" || error?.code === "ETIMEDOUT" || error?.code === "ENOTFOUND") {
      return true;
    }
    const status = error?.response?.status;
    // Don't retry 401 — need to refresh token
    return status && status >= 500;
  },
};

// In-memory cached access token
let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * Get a valid access token, refreshing if needed.
 * CJ requires: POST /authentication/getAccessToken with {email, password(=apiKey)}
 */
async function getAccessToken(): Promise<string> {
  // Use cached token if still valid (with 5min buffer)
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 300000) {
    return cachedAccessToken;
  }

  // Check if we already have a direct access token set
  if (process.env.CJ_ACCESS_TOKEN && !process.env.CJ_API_KEY) {
    return process.env.CJ_ACCESS_TOKEN;
  }

  const email = process.env.CJ_EMAIL;
  const apiKey = process.env.CJ_API_KEY;

  if (!email || !apiKey) {
    throw new Error("CJ Dropshipping credentials not configured. Set CJ_EMAIL and CJ_API_KEY in .env");
  }

  try {
    const response = await axios.post(`${CJ_BASE_URL}/authentication/getAccessToken`, {
      email,
      password: apiKey,
    }, { timeout: 30000 });

    const body = response.data;
    if (!body.data?.accessToken) {
      throw new Error(`CJ auth failed: ${body.message || "No token returned"}`);
    }

    cachedAccessToken = body.data.accessToken;
    // Token typically lasts ~30 days, cache for 24h to be safe
    tokenExpiresAt = Date.now() + 24 * 60 * 60 * 1000;

    console.log("[CJ] Access token refreshed successfully");
    return cachedAccessToken!;
  } catch (error: any) {
    const msg = error.response?.data?.message || error.message;
    throw new Error(`CJ authentication failed: ${msg}`);
  }
}

async function headers() {
  const token = await getAccessToken();
  return {
    "CJ-Access-Token": token,
    "Content-Type": "application/json",
  };
}

/**
 * Make an authenticated request to the CJ API
 */
async function apiCall<T = any>(method: "GET" | "POST" | "PATCH", path: string, data?: any): Promise<T> {
  return withRetryAndCircuitBreaker<T>(
    `cj-${path}`,
    async () => {
      const hdrs = await headers();
      const response = await axios({
        method,
        url: `${CJ_BASE_URL}${path}`,
        headers: hdrs,
        data: method !== "GET" ? data : undefined,
        params: method === "GET" ? data : undefined,
        timeout: 30000,
      });

      const body = response.data;
      if (body.code !== 200 && body.result !== true) {
        throw new Error(`CJ API error [${body.code}]: ${body.message || "Unknown error"}`);
      }
      return body.data;
    },
    CJ_RETRY_OPTIONS,
  );
}

// ── Product Search & Details ──

export interface CJProductSearchResult {
  productId: string;
  title: string;
  imageUrl: string;
  price: number;
  originalPrice: number;
  categoryName: string;
  sellPrice: number;
  productUrl: string;
}

/**
 * Search CJ Dropshipping products
 */
export async function searchProducts(query: string, page = 1, pageSize = 20): Promise<{
  products: CJProductSearchResult[];
  totalCount: number;
}> {
  const data = await apiCall("GET", "/product/list", {
    productNameEn: query,
    pageNum: page,
    pageSize: Math.min(pageSize, 50),
  });

  if (!data?.list) {
    return { products: [], totalCount: 0 };
  }

  const products: CJProductSearchResult[] = data.list.map((p: any) => ({
    productId: p.pid || p.productId || "",
    title: p.productNameEn || p.productName || "",
    imageUrl: p.productImage || "",
    price: Number(p.sellPrice || p.productPrice || 0),
    originalPrice: Number(p.productPrice || p.sellPrice || 0),
    categoryName: p.categoryName || "",
    sellPrice: Number(p.sellPrice || 0),
    productUrl: `https://cjdropshipping.com/product/${p.pid || p.productId}.html`,
  }));

  return {
    products,
    totalCount: Number(data.total) || products.length,
  };
}

export interface CJProductDetail {
  productId: string;
  title: string;
  description: string;
  images: string[];
  price: number;
  originalPrice: number;
  variants: Array<{
    vid: string;
    variantName: string;
    variantPrice: number;
    variantStock: number;
    variantImage: string;
  }>;
  weight: number;
  categoryName: string;
  productUrl: string;
}

/**
 * Get full product details from CJ
 */
export async function getProductDetail(productId: string): Promise<CJProductDetail> {
  const data = await apiCall("GET", `/product/query`, { pid: productId });

  if (!data) {
    throw new Error(`Product ${productId} not found on CJ Dropshipping`);
  }

  const images: string[] = (data.productImageSet || []).map((img: any) => img.imageUrl || img).filter(Boolean);
  // productImage can sometimes be a JSON array string or actual array — normalize it
  if (data.productImage) {
    let mainImages: string[] = [];
    if (Array.isArray(data.productImage)) {
      mainImages = data.productImage.filter((u: any) => typeof u === "string");
    } else if (typeof data.productImage === "string" && data.productImage.startsWith("[")) {
      try { mainImages = JSON.parse(data.productImage); } catch { mainImages = [data.productImage]; }
    } else if (typeof data.productImage === "string") {
      mainImages = [data.productImage];
    }
    for (const url of mainImages) {
      if (!images.includes(url)) images.unshift(url);
    }
  }

  const variants = (data.variants || []).map((v: any) => ({
    vid: v.vid || v.variantId || "",
    variantName: v.variantNameEn || v.variantName || "Default",
    variantPrice: Number(v.variantSellPrice || v.variantPrice || data.sellPrice || 0),
    variantStock: Number(v.variantVolume || v.variantStock || 999),
    variantImage: v.variantImage || "",
  }));

  return {
    productId: data.pid || productId,
    title: data.productNameEn || data.productName || "",
    description: data.description || data.productDescEn || "",
    images,
    price: Number(data.sellPrice || data.productPrice || 0),
    originalPrice: Number(data.productPrice || data.sellPrice || 0),
    variants,
    weight: Number(data.productWeight || 0),
    categoryName: data.categoryName || "",
    productUrl: `https://cjdropshipping.com/product/${productId}.html`,
  };
}

// ── Order Placement ──

export interface CJPlaceOrderInput {
  productId: string;
  variantId?: string;
  quantity: number;
  shippingAddress: {
    name: string;
    phone: string;
    street: string;
    city: string;
    province: string;
    country: string;
    countryCode: string;
    zip: string;
  };
  shippingMethod?: string;
}

export interface CJPlaceOrderResult {
  cjOrderId: string;
  orderStatus: string;
}

/**
 * Place a dropshipping order on CJ
 */
export async function placeOrder(input: CJPlaceOrderInput): Promise<CJPlaceOrderResult> {
  const addr = input.shippingAddress;

  const orderData = {
    products: [
      {
        vid: input.variantId || input.productId,
        quantity: input.quantity,
      },
    ],
    orderNumber: `SHOP-${Date.now()}`,
    shippingCountryCode: addr.countryCode || "UG",
    shippingCountry: addr.country || "Uganda",
    shippingProvince: addr.province,
    shippingCity: addr.city,
    shippingAddress: addr.street,
    shippingCustomerName: addr.name,
    shippingPhone: addr.phone,
    shippingZip: addr.zip,
    logisticName: input.shippingMethod || "",
  };

  const data = await apiCall("POST", "/shopping/order/createOrder", orderData);

  if (!data?.orderId && !data?.orderNum) {
    throw new Error("CJ order creation failed: no order ID returned");
  }

  return {
    cjOrderId: String(data.orderId || data.orderNum),
    orderStatus: "PLACED",
  };
}

// ── Order Tracking ──

export interface CJTrackingInfo {
  trackingNumber: string;
  trackingUrl: string;
  carrier: string;
  status: string;
  events: Array<{ date: string; description: string }>;
}

/**
 * Get order tracking info from CJ
 */
export async function getOrderTracking(cjOrderId: string): Promise<CJTrackingInfo | null> {
  try {
    const data = await apiCall("GET", "/logistic/getTrackInfo", { orderId: cjOrderId });
    if (!data) return null;

    return {
      trackingNumber: data.trackingNumber || data.logisticNumber || "",
      trackingUrl: data.trackingUrl || "",
      carrier: data.logisticName || data.carrier || "",
      status: data.orderStatus || data.status || "",
      events: (data.trackInfoList || []).map((e: any) => ({
        date: e.date || e.eventTime || "",
        description: e.info || e.eventDesc || "",
      })),
    };
  } catch (error) {
    console.error(`Failed to get tracking for CJ order ${cjOrderId}:`, error);
    return null;
  }
}

/**
 * Get shipping methods and costs for a product
 */
export async function getShippingInfo(productId: string, countryCode = "UG"): Promise<Array<{
  serviceName: string;
  cost: number;
  estimatedDays: string;
}>> {
  try {
    const data = await apiCall("POST", "/logistic/freightCalculate", {
      startCountryCode: "CN",
      endCountryCode: countryCode,
      products: [{ quantity: 1, vid: productId }],
    });

    if (!Array.isArray(data)) return [];

    return data.map((f: any) => ({
      serviceName: f.logisticName || "Standard",
      cost: Number(f.logisticPrice || 0),
      estimatedDays: f.logisticAging || "10-25 days",
    }));
  } catch (error) {
    console.error(`Failed to get CJ shipping for product ${productId}:`, error);
    return [];
  }
}

/**
 * Calculate selling price based on supplier cost and markup
 */
export function calculateSellingPrice(
  supplierCost: number,
  markupType: "PERCENTAGE" | "FIXED",
  markupValue: number,
): number {
  if (markupType === "PERCENTAGE") {
    return Math.ceil(supplierCost * (1 + markupValue / 100) * 100) / 100;
  }
  return Math.ceil((supplierCost + markupValue) * 100) / 100;
}
