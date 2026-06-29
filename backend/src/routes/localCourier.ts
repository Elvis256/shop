/**
 * Local Courier Integration — real-time Kampala delivery booking
 *
 * Supported couriers: SafeBoda, Sendy, YoRides (local fallback)
 * Currently implemented as an abstraction layer — actual API keys needed to go live.
 *
 * POST /api/courier/quote          — get delivery quote
 * POST /api/courier/book           — book pickup/delivery
 * GET  /api/courier/track/:ref     — track delivery status
 * GET  /api/courier/available      — check which couriers are available
 * POST /api/courier/webhook        — receive status updates from couriers
 */
import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { sendWhatsApp } from "../services/whatsapp";
import { sendSMS } from "../services/sms";
import axios from "axios";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";
import { approveAffiliateConversions } from "../utils/affiliateHelper";

const router = Router();

// Kampala zones with base delivery fees (UGX)
const KAMPALA_ZONES = [
  { names: ["kololo", "nakasero", "city centre", "central"], baseFee: 5000, etaMinutes: 45 },
  { names: ["ntinda", "naguru", "bukoto", "kisaasi", "kyanja"], baseFee: 7000, etaMinutes: 60 },
  { names: ["bugolobi", "muyenga", "tank hill", "munyonyo"], baseFee: 8000, etaMinutes: 75 },
  { names: ["entebbe", "kajjansi", "namasuba"], baseFee: 15000, etaMinutes: 90 },
  { names: ["mukono", "seeta", "namugongo"], baseFee: 12000, etaMinutes: 90 },
  { names: ["wakiso", "nansana", "bweyogerere", "kireka"], baseFee: 10000, etaMinutes: 75 },
];

function estimateDelivery(area: string): { fee: number; etaMinutes: number } {
  const lowerArea = area.toLowerCase();
  for (const zone of KAMPALA_ZONES) {
    if (zone.names.some((n) => lowerArea.includes(n))) {
      return { fee: zone.baseFee, etaMinutes: zone.etaMinutes };
    }
  }
  return { fee: 10000, etaMinutes: 90 }; // default Kampala rate
}

// SafeBoda API integration
async function quoteSafeBoda(pickup: string, delivery: string): Promise<number | null> {
  const apiKey = process.env.SAFEBODA_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await axios.post(
      "https://api.safeboda.com/v1/delivery/quote",
      {
        pickup: { address: pickup, city: "Kampala" },
        delivery: { address: delivery, city: "Kampala" },
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        timeout: 8000,
      }
    );
    return res.data?.price || null;
  } catch {
    return null;
  }
}

// Sendy API integration
async function bookSendy(order: {
  pickupAddress: string;
  deliveryAddress: string;
  recipientName: string;
  recipientPhone: string;
  notes: string;
}): Promise<{ bookingRef: string; trackingUrl: string } | null> {
  const apiKey = process.env.SENDY_API_KEY;
  const vendorId = process.env.SENDY_VENDOR_ID;
  if (!apiKey || !vendorId) return null;

  try {
    const res = await axios.post(
      "https://api.sendy.co.ke/v2/deliveries",
      {
        pickup_latitude: -0.3476,   // PleasureZone default pickup (Kampala city)
        pickup_longitude: 32.5825,
        pickup_location_name: "PleasureZone Kampala",
        pickup_description: "Call on arrival",
        delivery_latitude: null,
        delivery_longitude: null,
        delivery_location_name: order.deliveryAddress,
        delivery_description: order.notes,
        recipient_name: order.recipientName,
        recipient_phone: order.recipientPhone,
        carrier_type: 1, // motorbike
        collect_payment: { status: false, pay_method: 0 },
        pick_up_date: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      },
      {
        headers: {
          "api-username": apiKey,
          "api-key": vendorId,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );
    if (res.data?.status) {
      return {
        bookingRef: res.data.order_no || res.data.id || "SENDY-" + Date.now(),
        trackingUrl: `https://app.sendy.co.ke/track/${res.data.order_no}`,
      };
    }
    return null;
  } catch {
    return null;
  }
}

const QuoteSchema = z.object({
  pickupArea: z.string().default("Kampala Central"),
  deliveryArea: z.string(),
  orderValue: z.number().positive().optional(),
});

const BookSchema = z.object({
  orderId: z.string(),
  deliveryArea: z.string(),
  recipientName: z.string(),
  recipientPhone: z.string(),
  notes: z.string().optional(),
  preferredCourier: z.enum(["safeboda", "sendy", "internal", "auto"]).default("auto"),
  riderName: z.string().optional(),
  riderPhone: z.string().optional(),
});

// GET /api/courier/available
router.get("/available", (_req: Request, res: Response) => {
  return res.json({
    couriers: [
      {
        id: "safeboda",
        name: "SafeBoda",
        logo: "🛵",
        available: !!process.env.SAFEBODA_API_KEY,
        etaText: "45–90 min",
        features: ["Real-time tracking", "Motorbike delivery", "Kampala wide"],
      },
      {
        id: "sendy",
        name: "Sendy",
        logo: "🚚",
        available: !!process.env.SENDY_API_KEY,
        etaText: "60–120 min",
        features: ["Real-time tracking", "Van/bike options", "East Africa"],
      },
      {
        id: "internal",
        name: "PleasureZone Delivery",
        logo: "📦",
        available: true,
        etaText: "Same day / Next day",
        features: ["Discreet delivery", "Kampala area", "No extra app needed"],
      },
    ],
  });
});

// POST /api/courier/quote
router.post("/quote", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { pickupArea, deliveryArea, orderValue } = QuoteSchema.parse(req.body);

    const estimated = estimateDelivery(deliveryArea);
    let safeBodaPrice: number | null = null;

    // Try SafeBoda quote in parallel
    if (process.env.SAFEBODA_API_KEY) {
      safeBodaPrice = await quoteSafeBoda(pickupArea, deliveryArea);
    }

    const quotes = [
      {
        courier: "internal",
        name: "PleasureZone Delivery",
        logo: "📦",
        price: estimated.fee,
        etaMinutes: estimated.etaMinutes,
        etaText: `${Math.floor(estimated.etaMinutes / 60)}h ${estimated.etaMinutes % 60}min`,
        note: "Discreet packaging guaranteed",
        available: true,
      },
    ];

    if (safeBodaPrice) {
      quotes.push({
        courier: "safeboda",
        name: "SafeBoda",
        logo: "🛵",
        price: safeBodaPrice,
        etaMinutes: 45,
        etaText: "45–60 min",
        note: "Real-time GPS tracking",
        available: true,
      });
    }

    return res.json({ quotes, deliveryArea, currency: "UGX" });
  } catch (err: any) {
    if (err.name === "ZodError") return res.status(400).json({ error: err.errors[0]?.message });
    return res.status(500).json({ error: "Quote failed" });
  }
}));

// POST /api/courier/book
router.post("/book", asyncHandler(async (req: Request, res: Response) => {
  try {
    const body = BookSchema.parse(req.body);

    // Fetch order details
    const order = await prisma.order.findUnique({
      where: { id: body.orderId },
      select: { id: true, orderNumber: true, totalAmount: true, notes: true, shippingAddress: true },
    });

    if (!order) return res.status(404).json({ error: "Order not found" });

    let bookingRef: string | null = null;
    let trackingUrl: string | null = null;
    let courierUsed = body.preferredCourier;

    // Try external couriers
    if (body.preferredCourier === "sendy" || body.preferredCourier === "auto") {
      if (process.env.SENDY_API_KEY) {
        const result = await bookSendy({
          pickupAddress: "PleasureZone, Kampala",
          deliveryAddress: body.deliveryArea,
          recipientName: body.recipientName,
          recipientPhone: body.recipientPhone,
          notes: body.notes || `Order ${order.orderNumber}. Discreet packaging.`,
        });
        if (result) {
          bookingRef = result.bookingRef;
          trackingUrl = result.trackingUrl;
          courierUsed = "sendy";
        }
      }
    }

    // Fallback to internal
    if (!bookingRef) {
      bookingRef = `PZ-DEL-${order.orderNumber}`;
      courierUsed = "internal";
    }

    // Prepare note content with rider assignment details
    let updatedNotes = `${order.notes || ""}\nCourier: ${courierUsed} | Ref: ${bookingRef}${trackingUrl ? ` | Track: ${trackingUrl}` : ""}`.trim();
    if (courierUsed === "internal" && body.riderName) {
      updatedNotes += `\nAssigned Rider: ${body.riderName}${body.riderPhone ? ` (${body.riderPhone})` : ""}`;
    }

    // Update order with courier info
    await prisma.order.update({
      where: { id: body.orderId },
      data: {
        trackingNumber: bookingRef,
        shippingMethod: courierUsed,
        status: "SHIPPED",
        notes: updatedNotes,
      },
    });

    // Notify recipient
    if (body.recipientPhone) {
      const msg = trackingUrl
        ? `📦 PleasureZone: Your order ${order.orderNumber} has been dispatched!\n\nTrack your delivery: ${trackingUrl}\n\nPlain packaging 🔒`
        : (courierUsed === "internal" && body.riderName)
          ? `📦 PleasureZone: Your order ${order.orderNumber} is on the way! Our rider ${body.riderName} (${body.riderPhone || ""}) will call you shortly. Ref: ${bookingRef}`
          : `📦 PleasureZone: Your order ${order.orderNumber} is on the way! Our rider will call you shortly. Ref: ${bookingRef}`;
      await sendWhatsApp({ to: body.recipientPhone, text: msg }).catch(() => {});
      await sendSMS(body.recipientPhone, `PleasureZone: Order ${order.orderNumber} dispatched. Ref: ${bookingRef}`).catch(() => {});
    }

    // Notify assigned in-house rider via WhatsApp/SMS
    if (courierUsed === "internal" && body.riderPhone) {
      const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(body.deliveryArea)}`;
      
      // Fetch latest order details to determine payment mode and get/generate delivery OTP
      const freshOrder = await prisma.order.findUnique({
        where: { id: body.orderId },
        select: { paymentStatus: true, totalAmount: true, deliveryOtp: true },
      });
      
      const isCod = freshOrder?.paymentStatus === "PENDING";
      const paymentMode = isCod 
        ? `COD (Collect Cash: UGX ${Number(freshOrder?.totalAmount || 0).toLocaleString()})`
        : "PREPAID (Do NOT collect money)";

      let otpText = "";
      if (isCod) {
        let otp = freshOrder?.deliveryOtp;
        if (!otp) {
          const crypto = await import("crypto");
          otp = crypto.randomInt(100000, 999999).toString();
          const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
          await prisma.order.update({
            where: { id: body.orderId },
            data: { deliveryOtp: otp, deliveryOtpExpiry: expiry },
          });
        }
        otpText = `\n\n🔑 Verify delivery in portal using Customer OTP code.`;
      }

      const riderMsg = `🏍️ PleasureZone Rider Delivery Task!\n\nOrder: ${order.orderNumber}\nCustomer: ${body.recipientName}\nPhone: ${body.recipientPhone}\nAddress: ${body.deliveryArea}\nMaps: ${mapsLink}\nPayment: ${paymentMode}\n\nDiscreet packaging 🔒. Call customer before arriving.${otpText}`;
      
      await sendWhatsApp({ to: body.riderPhone, text: riderMsg }).catch(() => {});
      await sendSMS(body.riderPhone, `PleasureZone Rider: Delivery task for order ${order.orderNumber} assigned. Address: ${body.deliveryArea}. See WhatsApp.`).catch(() => {});
    }

    return res.json({
      success: true,
      bookingRef,
      trackingUrl,
      courier: courierUsed,
      orderNumber: order.orderNumber,
    });
  } catch (err: any) {
    logger.error("Courier booking error", { error: err.message });
    if (err.name === "ZodError") return res.status(400).json({ error: err.errors[0]?.message });
    return res.status(500).json({ error: "Booking failed" });
  }
}));

// GET /api/courier/track/:ref
router.get("/track/:ref", asyncHandler(async (req: Request, res: Response) => {
  const { ref } = req.params;

  // Find order by tracking number
  const order = await prisma.order.findFirst({
    where: { trackingNumber: ref },
    select: { orderNumber: true, status: true, shippingMethod: true, updatedAt: true },
  });

  if (!order) return res.status(404).json({ error: "Delivery not found" });

  return res.json({
    ref,
    orderNumber: order.orderNumber,
    status: order.status,
    courier: order.shippingMethod || "internal",
    lastUpdated: order.updatedAt,
  });
}));

// POST /api/courier/webhook — receive updates from couriers
router.post("/webhook", asyncHandler(async (req: Request, res: Response) => {
  const { provider, ref, status, eta } = req.body;

  if (!ref || !status) return res.status(400).json({ error: "ref and status required" });

  try {
    const order = await prisma.order.findFirst({
      where: { trackingNumber: ref },
      select: { id: true, orderNumber: true, customerPhone: true },
    });

    if (order) {
      const orderStatus = status === "delivered" ? "DELIVERED" : "SHIPPED";
      await prisma.order.update({
        where: { id: order.id },
        data: { status: orderStatus as any },
      });

      if (status === "delivered") {
        await approveAffiliateConversions(order.id);
      }

      if (status === "delivered" && order.customerPhone) {
        await sendWhatsApp({
          to: order.customerPhone,
          text: `✅ PleasureZone: Your order ${order.orderNumber} has been delivered!\n\nThank you for shopping with us. We hope you enjoy your purchase 💜`,
        }).catch(() => {});
      }
    }
  } catch (err: any) {
    logger.error("Courier webhook error", { error: err.message });
  }

  return res.json({ received: true });
}));

export default router;
