/**
 * AliExpress Open Platform (TOP) API Service
 * Handles product search, import, order placement, and tracking
 */

import axios from "axios";
import crypto from "crypto";
import { withRetryAndCircuitBreaker } from "../utils/retry";

// AliExpress TOP API base URLs
const AE_API_URL = "https://api-sg.aliexpress.com/sync";
const AE_GATEWAY_URL = "https://api-sg.aliexpress.com/rest";

// Retry options for AliExpress API calls
const AE_RETRY_OPTIONS = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 8000,
  shouldRetry: (error: any) => {
    if (error?.code === "ECONNREFUSED" || error?.code === "ETIMEDOUT" || error?.code === "ENOTFOUND") {
      return true;
    }
    const status = error?.response?.status;
    return status && (status >= 500 || status === 429);
  },
};

function getConfig() {
  const appKey = process.env.AE_APP_KEY;
  const appSecret = process.env.AE_APP_SECRET;
  const accessToken = process.env.AE_ACCESS_TOKEN;
  if (!appKey || !appSecret || !accessToken) {
    throw new Error("AliExpress API credentials not configured. Set AE_APP_KEY, AE_APP_SECRET, AE_ACCESS_TOKEN in .env");
  }
  return { appKey, appSecret, accessToken };
}

/**
 * Generate TOP protocol HMAC-MD5 signature
 */
function signRequest(params: Record<string, string>, secret: string): string {
  const sorted = Object.keys(params).sort();
  let signStr = "";
  for (const key of sorted) {
    signStr += key + params[key];
  }
  signStr = secret + signStr + secret;
  return crypto.createHmac("md5", secret).update(signStr, "utf8").digest("hex").toUpperCase();
}

/**
 * Make a signed request to the AliExpress TOP API
 */
async function apiCall<T = any>(method: string, params: Record<string, any> = {}): Promise<T> {
  const { appKey, appSecret, accessToken } = getConfig();

  const baseParams: Record<string, string> = {
    app_key: appKey,
    method,
    access_token: accessToken,
    sign_method: "hmac-md5",
    timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
    format: "json",
    v: "2.0",
    simplify: "true",
  };

  // Merge additional params (stringify objects)
  for (const [key, value] of Object.entries(params)) {
    baseParams[key] = typeof value === "object" ? JSON.stringify(value) : String(value);
  }

  baseParams.sign = signRequest(baseParams, appSecret);

  return withRetryAndCircuitBreaker<T>(
    `aliexpress-${method}`,
    async () => {
      const response = await axios.post(AE_API_URL, null, {
        params: baseParams,
        timeout: 30000,
      });
      // AliExpress wraps responses in a method-specific key
      const data = response.data;
      if (data?.error_response) {
        const err = data.error_response;
        throw new Error(`AliExpress API error [${err.code}]: ${err.msg || err.sub_msg || "Unknown error"}`);
      }
      return data;
    },
    AE_RETRY_OPTIONS,
  );
}

// ── Product Search & Details ──

export interface AEProductSearchResult {
  productId: string;
  title: string;
  imageUrl: string;
  price: string;
  originalPrice: string;
  currency: string;
  rating: string;
  orders: number;
  shippingFree: boolean;
  sellerName: string;
  productUrl: string;
}

/**
 * Search AliExpress products via the affiliate/dropshipping API
 */
export async function searchProducts(query: string, page = 1, pageSize = 20): Promise<{
  products: AEProductSearchResult[];
  totalCount: number;
}> {
  const data = await apiCall("aliexpress.affiliate.product.query", {
    keywords: query,
    page_no: page,
    page_size: Math.min(pageSize, 50),
    target_currency: "USD",
    sort: "SALE_PRICE_ASC",
    ship_to_country: "UG",
  });

  const result = data?.aliexpress_affiliate_product_query_response?.resp_result?.result;
  if (!result?.products?.product) {
    return { products: [], totalCount: 0 };
  }

  const products: AEProductSearchResult[] = result.products.product.map((p: any) => ({
    productId: String(p.product_id),
    title: p.product_title || "",
    imageUrl: p.product_main_image_url || "",
    price: p.target_sale_price || p.target_original_price || "0",
    originalPrice: p.target_original_price || "0",
    currency: p.target_sale_price_currency || "USD",
    rating: p.evaluate_rate || "0",
    orders: Number(p.lastest_volume) || 0,
    shippingFree: p.discount === "free shipping",
    sellerName: "",
    productUrl: p.product_detail_url || `https://www.aliexpress.com/item/${p.product_id}.html`,
  }));

  return {
    products,
    totalCount: Number(result.total_record_count) || products.length,
  };
}

export interface AEProductDetail {
  productId: string;
  title: string;
  description: string;
  images: string[];
  price: number;
  originalPrice: number;
  currency: string;
  variants: Array<{
    skuId: string;
    skuAttr: string;
    price: number;
    stock: number;
  }>;
  shippingOptions: Array<{
    serviceName: string;
    cost: number;
    days: string;
  }>;
  sellerName: string;
  rating: number;
  orders: number;
  productUrl: string;
}

/**
 * Get full product details from AliExpress
 */
export async function getProductDetail(productId: string): Promise<AEProductDetail> {
  const data = await apiCall("aliexpress.ds.product.get", {
    product_id: productId,
    target_currency: "USD",
    ship_to_country: "UG",
  });

  const result = data?.aliexpress_ds_product_get_response?.result;
  if (!result) {
    throw new Error(`Product ${productId} not found on AliExpress`);
  }

  const images: string[] = result.ae_multimedia_info_dto?.image_urls?.split(";").filter(Boolean) || [];

  const variants = (result.ae_item_sku_info_dtos?.ae_item_sku_info_d_t_o || []).map((sku: any) => ({
    skuId: sku.id || sku.sku_id,
    skuAttr: sku.sku_attr || "",
    price: Number(sku.offer_sale_price || sku.sku_price || 0),
    stock: Number(sku.sku_available_stock || sku.s_k_u_available_stock || 0),
  }));

  const shippingOptions = (result.ae_item_delivery_info_dtos?.ae_item_delivery_info_d_t_o || []).map((s: any) => ({
    serviceName: s.delivery_provider_name || "Standard",
    cost: Number(s.delivery_fee || 0),
    days: s.estimated_delivery_time || "15-30 days",
  }));

  return {
    productId: String(result.product_id || productId),
    title: result.subject || result.product_title || "",
    description: result.detail || result.product_description || "",
    images,
    price: Number(result.ae_item_base_info_dto?.sale_price?.amount || result.sale_price || 0),
    originalPrice: Number(result.ae_item_base_info_dto?.original_price?.amount || result.original_price || 0),
    currency: result.ae_item_base_info_dto?.sale_price?.currency_code || "USD",
    variants,
    shippingOptions,
    sellerName: result.store_info?.store_name || "",
    rating: Number(result.avg_evaluation_rating || 0),
    orders: Number(result.order_count || 0),
    productUrl: `https://www.aliexpress.com/item/${productId}.html`,
  };
}

// ── Order Placement ──

export interface AEPlaceOrderInput {
  productId: string;
  quantity: number;
  skuId?: string;
  shippingAddress: {
    name: string;
    phone: string;
    street: string;
    city: string;
    province: string;
    country: string;
    zip: string;
  };
  shippingMethod?: string;
}

export interface AEPlaceOrderResult {
  aliexpressOrderId: string;
  orderStatus: string;
}

/**
 * Place a dropshipping order on AliExpress
 */
export async function placeOrder(input: AEPlaceOrderInput): Promise<AEPlaceOrderResult> {
  const address = input.shippingAddress;

  const data = await apiCall("aliexpress.ds.order.create", {
    product_id: input.productId,
    product_count: input.quantity,
    sku_id: input.skuId || "",
    logistics_address: {
      full_name: address.name,
      phone_country: "",
      mobile_no: address.phone,
      address: address.street,
      city: address.city,
      province: address.province,
      country: address.country,
      zip: address.zip,
    },
    shipping_method: input.shippingMethod || "",
  });

  const result = data?.aliexpress_ds_order_create_response?.result;
  if (!result?.is_success) {
    const errMsg = result?.error_msg || result?.error_code || "Order placement failed";
    throw new Error(`AliExpress order failed: ${errMsg}`);
  }

  return {
    aliexpressOrderId: String(result.order_id || result.order_list?.[0]),
    orderStatus: "PLACED",
  };
}

// ── Order Tracking ──

export interface AETrackingInfo {
  trackingNumber: string;
  trackingUrl: string;
  carrier: string;
  status: string;
  events: Array<{
    date: string;
    description: string;
  }>;
}

/**
 * Get order tracking info from AliExpress
 */
export async function getOrderTracking(aliexpressOrderId: string): Promise<AETrackingInfo | null> {
  try {
    const data = await apiCall("aliexpress.ds.order.get", {
      order_id: aliexpressOrderId,
    });

    const result = data?.aliexpress_ds_order_get_response?.result;
    if (!result) return null;

    const logisticsInfo = result.logistics_info_list?.logistics_info?.[0];

    return {
      trackingNumber: logisticsInfo?.logistics_no || "",
      trackingUrl: logisticsInfo?.logistics_track_url || "",
      carrier: logisticsInfo?.logistics_company || "",
      status: result.order_status || "",
      events: (logisticsInfo?.tracking_info_list?.tracking_info || []).map((e: any) => ({
        date: e.event_date || "",
        description: e.event_desc || "",
      })),
    };
  } catch (error) {
    console.error(`Failed to get tracking for AE order ${aliexpressOrderId}:`, error);
    return null;
  }
}

/**
 * Get shipping options and costs for a product to a specific country
 */
export async function getShippingInfo(productId: string, country = "UG"): Promise<Array<{
  serviceName: string;
  cost: number;
  estimatedDays: string;
}>> {
  try {
    const data = await apiCall("aliexpress.ds.freight.query", {
      product_id: productId,
      ship_to_country: country,
      quantity: 1,
    });

    const result = data?.aliexpress_ds_freight_query_response?.result;
    if (!result?.freight_list?.freight) return [];

    return result.freight_list.freight.map((f: any) => ({
      serviceName: f.service_name || "Standard",
      cost: Number(f.freight?.amount || 0),
      estimatedDays: f.estimated_delivery_time || "15-45 days",
    }));
  } catch (error) {
    console.error(`Failed to get shipping for product ${productId}:`, error);
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
