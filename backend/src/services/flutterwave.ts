import axios from "axios";
import { withRetryAndCircuitBreaker } from "../utils/retry";
import { logger } from "../lib/logger";
import prisma from "../lib/prisma";

type CreatePaymentInput = {
  tx_ref: string;
  amount: number;
  currency: string;
  customer: {
    name: string;
    email: string;
  };
  paymentMethod: string;
  mobileMoney?: {
    network: "MPESA" | "AIRTEL" | "MTN";
    phone: string;
  };
  redirect_url: string;
  meta?: Record<string, any>;
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
  let billingName = "PleasureZone";
  try {
    const setting = await prisma.setting.findUnique({ where: { key: "STEALTH_BILLING_NAME" } });
    if (setting?.value) {
      billingName = setting.value;
    }
  } catch (err) {
    logger.warn("Failed to fetch STEALTH_BILLING_NAME setting, falling back to default", { error: err });
  }

  let customerEmail = input.customer.email || "";
  if (!customerEmail || !customerEmail.includes("@")) {
    const phoneDigits = customerEmail.replace(/[^0-9]/g, "");
    if (phoneDigits.length >= 7) {
      customerEmail = `${phoneDigits}@noreply.ugsex.com`;
    } else {
      customerEmail = "noreply@ugsex.com";
    }
  }

  const payload: Record<string, any> = {
    tx_ref: input.tx_ref,
    amount: input.amount,
    currency: input.currency,
    redirect_url: input.redirect_url,
    customer: {
      email: customerEmail,
      name: input.customer.name || "Customer",
    },
    customizations: {
      title: billingName,
      description: "Order Payment",
    },
  };

  if (input.paymentMethod === "mobile_money" && input.mobileMoney) {
    payload.payment_options = "mobilemoneyuganda";
  }
  // For "card" / general Flutterwave, omit payment_options to allow all methods

  if (input.meta) {
    payload.meta = input.meta;
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
    logger.error("Flutterwave payment error", { error: error.response?.data || error.message });
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
    logger.error("Flutterwave verify error", { error: error.response?.data || error.message });
    throw new Error("Transaction verification failed. Please try again.");
  }
}

// ─── Transfers (Payouts) ────────────────────────────────────────────────────

type CreateTransferInput = {
  reference: string;      // e.g. "payout-{id}"
  amount: number;
  currency?: string;
  narration: string;
  beneficiary: {
    account_bank: string; // "MPS" for MTN Uganda, "AIR" for Airtel
    account_number: string; // Phone number or bank account
    beneficiary_name: string;
  };
};

export async function createFlutterwaveTransfer(
  input: CreateTransferInput
): Promise<{ status: string; message: string; data?: { id?: number; reference?: string } }> {
  const payload = {
    account_bank: input.beneficiary.account_bank,
    account_number: input.beneficiary.account_number,
    amount: input.amount,
    narration: input.narration,
    currency: input.currency || "UGX",
    reference: input.reference,
    beneficiary_name: input.beneficiary.beneficiary_name,
  };

  try {
    return await withRetryAndCircuitBreaker(
      "flutterwave-transfer",
      async () => {
        const response = await axios.post(
          `${FLW_BASE_URL}/transfers`,
          payload,
          { headers: getAuthHeaders(), timeout: 30000 }
        );
        return response.data;
      },
      FLUTTERWAVE_RETRY_OPTIONS
    );
  } catch (error: any) {
    logger.error("Flutterwave transfer error", { error: error.response?.data || error.message });
    throw new Error("Transfer initiation failed. Please try again.");
  }
}

export async function getFlutterwaveTransferStatus(
  transferId: number
): Promise<{ status: string; data?: { status?: string } }> {
  try {
    return await withRetryAndCircuitBreaker(
      "flutterwave-transfer-status",
      async () => {
        const response = await axios.get(
          `${FLW_BASE_URL}/transfers/${transferId}`,
          { headers: getAuthHeaders(), timeout: 15000 }
        );
        return response.data;
      },
      FLUTTERWAVE_RETRY_OPTIONS
    );
  } catch (error: any) {
    logger.error("Flutterwave transfer status error", { error: error.response?.data || error.message });
    throw new Error("Transfer status check failed.");
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
    logger.error("Flutterwave refund error", { error: error.response?.data || error.message });
    throw new Error("Refund failed. Please try again or contact Flutterwave support.");
  }
}

export async function chargeMobileMoneyUganda(input: {
  tx_ref: string;
  amount: number;
  currency: string;
  email: string;
  phone_number: string;
  network: "MTN" | "AIRTEL";
  fullname: string;
}): Promise<{ status: string; message: string; data?: { id?: number; flw_ref?: string; status?: string } }> {
  const payload = {
    amount: input.amount,
    currency: input.currency || "UGX",
    email: input.email,
    tx_ref: input.tx_ref,
    phone_number: input.phone_number,
    network: input.network.toUpperCase(),
    fullname: input.fullname,
  };

  try {
    return await withRetryAndCircuitBreaker(
      "flutterwave-momo-uganda-charge",
      async () => {
        const response = await axios.post(
          `${FLW_BASE_URL}/charges?type=mobile_money_uganda`,
          payload,
          { headers: getAuthHeaders(), timeout: 35000 }
        );
        return response.data;
      },
      FLUTTERWAVE_RETRY_OPTIONS
    );
  } catch (error: any) {
    logger.error("Flutterwave direct momo charge error", { error: error.response?.data || error.message });
    throw new Error(error.response?.data?.message || "Mobile Money charge initiation failed. Please try again.");
  }
}
