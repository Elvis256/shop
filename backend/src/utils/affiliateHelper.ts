import prisma from "../lib/prisma";
import { logger } from "../lib/logger";

/**
 * Approves any pending affiliate conversions associated with a delivered order,
 * updating the affiliate's pending payout and total earnings.
 */
export async function approveAffiliateConversions(orderId: string, tx?: any) {
  const db = tx || prisma;
  try {
    // Find pending affiliate conversion for this order
    const conversion = await db.affiliateConversion.findFirst({
      where: { orderId, status: "PENDING" },
    });

    if (!conversion) {
      return;
    }

    // Update conversion status to APPROVED
    await db.affiliateConversion.update({
      where: { id: conversion.id },
      data: { status: "APPROVED" },
    });

    // Increment pending payout and total earnings for the affiliate
    await db.affiliate.update({
      where: { id: conversion.affiliateId },
      data: {
        totalEarnings: { increment: conversion.commission },
        pendingPayout: { increment: conversion.commission },
      },
    });

    logger.info(`Affiliate conversion approved for order ${orderId}, affiliate ID ${conversion.affiliateId}, commission ${conversion.commission}`);
  } catch (error) {
    logger.error("Error approving affiliate conversions", { orderId, error });
  }
}
