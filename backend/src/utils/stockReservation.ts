import prisma from "../lib/prisma";

/**
 * Release expired stock reservations
 * Should be called periodically (e.g., every 5 minutes via cron)
 */
export async function releaseExpiredReservations(): Promise<number> {
  const now = new Date();
  
  // Find expired, unreleased reservations
  const expiredReservations = await prisma.stockReservation.findMany({
    where: {
      expiresAt: { lt: now },
      released: false,
    },
  });

  if (expiredReservations.length === 0) {
    return 0;
  }

  // Release each reservation in a transaction
  await prisma.$transaction(async (tx) => {
    for (const reservation of expiredReservations) {
      // Release reserved stock
      await tx.product.update({
        where: { id: reservation.productId },
        data: {
          reservedStock: { decrement: reservation.quantity },
        },
      });
      
      // Mark reservation as released
      await tx.stockReservation.update({
        where: { id: reservation.id },
        data: { released: true },
      });
      
      // Cancel the order if still pending
      await tx.order.updateMany({
        where: { 
          id: reservation.orderId,
          status: "PENDING",
        },
        data: { 
          status: "CANCELLED",
          paymentStatus: "FAILED",
        },
      });
    }
  });

  console.log(`Released ${expiredReservations.length} expired stock reservations`);
  return expiredReservations.length;
}

// Run cleanup every 5 minutes in production
let cleanupInterval: NodeJS.Timeout | null = null;

export function startReservationCleanup() {
  if (cleanupInterval) return;
  
  // Run immediately on startup
  releaseExpiredReservations().catch(console.error);
  
  // Then run every 5 minutes
  cleanupInterval = setInterval(() => {
    releaseExpiredReservations().catch(console.error);
  }, 5 * 60 * 1000);
  
  console.log("Stock reservation cleanup job started");
}

export function stopReservationCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}
