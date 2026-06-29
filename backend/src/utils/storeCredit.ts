import prisma from "../lib/prisma";
import { logger } from "../lib/logger";

/**
 * Refunds any store credit used in an order back to the user's balance.
 * Runs atomically within an active Prisma transaction client.
 *
 * FIX H3: Errors are no longer swallowed. If this throws, the parent
 * transaction is aborted, ensuring the customer never silently loses credit.
 */
export async function refundStoreCreditForOrder(
  tx: any,
  orderId: string
): Promise<void> {
  // Find all REDEMPTION transactions for this order
  const redemptions = await tx.storeCreditTx.findMany({
    where: {
      orderId,
      type: "REDEMPTION",
    },
  });

  for (const redemption of redemptions) {
    const refundAmount = redemption.amount.abs();

    // Check if this redemption has already been refunded to prevent double refunds
    const alreadyRefunded = await tx.storeCreditTx.findFirst({
      where: {
        orderId,
        type: "REFUND",
        amount: refundAmount,
      },
    });

    if (alreadyRefunded) {
      continue; // Skip if already refunded
    }

    // Update store credit balance
    await tx.storeCredit.update({
      where: { id: redemption.storeCreditId },
      data: {
        balance: { increment: refundAmount },
      },
    });

    // Create a refund ledger transaction record
    await tx.storeCreditTx.create({
      data: {
        storeCreditId: redemption.storeCreditId,
        amount: refundAmount,
        type: "REFUND",
        description: `Refund for cancelled order ${orderId}`,
        orderId,
      },
    });
  }

  logger.info("store_credit_refunded", { orderId, count: redemptions.length });
}
