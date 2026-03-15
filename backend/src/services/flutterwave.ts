import axios from "axios";
import { withRetryAndCircuitBreaker } from "../utils/retry";

type CreatePaymentInput = {
  tx_ref: string;
  amount: number;
  currency: string;
  customer: {
    name: string;
    email: string;
  };
  paymentMethod: "card" | "mobile_money";
  mobileMoney?: {
    network: "MPESA" | "AIRTEL" | "MTN";
    phone: string;
  };
  redirect_url: string;
};

type FlutterwaveResponse = {
  status: string;
  message: string;
  data?: {
    link?: string;
    flw_ref?: string;
    tx_ref?: string;
    id?: string;
    reference?: string;
    next_action?: {
      type: string;
      redirect_url?: { url: string };
    };
  };
};

// V4 API endpoints
const FLW_TOKEN_URL =
  "https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token";
const FLW_BASE_URL = "https://f4bexperience.flutterwave.com";
const FLW_CHECKOUT_URL = "https://checkout.flutterwave.com/hosted/pay";

// OAuth2 token cache
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

// Retry options for Flutterwave API calls
const FLUTTERWAVE_RETRY_OPTIONS = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 5000,
  shouldRetry: (error: any) => {
    if (error?.code === "ECONNREFUSED" || error?.code === "ETIMEDOUT" || error?.code === "ENOTFOUND") {
      return true;
    }
    const status = error?.response?.status;
    if (status && status >= 500) {
      return true;
    }
    if (status === 429) {
      return true;
    }
    // Retry on 401 (token expired — will be refreshed on next attempt)
    if (status === 401) {
      cachedToken = null;
      return true;
    }
    return false;
  },
};

/**
 * Obtain an OAuth2 access token using Client Credentials grant.
 * Caches the token and refreshes 60s before expiry.
 */
async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.accessToken;
  }

  const clientId = process.env.FLW_CLIENT_ID;
  const clientSecret = process.env.FLW_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Flutterwave V4 credentials not configured (FLW_CLIENT_ID / FLW_CLIENT_SECRET)");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });

  const response = await axios.post(FLW_TOKEN_URL, params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 15000,
  });

  const { access_token, expires_in } = response.data;
  // Cache token with 60s safety margin
  cachedToken = {
    accessToken: access_token,
    expiresAt: now + (expires_in - 60) * 1000,
  };

  return access_token;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function createFlutterwavePayment(
  input: CreatePaymentInput
): Promise<FlutterwaveResponse> {
  // For mobile money payments — use the Orchestrator Flow
  if (input.paymentMethod === "mobile_money" && input.mobileMoney) {
    const [firstName, ...lastParts] = input.customer.name.split(" ");
    const lastName = lastParts.join(" ") || firstName;

    const orchestratorPayload = {
      amount: input.amount,
      currency: input.currency,
      reference: input.tx_ref,
      redirect_url: input.redirect_url,
      payment_method: {
        type: "mobile_money",
        mobile_money: {
          country_code: "256", // Uganda
          network: input.mobileMoney.network,
          phone_number: input.mobileMoney.phone.replace(/^\+?256/, ""),
        },
      },
      customer: {
        email: input.customer.email,
        name: { first: firstName, last: lastName },
        phone: {
          country_code: "256",
          number: input.mobileMoney.phone.replace(/^\+?256/, ""),
        },
      },
    };

    try {
      return await withRetryAndCircuitBreaker(
        "flutterwave-mobile-money",
        async () => {
          const headers = await getAuthHeaders();
          const response = await axios.post<any>(
            `${FLW_BASE_URL}/orchestration/direct-charges`,
            orchestratorPayload,
            {
              headers: {
                ...headers,
                "X-Idempotency-Key": `mm-${input.tx_ref}`,
                "X-Trace-Id": `trace-${input.tx_ref}`,
              },
              timeout: 30000,
            }
          );

          const data = response.data;
          // Normalize response to match expected format
          const redirectUrl =
            data.data?.next_action?.redirect_url?.url || undefined;
          return {
            status: data.status || "success",
            message: data.message || "Charge initiated",
            data: {
              link: redirectUrl,
              flw_ref: data.data?.id || data.data?.reference,
              tx_ref: input.tx_ref,
            },
          };
        },
        FLUTTERWAVE_RETRY_OPTIONS
      );
    } catch (error: any) {
      console.error("Flutterwave V4 mobile money error:", error.response?.data || error.message);
      throw new Error("Mobile money payment initiation failed. Please try again.");
    }
  }

  // For card payments — use V4 Checkout Sessions (hosted payment page)
  const payload = {
    reference: input.tx_ref,
    amount: input.amount,
    currency: input.currency,
    redirect_url: input.redirect_url,
    customer: {
      email: input.customer.email,
      name: input.customer.name,
    },
    customizations: {
      title: "Adult Store",
      description: "Order Payment",
      logo: "",
    },
  };

  try {
    return await withRetryAndCircuitBreaker(
      "flutterwave-card",
      async () => {
        const headers = await getAuthHeaders();
        const response = await axios.post<any>(
          `${FLW_BASE_URL}/checkout/sessions`,
          payload,
          { headers, timeout: 30000 }
        );
        const sessionId = response.data?.data?.id;
        const checkoutLink = sessionId
          ? `${FLW_CHECKOUT_URL}?session=${sessionId}`
          : undefined;
        return {
          status: response.data.status || "success",
          message: response.data.message || "Checkout session created",
          data: {
            link: checkoutLink,
            flw_ref: sessionId || response.data?.data?.reference,
            tx_ref: input.tx_ref,
          },
        };
      },
      FLUTTERWAVE_RETRY_OPTIONS
    );
  } catch (error: any) {
    console.error("Flutterwave V4 card payment error:", error.response?.data || error.message);
    throw new Error("Card payment initiation failed. Please try again.");
  }
}

export async function verifyFlutterwaveTransaction(transactionId: string) {
  try {
    return await withRetryAndCircuitBreaker(
      "flutterwave-verify",
      async () => {
        const headers = await getAuthHeaders();
        const response = await axios.get(
          `${FLW_BASE_URL}/charges/${transactionId}`,
          { headers, timeout: 15000 }
        );
        return response.data;
      },
      FLUTTERWAVE_RETRY_OPTIONS
    );
  } catch (error: any) {
    console.error("Flutterwave V4 verify error:", error.response?.data || error.message);
    throw new Error("Transaction verification failed. Please try again.");
  }
}

export async function refundFlutterwaveTransaction(
  transactionId: string,
  amount?: number,
  comment?: string
): Promise<{ status: string; message: string; data?: any }> {
  try {
    return await withRetryAndCircuitBreaker(
      "flutterwave-refund",
      async () => {
        const headers = await getAuthHeaders();
        const response = await axios.post(
          `${FLW_BASE_URL}/charges/${transactionId}/refund`,
          { amount, comment: comment || "Refund requested" },
          { headers, timeout: 20000 }
        );
        return response.data;
      },
      FLUTTERWAVE_RETRY_OPTIONS
    );
  } catch (error: any) {
    console.error("Flutterwave V4 refund error:", error.response?.data || error.message);
    throw new Error("Refund failed. Please try again or contact Flutterwave support.");
  }
}
