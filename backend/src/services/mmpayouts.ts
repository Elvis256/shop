import prisma from "../lib/prisma";
import logger from "../lib/logger";

interface PayoutRequest {
  phoneNumber: string;
  amount: number;
  currency: "UGX";
  narrative: string;
  referenceId: string;
}

interface PayoutResponse {
  success: boolean;
  transactionId?: string;
  errorMessage?: string;
}

/**
 * Service to automate Mobile Money payouts to MTN & Airtel phone numbers in Uganda.
 * Used for automated customer refunds (on resolved disputes) and vendor payout releases.
 */
export async function initiateMobileMoneyPayout(req: PayoutRequest): Promise<PayoutResponse> {
  const { phoneNumber, amount, currency, narrative, referenceId } = req;
  logger.info("initiating_mm_payout", { phoneNumber, amount, referenceId });

  // Normalize phone number (e.g. +25677xxxxxx or 077xxxxxx to 25677xxxxxx)
  let cleanPhone = phoneNumber.replace(/[^0-9]/g, "");
  if (cleanPhone.startsWith("0")) {
    cleanPhone = "256" + cleanPhone.substring(1);
  }
  if (!cleanPhone.startsWith("256")) {
    return { success: false, errorMessage: "Only Ugandan phone numbers are supported (+256)" };
  }

  // Determine provider based on prefix
  // MTN: 25677, 25678, 25676, 25639
  // Airtel: 25675, 25670, 25674, 25620
  let provider: "MTN" | "AIRTEL" | null = null;
  if (/^(25677|25678|25676|25639)/.test(cleanPhone)) {
    provider = "MTN";
  } else if (/^(25675|25670|25674|25620)/.test(cleanPhone)) {
    provider = "AIRTEL";
  }

  if (!provider) {
    return { success: false, errorMessage: "Unsupported mobile network provider prefix" };
  }

  // SAFETY: Block mock payouts in production — real MM API must be integrated first
  const isProduction = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "prod";
  if (isProduction && !process.env.MM_PAYOUT_API_URL) {
    logger.warn("mm_payout_skipped_no_api_configured", { referenceId, amount });
    return {
      success: false,
      errorMessage: "Mobile Money payout API not configured. Set MM_PAYOUT_API_URL to enable payouts.",
    };
  }

  try {
    // TODO: Replace mock with real API call when MM_PAYOUT_API_URL is configured
    // e.g., MTN MoMo API /disbursement/v1_0/transfer or Airtel Payouts API

    if (process.env.MM_PAYOUT_API_URL) {
      // Real implementation goes here
      throw new Error("Real Mobile Money payout API integration not yet implemented");
    }

    // Dev/staging only: simulate payout
    await new Promise((resolve) => setTimeout(resolve, 50));
    const mockTxId = `TXN-${provider.slice(0, 1)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    logger.info("mm_payout_mock_success", { provider, mockTxId, referenceId });

    const { Prisma } = await import("@prisma/client");

    await prisma.mobileMoneyTransaction.create({
      data: {
        transactionId: mockTxId,
        orderId: referenceId.startsWith("ORD-") ? referenceId : undefined,
        phoneNumber: cleanPhone,
        amount: new Prisma.Decimal(amount),
        provider,
        status: "SUCCESSFUL",
        externalRef: referenceId,
      },
    });

    return {
      success: true,
      transactionId: mockTxId,
    };
  } catch (err: any) {
    logger.error("mm_payout_api_error", { error: err.message, referenceId });
    return {
      success: false,
      errorMessage: err.message || "MM API Connection timeout",
    };
  }
}
