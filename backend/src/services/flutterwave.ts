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

const FLW_BASE_URL = "https://api.flutterwave.com/v3";

// Retry options for Flutterwave API calls
const FLUTTERWAVE_RETRY_OPTIONS = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 5000,
  shouldRetry: (error: any) => {
    // Retry on network errors
    if (error?.code === "ECONNREFUSED" || error?.code === "ETIMEDOUT" || error?.code === "ENOTFOUND") {
      return true;
    }
    // Retry on 5xx server errors
    const status = error?.response?.status;
    if (status && status >= 500) {
      return true;
    }
    // Retry on rate limiting
    if (status === 429) {
      return true;
    }
    return false;
  },
};

export async function createFlutterwavePayment(
  input: CreatePaymentInput
): Promise<FlutterwaveResponse> {
  const headers = {
    Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
    "Content-Type": "application/json",
  };

  // For mobile money payments
  if (input.paymentMethod === "mobile_money" && input.mobileMoney) {
    const mobileMoneyPayload = {
      tx_ref: input.tx_ref,
      amount: input.amount,
      currency: input.currency,
      email: input.customer.email,
      phone_number: input.mobileMoney.phone,
      fullname: input.customer.name,
      redirect_url: input.redirect_url,
    };

    // Different endpoint based on network
    let endpoint = "";
    switch (input.mobileMoney.network) {
      case "MPESA":
        endpoint = "/charges?type=mpesa";
        break;
      case "AIRTEL":
        endpoint = "/charges?type=mobilemoneyug"; // Airtel Uganda/Kenya
        break;
      case "MTN":
        endpoint = "/charges?type=mobilemoneyug"; // MTN Uganda
        break;
    }

    try {
      return await withRetryAndCircuitBreaker(
        "flutterwave-mobile-money",
        async () => {
          const response = await axios.post<FlutterwaveResponse>(
            `${FLW_BASE_URL}${endpoint}`,
            mobileMoneyPayload,
            { headers, timeout: 30000 }
          );
          return response.data;
        },
        FLUTTERWAVE_RETRY_OPTIONS
      );
    } catch (error: any) {
      console.error("Flutterwave mobile money error:", error.response?.data || error.message);
      throw new Error("Mobile money payment initiation failed. Please try again.");
    }
  }

  // For card payments - use standard checkout
  const payload = {
    tx_ref: input.tx_ref,
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
    payment_options: "card",
  };

  try {
    return await withRetryAndCircuitBreaker(
      "flutterwave-card",
      async () => {
        const response = await axios.post<FlutterwaveResponse>(
          `${FLW_BASE_URL}/payments`,
          payload,
          { headers, timeout: 30000 }
        );
        return response.data;
      },
      FLUTTERWAVE_RETRY_OPTIONS
    );
  } catch (error: any) {
    console.error("Flutterwave card payment error:", error.response?.data || error.message);
    throw new Error("Card payment initiation failed. Please try again.");
  }
}

export async function verifyFlutterwaveTransaction(transactionId: string) {
  const headers = {
    Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
  };

  try {
    return await withRetryAndCircuitBreaker(
      "flutterwave-verify",
      async () => {
        const response = await axios.get(
          `${FLW_BASE_URL}/transactions/${transactionId}/verify`,
          { headers, timeout: 15000 }
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
