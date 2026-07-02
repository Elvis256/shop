import prisma from "../lib/prisma";
import logger from "../lib/logger";

interface DispatchRequest {
  orderId: string;
  recipientName: string;
  recipientPhone: string;
  pickupAddress: string;
  deliveryAddress: string;
  instructions?: string;
}

interface DispatchResponse {
  success: boolean;
  trackingNumber?: string;
  carrierName?: string;
  errorMessage?: string;
}

/**
 * Service to automate last-mile delivery riders booking in Kampala (e.g. SafeBoda API wrapper).
 * Called automatically when order payment is confirmed or COD order is scheduled.
 */
export async function bookDeliveryRider(req: DispatchRequest): Promise<DispatchResponse> {
  const { orderId, recipientName, recipientPhone, pickupAddress, deliveryAddress, instructions } = req;
  logger.info("initiating_logistics_rider_booking", { orderId, recipientName, recipientPhone });

  // SAFETY: Block mock dispatch in production — real logistics API must be integrated first
  const isProduction = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "prod";
  if (isProduction && !process.env.LOGISTICS_API_URL) {
    logger.warn("logistics_skipped_no_api_configured", { orderId });
    return {
      success: false,
      errorMessage: "Logistics API not configured. Set LOGISTICS_API_URL to enable auto-dispatch.",
    };
  }

  try {
    // TODO: Replace mock with real API call when LOGISTICS_API_URL is configured
    // e.g., POST ${process.env.LOGISTICS_API_URL}/v1/send/delivery

    if (process.env.LOGISTICS_API_URL) {
      // Real implementation goes here
      throw new Error("Real logistics API integration not yet implemented");
    }

    // Dev/staging only: simulate dispatch
    await new Promise((resolve) => setTimeout(resolve, 50));
    const mockTracking = `TRK-SB-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    logger.info("logistics_rider_booked_mock", { orderId, mockTracking });

    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "SHIPPED",
        trackingNumber: mockTracking,
      },
    });

    await prisma.orderEvent.create({
      data: {
        orderId,
        status: "SHIPPED",
        note: `[DEV] Mock delivery dispatch. Tracking ID: ${mockTracking}. Instructions: ${instructions || "None"}`,
      },
    });

    return {
      success: true,
      trackingNumber: mockTracking,
      carrierName: "SafeBoda Delivery (Mock)",
    };
  } catch (err: any) {
    logger.error("logistics_rider_booking_failed", { orderId, error: err.message });
    return {
      success: false,
      errorMessage: err.message || "Logistics API Connection error",
    };
  }
}
