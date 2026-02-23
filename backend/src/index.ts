import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config();

// Routes
import authRoutes from "./routes/auth";
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

// Admin routes
import adminDashboard from "./routes/admin/dashboard";
import adminProducts from "./routes/admin/products";
import adminOrders from "./routes/admin/orders";
import adminCustomers from "./routes/admin/customers";
import adminCoupons from "./routes/admin/coupons";
import adminCategories from "./routes/admin/categories";
import adminSettings from "./routes/admin/settings";
import adminStaff from "./routes/adminStaff";
import adminActivity from "./routes/adminActivity";
import adminAuthRoutes from "./routes/adminAuth";

// Middleware
import { setupSecurity } from "./middleware/security";

const app = express();
const PORT = process.env.PORT || 4000;

// Security middleware
setupSecurity(app);

// CORS - Allow multiple origins for development
const allowedOrigins = [
  process.env.BASE_URL || "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5000",
  "http://localhost:8080",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5000",
  `http://100.83.8.43:5000`,
  `http://192.168.1.250:5000`,
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parsing
app.use(cookieParser());

// CSRF protection
import { setCsrfToken, validateCsrf, csrfTokenHandler } from "./middleware/csrf";
app.use(setCsrfToken);
app.get("/api/csrf-token", csrfTokenHandler);
app.use("/api", validateCsrf);

// Static files (uploads)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// API Routes
app.use("/api/auth", authRoutes);
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

// Admin Routes
app.use("/api/admin/dashboard", adminDashboard);
app.use("/api/admin/products", adminProducts);
app.use("/api/admin/orders", adminOrders);
app.use("/api/admin/customers", adminCustomers);
app.use("/api/admin/coupons", adminCoupons);
app.use("/api/admin/categories", adminCategories);
app.use("/api/admin/settings", adminSettings);
app.use("/api/admin/staff", adminStaff);
app.use("/api/admin/activity", adminActivity);
app.use("/api/admin/auth", adminAuthRoutes);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handling
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Admin panel: ${process.env.BASE_URL || "http://localhost:3000"}/admin`);
  
  // Start stock reservation cleanup job
  import("./utils/stockReservation").then(({ startReservationCleanup }) => {
    startReservationCleanup();
  });
  
  // Start abandoned cart email job
  import("./services/abandonedCart").then(({ startAbandonedCartJob }) => {
    startAbandonedCartJob();
  });

  // Start real-time exchange rate refresh job
  import("./services/exchangeRates").then(({ startRateRefreshJob }) => {
    startRateRefreshJob();
  });
});
