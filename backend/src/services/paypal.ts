import axios from "axios";
import prisma from "../lib/prisma";

const PAYPAL_NVP_LIVE = "https://api-3t.paypal.com/nvp";
const PAYPAL_NVP_SANDBOX = "https://api-3t.sandbox.paypal.com/nvp";
const PAYPAL_REDIRECT_LIVE = "https://www.paypal.com/cgi-bin/webscr?cmd=_express-checkout&token=";
const PAYPAL_REDIRECT_SANDBOX = "https://www.sandbox.paypal.com/cgi-bin/webscr?cmd=_express-checkout&token=";

const NVP_VERSION = "124.0";

function getEndpoint(): string {
  return process.env.PAYPAL_MODE === "live" ? PAYPAL_NVP_LIVE : PAYPAL_NVP_SANDBOX;
}

function getRedirectBase(): string {
  return process.env.PAYPAL_MODE === "live" ? PAYPAL_REDIRECT_LIVE : PAYPAL_REDIRECT_SANDBOX;
}

function baseParams(): Record<string, string> {
  return {
    USER: process.env.PAYPAL_API_USERNAME || "",
    PWD: process.env.PAYPAL_API_PASSWORD || "",
    SIGNATURE: process.env.PAYPAL_API_SIGNATURE || "",
    VERSION: NVP_VERSION,
  };
}

function encodeNVP(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

function decodeNVP(body: string): Record<string, string> {
  const result: Record<string, string> = {};
  body.split("&").forEach((pair) => {
    const [key, value] = pair.split("=");
    if (key) result[decodeURIComponent(key)] = decodeURIComponent(value || "");
  });
  return result;
}

async function nvpCall(params: Record<string, string>): Promise<Record<string, string>> {
  const allParams = { ...baseParams(), ...params };
  const { data } = await axios.post(getEndpoint(), encodeNVP(allParams), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 30000,
  });
  return decodeNVP(data);
}

// Convert UGX amount to USD using the Currency table
async function convertUgxToUsd(amountUgx: number): Promise<number> {
  const usdCurrency = await prisma.currency.findUnique({ where: { code: "USD" } });
  const rate = usdCurrency ? Number(usdCurrency.exchangeRate) : 0.000271;
  return Math.round(amountUgx * rate * 100) / 100; // Round to 2 decimal places
}

export interface PayPalCheckoutResult {
  token: string;
  redirectUrl: string;
}

/**
 * SetExpressCheckout — creates a PayPal payment and returns a redirect URL.
 * PayPal doesn't support UGX, so we convert to USD.
 */
export async function createPayPalCheckout(input: {
  orderId: string;
  amountUgx: number;
  customerEmail: string;
  description?: string;
}): Promise<PayPalCheckoutResult> {
  const amountUsd = await convertUgxToUsd(input.amountUgx);

  if (amountUsd < 1) {
    throw new Error("Order amount too small for PayPal (minimum $1.00 USD)");
  }

  const backendUrl = process.env.BACKEND_URL || `${process.env.BASE_URL}`;
  const returnUrl = `${backendUrl}/api/checkout/paypal-return?orderId=${input.orderId}`;
  const cancelUrl = `${backendUrl}/api/checkout/paypal-cancel?orderId=${input.orderId}`;

  const response = await nvpCall({
    METHOD: "SetExpressCheckout",
    PAYMENTREQUEST_0_PAYMENTACTION: "Sale",
    PAYMENTREQUEST_0_AMT: amountUsd.toFixed(2),
    PAYMENTREQUEST_0_CURRENCYCODE: "USD",
    PAYMENTREQUEST_0_DESC: input.description || "Order from Pleasure Zone",
    PAYMENTREQUEST_0_INVNUM: input.orderId,
    RETURNURL: returnUrl,
    CANCELURL: cancelUrl,
    EMAIL: input.customerEmail,
    NOSHIPPING: "1",
    ALLOWNOTE: "0",
    BRANDNAME: "Pleasure Zone",
  });

  if (response.ACK !== "Success" && response.ACK !== "SuccessWithWarning") {
    const errorMsg = response.L_LONGMESSAGE0 || response.L_SHORTMESSAGE0 || "PayPal checkout failed";
    console.error("PayPal SetExpressCheckout error:", response);
    throw new Error(errorMsg);
  }

  const token = response.TOKEN;
  return {
    token,
    redirectUrl: `${getRedirectBase()}${token}`,
  };
}

/**
 * GetExpressCheckoutDetails — retrieves payer info after they approve on PayPal.
 */
export async function getPayPalCheckoutDetails(token: string) {
  const response = await nvpCall({
    METHOD: "GetExpressCheckoutDetails",
    TOKEN: token,
  });

  if (response.ACK !== "Success" && response.ACK !== "SuccessWithWarning") {
    const errorMsg = response.L_LONGMESSAGE0 || "Failed to get checkout details";
    console.error("PayPal GetExpressCheckoutDetails error:", response);
    throw new Error(errorMsg);
  }

  return {
    payerId: response.PAYERID,
    email: response.EMAIL,
    firstName: response.FIRSTNAME,
    lastName: response.LASTNAME,
    amount: response.PAYMENTREQUEST_0_AMT,
    currency: response.PAYMENTREQUEST_0_CURRENCYCODE,
    status: response.CHECKOUTSTATUS,
  };
}

/**
 * DoExpressCheckoutPayment — completes the payment after payer approval.
 */
export async function executePayPalPayment(token: string, payerId: string, amountUsd: string) {
  const response = await nvpCall({
    METHOD: "DoExpressCheckoutPayment",
    TOKEN: token,
    PAYERID: payerId,
    PAYMENTREQUEST_0_PAYMENTACTION: "Sale",
    PAYMENTREQUEST_0_AMT: amountUsd,
    PAYMENTREQUEST_0_CURRENCYCODE: "USD",
  });

  if (response.ACK !== "Success" && response.ACK !== "SuccessWithWarning") {
    const errorMsg = response.L_LONGMESSAGE0 || "PayPal payment failed";
    console.error("PayPal DoExpressCheckoutPayment error:", response);
    throw new Error(errorMsg);
  }

  return {
    transactionId: response.PAYMENTINFO_0_TRANSACTIONID,
    status: response.PAYMENTINFO_0_PAYMENTSTATUS,
    amount: response.PAYMENTINFO_0_AMT,
    currency: response.PAYMENTINFO_0_CURRENCYCODE,
    feeAmount: response.PAYMENTINFO_0_FEEAMT,
    ack: response.ACK,
  };
}
