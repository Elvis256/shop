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
  };
};

// V3 API
const FLW_BASE_URL = "https://api.flutterwave.com/v3";

const FLUTTERWAVE_RETRY_OPTIONS = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 5000,
  shouldRetry: (error: any) => {
    if (error?.code === "ECONNREFUSED" || error?.code === "ETIMEDOUT" || error?.code === "ENOTFOUND") {
      return true;
    }
    const status = error?.response?.status;
    if (status && status >= 500) return true;
    if (status === 429) return true;
    return false;
  },
};

function getSecretKey(): string {
  const key = process.env.FLW_SECRET_KEY;
  if (!key) {
    throw new Error("Flutterwave credentials not configured (FLW_SECRET_KEY)");
  }
  return key;
}

function getAuthHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getSecretKey()}`,
    "Content-Type": "application/json",
  };
}

export async function createFlutterwavePayment(
  input: CreatePaymentInput
): Promise<FlutterwaveResponse> {
  const payload: Record<string, any> = {
    tx_ref: input.tx_ref,
    amount: input.amount,
    currency: input.currency,
    redirect_url: input.redirect_url,
    customer: {
      email: input.customer.email,
      name: input.customer.name,
    },
    customizations: {
      title: "UGSex Store",
      description: "Order Payment",
    },
  };

  if (input.paymentMethod === "mobile_money" && input.mobileMoney) {
    payload.payment_options = "mobilemoneyuganda";
  } else {
    payload.payment_options = "card";
  }

  try {
    return await withRetryAndCircuitBreaker(
      "flutterwave-payment",
      async () => {
        const response = await axios.post<FlutterwaveResponse>(
          `${FLW_BASE_URL}/payments`,
          payload,
          { headers: getAuthHeaders(), timeout: 30000 }
        );
        return response.data;
      },
      FLUTTERWAVE_RETRY_OPTIONS
    );
  } catch (error: any) {
    console.error("Flutterwave payment error:", error.response?.data || error.message);
    throw new Error("Payment initiation failed. Please try again.");
  }
}

export async function verifyFlutterwaveTransaction(transactionId: string) {
  try {
    return await withRetryAndCircuitBreaker(
      "flutterwave-verify",
      async () => {
        const response = await axios.get(
          `${FLW_BASE_URL}/transactions/${transactionId}/verify`,
          { headers: getAuthHeaders(), timeout: 15000 }
        );
        return response.data;
      },
      FLUTTERWAVE_RETRY_OPTIONS
    );
  } catch (error: any) {
    console.error("Flutterwave verify error:", error.response?.data || error.message);
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
        const response = await axios.post(
          `${FLW_BASE_URL}/transactions/${transactionId}/refund`,
          { amount, comment: comment || "Refund requested" },
          { headers: getAuthHeaders(), timeout: 20000 }
        );
        return response.data;
      },
      FLUTTERWAVE_RETRY_OPTIONS
    );
  } catch (error: any) {
    console.error("Flutterwave refund error:", error.response?.data || error.message);
    throw new Error("Refund failed. Please try again or contact Flutterwave support.");
  }
}
