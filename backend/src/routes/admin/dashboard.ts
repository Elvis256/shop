import { Router, Response } from "express";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { asyncHandler } from "../../middleware/errorHandler";
import { cacheGetOrSet, SHORT_TTL } from "../../lib/cache";

const router = Router();

router.use(authenticate, requireAdmin);

// Cache dashboard stats for 60s to avoid hammering DB on frequent admin refreshes
const DASH_CACHE_TTL = 60;

// GET /api/admin/dashboard
router.get("/", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const cacheKey = "admin:dashboard";
    const cached = await cacheGetOrSet(cacheKey, async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      const [
        totalOrders, monthOrders, lastMonthOrders,
        totalRevenue, monthRevenue, lastMonthRevenue,
        totalCustomers, newCustomers,
        totalProducts, lowStockProducts,
        recentOrders, topProducts, ordersByStatus,
      ] = await Promise.all([
        prisma.order.count({ where: { status: { notIn: ["CANCELLED", "REFUNDED"] } } }),
        prisma.order.count({ where: { status: { notIn: ["CANCELLED", "REFUNDED"] }, createdAt: { gte: startOfMonth } } }),
        prisma.order.count({ where: { status: { notIn: ["CANCELLED", "REFUNDED"] }, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
        prisma.order.aggregate({ where: { status: { notIn: ["CANCELLED", "REFUNDED"] } }, _sum: { totalAmount: true } }),
        prisma.order.aggregate({ where: { status: { notIn: ["CANCELLED", "REFUNDED"] }, createdAt: { gte: startOfMonth } }, _sum: { totalAmount: true } }),
        prisma.order.aggregate({ where: { status: { notIn: ["CANCELLED", "REFUNDED"] }, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } }, _sum: { totalAmount: true } }),
        prisma.user.count({ where: { role: "CUSTOMER" } }),
        prisma.user.count({ where: { role: "CUSTOMER", createdAt: { gte: startOfMonth } } }),
        prisma.product.count({ where: { status: "ACTIVE" } }),
        prisma.product.count({ where: { status: "ACTIVE", trackInventory: true, stock: { lte: 5 } } }),
        prisma.order.findMany({
          take: 10, orderBy: { createdAt: "desc" },
          select: { id: true, orderNumber: true, customerName: true, totalAmount: true, status: true, paymentStatus: true, createdAt: true },
        }),
        prisma.orderItem.groupBy({
          by: ["productId"],
          where: { order: { status: { notIn: ["CANCELLED", "REFUNDED"] } } },
          _sum: { quantity: true },
          orderBy: { _sum: { quantity: "desc" } },
          take: 5
        }),
        prisma.order.groupBy({ by: ["status"], _count: { status: true } }),
      ]);

      const topProductIds = topProducts.map((p) => p.productId);
      const productDetails = await prisma.product.findMany({
        where: { id: { in: topProductIds } },
        select: { id: true, name: true, price: true },
      });

      const topProductsWithDetails = topProducts.map((tp) => {
        const product = productDetails.find((p) => p.id === tp.productId);
        return { productId: tp.productId, name: product?.name || "Unknown", price: product?.price || 0, soldCount: tp._sum.quantity || 0 };
      });

      // Revenue breakdown with SQL aggregation
      const [
        directRevenueResult,
        totalCommissions, commissionsThisMonth,
        pendingPayouts, activeVendors, pendingVendors, vendorProductCount,
      ] = await Promise.all([
        prisma.$queryRaw<[{ total: bigint | null, month: bigint | null }]>`
          SELECT
            COALESCE(SUM(oi.price * oi.quantity), 0) as total,
            COALESCE(SUM(CASE WHEN o."createdAt" >= ${startOfMonth} THEN oi.price * oi.quantity ELSE 0 END), 0) as month
          FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
          WHERE oi."sellerId" IS NULL AND o."status" NOT IN ('CANCELLED', 'REFUNDED')`,
        prisma.orderItem.aggregate({ where: { sellerId: { not: null }, commission: { not: null }, order: { status: { notIn: ["CANCELLED", "REFUNDED"] } } }, _sum: { commission: true, price: true } }),
        prisma.orderItem.aggregate({ where: { sellerId: { not: null }, commission: { not: null }, order: { status: { notIn: ["CANCELLED", "REFUNDED"] }, createdAt: { gte: startOfMonth } } }, _sum: { commission: true, price: true } }),
        prisma.sellerPayout.aggregate({ where: { status: { in: ["PENDING", "PROCESSING"] } }, _sum: { amount: true }, _count: true }),
        prisma.seller.count({ where: { status: "APPROVED" } }),
        prisma.seller.count({ where: { status: "PENDING" } }),
        prisma.product.count({ where: { sellerId: { not: null }, status: "ACTIVE" } }),
      ]);

      const drr = directRevenueResult?.[0];
      const directRevenueTotal = Number(drr?.total || 0);
      const directRevenueMonth = Number(drr?.month || 0);
      const totalCommissionAmount = Number(totalCommissions._sum.commission || 0);
      const monthCommissionAmount = Number(commissionsThisMonth._sum.commission || 0);
      const vendorGrossSalesTotal = Number(totalCommissions._sum.price || 0);
      const vendorGrossSalesMonth = Number(commissionsThisMonth._sum.price || 0);

      // Dropshipping + category stats
      const [cjProducts, aeProducts, localProducts, productsByCategory] = await Promise.all([
        prisma.product.count({ where: { cjProductId: { not: null }, status: "ACTIVE" } }),
        prisma.product.count({ where: { aliexpressProductId: { not: null }, status: "ACTIVE" } }),
        prisma.product.count({ where: { cjProductId: null, aliexpressProductId: null, status: "ACTIVE" } }),
        prisma.product.groupBy({ by: ["categoryId"], where: { status: "ACTIVE" }, _count: { id: true } }),
      ]);

      const catIds = productsByCategory.map((p) => p.categoryId).filter(Boolean) as string[];
      const categories = await prisma.category.findMany({ where: { id: { in: catIds } }, select: { id: true, name: true } });
      const catMap = new Map(categories.map((c) => [c.id, c.name]));

      const categoryBreakdown = productsByCategory
        .map((p) => ({ category: p.categoryId ? catMap.get(p.categoryId) || "Unknown" : "Uncategorized", count: p._count.id }))
        .sort((a, b) => b.count - a.count);

      const orderGrowth = lastMonthOrders > 0 ? ((monthOrders - lastMonthOrders) / lastMonthOrders) * 100 : 0;
      const currentRev = Number(monthRevenue._sum?.totalAmount) || 0;
      const lastRev = Number(lastMonthRevenue._sum?.totalAmount) || 0;
      const revenueGrowth = lastRev > 0 ? ((currentRev - lastRev) / lastRev) * 100 : 0;

      return {
        stats: {
          orders: { total: totalOrders, thisMonth: monthOrders, growth: Math.round(orderGrowth * 10) / 10 },
          revenue: { total: Number(totalRevenue._sum?.totalAmount) || 0, thisMonth: currentRev, growth: Math.round(revenueGrowth * 10) / 10, currency: "UGX" },
          customers: { total: totalCustomers, newThisMonth: newCustomers },
          products: { total: totalProducts, lowStock: lowStockProducts, cjDropshipping: cjProducts, aliexpress: aeProducts, local: localProducts, categoryBreakdown },
        },
        ordersByStatus: ordersByStatus.reduce((acc, item) => { acc[item.status] = item._count.status; return acc; }, {} as Record<string, number>),
        recentOrders,
        topProducts: topProductsWithDetails,
        marketplace: {
          directRevenue: { total: directRevenueTotal, thisMonth: directRevenueMonth },
          commissionRevenue: { total: totalCommissionAmount, thisMonth: monthCommissionAmount },
          vendorGrossSales: { total: vendorGrossSalesTotal, thisMonth: vendorGrossSalesMonth },
          platformRevenue: { total: directRevenueTotal + totalCommissionAmount, thisMonth: directRevenueMonth + monthCommissionAmount },
          pendingPayouts: { amount: Number(pendingPayouts._sum.amount || 0), count: pendingPayouts._count || 0 },
          vendors: { active: activeVendors, pending: pendingVendors },
          vendorProducts: vendorProductCount,
        },
      };
    }, DASH_CACHE_TTL);

    return res.json(cached);
  } catch (error) {
    logger.error("Dashboard error", { error });
    return res.status(500).json({ error: "Failed to load dashboard" });
  }
}));

// GET /api/admin/analytics — Rewritten with SQL aggregation (no unbounded findMany)
router.get("/analytics", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { period = "30" } = req.query;
    const days = parseInt(period as string) || 30;
    const startDate = new Date();
    if (days === 1) {
      startDate.setUTCHours(0, 0, 0, 0);
    } else {
      startDate.setDate(startDate.getDate() - days);
    }

    const previousStartDate = new Date(startDate);
    if (days === 1) {
      previousStartDate.setDate(previousStartDate.getDate() - 1);
    } else {
      previousStartDate.setDate(previousStartDate.getDate() - days);
    }

    const cacheKey = `admin:analytics:${days}`;
    const result = await cacheGetOrSet(cacheKey, async () => {

      // ── Daily order data via SQL aggregation ──────────────────
      const dailyOrders = await prisma.$queryRaw<Array<{
        day: string; revenue: number; orders: number; collected: number;
      }>>`
        SELECT
          TO_CHAR("createdAt", 'YYYY-MM-DD') as day,
          COALESCE(SUM("totalAmount"::numeric), 0)::float8 as revenue,
          COUNT(*)::int as orders,
          COALESCE(SUM(CASE WHEN "paymentStatus" = 'SUCCESSFUL' THEN "totalAmount"::numeric ELSE 0 END), 0)::float8 as collected
        FROM "Order"
        WHERE "createdAt" >= ${startDate}
          AND "status" NOT IN ('CANCELLED', 'REFUNDED')
        GROUP BY TO_CHAR("createdAt", 'YYYY-MM-DD')
        ORDER BY day`;

      // ── Visitor data via SQL aggregation ──────────────────────
      const dailyVisitors = await prisma.$queryRaw<Array<{
        day: string; visitors: number; page_views: number;
      }>>`
        SELECT
          TO_CHAR("createdAt", 'YYYY-MM-DD') as day,
          COUNT(DISTINCT COALESCE("sessionId", id::text))::int as visitors,
          COUNT(*)::int as page_views
        FROM "PageView"
        WHERE "createdAt" >= ${startDate}
        GROUP BY TO_CHAR("createdAt", 'YYYY-MM-DD')
        ORDER BY day`;

      // Merge into daily data
      const orderMap = new Map(dailyOrders.map(d => [d.day, d]));
      const visitorMap = new Map(dailyVisitors.map(d => [d.day, d]));
      const allDays = new Set([...orderMap.keys(), ...visitorMap.keys()]);

      // Fill in missing days
      const bucketCount = days === 1 ? 1 : days + 1;
      for (let i = 0; i < bucketCount; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        allDays.add(d.toISOString().split("T")[0]);
      }

      const dailyData = Array.from(allDays).sort().map(date => {
        const o = orderMap.get(date);
        const v = visitorMap.get(date);
        return {
          date,
          revenue: o?.revenue || 0,
          orders: o?.orders || 0,
          collected: o?.collected || 0,
          visitors: v?.visitors || 0,
        };
      });

      // ── Aggregate traffic stats via SQL ──────────────────────
      const [trafficStats] = await prisma.$queryRaw<[{
        total_visitors: number; total_page_views: number;
        pages_per_session: number; bounce_rate: number;
      }]>`
        WITH sessions AS (
          SELECT COALESCE("sessionId", id::text) as sid, COUNT(*)::int as pages
          FROM "PageView" WHERE "createdAt" >= ${startDate}
          GROUP BY sid
        )
        SELECT
          COUNT(*)::int as total_visitors,
          COALESCE(SUM(pages), 0)::int as total_page_views,
          CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(pages)::numeric / COUNT(*), 1)::float8 ELSE 0 END as pages_per_session,
          CASE WHEN COUNT(*) > 0 THEN ROUND(COUNT(*) FILTER (WHERE pages = 1)::numeric / COUNT(*) * 100, 1)::float8 ELSE 0 END as bounce_rate
        FROM sessions`;

      const totalVisitors = trafficStats?.total_visitors || 0;
      const totalPageViews = trafficStats?.total_page_views || 0;

      // ── Top pages ──────────────────────────────────────────────
      const topPages = await prisma.$queryRaw<Array<{ path: string; views: number }>>`
        SELECT path, COUNT(*)::int as views
        FROM "PageView"
        WHERE "createdAt" >= ${startDate} AND path NOT LIKE '/admin%'
        GROUP BY path ORDER BY views DESC LIMIT 10`;

      // ── Visitors by country ────────────────────────────────────
      const visitorsByCountry = await prisma.$queryRaw<Array<{ country: string; visitors: number }>>`
        SELECT COALESCE(country, 'Unknown') as country,
          COUNT(DISTINCT COALESCE("sessionId", id::text))::int as visitors
        FROM "PageView"
        WHERE "createdAt" >= ${startDate} AND country IS NOT NULL AND country != 'Unknown'
        GROUP BY country ORDER BY visitors DESC LIMIT 20`;

      // ── Traffic sources ────────────────────────────────────────
      const trafficSources = await prisma.$queryRaw<Array<{ source: string; visits: number }>>`
        SELECT
          CASE
            WHEN referrer IS NULL OR referrer = '' THEN 'Direct'
            WHEN referrer LIKE '%google%' THEN 'Google'
            WHEN referrer LIKE '%facebook%' OR referrer LIKE '%fb.%' THEN 'Facebook'
            WHEN referrer LIKE '%instagram%' THEN 'Instagram'
            WHEN referrer LIKE '%tiktok%' THEN 'TikTok'
            WHEN referrer LIKE '%youtube%' THEN 'YouTube'
            WHEN referrer LIKE '%twitter%' OR referrer LIKE '%x.com%' THEN 'X/Twitter'
            WHEN referrer LIKE '%whatsapp%' OR referrer LIKE '%wa.me%' THEN 'WhatsApp'
            ELSE 'Other'
          END as source,
          COUNT(*)::int as visits
        FROM "PageView"
        WHERE "createdAt" >= ${startDate}
          AND (referrer IS NULL OR referrer NOT LIKE '%ugsex.com%')
        GROUP BY source ORDER BY visits DESC LIMIT 10`;

      // ── Period totals ─────────────────────────────────────────
      const currentRevenue = dailyData.reduce((s, d) => s + d.revenue, 0);
      const currentCollected = dailyData.reduce((s, d) => s + d.collected, 0);
      const currentOrders = dailyData.reduce((s, d) => s + d.orders, 0);

      // Previous period comparison via SQL
      const [prevStats] = await prisma.$queryRaw<[{ revenue: number; orders: number; visitors: number }]>`
        SELECT
          COALESCE((SELECT SUM("totalAmount"::numeric)::float8 FROM "Order"
            WHERE "createdAt" >= ${previousStartDate} AND "createdAt" < ${startDate}
            AND "status" NOT IN ('CANCELLED','REFUNDED')), 0) as revenue,
          COALESCE((SELECT COUNT(*)::int FROM "Order"
            WHERE "createdAt" >= ${previousStartDate} AND "createdAt" < ${startDate}
            AND "status" NOT IN ('CANCELLED','REFUNDED')), 0) as orders,
          COALESCE((SELECT COUNT(DISTINCT COALESCE("sessionId", id::text))::int FROM "PageView"
            WHERE "createdAt" >= ${previousStartDate} AND "createdAt" < ${startDate}), 0) as visitors`;

      const previousRevenue = prevStats?.revenue || 0;
      const previousOrderCount = prevStats?.orders || 0;
      const previousVisitors = prevStats?.visitors || 0;

      // ── Orders by status ──────────────────────────────────────
      const ordersByStatus = await prisma.order.groupBy({ by: ["status"], where: { createdAt: { gte: startDate } }, _count: { id: true } });
      const byStatus: Record<string, number> = {};
      ordersByStatus.forEach((s) => { byStatus[s.status] = s._count.id; });

      const allOrdersByStatus = await prisma.order.groupBy({ by: ["status"], _count: { id: true }, _sum: { totalAmount: true } });
      const funnel: Record<string, { count: number; value: number }> = {};
      allOrdersByStatus.forEach((s) => { funnel[s.status] = { count: s._count.id, value: Number(s._sum.totalAmount) || 0 }; });

      // ── Payment methods ────────────────────────────────────────
      const paymentsByMethod = await prisma.$queryRaw<Array<{
        method: string;
        count: number;
        amount: number;
      }>>`
        SELECT
          p.method,
          COUNT(DISTINCT p."orderId")::int as count,
          COALESCE(SUM(p.amount::numeric), 0)::float8 as amount
        FROM "Payment" p
        JOIN "Order" o ON p."orderId" = o.id
        WHERE o."createdAt" >= ${startDate}
          AND o."status" NOT IN ('CANCELLED', 'REFUNDED')
          AND p.amount > 0
        GROUP BY p.method`;

      const paymentMethods = paymentsByMethod.map((p) => ({
        name: p.method || "Unknown",
        count: p.count,
        amount: Number(p.amount) || 0,
      }));

      // ── Customer stats ────────────────────────────────────────
      const thisMonthStart = new Date(); thisMonthStart.setDate(1); thisMonthStart.setHours(0, 0, 0, 0);
      const lastMonthStart = new Date(thisMonthStart); lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);

      const [registeredCustomers, newRegisteredThisMonth, newRegisteredLastMonth] = await Promise.all([
        prisma.user.count({ where: { role: "CUSTOMER" } }),
        prisma.user.count({ where: { role: "CUSTOMER", createdAt: { gte: thisMonthStart } } }),
        prisma.user.count({ where: { role: "CUSTOMER", createdAt: { gte: lastMonthStart, lt: thisMonthStart } } }),
      ]);

      const [customerStats] = await prisma.$queryRaw<[{ unique_customers: number; returning: number }]>`
        SELECT
          COUNT(DISTINCT "customerEmail")::int as unique_customers,
          COUNT(*) FILTER (WHERE cnt > 1)::int as returning
        FROM (
          SELECT "customerEmail", COUNT(*)::int as cnt
          FROM "Order"
          WHERE "createdAt" >= ${startDate} AND "status" NOT IN ('CANCELLED','REFUNDED')
          GROUP BY "customerEmail"
        ) sub`;

      const totalOrderCustomers = customerStats?.unique_customers || 0;
      const returningCount = customerStats?.returning || 0;
      const conversionRate = totalVisitors > 0 ? (totalOrderCustomers / totalVisitors) * 100 : 0;

      // ── Top selling products ──────────────────────────────────
      const topProductGroups = await prisma.orderItem.groupBy({
        by: ["productId"],
        where: { order: { createdAt: { gte: startDate }, status: { notIn: ["CANCELLED", "REFUNDED"] } } },
        _sum: { quantity: true, price: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 10,
      });

      const topProdDetails = await prisma.product.findMany({
        where: { id: { in: topProductGroups.map((p) => p.productId) } },
        select: { id: true, name: true, price: true, cjCost: true, aliexpressCost: true },
      });

      const topSellingProducts = topProductGroups.map((tp) => {
        const prod = topProdDetails.find((p) => p.id === tp.productId);
        const revenue = Number(tp._sum.price) || 0;
        const unitCost = prod?.cjCost ? Number(prod.cjCost) : prod?.aliexpressCost ? Number(prod.aliexpressCost) : 0;
        const cost = unitCost * (tp._sum.quantity || 1);
        return { name: prod?.name || "Unknown", sold: tp._sum.quantity || 0, revenue, margin: revenue > 0 && cost > 0 ? Math.round(((revenue - cost) / revenue) * 100) : null };
      });

      // ── Product insights (SQL-based) ──────────────────────────
      const [productInsights] = await prisma.$queryRaw<[{
        low_stock: number; out_of_stock: number; total_active: number;
        never_ordered: number; healthy: number; overstocked: number;
      }]>`
        SELECT
          COUNT(*) FILTER (WHERE p.stock <= 10 AND p.stock > 0 AND p."trackInventory")::int as low_stock,
          COUNT(*) FILTER (WHERE p.stock <= 0 AND p."trackInventory")::int as out_of_stock,
          COUNT(*)::int as total_active,
          COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM "OrderItem" oi WHERE oi."productId" = p.id))::int as never_ordered,
          COUNT(*) FILTER (WHERE p.stock > 10 AND p.stock <= 200 AND p."trackInventory")::int as healthy,
          COUNT(*) FILTER (WHERE p.stock > 200 AND p."trackInventory")::int as overstocked
        FROM "Product" p WHERE p.status = 'ACTIVE'`;

      // Never ordered products (limited to 10)
      const neverOrderedProducts = await prisma.$queryRaw<Array<{
        name: string; price: number; stock: number; days_listed: number;
      }>>`
        SELECT p.name, p.price::float8 as price, COALESCE(p.stock, 0) as stock,
          EXTRACT(DAY FROM NOW() - p."createdAt")::int as days_listed
        FROM "Product" p
        WHERE p.status = 'ACTIVE'
          AND NOT EXISTS (SELECT 1 FROM "OrderItem" oi WHERE oi."productId" = p.id)
        ORDER BY p."createdAt" ASC LIMIT 10`;

      // Dropship margins (limited)
      const dropshipMargins = await prisma.$queryRaw<Array<{
        name: string; price: number; cost: number; margin: number;
      }>>`
        SELECT name, price::float8 as price,
          COALESCE("cjCost", "aliexpressCost", 0)::float8 as cost,
          CASE WHEN price > 0 AND COALESCE("cjCost", "aliexpressCost", 0) > 0
            THEN ROUND(((price - COALESCE("cjCost", "aliexpressCost", 0)) / price * 100))::int
            ELSE 0 END as margin
        FROM "Product"
        WHERE status = 'ACTIVE'
          AND ("cjProductId" IS NOT NULL OR "aliexpressProductId" IS NOT NULL)
          AND COALESCE("cjCost", "aliexpressCost", 0) > 0 AND price > 0
        ORDER BY margin ASC`;

      const avgDropshipMargin = dropshipMargins.length > 0
        ? Math.round(dropshipMargins.reduce((s, m) => s + m.margin, 0) / dropshipMargins.length)
        : null;

      // Inventory value (SQL)
      const [invResult] = await prisma.$queryRaw<[{ value: number }]>`
        SELECT COALESCE(SUM(
          CASE WHEN COALESCE("cjCost"::numeric, "aliexpressCost"::numeric, 0) > 0
            THEN COALESCE("cjCost"::numeric, "aliexpressCost"::numeric) * COALESCE(stock, 0)
            ELSE price::numeric * COALESCE(stock, 0)
          END
        ), 0)::float8 as value
        FROM "Product" WHERE status = 'ACTIVE' AND "trackInventory" = true`;

      // Category breakdown
      const categoryStats = await prisma.$queryRaw<Array<{
        name: string; count: number; total_value: number; total_stock: number;
      }>>`
        SELECT c.name, COUNT(p.id)::int as count,
          COALESCE(SUM(p.price::numeric), 0)::float8 as total_value,
          COALESCE(SUM(p.stock), 0)::int as total_stock
        FROM "Category" c
        JOIN "Product" p ON p."categoryId" = c.id AND p.status = 'ACTIVE'
        GROUP BY c.name ORDER BY count DESC`;

      // Most wishlisted
      const mostWishlisted = await prisma.$queryRaw<Array<{
        name: string; wishlist_count: number; stock: number;
      }>>`
        SELECT p.name, COUNT(w.id)::int as wishlist_count, COALESCE(p.stock, 0) as stock
        FROM "Product" p
        JOIN "WishlistItem" w ON w."productId" = p.id
        WHERE p.status = 'ACTIVE'
        GROUP BY p.id, p.name, p.stock
        ORDER BY wishlist_count DESC LIMIT 10`;

      // ── Hourly distribution (SQL) ─────────────────────────────
      const hourlyData = await prisma.$queryRaw<Array<{ hour: string; count: number }>>`
        SELECT LPAD(EXTRACT(HOUR FROM "createdAt")::text, 2, '0') || ':00' as hour,
          COUNT(*)::int as count
        FROM "Order"
        WHERE "createdAt" >= ${startDate} AND "status" NOT IN ('CANCELLED','REFUNDED')
        GROUP BY EXTRACT(HOUR FROM "createdAt")
        ORDER BY EXTRACT(HOUR FROM "createdAt")`;

      // ── Growth calculations ───────────────────────────────────
      const revenueGrowth = previousRevenue > 0 ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 1000) / 10 : currentRevenue > 0 ? 100 : 0;
      const ordersGrowth = previousOrderCount > 0 ? Math.round(((currentOrders - previousOrderCount) / previousOrderCount) * 1000) / 10 : currentOrders > 0 ? 100 : 0;
      const visitorGrowth = previousVisitors > 0 ? Math.round(((totalVisitors - previousVisitors) / previousVisitors) * 1000) / 10 : totalVisitors > 0 ? 100 : 0;

      // ── Projections ─────────────────────────────────────────
      const revenueValues = dailyData.map((d) => d.revenue);
      const visitorValues = dailyData.map((d) => d.visitors);
      const calcTrend = (vals: number[]) => {
        const n = vals.length;
        if (n < 2) return { slope: 0 };
        const xMean = (n - 1) / 2;
        const yMean = vals.reduce((a, b) => a + b, 0) / n;
        let num = 0, den = 0;
        vals.forEach((y, x) => { num += (x - xMean) * (y - yMean); den += (x - xMean) ** 2; });
        return { slope: den !== 0 ? num / den : 0 };
      };
      const revTrend = calcTrend(revenueValues);
      const visTrend = calcTrend(visitorValues);
      const projectedRevenue30d = Math.max(0, revenueValues.reduce((s, v) => s + v, 0) * (30 / days));
      const projectedVisitors30d = Math.max(0, Math.round(visitorValues.reduce((s, v) => s + v, 0) * (30 / days)));

      const lastWeekStart = new Date(); lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const prevWeekStart = new Date(); prevWeekStart.setDate(prevWeekStart.getDate() - 14);
      const lastWeekRevenue = dailyData.filter((d) => new Date(d.date) >= lastWeekStart).reduce((s, d) => s + d.revenue, 0);
      const prevWeekRevenue = dailyData.filter((d) => new Date(d.date) >= prevWeekStart && new Date(d.date) < lastWeekStart).reduce((s, d) => s + d.revenue, 0);
      const lastWeekVisitors = dailyData.filter((d) => new Date(d.date) >= lastWeekStart).reduce((s, d) => s + d.visitors, 0);
      const prevWeekVisitors = dailyData.filter((d) => new Date(d.date) >= prevWeekStart && new Date(d.date) < lastWeekStart).reduce((s, d) => s + d.visitors, 0);

      // ── Business insights ─────────────────────────────────────
      const insights: { type: string; title: string; message: string }[] = [];
      if (productInsights.out_of_stock > 0) insights.push({ type: "warning", title: "Out of Stock", message: `${productInsights.out_of_stock} product${productInsights.out_of_stock > 1 ? "s" : ""} out of stock.` });
      if (productInsights.low_stock > 3) insights.push({ type: "warning", title: "Low Stock Alert", message: `${productInsights.low_stock} products running low on stock.` });
      if (revenueGrowth > 20) insights.push({ type: "success", title: "Revenue Growing", message: `Revenue is up ${revenueGrowth.toFixed(1)}% vs previous period.` });
      if (revenueGrowth < -20) insights.push({ type: "warning", title: "Revenue Declining", message: `Revenue is down ${Math.abs(revenueGrowth).toFixed(1)}% vs previous period.` });
      if (conversionRate > 3) insights.push({ type: "success", title: "Good Conversion", message: `Conversion rate at ${conversionRate.toFixed(1)}% — above average.` });
      if (conversionRate > 0 && conversionRate < 1) insights.push({ type: "info", title: "Low Conversion", message: `Conversion rate at ${conversionRate.toFixed(1)}%. Consider improving product pages.` });
      if (productInsights.never_ordered > 5) insights.push({ type: "info", title: "Dormant Products", message: `${productInsights.never_ordered} products have never been ordered.` });

      return {
        revenue: {
          total: currentRevenue, collected: currentCollected, growth: revenueGrowth,
          daily: dailyData.map((d) => ({ date: d.date, amount: d.revenue, collected: d.collected })),
          avgOrderValue: currentOrders > 0 ? Math.round(currentRevenue / currentOrders) : 0,
        },
        orders: {
          total: currentOrders, allTime: await prisma.order.count(),
          growth: ordersGrowth,
          daily: dailyData.map((d) => ({ date: d.date, count: d.orders })),
          byStatus, funnel,
          avgPerDay: days > 0 ? Math.round((currentOrders / days) * 10) / 10 : 0,
        },
        customers: {
          registered: registeredCustomers, newRegistered: newRegisteredThisMonth,
          newLastMonth: newRegisteredLastMonth, orderCustomers: totalOrderCustomers,
          returning: returningCount, conversionRate: Math.round(conversionRate * 10) / 10,
        },
        products: {
          topSelling: topSellingProducts, lowStock: productInsights.low_stock,
          outOfStock: productInsights.out_of_stock, totalActive: productInsights.total_active,
          neverOrdered: neverOrderedProducts, neverOrderedCount: productInsights.never_ordered,
          dropshipMargins, avgDropshipMargin,
          inventoryValue: invResult?.value || 0,
          categoryBreakdown: categoryStats.map(c => ({ name: c.name, count: c.count, totalValue: c.total_value, totalStock: c.total_stock })),
          mostWishlisted: mostWishlisted.map(p => ({ name: p.name, wishlistCount: p.wishlist_count, stock: p.stock })),
          healthBreakdown: {
            outOfStock: productInsights.out_of_stock, lowStock: productInsights.low_stock,
            healthy: productInsights.healthy, overstocked: productInsights.overstocked,
          },
        },
        traffic: {
          daily: dailyData.map((d) => ({ date: d.date, visitors: d.visitors, orders: d.orders, revenue: d.revenue })),
          totalVisitors, visitorGrowth,
          pagesPerSession: trafficStats?.pages_per_session || 0,
          bounceRate: trafficStats?.bounce_rate || 0,
          topPages: topPages.map(p => ({ path: p.path, views: p.views })),
          sources: trafficSources.map(s => ({ source: s.source, visits: s.visits, pct: totalPageViews > 0 ? Math.round((s.visits / totalPageViews) * 1000) / 10 : 0 })),
          visitorsByCountry: visitorsByCountry.map(c => ({ country: c.country, visitors: c.visitors })),
        },
        projections: {
          revenue30d: Math.round(projectedRevenue30d), visitors30d: projectedVisitors30d,
          revenueTrend: revTrend.slope > 0 ? "up" : revTrend.slope < 0 ? "down" : "flat",
          visitorTrend: visTrend.slope > 0 ? "up" : visTrend.slope < 0 ? "down" : "flat",
          weekOverWeek: {
            revenue: { current: lastWeekRevenue, previous: prevWeekRevenue, change: prevWeekRevenue > 0 ? Math.round(((lastWeekRevenue - prevWeekRevenue) / prevWeekRevenue) * 1000) / 10 : 0 },
            visitors: { current: lastWeekVisitors, previous: prevWeekVisitors, change: prevWeekVisitors > 0 ? Math.round(((lastWeekVisitors - prevWeekVisitors) / prevWeekVisitors) * 1000) / 10 : 0 },
          },
        },
        paymentMethods,
        hourlyOrders: hourlyData,
        insights,
      };
    }, DASH_CACHE_TTL);

    return res.json(result);
  } catch (error) {
    logger.error("Analytics error", { error });
    return res.status(500).json({ error: "Failed to load analytics" });
  }
}));

export default router;
