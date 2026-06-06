import { Router, Request, Response } from "express";
import { z } from "zod";
import { createFlutterwavePayment } from "../services/flutterwave";
import { createPayPalCheckout, getPayPalCheckoutDetails, executePayPalPayment } from "../services/paypal";
import { placeAliExpressOrdersForOrder } from "../services/aliexpressOrder";
import { placeCJOrdersForOrder } from "../services/cjOrder";
import { sendOrderReceivedEmail } from "../lib/email";
import { sendOrderConfirmationWhatsApp } from "../services/whatsapp";
import { sendOrderConfirmationSMS } from "../services/sms";
import { sendMetaConversionEvent } from "../services/metaConversions";
import { optionalAuth, AuthRequest } from "../middleware/auth";
import prisma from "../lib/prisma";
import redis from "../lib/redis";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";
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
  shipping: z.number().min(0).default(0),
  paymentMethod: z.enum(["card", "mobile_money", "paypal", "cod"]),
  mobileMoney: z
    .object({
      network: z.enum(["MPESA", "AIRTEL", "MTN"]),
      phone: z.string(),
    })
    .optional(),
  customer: z.object({
    name: z.string(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  }).refine(data => data.email || data.phone, { message: "Email or phone required" }),
  deliveryTimeSlot: z.string().optional(),
  couponCode: z.string().optional(),
  discreet: z.boolean().default(true),
  shippingAddress: z.object({
    name: z.string().max(200).optional(),
    phone: z.string().max(30).optional(),
    address: z.string().max(500),
    city: z.string().max(100),
    county: z.string().max(100).optional(),
    country: z.string().max(100).default("Uganda"),
    postalCode: z.string().max(20).optional(),
    notes: z.string().max(500).optional(),
  }).optional(),
  affiliateCode: z.string().optional(),
  storeCreditAmount: z.number().min(0).optional(),
  loyaltyPointsRedeem: z.number().int().min(0).optional(),
  giftCardCode: z.string().optional(),
  giftCardAmount: z.number().min(0).optional(),
  installments: z.number().int().min(2).max(4).optional(),
  whatsappOptIn: z.boolean().optional(),
});

// Helper: Check and reserve stock for cart items
async function reserveStock(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  cartItems: Array<{ productId: string; quantity: number; product: { name: string } }>,
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  const reservations = [];
  
  for (const item of cartItems) {
    // Re-fetch product inside transaction for consistent reads (prevents TOCTOU race)
    const product = await tx.product.findUnique({ where: { id: item.productId } });
    if (!product) {
      return { success: false, error: `Product "${item.product.name}" no longer exists.` };
    }
    
    // Skip inventory check if not tracking or allows backorder
    if (!product.trackInventory || product.allowBackorder) {
      continue;
    }
    
    const availableStock = product.stock - (product.reservedStock || 0);
    
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
router.post("/create", optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
  let checkoutAttemptId: string | undefined;
  const redisKey = idempotencyKey ? `idempotency:checkout:${idempotencyKey}` : undefined;
  try {
    // Idempotency: Database-backed primary defense, Redis as cache layer
    // This prevents duplicate orders even if Redis is unavailable
    if (idempotencyKey) {
      try {
        // Check Redis cache first (fast path)
        const cached = await redis.get(redisKey!);
        if (cached) {
          const cachedResult = JSON.parse(cached);
          if (!cachedResult.pending) {
            // Return cached successful/failed result
            return res.status(cachedResult.statusCode || 200).json(cachedResult.body);
          } else {
            // Checkout still in progress
            return res.status(409).json({ error: "Checkout already in progress. Please wait." });
          }
        }
      } catch (redisError) {
        // Redis error logged but doesn't block — DB will be primary
      }

      // PRIMARY DEFENSE: Check database for existing checkout attempt
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hour expiry
      try {
        // Attempt to create new checkout attempt record
        const checkoutAttempt = await prisma.checkoutAttempt.create({
          data: {
            idempotencyKey,
            userId: req.user?.id || null,
            status: "PENDING",
            expiresAt,
          },
        });

        checkoutAttemptId = checkoutAttempt.id;

        // Successfully claimed this idempotency key
        // Store in Redis for fast retrieval on retry (cache layer)
        try {
          await redis.setex(
            redisKey!,
            300, // 5 min cache TTL
            JSON.stringify({ pending: true, attemptId: checkoutAttempt.id })
          );
        } catch {
          // Redis write failure doesn't block — DB is source of truth
        }
      } catch (error: any) {
        // Database constraint violation: duplicate idempotency key
        if (error.code === "P2002") {
          // Someone else already processing this key — check status
          const existingAttempt = await prisma.checkoutAttempt.findUnique({
            where: { idempotencyKey },
            include: { order: true },
          });

          if (existingAttempt?.status === "PENDING") {
            return res.status(409).json({ error: "Checkout already in progress. Please wait." });
          }

          if (existingAttempt?.orderId && existingAttempt.order) {
           // Return previously created order response
           const cachedResponse = {
             statusCode: 200,
             body: {
               message: "Order already created",
               orderId: existingAttempt.order.id,
               orderNumber: existingAttempt.order.orderNumber,
             },
           };
           try {
             await redis.setex(redisKey!, 300, JSON.stringify(cachedResponse));
           } catch {
             // Redis failure doesn't matter
           }
           return res.status(200).json(cachedResponse.body);
          }

          // Attempt exists but no order yet — return error (shouldn't happen but handle gracefully)
          return res.status(409).json({ error: "Checkout already in progress. Please wait." });
        }

        throw error; // Re-throw other errors
      }
    }

    const body = CheckoutSchema.parse(req.body);

    // Fetch cart items — body.items is the authoritative source (it reflects the
    // user's actual current cart). Fall back to the server-side cart only when
    // body.items is absent, so a stale/incomplete server cart never silently
    // under-charges the customer.
    let cartItems: Array<{ productId: string; quantity: number; product: any }> = [];

    let cartFound = false;
    if (body.items && body.items.length > 0) {
      const products = await prisma.product.findMany({
        where: { id: { in: body.items.map((i) => i.productId) } },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));
      cartItems = body.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        product: productMap.get(item.productId),
      })).filter((item) => item.product);
      if (cartItems.length > 0) cartFound = true;
    }

    if (!cartFound && body.cartId) {
      // Fall back to server cart when no items were submitted
      const cart = await prisma.cart.findUnique({
        where: { id: body.cartId },
        include: { items: { include: { product: true } } },
      });
      if (cart && cart.items.length > 0) {
        cartItems = cart.items;
        cartFound = true;
      }
    }

    if (!cartFound || cartItems.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    // Calculate total from DB prices (authoritative source of truth)
    // Honor active flash sale and daily deal prices
    const effectivePrices = new Map<string, number>();
    const calculatedTotal = cartItems.reduce((sum, item) => {
      const product = item.product;
      let unitPrice = Math.round(Number(product.price));

      // Check flash sale pricing
      if (product.flashSalePrice && product.flashSaleEndsAt && new Date(product.flashSaleEndsAt) > new Date()) {
        unitPrice = Math.round(Number(product.flashSalePrice));
      }
      // Check daily deal pricing
      else if (product.dailyDealPrice && product.dailyDealDate) {
        const dealDate = new Date(product.dailyDealDate).toDateString();
        if (dealDate === new Date().toDateString()) {
          unitPrice = Math.round(Number(product.dailyDealPrice));
        }
      }

      effectivePrices.set(item.productId, unitPrice);
      return sum + unitPrice * item.quantity;
    }, 0);
    const shippingAmount = body.shipping || 0;

    // Coupon and gift card validation moved inside transaction to prevent race conditions
    const couponCode = body.couponCode;
    const giftCardCode = body.giftCardCode;
    const giftCardRequestedAmount = body.giftCardAmount;

    const txResult = await prisma.$transaction(async (tx) => {
      // Validate and apply coupon inside transaction (atomic check + increment)
      let couponDiscount = 0;
      let appliedCouponId: string | undefined;
      if (couponCode) {
        const coupon = await tx.coupon.findUnique({
          where: { code: couponCode.toUpperCase() },
        });
        if (coupon && coupon.active) {
          const now = new Date();
          if (now >= coupon.validFrom && now <= coupon.validUntil) {
            if (!coupon.usageLimit || coupon.usedCount < coupon.usageLimit) {
              if (!coupon.minOrderAmount || calculatedTotal >= Number(coupon.minOrderAmount)) {
                if (coupon.type === "PERCENTAGE") {
                  couponDiscount = calculatedTotal * (Number(coupon.value) / 100);
                  if (coupon.maxDiscount && couponDiscount > Number(coupon.maxDiscount)) {
                    couponDiscount = Number(coupon.maxDiscount);
                  }
                } else {
                  couponDiscount = Number(coupon.value);
                }
                couponDiscount = Math.round(Math.min(couponDiscount, calculatedTotal));
                appliedCouponId = coupon.id;
                // Atomically increment usage inside the transaction
                await tx.coupon.update({
                  where: { id: coupon.id },
                  data: { usedCount: { increment: 1 } },
                });
              }
            }
          }
        }
      }

      // Validate and redeem gift card inside transaction (atomic check + decrement)
      let giftCardDiscount = 0;
      let giftCardId: string | undefined;
      if (giftCardCode && giftCardRequestedAmount && giftCardRequestedAmount > 0) {
        const giftCard = await tx.giftCard.findUnique({
          where: { code: giftCardCode.toUpperCase() },
        });
        if (giftCard && giftCard.isActive && Number(giftCard.currentValue) > 0) {
          if (!giftCard.expiresAt || giftCard.expiresAt > new Date()) {
            giftCardDiscount = Math.min(giftCardRequestedAmount, Number(giftCard.currentValue));
            giftCardId = giftCard.id;
            const gc = await tx.giftCard.update({
              where: { id: giftCard.id },
              data: { currentValue: { decrement: giftCardDiscount } },
            });
            // Deactivate if fully used
            if (Number(gc.currentValue) <= 0) {
              await tx.giftCard.update({ where: { id: giftCard.id }, data: { isActive: false } });
            }
          }
        }
      }

      // Create order
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const subtotal = calculatedTotal;
      const totalDiscount = couponDiscount + giftCardDiscount;
      const order = await tx.order.create({
        data: {
          orderNumber,
          subtotal,
          discount: totalDiscount,
          totalAmount: Math.max(0, subtotal - totalDiscount + shippingAmount),
          shippingCost: shippingAmount,
          currency: body.currency,
          status: "PENDING",
          discreet: body.discreet,
          customerName: body.customer.name,
          customerEmail: body.customer.email || body.customer.phone || "",
          customerPhone: body.customer.phone || "",
          deliveryTimeSlot: body.deliveryTimeSlot,
          // Guest checkout: auto-delete data 45 days from now
          ...(!req.user?.id ? { guestDataExpiresAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), discreet: true } : {}),
          couponId: appliedCouponId,
          userId: req.user?.id,
          shippingAddress: typeof body.shippingAddress === 'object' ? JSON.stringify(body.shippingAddress) : (body.shippingAddress || ""),
          items: {
            create: cartItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: effectivePrices.get(item.productId) ?? item.product.price,
              name: item.product.name,
              sellerId: item.product.sellerId || null,
            })),
          },
        },
      });

      // Reserve stock
      const stockResult = await reserveStock(tx, cartItems, order.id);
      if (!stockResult.success) {
        throw new Error(stockResult.error);
      }

      // Apply store credit if requested
      let storeCreditUsed = 0;
      if (body.storeCreditAmount && body.storeCreditAmount > 0 && req.user?.id) {
        const credit = await tx.storeCredit.findUnique({
          where: { userId: req.user.id },
        });
        const maxCredit = Math.min(body.storeCreditAmount, subtotal - couponDiscount + shippingAmount);
        if (credit && Number(credit.balance) >= maxCredit && maxCredit > 0) {
          storeCreditUsed = maxCredit;
          await tx.storeCredit.update({
            where: { userId: req.user.id },
            data: { balance: { decrement: storeCreditUsed } },
          });
          await tx.storeCreditTx.create({
            data: {
              storeCreditId: credit.id,
              amount: -storeCreditUsed,
              type: "REDEMPTION",
              description: `Applied to order ${orderNumber}`,
              orderId: order.id,
            },
          });
          await tx.order.update({
            where: { id: order.id },
            data: {
              discount: { increment: storeCreditUsed },
              totalAmount: { decrement: storeCreditUsed },
            },
          });
        }
      }

      // Create installment plan if requested (not applicable to COD)
      if (body.installments && body.installments >= 2 && body.paymentMethod !== "cod") {
        const planTotal = subtotal - couponDiscount + shippingAmount - storeCreditUsed;
        if (planTotal > 0) {
          const perInstallment = Math.ceil(planTotal / body.installments);
          const intervalDays = body.installments <= 2 ? 14 : 30;
          await tx.installmentPlan.create({
            data: {
              orderId: order.id,
              totalAmount: planTotal,
              installments: body.installments,
              paidCount: 1,
              nextDueDate: new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000),
              status: "ACTIVE",
              payments: {
                create: Array.from({ length: body.installments }, (_, i) => ({
                  number: i + 1,
                  amount: i === body.installments! - 1 ? planTotal - perInstallment * (body.installments! - 1) : perInstallment,
                  status: i === 0 ? "PAID" : "PENDING",
                  dueDate: new Date(Date.now() + i * intervalDays * 24 * 60 * 60 * 1000),
                  paidAt: i === 0 ? new Date() : null,
                })),
              },
            },
          });
        }
      }

      return { order, storeCreditUsed, couponDiscount, giftCardDiscount };
    });

    const result = txResult.order;
    const storeCreditUsed = txResult.storeCreditUsed;
    const couponDiscount = txResult.couponDiscount;
    const giftCardDiscount = txResult.giftCardDiscount;
    const orderTotal = calculatedTotal - couponDiscount + shippingAmount;
    const paymentAmount = orderTotal - storeCreditUsed;
    const chargeAmount = body.installments && body.installments >= 2 && body.paymentMethod !== "cod"
      ? Math.ceil(paymentAmount / body.installments)
      : paymentAmount;

    let paymentLink: string | undefined;
    let paymentRef: string | undefined;
    let paymentStatus = "PENDING";

    if (chargeAmount <= 0) {
      // Fully paid with store credit — confirm order directly
      paymentStatus = "SUCCESSFUL";
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: result.id },
          data: { status: "CONFIRMED", paymentStatus: "SUCCESSFUL" },
        });
        await tx.orderEvent.create({
          data: {
            orderId: result.id,
            status: "CONFIRMED",
            note: "Order confirmed — fully paid with store credit.",
          },
        });
        const reservations = await tx.stockReservation.findMany({
          where: { orderId: result.id, released: false },
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
    } else if (body.paymentMethod === "cod") {
      // Cash on Delivery — auto-confirm, payment collected on delivery
      paymentStatus = "PENDING";
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: result.id },
          data: { status: "CONFIRMED" },
        });
        await tx.orderEvent.create({
          data: {
            orderId: result.id,
            status: "CONFIRMED",
            note: "Order confirmed — Cash on Delivery. Payment will be collected at delivery.",
          },
        });

        // Finalize stock for COD orders
        const reservations = await tx.stockReservation.findMany({
          where: { orderId: result.id, released: false },
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
    } else if (body.paymentMethod === "paypal") {
      // PayPal Express Checkout
      const ppResult = await createPayPalCheckout({
        orderId: result.id,
        amountUgx: chargeAmount,
        customerEmail: body.customer.email || body.customer.phone || "",
        description: `Order ${result.orderNumber}`,
      });
      paymentLink = ppResult.redirectUrl;
      paymentRef = ppResult.token;
    } else {
      // Flutterwave (card or mobile money)
      try {
        const flutterwaveMeta: Record<string, any> = {};
        if (body.installments && body.installments >= 2) {
          flutterwaveMeta.installment = `1 of ${body.installments}`;
          flutterwaveMeta.totalOrderAmount = paymentAmount;
        }
        const paymentResponse = await createFlutterwavePayment({
          tx_ref: result.id,
          amount: chargeAmount,
          currency: body.currency,
          customer: body.customer as any,
          paymentMethod: body.paymentMethod,
          mobileMoney: body.mobileMoney as any,
          redirect_url: `${process.env.BASE_URL}/checkout/confirm?orderId=${result.id}`,
          ...(Object.keys(flutterwaveMeta).length > 0 ? { meta: flutterwaveMeta } : {}),
        });
        paymentLink = paymentResponse.data?.link;
        paymentRef = paymentResponse.data?.flw_ref;
        paymentStatus = paymentResponse.status || "PENDING";
      } catch (flwErr: any) {
        // Clean up the order and release stock if payment initiation fails
        const reservations = await prisma.stockReservation.findMany({
          where: { orderId: result.id, released: false },
        });
        await prisma.$transaction([
          prisma.order.update({ where: { id: result.id }, data: { status: "CANCELLED", paymentStatus: "FAILED" } }),
          ...reservations.map((r) => prisma.product.update({ where: { id: r.productId }, data: { reservedStock: { decrement: r.quantity } } })),
          ...reservations.map((r) => prisma.stockReservation.update({ where: { id: r.id }, data: { released: true } })),
        ]);
        // Release idempotency key so user can retry
        if (idempotencyKey) {
          redis.del(`idempotency:checkout:${idempotencyKey}`).catch(() => {});
        }
        const msg = flwErr.message?.includes("authorization key")
          ? "Payment processing is temporarily unavailable. Please try PayPal or contact support."
          : "Payment initiation failed. Please try again or use a different method.";
        return res.status(400).json({ error: msg });
      }
    }

    // Save payment record
    const methodMap: Record<string, "CARD" | "MOBILE_MONEY" | "PAYPAL" | "COD"> = {
      card: "CARD",
      mobile_money: "MOBILE_MONEY",
      paypal: "PAYPAL",
      cod: "COD",
    };

    const payment = await prisma.payment.create({
      data: {
        orderId: result.id,
        provider: body.paymentMethod === "paypal" ? "paypal" : body.paymentMethod === "cod" ? "cod" : "flutterwave",
        method: methodMap[body.paymentMethod] || "CARD",
        status: chargeAmount <= 0 ? "SUCCESSFUL" : "PENDING",
        amount: chargeAmount,
        currency: body.currency,
        flwRef: paymentRef,
      },
    });

    // Coupon usedCount is now incremented inside the order transaction above

    // Only clear cart for COD (payment confirmed immediately).
    // For other methods, cart is cleared after payment confirmation.
    if ((body.paymentMethod === "cod" || chargeAmount <= 0) && body.cartId) {
      await prisma.cartItem.deleteMany({ where: { cartId: body.cartId } }).catch(() => {});
    }

    // Send "Order Received" email immediately (all payment methods)
    const orderWithItems = await prisma.order.findUnique({
      where: { id: result.id },
      include: { items: true, payments: { select: { method: true } } },
    });
    if (orderWithItems) {
      sendOrderReceivedEmail(orderWithItems).catch((err) =>
        logger.error("Order received email failed", { error: err.message })
      );

      // WhatsApp & SMS order confirmation (fire-and-forget)
      if (orderWithItems.customerPhone) {
        sendOrderConfirmationWhatsApp(orderWithItems.customerPhone, orderWithItems.orderNumber, orderWithItems.totalAmount.toString()).catch(() => {});
        sendOrderConfirmationSMS(orderWithItems.customerPhone, orderWithItems.orderNumber, orderWithItems.totalAmount.toString()).catch(() => {});
      }

      // Meta Conversions API and affiliate tracking only fire immediately for COD
      // (payment is confirmed at order creation). For other methods, these fire
      // in the webhook/callback handlers after payment confirmation.
      if (body.paymentMethod === "cod") {
        sendMetaConversionEvent({
          eventName: "Purchase",
          userData: {
            email: orderWithItems.customerEmail,
            phone: orderWithItems.customerPhone || undefined,
            ip: req.ip,
            userAgent: req.headers["user-agent"],
          },
          customData: {
            value: Number(orderWithItems.totalAmount),
            currency: orderWithItems.currency || "UGX",
            orderId: orderWithItems.orderNumber,
            numItems: orderWithItems.items.length,
          },
          eventSourceUrl: `${process.env.FRONTEND_URL || "https://ugsex.com"}/checkout`,
        }).catch(() => {});
      }
    }

    // Track affiliate conversion only for COD (immediate confirmation)
    // For other payment methods, tracked after payment confirmation
    if (body.affiliateCode && body.paymentMethod === "cod") {
      try {
        const affiliate = await prisma.affiliate.findUnique({
          where: { code: body.affiliateCode, status: "APPROVED" },
        });
        if (affiliate) {
          const commissionAmount = orderTotal * (Number(affiliate.commissionRate) / 100);
          await prisma.affiliateConversion.create({
            data: {
              affiliateId: affiliate.id,
              orderId: result.id,
              orderAmount: orderTotal,
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
        logger.error("Affiliate tracking error", { error: e });
      }
    }

    const responseBody = {
      orderId: result.id,
      paymentId: payment.id,
      paymentLink,
      paymentMethod: body.paymentMethod,
      status: paymentStatus,
    };

    // Update checkout attempt with success status and order ID
    if (checkoutAttemptId) {
      await prisma.checkoutAttempt.update({
        where: { id: checkoutAttemptId },
        data: {
          status: "SUCCESS",
          orderId: result.id,
        },
      });
    }

    // Cache successful response for idempotency (1 hour TTL)
    if (idempotencyKey) {
      const redisKey = `idempotency:checkout:${idempotencyKey}`;
      redis.set(redisKey, JSON.stringify({ statusCode: 200, body: responseBody }), "EX", 3600).catch(() => {});
    }

    return res.json(responseBody);
  } catch (error) {
    logger.error("Checkout error", { error });
    
    // Mark checkout attempt as failed
    if (checkoutAttemptId) {
      await prisma.checkoutAttempt.update({
        where: { id: checkoutAttemptId },
        data: { status: "FAILED" },
      }).catch(err => logger.error("Failed to update checkout attempt", { error: err }));
    }
    
    // Delete the idempotency Redis key to allow retry
    if (idempotencyKey) {
      const redisKey = `idempotency:checkout:${idempotencyKey}`;
      redis.del(redisKey).catch(() => {});
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    if (error instanceof Error && error.message.includes("Insufficient stock")) {
      return res.status(400).json({ error: "Insufficient stock for one or more items" });
    }
    return res.status(500).json({ error: "Checkout failed" });
  }
}));

// GET /api/checkout/paypal-return — called after user approves on PayPal
router.get("/paypal-return", asyncHandler(async (req: Request, res: Response) => {
  try {
    const token = req.query.token as string;
    const payerId = req.query.PayerID as string;
    const orderId = req.query.orderId as string;

    if (!token || !payerId || !orderId) {
      return res.status(400).json({ error: "Missing PayPal return parameters" });
    }

    // Verify orderId has a pending PayPal payment (prevents arbitrary order manipulation)
    const pendingPayment = await prisma.payment.findFirst({
      where: { orderId, method: "PAYPAL", status: "PENDING" },
    });
    if (!pendingPayment) {
      const existingOrder = await prisma.order.findUnique({ where: { id: orderId } });
      if (existingOrder?.paymentStatus === "SUCCESSFUL") {
        return res.redirect(`${process.env.FRONTEND_URL || process.env.BASE_URL}/orders/${orderId}?success=true`);
      }
      return res.redirect(`${process.env.FRONTEND_URL || process.env.BASE_URL}/checkout?error=invalid_payment`);
    }

    // Get payment details from PayPal
    const details = await getPayPalCheckoutDetails(token);

    // Execute the payment
    const result = await executePayPalPayment(token, payerId, details.amount);

    if (result.status === "Completed") {
      // Verify the paid amount matches the order total (converted to USD)
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order) {
        return res.redirect(`${process.env.FRONTEND_URL || process.env.BASE_URL}/checkout?error=order_not_found`);
      }

      // Idempotency guard: skip if already confirmed
      if (order.status === "CONFIRMED" && order.paymentStatus === "SUCCESSFUL") {
        return res.redirect(`${process.env.FRONTEND_URL || process.env.BASE_URL}/orders/${orderId}?success=true`);
      }

      // Import convertUgxToUsd from paypal service for amount verification
      const { convertUgxToUsd } = await import("../services/paypal");
      const expectedUsd = await convertUgxToUsd(Number(order.totalAmount));
      const paidUsd = parseFloat(result.amount);
      if (Math.abs(paidUsd - expectedUsd) > 0.50) {
        logger.error(`PayPal amount mismatch for order ${orderId}: expected $${expectedUsd}, got $${paidUsd}`);
        return res.redirect(`${process.env.FRONTEND_URL || process.env.BASE_URL}/checkout?error=amount_mismatch`);
      }

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
        logger.error(`AliExpress auto-order failed for ${orderId}`, { error: err.message })
      );
      placeCJOrdersForOrder(orderId).catch((err) =>
        logger.error(`CJ auto-order failed for ${orderId}`, { error: err.message })
      );

      // Clear cart after payment confirmation
      // Note: Cart is cleared on the frontend upon redirect to success page

      // Redirect to success page
      return res.redirect(`${process.env.FRONTEND_URL || process.env.BASE_URL}/orders/${orderId}?success=true`);
    } else {
      // Payment not completed — release stock reservations
      const reservations = await prisma.stockReservation.findMany({
        where: { orderId, released: false },
      });
      await prisma.$transaction([
        prisma.payment.updateMany({ where: { orderId }, data: { status: "FAILED" } }),
        prisma.order.update({ where: { id: orderId }, data: { status: "CANCELLED", paymentStatus: "FAILED" } }),
        ...reservations.map((r) => prisma.product.update({ where: { id: r.productId }, data: { reservedStock: { decrement: r.quantity } } })),
        ...reservations.map((r) => prisma.stockReservation.update({ where: { id: r.id }, data: { released: true } })),
      ]);

      return res.redirect(`${process.env.FRONTEND_URL || process.env.BASE_URL}/checkout?error=payment_failed`);
    }
  } catch (error: any) {
    logger.error("PayPal return error", { error: error.message });
    const orderId = req.query.orderId as string;
    return res.redirect(`${process.env.FRONTEND_URL || process.env.BASE_URL}/checkout?error=paypal_error`);
  }
}));

// GET /api/checkout/paypal-cancel — user cancelled on PayPal
router.get("/paypal-cancel", asyncHandler(async (req: Request, res: Response) => {
  const orderId = req.query.orderId as string;

  if (orderId) {
    try {
      // Verify the order exists, is still PENDING, and has a pending PayPal payment
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { payments: true },
      });
      if (!order || order.status !== "PENDING") {
        return res.redirect(`${process.env.FRONTEND_URL || process.env.BASE_URL}/checkout?error=payment_cancelled`);
      }
      const hasPendingPaypal = order.payments.some(p => p.method === "PAYPAL" && p.status === "PENDING");
      if (!hasPendingPaypal) {
        return res.redirect(`${process.env.FRONTEND_URL || process.env.BASE_URL}/checkout?error=payment_cancelled`);
      }

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
          data: { status: "CANCELLED", paymentStatus: "FAILED" },
        });

        await tx.payment.updateMany({
          where: { orderId, status: "PENDING" },
          data: { status: "FAILED" },
        });
      });
    } catch (e) {
      logger.error("PayPal cancel cleanup error", { error: e });
    }
  }

  return res.redirect(`${process.env.FRONTEND_URL || process.env.BASE_URL}/checkout?error=payment_cancelled`);
}));

export default router;
