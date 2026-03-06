import { Router, Request, Response } from "express";
import { z } from "zod";
import { createFlutterwavePayment } from "../services/flutterwave";
import { createPayPalCheckout, getPayPalCheckoutDetails, executePayPalPayment } from "../services/paypal";
import { placeAliExpressOrdersForOrder } from "../services/aliexpressOrder";
import { placeCJOrdersForOrder } from "../services/cjOrder";
import prisma from "../lib/prisma";
const router = Router();

// Stock reservation timeout (15 minutes)
const RESERVATION_TIMEOUT_MS = 15 * 60 * 1000;

// Validation schema
const CheckoutSchema = z.object({
  cartId: z.string().optional(),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
    price: z.number().positive(),
  })).optional(),
  currency: z.string().default("UGX"),
  amount: z.number().positive(),
  shipping: z.number().default(0),
  paymentMethod: z.enum(["card", "mobile_money", "paypal"]),
  mobileMoney: z
    .object({
      network: z.enum(["MPESA", "AIRTEL", "MTN"]),
      phone: z.string(),
    })
    .optional(),
  customer: z.object({
    name: z.string(),
    email: z.string().email(),
  }),
  discreet: z.boolean().default(true),
  shippingAddress: z.any().optional(),
  affiliateCode: z.string().optional(),
});

// Helper: Check and reserve stock for cart items
async function reserveStock(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  cartItems: Array<{ productId: string; quantity: number; product: { stock: number; reservedStock: number; trackInventory: boolean; allowBackorder: boolean; name: string } }>,
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  const reservations = [];
  
  for (const item of cartItems) {
    const product = item.product;
    
    // Skip inventory check if not tracking or allows backorder
    if (!product.trackInventory || product.allowBackorder) {
      continue;
    }
    
    const availableStock = product.stock - product.reservedStock;
    
    if (availableStock < item.quantity) {
      return {
        success: false,
        error: `Insufficient stock for "${product.name}". Available: ${availableStock}, requested: ${item.quantity}`,
      };
    }
    
    reservations.push({
      productId: item.productId,
      quantity: item.quantity,
    });
  }
  
  // Create reservations and update reserved stock
  const expiresAt = new Date(Date.now() + RESERVATION_TIMEOUT_MS);
  
  for (const reservation of reservations) {
    await tx.stockReservation.create({
      data: {
        orderId,
        productId: reservation.productId,
        quantity: reservation.quantity,
        expiresAt,
      },
    });
    
    await tx.product.update({
      where: { id: reservation.productId },
      data: {
        reservedStock: { increment: reservation.quantity },
      },
    });
  }
  
  return { success: true };
}

// POST /api/checkout/create
router.post("/create", async (req: Request, res: Response) => {
  try {
    const body = CheckoutSchema.parse(req.body);

    // Fetch cart items - either from cartId or build from items array
    let cartItems: Array<{ productId: string; quantity: number; product: any }>;

    if (body.cartId) {
      const cart = await prisma.cart.findUnique({
        where: { id: body.cartId },
        include: { items: { include: { product: true } } },
      });
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ error: "Cart is empty or not found" });
      }
      cartItems = cart.items;
    } else if (body.items && body.items.length > 0) {
      // Build cart items from the submitted items array (guest checkout)
      const products = await prisma.product.findMany({
        where: { id: { in: body.items.map((i) => i.productId) } },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));
      cartItems = body.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        product: productMap.get(item.productId),
      })).filter((item) => item.product);
      if (cartItems.length === 0) {
        return res.status(400).json({ error: "No valid products found" });
      }
    } else {
      return res.status(400).json({ error: "Cart ID or items required" });
    }

    // Calculate total from cart (verify against submitted amount — allow shipping margin)
    const calculatedTotal = cartItems.reduce((sum, item) => {
      return sum + Number(item.product.price) * item.quantity;
    }, 0);
    const submittedSubtotal = body.amount - (body.shipping || 0);

    if (Math.abs(calculatedTotal - submittedSubtotal) > 1) {
      return res.status(400).json({ error: "Amount mismatch" });
    }

    // Create order with stock reservation in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create order
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const subtotal = calculatedTotal;
      const shippingAmount = body.shipping || 0;
      const order = await tx.order.create({
        data: {
          orderNumber,
          subtotal,
          totalAmount: subtotal + shippingAmount,
          shippingCost: shippingAmount,
          currency: body.currency,
          status: "PENDING",
          discreet: body.discreet,
          customerName: body.customer.name,
          customerEmail: body.customer.email,
          shippingAddress: body.shippingAddress || "",
          items: {
            create: cartItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.product.price,
              name: item.product.name,
            })),
          },
        },
      });

      // Reserve stock
      const stockResult = await reserveStock(tx, cartItems, order.id);
      if (!stockResult.success) {
        throw new Error(stockResult.error);
      }

      return order;
    });

    let paymentLink: string | undefined;
    let paymentRef: string | undefined;
    let paymentStatus = "PENDING";

    if (body.paymentMethod === "paypal") {
      // PayPal Express Checkout
      const ppResult = await createPayPalCheckout({
        orderId: result.id,
        amountUgx: body.amount,
        customerEmail: body.customer.email,
        description: `Order ${result.orderNumber}`,
      });
      paymentLink = ppResult.redirectUrl;
      paymentRef = ppResult.token;
    } else {
      // Flutterwave (card or mobile money)
      const paymentResponse = await createFlutterwavePayment({
        tx_ref: result.id,
        amount: body.amount,
        currency: body.currency,
        customer: body.customer as any,
        paymentMethod: body.paymentMethod,
        mobileMoney: body.mobileMoney as any,
        redirect_url: `${process.env.BASE_URL}/checkout/confirm?orderId=${result.id}`,
      });
      paymentLink = paymentResponse.data?.link;
      paymentRef = paymentResponse.data?.flw_ref;
      paymentStatus = paymentResponse.status || "PENDING";
    }

    // Save payment record
    const methodMap: Record<string, "CARD" | "MOBILE_MONEY" | "PAYPAL"> = {
      card: "CARD",
      mobile_money: "MOBILE_MONEY",
      paypal: "PAYPAL",
    };

    const payment = await prisma.payment.create({
      data: {
        orderId: result.id,
        provider: body.paymentMethod === "paypal" ? "paypal" : "flutterwave",
        method: methodMap[body.paymentMethod] || "CARD",
        status: "PENDING",
        amount: body.amount,
        currency: body.currency,
        flwRef: paymentRef,
      },
    });

    // Clear cart after order created
    await prisma.cartItem.deleteMany({ where: { cartId: body.cartId } });

    // Track affiliate conversion if referral code provided
    if (body.affiliateCode) {
      try {
        const affiliate = await prisma.affiliate.findUnique({
          where: { code: body.affiliateCode, status: "APPROVED" },
        });
        if (affiliate) {
          const commissionAmount = body.amount * (Number(affiliate.commissionRate) / 100);
          await prisma.affiliateConversion.create({
            data: {
              affiliateId: affiliate.id,
              orderId: result.id,
              orderAmount: body.amount,
              commission: commissionAmount,
              status: "PENDING",
            },
          });
          await prisma.affiliate.update({
            where: { id: affiliate.id },
            data: {
              totalOrders: { increment: 1 },
              totalEarnings: { increment: commissionAmount },
            },
          });
        }
      } catch (e) {
        console.error("Affiliate tracking error:", e);
      }
    }

    return res.json({
      orderId: result.id,
      paymentId: payment.id,
      paymentLink,
      paymentMethod: body.paymentMethod,
      status: paymentStatus,
    });
  } catch (error) {
    console.error("Checkout error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    if (error instanceof Error && error.message.includes("Insufficient stock")) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: "Checkout failed" });
  }
});

// GET /api/checkout/paypal-return — called after user approves on PayPal
router.get("/paypal-return", async (req: Request, res: Response) => {
  try {
    const token = req.query.token as string;
    const payerId = req.query.PayerID as string;
    const orderId = req.query.orderId as string;

    if (!token || !payerId || !orderId) {
      return res.status(400).json({ error: "Missing PayPal return parameters" });
    }

    // Get payment details from PayPal
    const details = await getPayPalCheckoutDetails(token);

    // Execute the payment
    const result = await executePayPalPayment(token, payerId, details.amount);

    if (result.status === "Completed") {
      // Update payment and order
      await prisma.$transaction(async (tx) => {
        await tx.payment.updateMany({
          where: { orderId },
          data: {
            status: "SUCCESSFUL",
            flwTxId: result.transactionId,
          },
        });

        await tx.order.update({
          where: { id: orderId },
          data: { status: "CONFIRMED", paymentStatus: "SUCCESSFUL" },
        });

        // Finalize stock
        const reservations = await tx.stockReservation.findMany({
          where: { orderId, released: false },
        });
        for (const reservation of reservations) {
          await tx.product.update({
            where: { id: reservation.productId },
            data: {
              stock: { decrement: reservation.quantity },
              reservedStock: { decrement: reservation.quantity },
            },
          });
          await tx.stockReservation.update({
            where: { id: reservation.id },
            data: { released: true },
          });
        }
      });

      // Auto-place dropshipping orders
      placeAliExpressOrdersForOrder(orderId).catch((err) =>
        console.error(`AliExpress auto-order failed for ${orderId}:`, err.message)
      );
      placeCJOrdersForOrder(orderId).catch((err) =>
        console.error(`CJ auto-order failed for ${orderId}:`, err.message)
      );

      // Redirect to success page
      return res.redirect(`${process.env.FRONTEND_URL || process.env.BASE_URL}/orders/${orderId}?success=true`);
    } else {
      // Payment not completed
      await prisma.payment.updateMany({
        where: { orderId },
        data: { status: "FAILED" },
      });
      await prisma.order.update({
        where: { id: orderId },
        data: { status: "CANCELLED", paymentStatus: "FAILED" },
      });

      return res.redirect(`${process.env.FRONTEND_URL || process.env.BASE_URL}/checkout?error=payment_failed`);
    }
  } catch (error: any) {
    console.error("PayPal return error:", error.message);
    const orderId = req.query.orderId as string;
    return res.redirect(`${process.env.FRONTEND_URL || process.env.BASE_URL}/checkout?error=paypal_error`);
  }
});

// GET /api/checkout/paypal-cancel — user cancelled on PayPal
router.get("/paypal-cancel", async (req: Request, res: Response) => {
  const orderId = req.query.orderId as string;

  if (orderId) {
    try {
      // Release stock reservations
      await prisma.$transaction(async (tx) => {
        const reservations = await tx.stockReservation.findMany({
          where: { orderId, released: false },
        });
        for (const reservation of reservations) {
          await tx.product.update({
            where: { id: reservation.productId },
            data: { reservedStock: { decrement: reservation.quantity } },
          });
          await tx.stockReservation.update({
            where: { id: reservation.id },
            data: { released: true },
          });
        }

        await tx.order.update({
          where: { id: orderId },
          data: { status: "CANCELLED" },
        });
      });
    } catch (e) {
      console.error("PayPal cancel cleanup error:", e);
    }
  }

  return res.redirect(`${process.env.FRONTEND_URL || process.env.BASE_URL}/checkout?error=payment_cancelled`);
});

export default router;
