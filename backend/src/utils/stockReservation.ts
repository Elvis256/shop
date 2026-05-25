import prisma from "../lib/prisma";

/**
 * Release expired stock reservations with batching to prevent event loop blocking
 * Processes 1000 reservations at a time with yielding between batches
 * Prevents 60+ second blocking during peak hours
 */
export async function releaseExpiredReservations(): Promise<number> {
  const now = new Date();
  const BATCH_SIZE = 1000;
  let totalReleased = 0;
  let batchCount = 0;

  while (true) {
    batchCount++;
    
    // Find batch of expired, unreleased reservations
    const expiredReservations = await prisma.stockReservation.findMany({
      where: {
        expiresAt: { lt: now },
        released: false,
      },
      take: BATCH_SIZE,
      select: {
        id: true,
        orderId: true,
        productId: true,
        quantity: true,
      },
    });

    if (expiredReservations.length === 0) {
      break; // No more expired reservations
    }

    // Process batch in transaction
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

    totalReleased += expiredReservations.length;

    // Yield to event loop between batches (prevent blocking)
    // setTimeout with 0 allows other requests to process
    if (expiredReservations.length === BATCH_SIZE) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  if (totalReleased > 0) {
    console.log(`Released ${totalReleased} expired stock reservations in ${batchCount} batches`);
  }
  return totalReleased;
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
