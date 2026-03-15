import { Router, Response } from "express";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate, requireAdmin);

// GET /api/admin/dashboard
router.get("/", async (req: AuthRequest, res: Response) => {
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
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return res.status(500).json({ error: "Failed to load dashboard" });
  }
});

// GET /api/admin/analytics
router.get("/analytics", async (req: AuthRequest, res: Response) => {
  try {
    const { period = "30" } = req.query;
    const days = parseInt(period as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const previousStartDate = new Date(startDate);
    previousStartDate.setDate(previousStartDate.getDate() - days);

    // Active orders = not cancelled/refunded (includes COD with pending payment)
    const activeFilter = { status: { notIn: ["CANCELLED", "REFUNDED"] as ("CANCELLED" | "REFUNDED")[] } };

    // ── Daily order data (active orders) ──────────────────────
    const dailyMap = new Map<string, { revenue: number; orders: number; collected: number }>();
    for (let i = 0; i <= days; i++) {
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
      select: { createdAt: true, sessionId: true, path: true },
    });
    const visitorMap = new Map<string, Set<string>>();
    const allSessions = new Set<string>();
    const pathCounts = new Map<string, number>();
    let totalPageViews = 0;

    pageViews.forEach((pv) => {
      const key = pv.createdAt.toISOString().split("T")[0];
      const sid = pv.sessionId || pv.createdAt.toISOString();
      if (!visitorMap.has(key)) visitorMap.set(key, new Set());
      visitorMap.get(key)!.add(sid);
      allSessions.add(sid);
      totalPageViews++;
      const p = pv.path || "/";
      pathCounts.set(p, (pathCounts.get(p) || 0) + 1);
    });

    dailyData.forEach((d) => {
      d.visitors = visitorMap.get(d.date)?.size || 0;
    });

    const totalVisitors = allSessions.size;
    const pagesPerSession = totalVisitors > 0 ? Math.round((totalPageViews / totalVisitors) * 10) / 10 : 0;

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
    const newRegistered = await prisma.user.count({
      where: { role: "CUSTOMER", createdAt: { gte: startDate } },
    });

    // Unique customers from orders (includes guests)
    const uniqueEmails = await prisma.order.findMany({
      where: { createdAt: { gte: startDate } },
      select: { customerEmail: true },
      distinct: ["customerEmail"],
    });
    const totalOrderCustomers = uniqueEmails.length;

    // Repeat customers
    const repeatBuyers = await prisma.order.groupBy({
      by: ["customerEmail"],
      where: { createdAt: { gte: startDate }, ...activeFilter },
      _count: { id: true },
    });
    const returningCount = repeatBuyers.filter((r) => r._count.id > 1).length;

    const conversionRate = totalVisitors > 0 ? (currentOrders / totalVisitors) * 100 : 0;

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

    // Never ordered products
    const orderedProductIds = await prisma.orderItem.findMany({
      select: { productId: true },
      distinct: ["productId"],
    });
    const orderedSet = new Set(orderedProductIds.map((p) => p.productId));
    const allActiveProducts = await prisma.product.findMany({
      where: { status: "ACTIVE" },
      select: { id: true },
    });
    const neverOrdered = allActiveProducts.filter((p) => !orderedSet.has(p.id)).length;

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

    // ── Traffic sources from referrer ─────────────────────────
    const referrerViews = await prisma.pageView.findMany({
      where: { createdAt: { gte: startDate } },
      select: { referrer: true },
    });
    const sourceCounts = new Map<string, number>();
    referrerViews.forEach((pv) => {
      let source = "Direct";
      if (pv.referrer) {
        try {
          const url = new URL(pv.referrer);
          source = url.hostname.replace("www.", "");
        } catch { source = pv.referrer; }
      }
      sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
    });
    const trafficSources = Array.from(sourceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([source, visits]) => ({
        source,
        visits,
        pct: totalPageViews > 0 ? Math.round((visits / totalPageViews) * 100) : 0,
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
        newRegistered,
        orderCustomers: totalOrderCustomers,
        returning: returningCount,
        conversionRate: Math.round(conversionRate * 10) / 10,
      },
      products: {
        topSelling: topSellingProducts,
        lowStock: lowStockCount,
        outOfStock,
        totalActive: totalActiveProducts,
        neverOrdered,
        dropshipMargins,
        avgDropshipMargin,
        inventoryValue,
      },
      traffic: {
        daily: dailyData.map((d) => ({ date: d.date, visitors: d.visitors, orders: d.orders, revenue: d.revenue })),
        totalVisitors,
        visitorGrowth,
        pagesPerSession,
        topPages,
        sources: trafficSources,
        bounceRate: 0,
      },
      paymentMethods,
      hourlyOrders: hourlyData,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return res.status(500).json({ error: "Failed to load analytics" });
  }
});

export default router;
