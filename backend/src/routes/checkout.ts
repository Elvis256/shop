import { Router, Request, Response } from "express";
import { z } from "zod";
import { nanoid } from "nanoid";
import { createFlutterwavePayment } from "../services/flutterwave";
import { createPayPalCheckout, getPayPalCheckoutDetails, executePayPalPayment } from "../services/paypal";
import { placeAliExpressOrdersForOrder } from "../services/aliexpressOrder";
import { placeCJOrdersForOrder } from "../services/cjOrder";
import { sendMetaConversionEvent } from "../services/metaConversions";
import { enqueueNotification } from "../services/notificationDispatcher";
import { trackAbandonedCart, markCartRecovered } from "../services/abandonedCart";
import { confirmPaidOrder, releaseOrderStock } from "../services/orderConfirmation";
import { optionalAuth, AuthRequest } from "../middleware/auth";
import prisma from "../lib/prisma";
import redis from "../lib/redis";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";
import { reserveStock, DEFAULT_RESERVATION_TIMEOUT_MS } from "../utils/stockReservation";
const router = Router();

// Stock reservation timeout (15 minutes)
const RESERVATION_TIMEOUT_MS = DEFAULT_RESERVATION_TIMEOUT_MS;

// Validation schema
const CheckoutSchema = z.object({
  cartId: z.string().optional(),
  items: z.array(z.object({
    productId: z.string(),
    variantId: z.string().optional(),
    quantity: z.number().int().positive().max(100),
    price: z.number().positive(),
  })).max(50).optional(),
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
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }).optional(),
  affiliateCode: z.string().optional(),
  storeCreditAmount: z.number().min(0).optional(),
  loyaltyPointsRedeem: z.number().int().min(0).optional(),
  giftCardCode: z.string().optional(),
  giftCardAmount: z.number().min(0).optional(),
  installments: z.number().int().min(2).max(4).optional(),
  whatsappOptIn: z.boolean().optional(),
  deliveryMethod: z.enum(["home", "pickup", "seller_pickup"]).default("home"),
  pickupPointId: z.string().optional(),
  sellerPickupId: z.string().optional(),
  // Incognito Gifting fields
  isGift: z.boolean().default(false),
  giftRecipientPhone: z.string().optional(),
  giftMessage: z.string().max(300).optional(),
  senderName: z.string().max(60).optional(),
  // Stealth & Split payment options
  packagingType: z.enum(["STANDARD", "GIFT", "ULTRA_STEALTH"]).default("STANDARD"),
  isSplitPayment: z.boolean().default(false),
  splitShowItems: z.boolean().default(false),
  isPayForMe: z.boolean().default(false),
  splitPartnerPhone: z.string().optional(),
  dispatchScheduledAt: z.string().optional().nullable(),
  receiptMasked: z.boolean().default(false),
  codDepositMethod: z.enum(["card", "mobile_money"]).default("mobile_money"),
});

// GET /api/checkout/tax-info?country=Uganda&subtotal=50000
router.get("/tax-info", asyncHandler(async (req: Request, res: Response) => {
  const country = (req.query.country as string) || "Uganda";
  const subtotal = parseFloat(req.query.subtotal as string) || 0;

  const taxRule = await prisma.taxRule.findFirst({
    where: { country, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  if (!taxRule || subtotal <= 0) {
    return res.json({ taxName: null, taxRate: 0, taxAmount: 0, isInclusive: true });
  }

  const rate = Number(taxRule.rate);
  // Tax-inclusive: extract tax from the price
  const taxAmount = Math.round(subtotal - subtotal / (1 + rate));

  return res.json({
    taxName: taxRule.name,
    taxRate: rate,
    taxAmount,
    isInclusive: true, // Prices always include tax
  });
}));

// GET /api/checkout/delivery-options?productIds=a,b,c
router.get("/delivery-options", asyncHandler(async (req: Request, res: Response) => {
  const productIds = (req.query.productIds as string || "").split(",").filter(Boolean);
  if (productIds.length === 0) {
    return res.status(400).json({ error: "productIds required" });
  }

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      allowedDeliveryMethods: true,
      codAllowed: true,
      sellerId: true,
      shippingFee: true,
    },
  });

  if (products.length === 0) {
    return res.status(404).json({ error: "No products found" });
  }

  // Compute intersection of allowed delivery methods
  const ALL_METHODS = ["HOME_DELIVERY", "PICKUP", "SELLER_PICKUP"];
  let allowedMethods: string[] = ALL_METHODS;

  for (const product of products) {
    const methods = product.allowedDeliveryMethods.length > 0
      ? product.allowedDeliveryMethods
      : ALL_METHODS; // empty = all allowed
    allowedMethods = allowedMethods.filter((m) => methods.includes(m));
  }

  // COD is only allowed if ALL products allow it
  const codAllowed = products.every((p) => p.codAllowed !== false);

  // Seller pickup only available for single-seller carts
  const sellerIds = [...new Set(products.map((p) => p.sellerId).filter(Boolean))];
  let sellerPickupInfo: any = null;

  if (sellerIds.length === 1 && allowedMethods.includes("SELLER_PICKUP")) {
    const seller = await prisma.seller.findUnique({
      where: { id: sellerIds[0]! },
      select: {
        id: true,
        storeName: true,
        allowsCustomerPickup: true,
        pickupAddress: true,
        pickupCity: true,
        pickupHours: true,
        phone: true,
      },
    });
    if (seller?.allowsCustomerPickup && seller.pickupAddress) {
      sellerPickupInfo = {
        sellerId: seller.id,
        storeName: seller.storeName,
        address: seller.pickupAddress,
        city: seller.pickupCity,
        hours: seller.pickupHours,
        phone: seller.phone,
      };
    } else {
      // Seller doesn't support pickup — remove from allowed
      allowedMethods = allowedMethods.filter((m) => m !== "SELLER_PICKUP");
    }
  } else if (sellerIds.length > 1) {
    // Multi-seller cart: remove seller pickup
    allowedMethods = allowedMethods.filter((m) => m !== "SELLER_PICKUP");
  }

  return res.json({ allowedMethods, codAllowed, sellerPickupInfo });
}));

// POST /api/checkout/track-cart — track cart for abandoned cart recovery
router.post("/track-cart", optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { cartId, email, items, totalAmount, currency } = req.body;
  if (!cartId || !email || !items?.length) {
    return res.json({ tracked: false });
  }
  await trackAbandonedCart(
    cartId,
    req.user?.id || null,
    email,
    items.map((i: any) => ({ productId: i.productId, productName: i.name || i.productName, productImage: i.imageUrl || i.productImage, quantity: i.quantity, price: i.price })),
    totalAmount || 0,
    currency || "UGX"
  );
  return res.json({ tracked: true });
}));

// POST /api/checkout/create
router.post("/create", optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
  let checkoutAttemptId: string | undefined;
  const redisKey = idempotencyKey ? `idempotency:checkout:${idempotencyKey}` : undefined;

  // Clear idempotency state so the client can retry immediately after a 4xx.
  // Without this, the CheckoutAttempt row stays PENDING and any retry with the
  // same Idempotency-Key returns 409 until the 24h DB expiry.
  // Also records the failure reason so admin can review what went wrong.
  const failAttempt = async (
    status: number,
    body: Record<string, unknown>,
    failureCode?: string
  ) => {
    if (checkoutAttemptId) {
      const reason = typeof body.error === "string" ? body.error : JSON.stringify(body);
      await prisma.checkoutAttempt.update({
        where: { id: checkoutAttemptId },
        data: {
          status: "FAILED",
          failureReason: reason.slice(0, 500),
          failureCode: failureCode || "VALIDATION",
        },
      }).catch(err => logger.error("Failed to mark checkout attempt FAILED", { error: err }));
    }
    if (redisKey) {
      await redis.del(redisKey).catch(() => {});
    }
    return res.status(status).json(body);
  };

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

      // Resolve cart details for the checkout attempt
      let cartData: any = null;
      let cartValue = 0;
      try {
        if (req.body.items && Array.isArray(req.body.items)) {
          cartData = req.body.items.map((i: any) => ({
            productId: i.productId,
            quantity: i.quantity,
            price: Number(i.price)
          }));
          cartValue = req.body.amount || cartData.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0);
        } else if (req.body.cartId) {
          const dbCart = await prisma.cart.findUnique({
            where: { id: req.body.cartId },
            include: { items: { include: { product: true } } }
          });
          if (dbCart) {
            cartData = dbCart.items.map(i => ({
              productId: i.productId,
              quantity: i.quantity,
              price: Number(i.product.price),
              productName: i.product.name,
            }));
            cartValue = dbCart.items.reduce((sum, i) => sum + (Number(i.product.price) * i.quantity), 0);
          }
        }

        // Fetch product names for items if not already resolved
        if (cartData && Array.isArray(cartData)) {
          const productIds = cartData.filter((i: any) => !i.productName).map((i: any) => i.productId);
          if (productIds.length > 0) {
            const dbProducts = await prisma.product.findMany({
              where: { id: { in: productIds } },
              select: { id: true, name: true }
            });
            const prodMap = new Map(dbProducts.map(p => [p.id, p.name]));
            cartData = cartData.map((i: any) => ({
              ...i,
              productName: i.productName || prodMap.get(i.productId) || "Product " + i.productId
            }));
          }
        }
      } catch (err) {
        logger.error("Failed to pre-resolve checkoutAttempt cartData", { error: err });
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
            packagingType: (req.body.packagingType as string) || "STANDARD",
            expiresAt,
            cartData: cartData || undefined,
            cartValue: cartValue || undefined,
            currency: req.body.currency || "UGX",
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

    if ((body.isSplitPayment || body.isPayForMe) && body.paymentMethod === "cod") {
      return failAttempt(400, { error: "Cash on Delivery is not allowed for split payments or group checkouts." }, "COD_NOT_ALLOWED");
    }

    let normalizedGiftRecipientPhone: string | undefined;
    if (body.isGift) {
      if (!body.giftRecipientPhone) {
        return failAttempt(400, { error: "Recipient phone number is required for gift orders" }, "VALIDATION");
      }
      let phone = body.giftRecipientPhone.replace(/\s+/g, "");
      if (phone.startsWith("0")) phone = "+256" + phone.slice(1);
      if (!phone.startsWith("+")) phone = "+256" + phone;
      normalizedGiftRecipientPhone = phone;
    }

    // Fetch cart items — body.items is the authoritative source (it reflects the
    // user's actual current cart). Fall back to the server-side cart only when
    // body.items is absent, so a stale/incomplete server cart never silently
    // under-charges the customer.
    let cartItems: Array<{ productId: string; quantity: number; variantId?: string | null; product: any; variant?: any }> = [];

    let cartFound = false;
    if (body.items && body.items.length > 0) {
      const products = await prisma.product.findMany({
        where: { id: { in: body.items.map((i) => i.productId) } },
      });
      const variants = await prisma.productVariant.findMany({
        where: { id: { in: body.items.map((i) => i.variantId).filter(Boolean) as string[] } },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));
      const variantMap = new Map(variants.map((v) => [v.id, v]));
      cartItems = body.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        variantId: item.variantId || null,
        product: productMap.get(item.productId),
        variant: item.variantId ? variantMap.get(item.variantId) : null,
      })).filter((item) => item.product);
      if (cartItems.length > 0) cartFound = true;
    }

    if (!cartFound && body.cartId) {
      // Fall back to server cart when no items were submitted
      const cart = await prisma.cart.findUnique({
        where: { id: body.cartId },
        include: { items: { include: { product: true, variant: true } } },
      });
      if (cart && cart.items.length > 0) {
        cartItems = cart.items;
        cartFound = true;
      }
    }

    if (!cartFound || cartItems.length === 0) {
      return failAttempt(400, { error: "Cart is empty" }, "CART_EMPTY");
    }

    // Validate delivery method against products' allowed methods
    const ALL_DELIVERY_METHODS = ["HOME_DELIVERY", "PICKUP", "SELLER_PICKUP"];
    const deliveryMethodMap: Record<string, string> = { home: "HOME_DELIVERY", pickup: "PICKUP", seller_pickup: "SELLER_PICKUP" };
    const requestedMethod = deliveryMethodMap[body.deliveryMethod] || "HOME_DELIVERY";

    let cartAllowedMethods: string[] = ALL_DELIVERY_METHODS;
    for (const item of cartItems) {
      const methods = item.product.allowedDeliveryMethods?.length > 0
        ? item.product.allowedDeliveryMethods
        : ALL_DELIVERY_METHODS;
      cartAllowedMethods = cartAllowedMethods.filter((m: string) => methods.includes(m));
    }

    // Multi-seller cart: remove seller_pickup
    const cartSellerIds = [...new Set(cartItems.map((i) => i.product.sellerId).filter(Boolean))];
    if (cartSellerIds.length > 1) {
      cartAllowedMethods = cartAllowedMethods.filter((m: string) => m !== "SELLER_PICKUP");
    }

    if (!cartAllowedMethods.includes(requestedMethod)) {
      return failAttempt(400, { error: `Delivery method "${body.deliveryMethod}" is not available for the items in your cart` }, "DELIVERY");
    }

    // Validate COD is allowed if selected
    if (body.paymentMethod === "cod") {
      const allAllowCod = cartItems.every((item) => item.product.codAllowed !== false);
      if (!allAllowCod) {
        return failAttempt(400, { error: "Cash on Delivery is not available for one or more items in your cart" }, "COD");
      }
    }

    // Validate seller pickup
    let sellerPickupData: { address: string; city: string; hours: string; phone: string; sellerId: string } | null = null;
    if (body.deliveryMethod === "seller_pickup") {
      const pickupSellerId = body.sellerPickupId || cartSellerIds[0];
      if (!pickupSellerId) {
        return failAttempt(400, { error: "Seller pickup requires a seller" }, "DELIVERY");
      }
      const seller = await prisma.seller.findUnique({
        where: { id: pickupSellerId },
        select: { id: true, allowsCustomerPickup: true, pickupAddress: true, pickupCity: true, pickupHours: true, phone: true },
      });
      if (!seller?.allowsCustomerPickup || !seller.pickupAddress) {
        return failAttempt(400, { error: "Seller does not offer customer pickup" }, "DELIVERY");
      }
      sellerPickupData = {
        address: seller.pickupAddress,
        city: seller.pickupCity || "",
        hours: seller.pickupHours || "",
        phone: seller.phone || "",
        sellerId: seller.id,
      };
    }

    // Fetch active price slashes for the current user and the items in the cart
    const activePriceSlashes = req.user?.id
      ? await prisma.priceSlash.findMany({
          where: {
            initiatorId: req.user.id,
            productId: { in: cartItems.map(item => item.productId) },
            status: "active",
            expiresAt: { gt: new Date() },
          },
        })
      : [];
    const priceSlashMap = new Map(activePriceSlashes.map(ps => [ps.productId, ps]));

    // Calculate total from DB prices (authoritative source of truth)
    // Honor active flash sale and daily deal prices
    const effectivePrices = new Map<string, number>();
    const calculatedTotal = cartItems.reduce((sum, item) => {
      const product = item.product;
      let unitPrice = Math.round(Number(product.price));

      // Apply price slash if active
      const activeSlash = priceSlashMap.get(item.productId);
      if (activeSlash) {
        unitPrice = Math.round(Number(activeSlash.currentPrice));
      }
      // Check flash sale pricing
      else if (product.flashSalePrice && product.flashSaleEndsAt && new Date(product.flashSaleEndsAt) > new Date()) {
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

    // Enforce minimum order amount (5,000 UGX ≈ ~$1.35) to prevent payment gateway fee abuse
    if (calculatedTotal < 5000) {
      return failAttempt(400, { error: "Minimum order amount is UGX 5,000" }, "MIN_ORDER");
    }

    // Validate shipping fee to prevent payload tampering
    let expectedShippingUgx = 0;
    if (body.deliveryMethod === "home") {
      expectedShippingUgx = cartItems.reduce((sum, item) => sum + (item.product.shippingFee ? Number(item.product.shippingFee) : 0), 0);
    }
    
    let shippingAmountInUgx = body.shipping || 0;
    if (body.currency && body.currency !== "UGX" && shippingAmountInUgx > 0) {
      const dbCurrency = await prisma.currency.findUnique({
        where: { code: body.currency, isActive: true },
      });
      if (dbCurrency && Number(dbCurrency.exchangeRate) > 0) {
        shippingAmountInUgx = Math.round(shippingAmountInUgx / Number(dbCurrency.exchangeRate));
      }
    }

    // Allow a small conversion rounding tolerance (e.g. 500 UGX)
    if (Math.abs(shippingAmountInUgx - expectedShippingUgx) > 500) {
      return failAttempt(400, {
        error: `Shipping cost mismatch. Expected UGX ${expectedShippingUgx.toLocaleString()} (converted: ${body.shipping}), but received UGX ${shippingAmountInUgx.toLocaleString()}.`,
      }, "SHIPPING_MISMATCH");
    }

    const shippingAmount = body.shipping || 0;

    // Convert client expected total to UGX for comparison
    let amountInUgx = body.amount;
    if (body.currency && body.currency !== "UGX") {
      const dbCurrency = await prisma.currency.findUnique({
        where: { code: body.currency, isActive: true },
      });
      if (dbCurrency && Number(dbCurrency.exchangeRate) > 0) {
        amountInUgx = Math.round(body.amount / Number(dbCurrency.exchangeRate));
      }
    }

    // Reconstruct expected coupon discount outside transaction to validate price
    let validationCouponDiscount = 0;
    if (body.couponCode) {
      const upperCode = body.couponCode.toUpperCase();
      const coupon = await prisma.coupon.findUnique({
        where: { code: upperCode },
      });

      if (coupon && coupon.active) {
        if (coupon.type === "PERCENTAGE") {
          validationCouponDiscount = calculatedTotal * (Number(coupon.value) / 100);
          if (coupon.maxDiscount && validationCouponDiscount > Number(coupon.maxDiscount)) {
            validationCouponDiscount = Number(coupon.maxDiscount);
          }
        } else {
          validationCouponDiscount = Number(coupon.value);
        }
        validationCouponDiscount = Math.round(Math.min(validationCouponDiscount, calculatedTotal));
      }
    }

    // Reconstruct expected gift card discount outside transaction (for price validation helper)
    let validationGiftCardDiscount = 0;
    if (body.giftCardCode && body.giftCardAmount && body.giftCardAmount > 0) {
      const giftCard = await prisma.giftCard.findUnique({
        where: { code: body.giftCardCode.toUpperCase() },
      });
      if (giftCard && giftCard.isActive && Number(giftCard.currentValue) > 0) {
        validationGiftCardDiscount = Math.min(body.giftCardAmount, Number(giftCard.currentValue));
      }
    }

    // Grand total = items subtotal - coupon - gift card + shipping
    const expectedGrandTotal = calculatedTotal - validationCouponDiscount - validationGiftCardDiscount + shippingAmountInUgx;

    // Compare server-calculated grand total with client grand total
    if (Math.abs(amountInUgx - expectedGrandTotal) > 500) {
      return failAttempt(400, {
        error: `Price discrepancy detected. The price on your screen (converted: UGX ${amountInUgx.toLocaleString()}) does not match the current shop price (UGX ${expectedGrandTotal.toLocaleString()}). Please refresh your cart.`,
      }, "PRICE_MISMATCH");
    }

    // Tax calculation — prices are tax-inclusive, extract tax portion for display/invoicing
    const customerCountry = body.shippingAddress?.country || "Uganda";
    const taxRule = await prisma.taxRule.findFirst({
      where: { country: customerCountry, isActive: true },
      orderBy: { createdAt: "desc" },
    });
    const taxRate = taxRule ? Number(taxRule.rate) : 0;
    // Tax-inclusive formula: taxAmount = total - total / (1 + rate)
    const taxAmount = taxRate > 0 ? Math.round(calculatedTotal - calculatedTotal / (1 + taxRate)) : 0;

    // Coupon and gift card validation moved inside transaction to prevent race conditions
    const couponCode = body.couponCode;
    const giftCardCode = body.giftCardCode;
    const giftCardRequestedAmount = body.giftCardAmount;

    const txResult = await prisma.$transaction(async (tx) => {
      // Validate and apply coupon inside transaction (atomic check + increment)
      let couponDiscount = 0;
      let appliedCouponId: string | undefined;
      if (couponCode) {
        const upperCode = couponCode.toUpperCase();
        // Lock the coupon row to prevent concurrent usage race condition
        const [coupon] = await tx.$queryRaw<any[]>`
          SELECT * FROM "Coupon" WHERE code = ${upperCode} FOR UPDATE`;
        const now = new Date();
        const couponValid = coupon && coupon.active
          && now >= coupon.validFrom && now <= coupon.validUntil
          && (!coupon.usageLimit || coupon.usedCount < coupon.usageLimit)
          && (!coupon.minOrderAmount || calculatedTotal >= Number(coupon.minOrderAmount));

        // Per-user limit check
        let perUserBlocked = false;
        if (couponValid && coupon.perUserLimit) {
          const perUserWhere: any = { couponId: coupon.id };
          if (req.user?.id) perUserWhere.userId = req.user.id;
          else if (body.customer?.email) perUserWhere.customerEmail = body.customer.email;
          const userUsage = await tx.order.count({ where: perUserWhere });
          perUserBlocked = userUsage >= coupon.perUserLimit;
        }

        if (couponValid && !perUserBlocked) {
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
          await tx.coupon.update({
            where: { id: coupon.id },
            data: { usedCount: { increment: 1 } },
          });
        }
      }

      // Validate and redeem gift card inside transaction (atomic check + decrement)
      let giftCardDiscount = 0;
      let giftCardId: string | undefined;
      if (giftCardCode && giftCardRequestedAmount && giftCardRequestedAmount > 0) {
        // Lock the gift card row to prevent concurrent double-spend
        const [giftCard] = await tx.$queryRaw<any[]>`
          SELECT * FROM "GiftCard" WHERE code = ${giftCardCode.toUpperCase()} FOR UPDATE`;
        if (giftCard && giftCard.isActive && Number(giftCard.currentValue) > 0) {
          if (!giftCard.expiresAt || new Date(giftCard.expiresAt) > new Date()) {
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

      // Resolve delivery method and address
      let resolvedShippingAddress = typeof body.shippingAddress === 'object' ? JSON.stringify(body.shippingAddress) : (body.shippingAddress || "");
      let resolvedDeliveryMethod = "HOME_DELIVERY";
      let resolvedPickupPointId: string | undefined;

      if (body.deliveryMethod === "pickup" && body.pickupPointId) {
        const pickupPoint = await tx.pickupPoint.findUnique({ where: { id: body.pickupPointId } });
        if (pickupPoint && pickupPoint.isActive) {
          resolvedShippingAddress = JSON.stringify({
            name: pickupPoint.name,
            address: pickupPoint.address,
            city: pickupPoint.city,
            county: pickupPoint.county,
            phone: pickupPoint.phone,
            type: "pickup",
          });
          resolvedDeliveryMethod = "PICKUP";
          resolvedPickupPointId = pickupPoint.id;
        }
      } else if (body.deliveryMethod === "seller_pickup" && sellerPickupData) {
        resolvedShippingAddress = JSON.stringify({
          address: sellerPickupData.address,
          city: sellerPickupData.city,
          hours: sellerPickupData.hours,
          phone: sellerPickupData.phone,
          type: "seller_pickup",
        });
        resolvedDeliveryMethod = "SELLER_PICKUP";
      }

      // Create order
      const orderNumber = `ORD-${nanoid(12).toUpperCase()}`;
      const subtotal = calculatedTotal;
      const totalDiscount = couponDiscount + giftCardDiscount;
      const order = await tx.order.create({
        data: {
          orderNumber,
          subtotal,
          discount: totalDiscount,
          totalAmount: Math.max(0, subtotal - totalDiscount + (body.isGift ? 0 : shippingAmount)),
          shippingCost: body.isGift ? 0 : shippingAmount,
          tax: taxAmount,
          currency: body.currency,
          status: "PENDING",
          discreet: body.discreet,
          customerName: body.isGift ? (body.senderName || "Someone special") : body.customer.name,
          customerEmail: body.customer.email || body.customer.phone || "",
          customerPhone: body.customer.phone || "",
          deliveryTimeSlot: body.isGift ? undefined : body.deliveryTimeSlot,
          deliveryMethod: body.isGift ? "HOME_DELIVERY" : resolvedDeliveryMethod,
          pickupPointId: body.isGift ? undefined : resolvedPickupPointId,
          // Guest checkout: auto-delete data 45 days from now
          ...(!req.user?.id ? { guestDataExpiresAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), discreet: true } : {}),
          couponId: appliedCouponId,
          userId: req.user?.id,
          shippingAddress: body.isGift ? JSON.stringify({ pending: true }) : resolvedShippingAddress,
          isGift: body.isGift,
          giftRecipientPhone: normalizedGiftRecipientPhone || null,
          giftMessage: body.giftMessage || null,
          giftToken: body.isGift ? nanoid(32) : null,
          giftAddressSet: false,
          packagingType: body.packagingType || "STANDARD",
          latitude: body.shippingAddress?.latitude || null,
          longitude: body.shippingAddress?.longitude || null,
          isSplitPayment: body.isSplitPayment || body.isPayForMe || false,
          splitShowItems: body.splitShowItems || false,
          splitPartnerPhone: body.splitPartnerPhone || null,
          splitPaidAmount: 0,
          splitPartnerPaid: false,
          dispatchScheduledAt: body.dispatchScheduledAt ? new Date(body.dispatchScheduledAt) : null,
          receiptMasked: body.receiptMasked || false,
          items: {
            create: cartItems.map((item) => {
              const unitPrice = item.variant?.price
                ? Number(item.variant.price)
                : (effectivePrices.get(item.productId) ?? item.product.price);
              return {
                productId: item.productId,
                variantId: item.variantId || null,
                quantity: item.quantity,
                price: unitPrice,
                name: item.variant ? `${item.product.name} — ${item.variant.name}` : item.product.name,
                sellerId: item.product.sellerId || null,
                shippingFeeCharged: item.product.shippingFee ? Number(item.product.shippingFee) : null,
              };
            }),
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
        // Lock the store credit row to prevent concurrent double-spend
        const [credit] = await tx.$queryRaw<any[]>`
          SELECT * FROM "StoreCredit" WHERE "userId" = ${req.user.id} FOR UPDATE`;
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
        if (!req.user?.id) {
          throw new Error("INSTALLMENT_INELIGIBLE:Please log in to pay in installments.");
        }
        const eligibility = await checkInstallmentEligibility(req.user.id);
        if (!eligibility.eligible) {
          throw new Error(`INSTALLMENT_INELIGIBLE:${eligibility.reason}`);
        }
        const planTotal = subtotal - couponDiscount + shippingAmount - storeCreditUsed;
        if (planTotal > 0) {
          const perInstallment = Math.ceil(planTotal / body.installments);
          const intervalDays = body.installments <= 2 ? 14 : 30;
          await tx.installmentPlan.create({
            data: {
              orderId: order.id,
              totalAmount: planTotal,
              installments: body.installments,
              // FIX H11: Start paidCount at 0 — the webhook will increment it
              // after Flutterwave confirms the first payment. Marking it PAID
              // here causes a phantom paid installment if payment fails.
              paidCount: 0,
              nextDueDate: new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000),
              status: "ACTIVE",
              payments: {
                create: Array.from({ length: body.installments }, (_, i) => ({
                  number: i + 1,
                  amount: i === body.installments! - 1 ? planTotal - perInstallment * (body.installments! - 1) : perInstallment,
                  // FIX H11: All installments start PENDING; first one upgraded to PAID by the webhook.
                  status: "PENDING",
                  dueDate: new Date(Date.now() + i * intervalDays * 24 * 60 * 60 * 1000),
                  paidAt: null,
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
    let chargeAmount = body.installments && body.installments >= 2 && body.paymentMethod !== "cod"
      ? Math.ceil(paymentAmount / body.installments)
      : paymentAmount;

    if (body.isPayForMe) {
      chargeAmount = 0;
    } else if (body.isSplitPayment) {
      chargeAmount = Math.ceil(chargeAmount / 2);
    } else if (body.paymentMethod === "cod") {
      chargeAmount = Math.ceil(paymentAmount * 0.2);
    }

    let paymentLink: string | undefined;
    let paymentRef: string | undefined;
    let paymentStatus = "PENDING";

    if (body.isPayForMe) {
      paymentStatus = "PENDING";
      
      // Save payment record for the friend's payment (full amount)
      await prisma.payment.create({
        data: {
          orderId: result.id,
          amount: paymentAmount,
          currency: body.currency,
          provider: "flutterwave",
          method: body.paymentMethod === "card" ? "CARD" : "MOBILE_MONEY",
          status: "PENDING",
          flwRef: `split-part-${result.id}`,
        },
      });

      // Send WhatsApp / SMS invitation to the friend/partner immediately
      if (body.splitPartnerPhone) {
        const { sendWhatsApp } = await import("../services/whatsapp");
        const { sendSMS } = await import("../services/sms");
        const paymentUrl = `${process.env.FRONTEND_URL || process.env.BASE_URL || "http://localhost:3000"}/checkout/split/${result.id}`;
        const initiatorLabel = body.customer.name || "A friend";
        const formattedAmount = `USh ${paymentAmount.toLocaleString()}`;
        
        const message = `💸 Hello! ${initiatorLabel} has asked you to pay for their PleasureZone order!\n\nThe total amount is ${formattedAmount}.\n\nComplete the secure payment on their behalf here:\n${paymentUrl}`;
        
        sendWhatsApp({ to: body.splitPartnerPhone, text: message })
          .then((waSent) => {
            if (!waSent) sendSMS(body.splitPartnerPhone!, message).catch(() => {});
          })
          .catch(() => {
            sendSMS(body.splitPartnerPhone!, message).catch(() => {});
          });
      }

      paymentLink = `${process.env.FRONTEND_URL || process.env.BASE_URL || "http://localhost:3000"}/checkout/success?orderId=${result.id}&payForMe=true`;

    } else if (chargeAmount <= 0) {
      // Fully paid with store credit — confirm order directly
      paymentStatus = "SUCCESSFUL";
      await prisma.$transaction(async (tx) => {
        await tx.orderEvent.create({
          data: {
            orderId: result.id,
            status: "CONFIRMED",
            note: "Order confirmed — fully paid with store credit.",
          },
        });

        // Use shared confirmation logic (status, stock, seller earnings, escrow, variants)
        await confirmPaidOrder(tx, result.id);
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

        // Convert chargeAmount to target currency for payment gateway
        let targetChargeAmount = chargeAmount;
        if (body.currency && body.currency !== "UGX") {
          const dbCurrency = await prisma.currency.findUnique({
            where: { code: body.currency, isActive: true },
          });
          if (dbCurrency && Number(dbCurrency.exchangeRate) > 0) {
            targetChargeAmount = Math.round(chargeAmount * Number(dbCurrency.exchangeRate));
          }
        }

        const paymentResponse = await createFlutterwavePayment({
          tx_ref: body.isSplitPayment ? `split-init-${result.id}` : result.id,
          amount: targetChargeAmount,
          currency: body.currency,
          customer: {
            // Flutterwave REQUIRES an email. If user only gave us a phone, synthesize a
            // deterministic placeholder so the API call succeeds. We still record the real
            // contact info on the order (customerEmail / customerPhone above).
            name: body.customer.name,
            email: body.customer.email
              || (body.customer.phone ? `${body.customer.phone.replace(/[^0-9]/g, "")}@noreply.ugsex.com` : "noreply@ugsex.com"),
          },
          paymentMethod: body.paymentMethod === "cod" ? body.codDepositMethod : body.paymentMethod,
          mobileMoney: body.mobileMoney as any,
          redirect_url: `${process.env.FRONTEND_URL || process.env.BASE_URL}/checkout/confirm?orderId=${result.id}`,
          ...(Object.keys(flutterwaveMeta).length > 0 ? { meta: flutterwaveMeta } : {}),
        });
        paymentLink = paymentResponse.data?.link;
        paymentRef = paymentResponse.data?.flw_ref;
        paymentStatus = paymentResponse.status || "PENDING";
      } catch (flwErr: any) {
        // Clean up the order and release stock if payment initiation fails
        await prisma.$transaction(async (tx) => {
          await tx.order.update({ where: { id: result.id }, data: { status: "CANCELLED", paymentStatus: "FAILED" } });
          await releaseOrderStock(tx, result.id);
          const { refundStoreCreditForOrder } = await import("../utils/storeCredit");
          await refundStoreCreditForOrder(tx, result.id);
        });
        // Release idempotency key so user can retry
        const msg = flwErr.message?.includes("authorization key")
          ? "Payment processing is temporarily unavailable. Please try PayPal or contact support."
          : "Payment initiation failed. Please try again or use a different method.";
        return failAttempt(400, { error: msg }, "PAYMENT");
      }
    }

    // Save payment record
    const methodMap: Record<string, "CARD" | "MOBILE_MONEY" | "PAYPAL" | "COD"> = {
      card: "CARD",
      mobile_money: "MOBILE_MONEY",
      paypal: "PAYPAL",
      cod: "COD",
    };

    // Calculate target charge amount for payment record (excludes PayPal which handles conversion inside service)
    let targetChargeAmount = chargeAmount;
    if (body.currency && body.currency !== "UGX" && body.paymentMethod !== "paypal") {
      const dbCurrency = await prisma.currency.findUnique({
        where: { code: body.currency, isActive: true },
      });
      if (dbCurrency && Number(dbCurrency.exchangeRate) > 0) {
        targetChargeAmount = Math.round(chargeAmount * Number(dbCurrency.exchangeRate));
      }
    }

    let payment: any;

    if (body.paymentMethod === "cod") {
      // 1. Create online deposit payment (20%)
      const methodMapDeposit: Record<string, "CARD" | "MOBILE_MONEY"> = {
        card: "CARD",
        mobile_money: "MOBILE_MONEY",
      };
      payment = await prisma.payment.create({
        data: {
          orderId: result.id,
          provider: "flutterwave",
          method: methodMapDeposit[body.codDepositMethod] || "MOBILE_MONEY",
          status: "PENDING",
          amount: targetChargeAmount,
          currency: body.currency,
          flwRef: paymentRef,
        },
      });

      // 2. Create remaining COD payment (80%)
      let remainingAmount = paymentAmount - chargeAmount;
      let targetRemainingAmount = remainingAmount;
      if (body.currency && body.currency !== "UGX") {
        const dbCurrency = await prisma.currency.findUnique({
          where: { code: body.currency, isActive: true },
        });
        if (dbCurrency && Number(dbCurrency.exchangeRate) > 0) {
          targetRemainingAmount = Math.round(remainingAmount * Number(dbCurrency.exchangeRate));
        }
      }

      await prisma.payment.create({
        data: {
          orderId: result.id,
          provider: "cod",
          method: "COD",
          status: "PENDING",
          amount: targetRemainingAmount,
          currency: body.currency,
        },
      });
    } else {
      payment = await prisma.payment.create({
        data: {
          orderId: result.id,
          provider: body.paymentMethod === "paypal" ? "paypal" : "flutterwave",
          method: methodMap[body.paymentMethod] || "CARD",
          status: chargeAmount <= 0 ? "SUCCESSFUL" : "PENDING",
          amount: targetChargeAmount,
          currency: body.currency,
          flwRef: paymentRef,
        },
      });

      // Create escrow for fully paid with store credit orders immediately
      if (chargeAmount <= 0) {
        const escrowAmount = Number(result.totalAmount);
        if (escrowAmount > 0) {
          await prisma.escrowTransaction.create({
            data: {
              orderId: result.id,
              amount: escrowAmount,
              currency: body.currency,
              status: "HELD",
              releaseDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days after delivery
            },
          }).catch((err) => logger.error("Escrow creation failed", { orderId: result.id, error: err }));
        }
      }
    }

    // Only clear cart immediately if fully paid with store credit.
    // For COD and online methods, cart is cleared after deposit/payment confirmation.
    if (chargeAmount <= 0 && body.cartId) {
      await prisma.cartItem.deleteMany({ where: { cartId: body.cartId } }).catch(() => {});
    }

    // Send "Order Received" notifications via centralized dispatcher
    const orderWithItems = await prisma.order.findUnique({
      where: { id: result.id },
      include: { items: true, payments: { select: { method: true } } },
    });
    if (orderWithItems) {
      const paymentMethodLabels: Record<string, string> = {
        CARD: "Credit/Debit Card",
        MOBILE_MONEY: "Mobile Money",
        PAYPAL: "PayPal",
        COD: "Cash on Delivery",
      };
      enqueueNotification({
        event: "ORDER_RECEIVED",
        recipientEmail: orderWithItems.customerEmail || undefined,
        recipientPhone: orderWithItems.customerPhone || undefined,
        recipientUserId: req.user?.id,
        orderId: orderWithItems.id,
        data: {
          customerName: orderWithItems.customerName,
          orderNumber: orderWithItems.orderNumber,
          orderId: orderWithItems.id,
          total: Number(orderWithItems.totalAmount),
          paymentMethod: paymentMethodLabels[orderWithItems.payments?.[0]?.method] || orderWithItems.payments?.[0]?.method || "Card",
          items: orderWithItems.items.map((item: any) => ({
            name: item.name,
            quantity: item.quantity,
            price: Number(item.price) * item.quantity,
          })),
        },
      }).catch((err) => logger.error("Notification dispatch failed", { error: err }));

      // If free, send the gift link to the recipient immediately
      if (body.isGift && chargeAmount <= 0) {
        if (orderWithItems.giftToken && normalizedGiftRecipientPhone) {
          const { sendWhatsApp } = await import("../services/whatsapp");
          const { sendSMS } = await import("../services/sms");
          const addressUrl = `${process.env.FRONTEND_URL}/gift/${orderWithItems.giftToken}`;
          const senderLabel = body.senderName || "Someone special";
          const message = body.giftMessage
            ? `🎁 ${senderLabel} sent you a gift!\n\n"${body.giftMessage}"\n\nChoose where to deliver it (plain packaging, discreet):\n${addressUrl}`
            : `🎁 ${senderLabel} sent you a gift from PleasureZone!\n\nChoose your delivery address (plain packaging):\n${addressUrl}`;
          
          sendWhatsApp({ to: normalizedGiftRecipientPhone, text: message })
            .then((waSent) => {
              if (!waSent) sendSMS(normalizedGiftRecipientPhone!, message).catch(() => {});
            })
            .catch(() => {
              sendSMS(normalizedGiftRecipientPhone!, message).catch(() => {});
            });
        }
      }
    }

    // Mark abandoned cart as recovered
    if (req.user?.id) {
      markCartRecovered(req.user.id).catch(() => {});
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

    // Build a meaningful failure reason / code for admin review
    let reason = "Unknown error";
    let code = "INTERNAL";
    let statusCode = 500;
    let responseBody: Record<string, unknown> = { error: "Checkout failed" };

    if (error instanceof z.ZodError) {
      reason = "Validation failed: " + error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join("; ");
      code = "VALIDATION";
      statusCode = 400;
      responseBody = { error: "Validation failed", details: error.errors };
    } else if (error instanceof Error && error.message.includes("Insufficient stock")) {
      reason = "Insufficient stock for one or more items";
      code = "STOCK";
      statusCode = 400;
      responseBody = { error: "Insufficient stock for one or more items" };
    } else if (error instanceof Error && error.message.startsWith("INSTALLMENT_INELIGIBLE:")) {
      const eligibilityReason = error.message.replace("INSTALLMENT_INELIGIBLE:", "");
      reason = eligibilityReason;
      code = "ELIGIBILITY";
      statusCode = 400;
      responseBody = { error: eligibilityReason };
    } else if (error instanceof Error) {
      reason = error.message;
    }

    // Mark checkout attempt as failed (with reason)
    if (checkoutAttemptId) {
      await prisma.checkoutAttempt.update({
        where: { id: checkoutAttemptId },
        data: {
          status: "FAILED",
          failureReason: reason.slice(0, 500),
          failureCode: code,
        },
      }).catch(err => logger.error("Failed to update checkout attempt", { error: err }));
    }

    // Delete the idempotency Redis key to allow retry
    if (idempotencyKey) {
      const redisKey = `idempotency:checkout:${idempotencyKey}`;
      redis.del(redisKey).catch(() => {});
    }

    return res.status(statusCode).json(responseBody);
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
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: { include: { product: { select: { aliexpressProductId: true, cjProductId: true } } } },
        },
      });
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

        await confirmPaidOrder(tx, orderId, { order });
      });

      // Auto-place dropshipping orders only if order has dropship items
      const hasAliExpress = order.items.some((i: any) => i.product?.aliexpressProductId);
      const hasCJ = order.items.some((i: any) => i.product?.cjProductId);

      if (hasAliExpress || hasCJ) {
        if (!order.dispatchScheduledAt || new Date(order.dispatchScheduledAt) <= new Date()) {
          if (hasAliExpress) {
            placeAliExpressOrdersForOrder(orderId).catch((err) =>
              logger.error(`AliExpress auto-order failed for ${orderId}`, { error: err.message })
            );
          }
          if (hasCJ) {
            placeCJOrdersForOrder(orderId).catch((err) =>
              logger.error(`CJ auto-order failed for ${orderId}`, { error: err.message })
            );
          }
        } else {
          logger.info(`[Dropship] Delayed dispatch active for PayPal order ${orderId} until ${order.dispatchScheduledAt}. Held in queue.`);
        }
      }

      // Clear cart after payment confirmation
      // Note: Cart is cleared on the frontend upon redirect to success page

      // Redirect to success page
      return res.redirect(`${process.env.FRONTEND_URL || process.env.BASE_URL}/orders/${orderId}?success=true`);
    } else {
      // Payment not completed — release stock reservations
      await prisma.$transaction(async (tx) => {
        await tx.payment.updateMany({ where: { orderId }, data: { status: "FAILED" } });
        await tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED", paymentStatus: "FAILED" } });
        await releaseOrderStock(tx, orderId);
        const { refundStoreCreditForOrder } = await import("../utils/storeCredit");
        await refundStoreCreditForOrder(tx, orderId);
      });

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
        await tx.order.update({
          where: { id: orderId },
          data: { status: "CANCELLED", paymentStatus: "FAILED" },
        });

        await tx.payment.updateMany({
          where: { orderId, status: "PENDING" },
          data: { status: "FAILED" },
        });

        await releaseOrderStock(tx, orderId);

        const { refundStoreCreditForOrder } = await import("../utils/storeCredit");
        await refundStoreCreditForOrder(tx, orderId);
      });
    } catch (e) {
      logger.error("PayPal cancel cleanup error", { error: e });
    }
  }

  return res.redirect(`${process.env.FRONTEND_URL || process.env.BASE_URL}/checkout?error=payment_cancelled`);
}));

// GET /api/checkout/cancel — user cancelled on Flutterwave
// optionalAuth so logged-in users can be verified as the order owner.
// For guest orders, the orderId alone is sufficient (PENDING-only guard prevents abuse).
router.get("/cancel", optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const orderId = req.query.orderId as string;
  if (!orderId) {
    return res.redirect(`${process.env.FRONTEND_URL || process.env.BASE_URL}/checkout?error=payment_cancelled`);
  }
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payments: true } });
    if (!order || order.status !== "PENDING") {
      return res.redirect(`${process.env.FRONTEND_URL || process.env.BASE_URL}/checkout?error=payment_cancelled`);
    }
    // FIX C7: If user is authenticated, verify they own this order
    if (req.user) {
      const ownsOrder = order.userId === req.user.id || order.customerEmail === req.user.email;
      if (!ownsOrder) {
        logger.warn("cancel_ownership_mismatch", { userId: req.user.id, orderId });
        return res.redirect(`${process.env.FRONTEND_URL || process.env.BASE_URL}/checkout?error=payment_cancelled`);
      }
    }
    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED", paymentStatus: "FAILED" } });
      await tx.payment.updateMany({ where: { orderId, status: "PENDING" }, data: { status: "FAILED" } });
      await releaseOrderStock(tx, orderId);
      const { refundStoreCreditForOrder } = await import("../utils/storeCredit");
      await refundStoreCreditForOrder(tx, orderId);
    });
  } catch (e) {
    logger.error("Cancel cleanup error", { error: e });
  }
  return res.redirect(`${process.env.FRONTEND_URL || process.env.BASE_URL}/checkout?error=payment_cancelled`);
}));

// GET /api/checkout/eligibility/installments — Check if user is eligible for installments
router.get("/eligibility/installments", optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user?.id) {
    return res.json({ eligible: false, reason: "Please log in to check installment eligibility." });
  }
  const result = await checkInstallmentEligibility(req.user.id);
  return res.json(result);
}));

// GET /api/checkout/split/:orderId — Fetch split payment details
// FIX C6: Require either authenticated order owner or correct split partner phone via query param
router.get("/split/:orderId", optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { orderId } = req.params;
  const partnerPhone = (req.query.phone as string || "").trim();
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        isSplitPayment: true,
        splitShowItems: true,
        splitPaidAmount: true,
        splitPartnerPhone: true,
        splitPartnerPaid: true,
        currency: true,
        customerName: true,
        status: true,
        userId: true,
        customerEmail: true,
        items: {
          select: {
            id: true,
            name: true,
            quantity: true,
            price: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Verify access: must be the order owner OR the split partner
    const isOwner = req.user && (req.user.id === order.userId || req.user.email === order.customerEmail);
    const isPartner = order.splitPartnerPhone && partnerPhone &&
      order.splitPartnerPhone.replace(/\s+/g, "") === partnerPhone.replace(/\s+/g, "");

    if (!isOwner && !isPartner) {
      return res.status(403).json({ error: "Access denied. Provide your registered phone number to access this split payment." });
    }

    const { items, userId, customerEmail, ...orderData } = order;
    return res.json({
      order: {
        ...orderData,
        items: order.splitShowItems ? items : undefined,
      },
    });
  } catch (error) {
    logger.error("Fetch split order details error", { error });
    return res.status(500).json({ error: "Failed to fetch split order details" });
  }
}));

// POST /api/checkout/split/:orderId/pay — Pay second half of split payment
// FIX C6: Require authenticated owner OR matching split partner phone to initiate payment
router.post("/split/:orderId/pay", optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { orderId } = req.params;
  const { paymentMethod, mobileMoney, partnerPhone } = z.object({
    paymentMethod: z.enum(["card", "mobile_money"]).default("card"),
    mobileMoney: z.object({
      network: z.enum(["MTN", "AIRTEL"]),
      phone: z.string(),
    }).optional(),
    // Partner provides their phone for verification when not authenticated
    partnerPhone: z.string().optional(),
  }).parse(req.body || {});

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });

    if (!order || !order.isSplitPayment) {
      return res.status(404).json({ error: "Order not found or is not a split payment" });
    }

    if (order.status === "CANCELLED") {
      return res.status(400).json({ error: "This payment link has expired. The order was cancelled because payment was not completed within the 15-minute reservation window." });
    }

    if (order.splitPartnerPaid) {
      return res.status(400).json({ error: "Split payment has already been completed" });
    }

    // FIX C6: Verify access — must be authenticated order owner OR matching split partner phone
    const isOwner = req.user && (req.user.id === order.userId || req.user.email === order.customerEmail);
    const verifyPhone = partnerPhone || mobileMoney?.phone || "";
    const isPartner = order.splitPartnerPhone && verifyPhone &&
      order.splitPartnerPhone.replace(/\s+/g, "") === verifyPhone.replace(/\s+/g, "");

    if (!isOwner && !isPartner) {
      logger.warn("split_pay_unauthorized", { orderId, userId: req.user?.id });
      return res.status(403).json({ error: "Access denied. You must be the split partner to complete this payment." });
    }

    const remainingAmount = Number(order.totalAmount) - Number(order.splitPaidAmount);
    if (remainingAmount <= 0) {
      return res.status(400).json({ error: "No remaining balance to pay" });
    }

    const flwRef = `pay-split-partner-${order.id}-${Date.now()}`;

    // Convert remainingAmount to target currency for payment gateway
    let targetRemainingAmount = remainingAmount;
    if (order.currency && order.currency !== "UGX") {
      const dbCurrency = await prisma.currency.findUnique({
        where: { code: order.currency, isActive: true },
      });
      if (dbCurrency && Number(dbCurrency.exchangeRate) > 0) {
        targetRemainingAmount = Math.round(remainingAmount * Number(dbCurrency.exchangeRate));
      }
    }

    // Create payment record
    await prisma.payment.create({
      data: {
        orderId: order.id,
        amount: targetRemainingAmount,
        currency: order.currency,
        provider: "flutterwave",
        method: paymentMethod === "card" ? "CARD" : "MOBILE_MONEY",
        status: "PENDING",
        flwRef,
      },
    });

    // Request partner payment
    const paymentResponse = await createFlutterwavePayment({
      tx_ref: `split-part-${order.id}`, // Custom prefix to distinguish from initiator
      amount: targetRemainingAmount,
      currency: order.currency,
      paymentMethod,
      mobileMoney: mobileMoney ? {
        network: mobileMoney.network,
        phone: mobileMoney.phone,
      } : undefined,
      customer: {
        name: "Split Partner",
        email: order.customerEmail || "split-partner@ugsex.com",
      },
      redirect_url: `${process.env.FRONTEND_URL || process.env.BASE_URL}/checkout/success?orderId=${order.id}`,
    });

    return res.json({
      paymentLink: paymentResponse.data?.link,
      flwRef,
    });
  } catch (error: any) {
    logger.error("Initiate split partner payment error", { error });
    return res.status(500).json({ error: error.message || "Failed to initiate split payment" });
  }
}));

async function checkInstallmentEligibility(userId: string): Promise<{ eligible: boolean; reason?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user) {
    return { eligible: false, reason: "User not found" };
  }

  // 1. Must have been on the platform 60 days
  const accountAgeInDays = (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  if (accountAgeInDays < 60) {
    return { eligible: false, reason: "Account must be at least 60 days old." };
  }

  // 2. Completed 10 orders
  const completedOrders = await prisma.order.findMany({
    where: {
      userId,
      status: { in: ["CONFIRMED", "DELIVERED"] },
      paymentStatus: "SUCCESSFUL",
    },
    select: { totalAmount: true, createdAt: true },
  });

  if (completedOrders.length < 10) {
    return { eligible: false, reason: `Requires at least 10 completed orders to qualify (you have completed ${completedOrders.length}).` };
  }

  // 3. Must have spent 1,000,000 in cumulative orders over the last 6 months
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  const sixMonthsOrders = completedOrders.filter(o => new Date(o.createdAt) >= sixMonthsAgo);
  const totalSpentSixMonths = sixMonthsOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
  
  if (totalSpentSixMonths < 1000000) {
    return { 
      eligible: false, 
      reason: `Cumulative spend in the last 6 months must be at least UGX 1,000,000 (your spend: UGX ${totalSpentSixMonths.toLocaleString()}).` 
    };
  }

  // 4. Drop check: if after 3 months, the spend drops by 90%
  // Spend in the last 3 months (days 0-90) vs preceding 3 months (days 91-180)
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const spendRecent = sixMonthsOrders
    .filter(o => new Date(o.createdAt) >= threeMonthsAgo)
    .reduce((sum, o) => sum + Number(o.totalAmount), 0);
    
  const spendPrevious = sixMonthsOrders
    .filter(o => new Date(o.createdAt) < threeMonthsAgo)
    .reduce((sum, o) => sum + Number(o.totalAmount), 0);

  if (spendPrevious > 0) {
    const dropPercentage = ((spendPrevious - spendRecent) / spendPrevious) * 100;
    if (dropPercentage >= 90) {
      return { 
        eligible: false, 
        reason: `Your order spend has dropped by ${dropPercentage.toFixed(1)}% (90%+) in the last 3 months. You must requalify.` 
      };
    }
  }

  return { eligible: true };
}

export default router;
