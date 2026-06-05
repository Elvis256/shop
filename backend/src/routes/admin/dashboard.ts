import { Router, Response } from "express";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { asyncHandler } from "../../middleware/errorHandler";

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate, requireAdmin);

// GET /api/admin/dashboard
router.get("/", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get current month stats
    const [
      totalOrders,
      monthOrders,
      lastMonthOrders,
      totalRevenue,
      monthRevenue,
      lastMonthRevenue,
      totalCustomers,
      newCustomers,
      totalProducts,
      lowStockProducts,
      recentOrders,
      topProducts,
      ordersByStatus,
    ] = await Promise.all([
      // Total orders
      prisma.order.count(),
      // This month orders
      prisma.order.count({ where: { createdAt: { gte: startOfMonth } } }),
      // Last month orders
      prisma.order.count({
        where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
      }),
      // Total revenue
      prisma.order.aggregate({
        where: { paymentStatus: "SUCCESSFUL" },
        _sum: { totalAmount: true },
      }),
      // This month revenue
      prisma.order.aggregate({
        where: {
          paymentStatus: "SUCCESSFUL",
          createdAt: { gte: startOfMonth },
        },
        _sum: { totalAmount: true },
      }),
      // Last month revenue
      prisma.order.aggregate({
        where: {
          paymentStatus: "SUCCESSFUL",
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
        _sum: { totalAmount: true },
      }),
      // Total customers
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      // New customers this month
      prisma.user.count({
        where: { role: "CUSTOMER", createdAt: { gte: startOfMonth } },
      }),
      // Total products
      prisma.product.count({ where: { status: "ACTIVE" } }),
      // Low stock products (stock <= 5)
      prisma.product.count({
        where: {
          status: "ACTIVE",
          trackInventory: true,
          stock: { lte: 5 },
        },
      }),
      // Recent orders
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          totalAmount: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
        },
      }),
      // Top selling products
      prisma.orderItem.groupBy({
        by: ["productId"],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
      // Orders by status
      prisma.order.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
    ]);

    // Get product details for top products
    const topProductIds = topProducts.map((p) => p.productId);
    const productDetails = await prisma.product.findMany({
      where: { id: { in: topProductIds } },
      select: { id: true, name: true, price: true },
    });

    const topProductsWithDetails = topProducts.map((tp) => {
      const product = productDetails.find((p) => p.id === tp.productId);
      return {
        productId: tp.productId,
        name: product?.name || "Unknown",
        price: product?.price || 0,
        soldCount: tp._sum.quantity || 0,
      };
    });

    // ── Revenue breakdown: Direct sales vs Marketplace commissions ──
    const [
      directSalesRevenue,
      directSalesThisMonth,
      totalCommissions,
      commissionsThisMonth,
      pendingPayouts,
      activeVendors,
      pendingVendors,
      vendorProductCount,
    ] = await Promise.all([
      // Direct sales: OrderItems with no sellerId, from paid orders
      prisma.orderItem.aggregate({
        where: { sellerId: null, order: { paymentStatus: "SUCCESSFUL" } },
        _sum: { price: true },
      }),
      // Direct sales this month
      prisma.orderItem.aggregate({
        where: {
          sellerId: null,
          order: { paymentStatus: "SUCCESSFUL", createdAt: { gte: startOfMonth } },
        },
        _sum: { price: true },
      }),
      // Total commissions earned from vendors (all time)
      prisma.orderItem.aggregate({
        where: { sellerId: { not: null }, commission: { not: null } },
        _sum: { commission: true, price: true },
      }),
      // Commissions this month
      prisma.orderItem.aggregate({
        where: {
          sellerId: { not: null },
          commission: { not: null },
          order: { createdAt: { gte: startOfMonth } },
        },
        _sum: { commission: true, price: true },
      }),
      // Pending vendor payouts
      prisma.sellerPayout.aggregate({
        where: { status: { in: ["PENDING", "PROCESSING"] } },
        _sum: { amount: true },
        _count: true,
      }),
      // Active vendors
      prisma.seller.count({ where: { status: "APPROVED" } }),
      // Pending vendor applications
      prisma.seller.count({ where: { status: "PENDING" } }),
      // Vendor product count
      prisma.product.count({ where: { sellerId: { not: null }, status: "ACTIVE" } }),
    ]);

    // Calculate direct revenue using SQL aggregation (not loading all rows into memory)
    const [directRevenueResult] = await prisma.$queryRaw<[{ total: bigint | null, month: bigint | null }]>`
      SELECT
        COALESCE(SUM(oi.price * oi.quantity), 0) as total,
        COALESCE(SUM(CASE WHEN o."createdAt" >= ${startOfMonth} THEN oi.price * oi.quantity ELSE 0 END), 0) as month
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      WHERE oi."sellerId" IS NULL AND o."paymentStatus" = 'SUCCESSFUL'
    `;
    const directRevenueTotal = Number(directRevenueResult?.total || 0);
    const directRevenueMonth = Number(directRevenueResult?.month || 0);

    const totalCommissionAmount = Number(totalCommissions._sum.commission || 0);
    const monthCommissionAmount = Number(commissionsThisMonth._sum.commission || 0);
    const vendorGrossSalesTotal = Number(totalCommissions._sum.price || 0);
    const vendorGrossSalesMonth = Number(commissionsThisMonth._sum.price || 0);

    // Dropshipping stats
    const [cjProducts, aeProducts, localProducts, productsByCategory] = await Promise.all([
      prisma.product.count({ where: { cjProductId: { not: null }, status: "ACTIVE" } }),
      prisma.product.count({ where: { aliexpressProductId: { not: null }, status: "ACTIVE" } }),
      prisma.product.count({
        where: { cjProductId: null, aliexpressProductId: null, status: "ACTIVE" },
      }),
      prisma.product.groupBy({
        by: ["categoryId"],
        where: { status: "ACTIVE" },
        _count: { id: true },
      }),
    ]);

    // Get category names for the breakdown
    const catIds = productsByCategory.map((p) => p.categoryId).filter(Boolean) as string[];
    const categories = await prisma.category.findMany({
      where: { id: { in: catIds } },
      select: { id: true, name: true },
    });
    const catMap = new Map(categories.map((c) => [c.id, c.name]));

    const categoryBreakdown = productsByCategory.map((p) => ({
      category: p.categoryId ? catMap.get(p.categoryId) || "Unknown" : "Uncategorized",
      count: p._count.id,
    })).sort((a, b) => b.count - a.count);

    // Calculate growth percentages
    const orderGrowth = lastMonthOrders > 0
      ? ((monthOrders - lastMonthOrders) / lastMonthOrders) * 100
      : 0;
    
    const currentRev = Number(monthRevenue._sum?.totalAmount) || 0;
    const lastRev = Number(lastMonthRevenue._sum?.totalAmount) || 0;
    const revenueGrowth = lastRev > 0 ? ((currentRev - lastRev) / lastRev) * 100 : 0;

    return res.json({
      stats: {
        orders: {
          total: totalOrders,
          thisMonth: monthOrders,
          growth: Math.round(orderGrowth * 10) / 10,
        },
        revenue: {
          total: Number(totalRevenue._sum?.totalAmount) || 0,
          thisMonth: currentRev,
          growth: Math.round(revenueGrowth * 10) / 10,
          currency: "UGX",
        },
        customers: {
          total: totalCustomers,
          newThisMonth: newCustomers,
        },
        products: {
          total: totalProducts,
          lowStock: lowStockProducts,
          cjDropshipping: cjProducts,
          aliexpress: aeProducts,
          local: localProducts,
          categoryBreakdown,
        },
      },
      ordersByStatus: ordersByStatus.reduce((acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
      }, {} as Record<string, number>),
      recentOrders,
      topProducts: topProductsWithDetails,
      marketplace: {
        directRevenue: { total: directRevenueTotal, thisMonth: directRevenueMonth },
        commissionRevenue: { total: totalCommissionAmount, thisMonth: monthCommissionAmount },
        vendorGrossSales: { total: vendorGrossSalesTotal, thisMonth: vendorGrossSalesMonth },
        platformRevenue: {
          total: directRevenueTotal + totalCommissionAmount,
          thisMonth: directRevenueMonth + monthCommissionAmount,
        },
        pendingPayouts: { amount: Number(pendingPayouts._sum.amount || 0), count: pendingPayouts._count || 0 },
        vendors: { active: activeVendors, pending: pendingVendors },
        vendorProducts: vendorProductCount,
      },
    });
  } catch (error) {
    logger.error("Dashboard error", { error });
    return res.status(500).json({ error: "Failed to load dashboard" });
  }
}));

// GET /api/admin/analytics
router.get("/analytics", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { period = "30" } = req.query;
    const days = parseInt(period as string) || 30;
    const startDate = new Date();
    if (days === 1) {
      // "Today" — start of current day (UTC)
      startDate.setUTCHours(0, 0, 0, 0);
    } else {
      startDate.setDate(startDate.getDate() - days);
    }

    const previousStartDate = new Date(startDate);
    if (days === 1) {
      // Previous period = yesterday
      previousStartDate.setDate(previousStartDate.getDate() - 1);
    } else {
      previousStartDate.setDate(previousStartDate.getDate() - days);
    }

    // Active orders = not cancelled/refunded (includes COD with pending payment)
    const activeFilter = { status: { notIn: ["CANCELLED", "REFUNDED"] as ("CANCELLED" | "REFUNDED")[] } };

    // ── Daily order data (active orders) ──────────────────────
    const dailyMap = new Map<string, { revenue: number; orders: number; collected: number }>();
    const bucketCount = days === 1 ? 1 : days + 1;
    for (let i = 0; i < bucketCount; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      dailyMap.set(d.toISOString().split("T")[0], { revenue: 0, orders: 0, collected: 0 });
    }

    const periodOrders = await prisma.order.findMany({
      where: { createdAt: { gte: startDate }, ...activeFilter },
      select: { createdAt: true, totalAmount: true, paymentStatus: true },
    });

    periodOrders.forEach((o) => {
      const key = o.createdAt.toISOString().split("T")[0];
      const entry = dailyMap.get(key) || { revenue: 0, orders: 0, collected: 0 };
      const amt = Number(o.totalAmount);
      entry.revenue += amt;
      entry.orders += 1;
      if (o.paymentStatus === "SUCCESSFUL") entry.collected += amt;
      dailyMap.set(key, entry);
    });

    const dailyData = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, s]) => ({ date, revenue: s.revenue, orders: s.orders, collected: s.collected, visitors: 0 }));

    // ── Visitor data from PageView ────────────────────────────
    const pageViews = await prisma.pageView.findMany({
      where: { createdAt: { gte: startDate } },
      select: { createdAt: true, sessionId: true, path: true, country: true, referrer: true },
    });
    const visitorMap = new Map<string, Set<string>>();
    const allSessions = new Set<string>();
    const pathCounts = new Map<string, number>();
    const countryVisitorMap = new Map<string, Set<string>>();
    const sessionPageCounts = new Map<string, number>();
    let totalPageViews = 0;

    pageViews.forEach((pv) => {
      const key = pv.createdAt.toISOString().split("T")[0];
      const sid = pv.sessionId || pv.createdAt.toISOString();
      if (!visitorMap.has(key)) visitorMap.set(key, new Set());
      visitorMap.get(key)!.add(sid);
      allSessions.add(sid);
      totalPageViews++;
      const p = pv.path || "/";
      if (!p.startsWith("/admin")) {
        pathCounts.set(p, (pathCounts.get(p) || 0) + 1);
      }
      // Country tracking
      const country = pv.country || "Unknown";
      if (!countryVisitorMap.has(country)) countryVisitorMap.set(country, new Set());
      countryVisitorMap.get(country)!.add(sid);
      // Session page counts for bounce rate
      sessionPageCounts.set(sid, (sessionPageCounts.get(sid) || 0) + 1);
    });

    dailyData.forEach((d) => {
      d.visitors = visitorMap.get(d.date)?.size || 0;
    });

    const totalVisitors = allSessions.size;
    const pagesPerSession = totalVisitors > 0 ? Math.round((totalPageViews / totalVisitors) * 10) / 10 : 0;

    // Bounce rate
    const totalSessions = sessionPageCounts.size;
    const bounceSessions = Array.from(sessionPageCounts.values()).filter(c => c === 1).length;
    const bounceRate = totalSessions > 0 ? Math.round((bounceSessions / totalSessions) * 1000) / 10 : 0;

    // Visitors by country
    const visitorsByCountry = Array.from(countryVisitorMap.entries())
      .filter(([c]) => c !== "Unknown")
      .map(([country, sessions]) => ({ country, visitors: sessions.size }))
      .sort((a, b) => b.visitors - a.visitors)
      .slice(0, 20);

    // Top pages
    const topPages = Array.from(pathCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, views]) => ({ path, views }));

    // ── Period totals ─────────────────────────────────────────
    const currentRevenue = dailyData.reduce((s, d) => s + d.revenue, 0);
    const currentCollected = dailyData.reduce((s, d) => s + d.collected, 0);
    const currentOrders = dailyData.reduce((s, d) => s + d.orders, 0);

    // Previous period for comparison
    const prevOrders = await prisma.order.findMany({
      where: { createdAt: { gte: previousStartDate, lt: startDate }, ...activeFilter },
      select: { totalAmount: true },
    });
    const previousRevenue = prevOrders.reduce((s, o) => s + Number(o.totalAmount), 0);
    const previousOrderCount = prevOrders.length;

    const prevVisitorPVs = await prisma.pageView.findMany({
      where: { createdAt: { gte: previousStartDate, lt: startDate } },
      select: { sessionId: true },
    });
    const prevSessions = new Set(prevVisitorPVs.map((p) => p.sessionId || ""));
    const previousVisitors = prevSessions.size;

    // ── Orders by status ──────────────────────────────────────
    const ordersByStatus = await prisma.order.groupBy({
      by: ["status"],
      where: { createdAt: { gte: startDate } },
      _count: { id: true },
    });
    const byStatus: Record<string, number> = {};
    ordersByStatus.forEach((s) => { byStatus[s.status] = s._count.id; });

    // All-time orders by status (for funnel)
    const allOrdersByStatus = await prisma.order.groupBy({
      by: ["status"],
      _count: { id: true },
      _sum: { totalAmount: true },
    });
    const funnel: Record<string, { count: number; value: number }> = {};
    allOrdersByStatus.forEach((s) => {
      funnel[s.status] = { count: s._count.id, value: Number(s._sum.totalAmount) || 0 };
    });

    // ── Payment method breakdown (from Payment table) ──
    const paymentsByMethod = await prisma.payment.groupBy({
      by: ["method"],
      where: { createdAt: { gte: startDate }, status: "SUCCESSFUL" },
      _count: true,
      _sum: { amount: true },
    });
    // Also count COD orders (no payment record)
    const codOrders = await prisma.order.count({
      where: { createdAt: { gte: startDate }, ...activeFilter, payments: { none: {} } },
    });
    const codValue = await prisma.order.aggregate({
      where: { createdAt: { gte: startDate }, ...activeFilter, payments: { none: {} } },
      _sum: { totalAmount: true },
    });
    const paymentMethods = [
      ...paymentsByMethod.map((p) => ({
        name: p.method || "Unknown",
        count: p._count,
        amount: Number(p._sum?.amount) || 0,
      })),
      ...(codOrders > 0 ? [{ name: "COD", count: codOrders, amount: Number(codValue._sum?.totalAmount) || 0 }] : []),
    ];

    // ── Customer stats ────────────────────────────────────────
    const registeredCustomers = await prisma.user.count({ where: { role: "CUSTOMER" } });
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1); thisMonthStart.setHours(0, 0, 0, 0);
    const lastMonthStart = new Date(thisMonthStart);
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    const newRegisteredThisMonth = await prisma.user.count({
      where: { role: "CUSTOMER", createdAt: { gte: thisMonthStart } },
    });
    const newRegisteredLastMonth = await prisma.user.count({
      where: { role: "CUSTOMER", createdAt: { gte: lastMonthStart, lt: thisMonthStart } },
    });

    // Unique customers from orders (includes guests)
    const uniqueEmails = await prisma.order.findMany({
      where: { createdAt: { gte: startDate }, ...activeFilter },
      select: { customerEmail: true },
      distinct: ["customerEmail"],
    });
    const totalOrderCustomers = uniqueEmails.length;

    // Repeat customers (more than 1 non-cancelled order in period)
    const repeatBuyers = await prisma.order.groupBy({
      by: ["customerEmail"],
      where: { createdAt: { gte: startDate }, ...activeFilter },
      _count: { id: true },
    });
    const returningCount = repeatBuyers.filter((r) => r._count.id > 1).length;

    // Conversion = unique buyers / unique visitors
    const conversionRate = totalVisitors > 0 ? (totalOrderCustomers / totalVisitors) * 100 : 0;

    // ── Top selling products ──────────────────────────────────
    const topProductGroups = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: { order: { createdAt: { gte: startDate }, ...activeFilter } },
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
      return {
        name: prod?.name || "Unknown",
        sold: tp._sum.quantity || 0,
        revenue,
        margin: revenue > 0 && cost > 0 ? Math.round(((revenue - cost) / revenue) * 100) : null,
      };
    });

    // ── Product insights ──────────────────────────────────────
    const lowStockCount = await prisma.product.count({
      where: { stock: { lte: 10 }, status: "ACTIVE", trackInventory: true },
    });
    const outOfStock = await prisma.product.count({
      where: { stock: { lte: 0 }, status: "ACTIVE", trackInventory: true },
    });
    const totalActiveProducts = await prisma.product.count({ where: { status: "ACTIVE" } });

    // Never ordered products — return details for display
    const orderedProductIds = await prisma.orderItem.findMany({
      select: { productId: true },
      distinct: ["productId"],
    });
    const orderedSet = new Set(orderedProductIds.map((p) => p.productId));
    const allActiveProducts = await prisma.product.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, price: true, stock: true, createdAt: true },
    });
    const now = new Date();
    const neverOrderedProducts = allActiveProducts
      .filter((p) => !orderedSet.has(p.id))
      .map((p) => ({
        name: p.name,
        price: Number(p.price),
        stock: p.stock,
        daysListed: Math.floor((now.getTime() - p.createdAt.getTime()) / 86400000),
      }))
      .sort((a, b) => b.daysListed - a.daysListed);
    const neverOrderedCount = neverOrderedProducts.length;

    // Dropship margin analysis
    const dropshipProducts = await prisma.product.findMany({
      where: {
        status: "ACTIVE",
        OR: [{ cjProductId: { not: null } }, { aliexpressProductId: { not: null } }],
      },
      select: { id: true, name: true, price: true, cjCost: true, aliexpressCost: true },
    });
    const dropshipMargins = dropshipProducts
      .filter((p) => {
        const cost = Number(p.cjCost) || Number(p.aliexpressCost) || 0;
        return cost > 0 && Number(p.price) > 0;
      })
      .map((p) => {
        const price = Number(p.price);
        const cost = Number(p.cjCost) || Number(p.aliexpressCost) || 0;
        const margin = Math.round(((price - cost) / price) * 100);
        return { name: p.name, price, cost, margin };
      })
      .sort((a, b) => a.margin - b.margin);

    const avgDropshipMargin = dropshipMargins.length > 0
      ? Math.round(dropshipMargins.reduce((s, m) => s + m.margin, 0) / dropshipMargins.length)
      : null;

    // ── Hourly distribution (active orders) ───────────────────
    const hourlyOrders = await prisma.order.findMany({
      where: { createdAt: { gte: startDate }, ...activeFilter },
      select: { createdAt: true },
    });
    const hourlyMap = new Map<number, number>();
    for (let i = 0; i < 24; i++) hourlyMap.set(i, 0);
    hourlyOrders.forEach((o) => {
      const h = o.createdAt.getHours();
      hourlyMap.set(h, (hourlyMap.get(h) || 0) + 1);
    });
    const hourlyData = Array.from(hourlyMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([hour, count]) => ({ hour: `${hour.toString().padStart(2, "0")}:00`, count }));

    // ── Growth calculations ───────────────────────────────────
    const revenueGrowth = previousRevenue > 0
      ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 1000) / 10
      : currentRevenue > 0 ? 100 : 0;
    const ordersGrowth = previousOrderCount > 0
      ? Math.round(((currentOrders - previousOrderCount) / previousOrderCount) * 1000) / 10
      : currentOrders > 0 ? 100 : 0;
    const visitorGrowth = previousVisitors > 0
      ? Math.round(((totalVisitors - previousVisitors) / previousVisitors) * 1000) / 10
      : totalVisitors > 0 ? 100 : 0;

    // ── Traffic sources from referrer (use already-loaded pageViews) ──
    const sourceCounts = new Map<string, number>();
    pageViews.forEach((pv) => {
      let source = "Direct";
      if (pv.referrer) {
        try {
          const url = new URL(pv.referrer);
          const host = url.hostname.replace("www.", "");
          if (host.includes("ugsex.com")) return; // skip internal
          if (host.includes("google")) source = "Google";
          else if (host.includes("facebook") || host.includes("fb.")) source = "Facebook";
          else if (host.includes("instagram")) source = "Instagram";
          else if (host.includes("tiktok")) source = "TikTok";
          else if (host.includes("youtube")) source = "YouTube";
          else if (host.includes("twitter") || host.includes("x.com")) source = "X/Twitter";
          else if (host.includes("whatsapp") || host.includes("wa.me")) source = "WhatsApp";
          else source = host;
        } catch { source = "Other"; }
      }
      sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
    });
    const trafficSources = Array.from(sourceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([source, visits]) => ({
        source,
        visits,
        pct: totalPageViews > 0 ? Math.round((visits / totalPageViews) * 1000) / 10 : 0,
      }));

    // ── Inventory value ───────────────────────────────────────
    const inventoryProducts = await prisma.product.findMany({
      where: { status: "ACTIVE", trackInventory: true },
      select: { stock: true, cjCost: true, aliexpressCost: true, price: true },
    });
    const inventoryValue = inventoryProducts.reduce((sum, p) => {
      const unitCost = Number(p.cjCost) || Number(p.aliexpressCost) || 0;
      const unitValue = unitCost > 0 ? unitCost : Number(p.price);
      return sum + unitValue * (p.stock || 0);
    }, 0);

    // ── Category breakdown ────────────────────────────────────
    const categoryBreakdown = await prisma.category.findMany({
      select: {
        name: true,
        _count: { select: { products: true } },
        products: { where: { status: "ACTIVE" }, select: { price: true, stock: true } },
      },
    });
    const categoryStats = categoryBreakdown
      .map((c) => ({
        name: c.name,
        count: c._count.products,
        totalValue: c.products.reduce((s, p) => s + Number(p.price), 0),
        totalStock: c.products.reduce((s, p) => s + (p.stock || 0), 0),
      }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count);

    // ── Most wishlisted ───────────────────────────────────────
    const wishlistedProducts = await prisma.product.findMany({
      where: { status: "ACTIVE", wishlist: { some: {} } },
      select: { name: true, stock: true, _count: { select: { wishlist: true } } },
      orderBy: { wishlist: { _count: "desc" } },
      take: 10,
    });
    const mostWishlisted = wishlistedProducts.map((p) => ({
      name: p.name,
      wishlistCount: p._count.wishlist,
      stock: p.stock || 0,
    }));

    // ── Health breakdown ──────────────────────────────────────
    const healthyStock = await prisma.product.count({
      where: { status: "ACTIVE", trackInventory: true, stock: { gt: 10, lte: 200 } },
    });
    const overstocked = await prisma.product.count({
      where: { status: "ACTIVE", trackInventory: true, stock: { gt: 200 } },
    });
    const healthBreakdown = {
      outOfStock,
      lowStock: lowStockCount,
      healthy: healthyStock,
      overstocked,
    };

    // ── Projections (simple linear trend) ─────────────────────
    const revenueValues = dailyData.map((d) => d.revenue);
    const visitorValues = dailyData.map((d) => d.visitors);
    const calcTrend = (vals: number[]) => {
      const n = vals.length;
      if (n < 2) return { slope: 0 };
      const xMean = (n - 1) / 2;
      const yMean = vals.reduce((a, b) => a + b, 0) / n;
      let num = 0, den = 0;
      vals.forEach((y, x) => { num += (x - xMean) * (y - yMean); den += (x - xMean) ** 2; });
      return { slope: den !== 0 ? num / den : 0, intercept: yMean - (den !== 0 ? num / den : 0) * xMean };
    };
    const revTrend = calcTrend(revenueValues);
    const visTrend = calcTrend(visitorValues);
    const projectedRevenue30d = Math.max(0, revenueValues.reduce((s, v) => s + v, 0) * (30 / days));
    const projectedVisitors30d = Math.max(0, Math.round(visitorValues.reduce((s, v) => s + v, 0) * (30 / days)));

    // Week-over-week
    const lastWeekStart = new Date(); lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const prevWeekStart = new Date(); prevWeekStart.setDate(prevWeekStart.getDate() - 14);
    const lastWeekRevenue = dailyData
      .filter((d) => new Date(d.date) >= lastWeekStart)
      .reduce((s, d) => s + d.revenue, 0);
    const prevWeekRevenue = dailyData
      .filter((d) => new Date(d.date) >= prevWeekStart && new Date(d.date) < lastWeekStart)
      .reduce((s, d) => s + d.revenue, 0);
    const lastWeekVisitors = dailyData
      .filter((d) => new Date(d.date) >= lastWeekStart)
      .reduce((s, d) => s + d.visitors, 0);
    const prevWeekVisitors = dailyData
      .filter((d) => new Date(d.date) >= prevWeekStart && new Date(d.date) < lastWeekStart)
      .reduce((s, d) => s + d.visitors, 0);

    // ── Business insights ─────────────────────────────────────
    const insights: { type: string; title: string; message: string }[] = [];
    if (outOfStock > 0)
      insights.push({ type: "warning", title: "Out of Stock", message: `${outOfStock} product${outOfStock > 1 ? "s" : ""} out of stock.` });
    if (lowStockCount > 3)
      insights.push({ type: "warning", title: "Low Stock Alert", message: `${lowStockCount} products running low on stock.` });
    if (revenueGrowth > 20)
      insights.push({ type: "success", title: "Revenue Growing", message: `Revenue is up ${revenueGrowth.toFixed(1)}% vs previous period.` });
    if (revenueGrowth < -20)
      insights.push({ type: "warning", title: "Revenue Declining", message: `Revenue is down ${Math.abs(revenueGrowth).toFixed(1)}% vs previous period.` });
    if (conversionRate > 3)
      insights.push({ type: "success", title: "Good Conversion", message: `Conversion rate at ${conversionRate.toFixed(1)}% — above average.` });
    if (conversionRate > 0 && conversionRate < 1)
      insights.push({ type: "info", title: "Low Conversion", message: `Conversion rate at ${conversionRate.toFixed(1)}%. Consider improving product pages.` });
    if (neverOrderedCount > 5)
      insights.push({ type: "info", title: "Dormant Products", message: `${neverOrderedCount} products have never been ordered.` });

    return res.json({
      revenue: {
        total: currentRevenue,
        collected: currentCollected,
        growth: revenueGrowth,
        daily: dailyData.map((d) => ({ date: d.date, amount: d.revenue, collected: d.collected })),
        avgOrderValue: currentOrders > 0 ? Math.round(currentRevenue / currentOrders) : 0,
      },
      orders: {
        total: currentOrders,
        allTime: await prisma.order.count(),
        growth: ordersGrowth,
        daily: dailyData.map((d) => ({ date: d.date, count: d.orders })),
        byStatus,
        funnel,
        avgPerDay: days > 0 ? Math.round((currentOrders / days) * 10) / 10 : 0,
      },
      customers: {
        registered: registeredCustomers,
        newRegistered: newRegisteredThisMonth,
        newLastMonth: newRegisteredLastMonth,
        orderCustomers: totalOrderCustomers,
        returning: returningCount,
        conversionRate: Math.round(conversionRate * 10) / 10,
      },
      products: {
        topSelling: topSellingProducts,
        lowStock: lowStockCount,
        outOfStock,
        totalActive: totalActiveProducts,
        neverOrdered: neverOrderedProducts.slice(0, 10),
        neverOrderedCount,
        dropshipMargins,
        avgDropshipMargin,
        inventoryValue,
        categoryBreakdown: categoryStats,
        mostWishlisted,
        healthBreakdown,
      },
      traffic: {
        daily: dailyData.map((d) => ({ date: d.date, visitors: d.visitors, orders: d.orders, revenue: d.revenue })),
        totalVisitors,
        visitorGrowth,
        pagesPerSession,
        bounceRate,
        topPages,
        sources: trafficSources,
        visitorsByCountry,
      },
      projections: {
        revenue30d: Math.round(projectedRevenue30d),
        visitors30d: projectedVisitors30d,
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
    });
  } catch (error) {
    logger.error("Analytics error", { error });
    return res.status(500).json({ error: "Failed to load analytics" });
  }
}));

export default router;
