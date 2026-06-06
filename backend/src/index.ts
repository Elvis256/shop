import "./lib/validateEnv"; // Must be first — loads .env and validates
import express from "express";
import compression from "compression";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import logger, { requestIdMiddleware, requestLogMiddleware } from "./lib/logger";
import prisma from "./lib/prisma";
import redis from "./lib/redis";

// Global error handlers — prevent silent crashes
process.on("unhandledRejection", (reason) => {
  logger.error("unhandled_rejection", { error: String(reason) });
});
process.on("uncaughtException", (err) => {
  logger.error("uncaught_exception", { error: err.message, stack: err.stack });
  // Give time to flush logs, then exit
  setTimeout(() => process.exit(1), 1000);
});

// Routes
import authRoutes from "./routes/auth";
import socialAuthRoutes from "./routes/socialAuth";
import checkoutRoutes from "./routes/checkout";
import webhookRoutes from "./routes/webhooks";
import ordersRoutes from "./routes/orders";
import productsRoutes from "./routes/products";
import categoriesRoutes from "./routes/categories";
import cartRoutes from "./routes/cart";
import wishlistRoutes from "./routes/wishlist";
import reviewsRoutes from "./routes/reviews";
import searchRoutes from "./routes/search";
import couponsRoutes from "./routes/coupons";
import addressesRoutes from "./routes/addresses";
import newsletterRoutes from "./routes/newsletter";
import blogRoutes from "./routes/blog";
import giftcardsRoutes from "./routes/giftcards";
import bannersRoutes from "./routes/banners";
import currenciesRoutes from "./routes/currencies";
import mobileMoneyRoutes from "./routes/mobilemoney";
import returnsRoutes from "./routes/returns";
import ticketsRoutes from "./routes/tickets";
import loyaltyRoutes from "./routes/loyalty";
import referralsRoutes from "./routes/referrals";
import twoFactorRoutes from "./routes/twoFactor";
import invoicesRoutes from "./routes/invoices";
import analyticsRoutes from "./routes/analytics";
import recommendationsRoutes from "./routes/recommendations";
import affiliateRoutes from "./routes/affiliate";
import priceTierRoutes from "./routes/priceTiers";
import bundleRoutes from "./routes/bundles";
import storeCreditRoutes from "./routes/storeCredit";
import backInStockRoutes from "./routes/backInStock";
import productQARoutes from "./routes/productQA";
import installmentsRoutes from "./routes/installments";
import subscriptionsRoutes from "./routes/subscriptions";
import pushNotificationsRoutes from "./routes/pushNotifications";
import browseTrackingRoutes from "./routes/browseTracking";
import webhookEndpointsRoutes from "./routes/webhookEndpoints";
import dailyDealRoutes from "./routes/dailyDeal";
import socialRoutes from "./routes/social";
import sellerRoutes from "./routes/seller";
import sellerAuthRoutes from "./routes/sellerAuth";
import chatRoutes from "./routes/chat";
import developerApiRoutes from "./routes/developerApi";
import registryRoutes from "./routes/registry";
import giftOrderRoutes from "./routes/giftOrder";
import advisorRoutes from "./routes/advisor";
import broadcastRoutes from "./routes/broadcast";
import smartBundlesRoutes from "./routes/smartBundles";
import whatsappBotRoutes from "./routes/whatsappBot";
import ussdRoutes from "./routes/ussd";
import diasporaRoutes from "./routes/diaspora";
import countryConfigRoutes from "./routes/countryConfig";
import localCourierRoutes from "./routes/localCourier";
import priceDropAlertsRoutes from "./routes/priceDropAlerts";
import sellerAdsRoutes from "./routes/sellerAds";
import pickupPointsRoutes from "./routes/pickupPoints";
import supportChatRoutes from "./routes/supportChat";
import deliveryRoutes from "./routes/delivery";
import quickReorderRoutes from "./routes/quickReorder";
import layawayRoutes from "./routes/layaway";

// Admin routes
import adminDashboard from "./routes/admin/dashboard";
import adminProducts from "./routes/admin/products";
import adminOrders from "./routes/admin/orders";
import adminCustomers from "./routes/admin/customers";
import adminCoupons from "./routes/admin/coupons";
import adminCategories from "./routes/admin/categories";
import adminSettings from "./routes/admin/settings";
import adminBlog from "./routes/admin/blog";
import adminShipping from "./routes/admin/shipping";
import adminAffiliates from "./routes/admin/affiliates";
import adminAliexpress from "./routes/admin/aliexpress";
import adminCJ from "./routes/admin/cjdropshipping";
import adminUpload from "./routes/admin/upload";
import adminStaff from "./routes/adminStaff";
import adminActivity from "./routes/adminActivity";
import adminAuthRoutes from "./routes/adminAuth";
import adminSocialRoutes from "./routes/adminSocial";
import adminApiKeys from "./routes/admin/apiKeys";
import adminSellers from "./routes/admin/sellers";
import adminPermissions from "./routes/admin/permissions";
import adminProductModeration from "./routes/admin/productModeration";
import adminMessages from "./routes/admin/messages";
import adminAds from "./routes/admin/ads";
import adminDisputes from "./routes/admin/disputes";
import adminSellerBadges from "./routes/admin/sellerBadges";
import adminAbandonedCarts from "./routes/admin/abandonedCarts";
import disputesRoutes from "./routes/disputes";
import settingsRoutes from "./routes/settings";

// Middleware
import { setupSecurity } from "./middleware/security";
import { setupHealthChecks } from "./middleware/monitoring";
import { errorHandler, asyncHandler } from "./middleware/errorHandler";
import { suspiciousActivityMiddleware } from "./middleware/securityEvents";

const app = express();
const PORT = process.env.PORT || 4000;

// Request ID + structured logging
app.use(requestIdMiddleware);
app.use(requestLogMiddleware);

// Security middleware
setupSecurity(app);

// Suspicious activity detection (must be before other middleware that parse body)
app.use(suspiciousActivityMiddleware);

// CORS - Allow multiple origins for development and production
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [
      "https://ugsex.com",
      "https://www.ugsex.com",
      process.env.FRONTEND_URL,
    ].filter(Boolean) as string[]
  : [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5000",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:5000",
      "http://192.168.1.250:5000",
      "https://ugsex.com",
      "https://www.ugsex.com",
      process.env.FRONTEND_URL,
    ].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin ONLY in development (blocks CSRF in production)
    if (!origin) {
      if (process.env.NODE_ENV === "production") {
        return callback(null, false);
      }
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
}));

// Response compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Cookie parsing
app.use(cookieParser());

// CSRF protection
import { setCsrfToken, validateCsrf, csrfTokenHandler } from "./middleware/csrf";
app.use(setCsrfToken);
app.get("/api/csrf-token", csrfTokenHandler);

// Developer API (API key auth, no CSRF needed)
app.use("/api/v1", developerApiRoutes);

app.use("/api", validateCsrf);

// Static files (uploads) — with security headers
app.use("/uploads", (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; style-src 'none'; script-src 'none'");
  // Force download for non-image files
  const ext = path.extname(req.path).toLowerCase();
  if (![".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".svg", ".ico"].includes(ext)) {
    res.setHeader("Content-Disposition", "attachment");
  }
  next();
}, express.static(path.join(__dirname, "../uploads")));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/auth", socialAuthRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/coupons", couponsRoutes);
app.use("/api/addresses", addressesRoutes);
app.use("/api/newsletter", newsletterRoutes);
app.use("/api/blog", blogRoutes);
app.use("/api/gift-cards", giftcardsRoutes);
app.use("/api/banners", bannersRoutes);
app.use("/api/currencies", currenciesRoutes);
app.use("/api/mobile-money", mobileMoneyRoutes);
app.use("/api/returns", returnsRoutes);
app.use("/api/tickets", ticketsRoutes);
app.use("/api/loyalty", loyaltyRoutes);
app.use("/api/referrals", referralsRoutes);
app.use("/api/2fa", twoFactorRoutes);
app.use("/api/invoices", invoicesRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/recommendations", recommendationsRoutes);
app.use("/api/affiliate", affiliateRoutes);
app.use("/api/notify", backInStockRoutes);
app.use("/api/qa", productQARoutes);
app.use("/api/bundles", bundleRoutes);
app.use("/api/store-credit", storeCreditRoutes);
app.use("/api/price-tiers", priceTierRoutes);
app.use("/api/installments", installmentsRoutes);
app.use("/api/subscriptions", subscriptionsRoutes);
app.use("/api/push", pushNotificationsRoutes);
app.use("/api/browse", browseTrackingRoutes);
app.use("/api/webhooks/endpoints", webhookEndpointsRoutes);
app.use("/api/daily-deal", dailyDealRoutes);
app.use("/api/social", socialRoutes);
app.use("/api/seller/auth", sellerAuthRoutes);
app.use("/api/seller/ads", sellerAdsRoutes);
app.use("/api/seller", sellerRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/registry", registryRoutes);
app.use("/api/gift", giftOrderRoutes);
app.use("/api/advisor", advisorRoutes);
app.use("/api/broadcast", broadcastRoutes);
app.use("/api/smart-bundles", smartBundlesRoutes);
app.use("/api/whatsapp-bot", whatsappBotRoutes);
app.use("/api/ussd", ussdRoutes);
// Diaspora webhook needs raw body for Stripe signature verification
app.use("/api/diaspora/webhook", express.raw({ type: "application/json" }));
app.use("/api/diaspora", diasporaRoutes);
app.use("/api/country-config", countryConfigRoutes);
app.use("/api/courier", localCourierRoutes);
app.use("/api/price-alerts", priceDropAlertsRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/quick-reorder", quickReorderRoutes);
app.use("/api/layaway", layawayRoutes);

// Admin Routes
app.use("/api/admin/dashboard", adminDashboard);
app.use("/api/admin/products", adminProducts);
app.use("/api/admin/orders", adminOrders);
app.use("/api/admin/customers", adminCustomers);
app.use("/api/admin/coupons", adminCoupons);
app.use("/api/admin/categories", adminCategories);
app.use("/api/admin/settings", adminSettings);
app.use("/api/admin/blog", adminBlog);
app.use("/api/admin/shipping-zones", adminShipping);
app.use("/api/admin/affiliates", adminAffiliates);
app.use("/api/admin/aliexpress", adminAliexpress);
app.use("/api/admin/cj", adminCJ);
app.use("/api/admin/upload", adminUpload);
app.use("/api/admin/staff", adminStaff);
app.use("/api/admin/activity", adminActivity);
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/social", adminSocialRoutes);
app.use("/api/admin/api-keys", adminApiKeys);
app.use("/api/admin/sellers", adminSellers);
app.use("/api/admin/permissions", adminPermissions);
app.use("/api/admin/product-moderation", adminProductModeration);
app.use("/api/admin/messages", adminMessages);
app.use("/api/admin/ads", adminAds);
app.use("/api/admin/disputes", adminDisputes);
app.use("/api/admin/seller-badges", adminSellerBadges);
app.use("/api/admin/abandoned-carts", adminAbandonedCarts);
app.use("/api/pickup-points", pickupPointsRoutes);
app.use("/api/support-chat", supportChatRoutes);
app.use("/api/disputes", disputesRoutes);
app.use("/api/settings", settingsRoutes);

// Health check endpoints — comprehensive monitoring
setupHealthChecks(app);

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

const server = app.listen(Number(PORT), "0.0.0.0", () => {
  logger.info("server_started", { port: PORT });

  // Background jobs — with error handling
  const startJob = (name: string, importFn: Promise<any>, startFn: string) => {
    importFn
      .then((mod) => { mod[startFn](); logger.info("job_started", { job: name }); })
      .catch((err) => logger.error("job_start_failed", { job: name, error: err.message }));
  };

  startJob("stock_reservation_cleanup", import("./utils/stockReservation"), "startReservationCleanup");
  startJob("abandoned_cart_emails", import("./services/abandonedCart"), "startAbandonedCartJob");
  startJob("exchange_rate_refresh", import("./services/exchangeRates"), "startRateRefreshJob");
  startJob("aliexpress_tracking_sync", import("./services/aliexpressSync"), "startTrackingSyncJob");
  startJob("aliexpress_price_sync", import("./services/aliexpressSync"), "startPriceSyncJob");
  startJob("cj_tracking_sync", import("./services/cjSync"), "startCJTrackingSyncJob");
  startJob("cj_price_sync", import("./services/cjSync"), "startCJPriceSyncJob");
  startJob("review_requests", import("./services/reviewRequests"), "startReviewRequestJob");
  startJob("restock_reminders", import("./services/restockReminder"), "startRestockReminderJob");
  startJob("subscription_boxes", import("./services/subscriptionBoxes"), "startSubscriptionBoxJob");
  startJob("smart_reorder", import("./services/smartReorder"), "startSmartReorderJob");
  startJob("seller_tiers", import("./scripts/evaluateSellerTiers"), "startSellerTierJob");
  startJob("ad_billing", import("./services/adBilling"), "startAdBillingJob");
  startJob("installment_reminders", import("./services/installmentReminders"), "startInstallmentReminderJob");
  startJob("layaway_reminders", import("./services/layawayReminders"), "startLayawayReminderJob");

  // Track interval handles for graceful shutdown
  const intervalHandles: NodeJS.Timeout[] = [];

  // Private order history cleanup — runs daily
  intervalHandles.push(setInterval(async () => {
    try {
      const users = await prisma.user.findMany({
        where: { orderHistoryDays: { not: null } },
        select: { id: true, orderHistoryDays: true },
      });
      for (const user of users) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - user.orderHistoryDays!);
        await prisma.order.updateMany({
          where: { userId: user.id, createdAt: { lt: cutoff }, status: { in: ["DELIVERED", "CANCELLED"] } },
          data: { userId: null }, // Anonymise: detach from user, keep for admin
        });
      }
    } catch (err: any) {
      logger.error("order_history_cleanup_failed", { error: err.message });
    }
  }, 24 * 60 * 60 * 1000));

  // Guest data auto-delete cleanup — runs daily
  intervalHandles.push(setInterval(async () => {
    try {
      const result = await prisma.order.updateMany({
        where: {
          guestDataExpiresAt: { lt: new Date() },
          userId: null,
          status: { in: ["DELIVERED", "CANCELLED"] },
          customerName: { not: "Guest" },
        },
        data: {
          customerName: "Guest",
          customerEmail: "deleted",
          customerPhone: "deleted",
          shippingAddress: "{}",
        },
      });
      if (result.count > 0) {
        logger.info("guest_data_cleanup", { anonymized: result.count });
      }
    } catch (err: any) {
      logger.error("guest_data_cleanup_failed", { error: err.message });
    }
  }, 24 * 60 * 60 * 1000));

  // Expired refresh token cleanup — every 6 hours
  intervalHandles.push(setInterval(async () => {
    try {
      const result = await prisma.refreshToken.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      if (result.count > 0) {
        logger.info("token_cleanup", { deleted: result.count });
      }
    } catch (err: any) {
      logger.error("token_cleanup_failed", { error: err.message });
    }
  }, 6 * 60 * 60 * 1000));
  // Run once on startup after 30s
  setTimeout(async () => {
    try {
      await prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    } catch {}
  }, 30_000);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info("shutdown_initiated", { signal });
    server.close(async () => {
      // Stop all background interval jobs
      for (const handle of intervalHandles) clearInterval(handle);
      await prisma.$disconnect().catch(() => {});
      await redis.quit().catch(() => {});
      logger.info("shutdown_complete");
      process.exit(0);
    });
    // Force exit if graceful shutdown takes too long
    setTimeout(() => {
      logger.error("shutdown_forced");
      process.exit(1);
    }, 30_000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
});
