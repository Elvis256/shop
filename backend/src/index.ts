import express from "express";
import cors from "cors";
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

// Admin routes
import adminDashboard from "./routes/admin/dashboard";
import adminProducts from "./routes/admin/products";
import adminOrders from "./routes/admin/orders";
import adminCustomers from "./routes/admin/customers";
import adminCoupons from "./routes/admin/coupons";
import adminCategories from "./routes/admin/categories";
import adminSettings from "./routes/admin/settings";

// Middleware
import { setupSecurity } from "./middleware/security";

const app = express();
const PORT = process.env.PORT || 4000;

// Security middleware
setupSecurity(app);

// CORS
app.use(cors({
  origin: process.env.BASE_URL || "http://localhost:3000",
  credentials: true,
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Admin Routes
app.use("/api/admin/dashboard", adminDashboard);
app.use("/api/admin/products", adminProducts);
app.use("/api/admin/orders", adminOrders);
app.use("/api/admin/customers", adminCustomers);
app.use("/api/admin/coupons", adminCoupons);
app.use("/api/admin/categories", adminCategories);
app.use("/api/admin/settings", adminSettings);

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

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Admin panel: ${process.env.BASE_URL || "http://localhost:3000"}/admin`);
});
