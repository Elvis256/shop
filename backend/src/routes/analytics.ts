import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../middleware/auth";
import geoip from "geoip-lite";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

// GET /api/analytics - Admin analytics (enhanced)
router.get("/", authenticate, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { period = "30" } = req.query;
    const days = parseInt(period as string) || 30;

    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    const previousStartDate = new Date(startDate);
    previousStartDate.setDate(previousStartDate.getDate() - days);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // ─── Build daily map using DB aggregation ────────────────────────────
    const dailyMap = new Map<string, { revenue: number; orders: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      dailyMap.set(d.toISOString().split("T")[0], { revenue: 0, orders: 0 });
    }

    // Aggregate daily revenue/orders in the database instead of loading all records
    const dailyOrderAgg: Array<{ day: string; total_revenue: any; order_count: bigint }> =
      await prisma.$queryRaw`
        SELECT DATE("createdAt") as day, SUM("totalAmount") as total_revenue, COUNT(*) as order_count
        FROM "Order"
        WHERE "createdAt" >= ${startDate} AND "paymentStatus" = 'SUCCESSFUL'
        GROUP BY DATE("createdAt")
      `;
    dailyOrderAgg.forEach((row) => {
      const key = new Date(row.day).toISOString().split("T")[0];
      const e = dailyMap.get(key);
      if (e) {
        e.revenue = Number(row.total_revenue) || 0;
        e.orders = Number(row.order_count);
      }
    });

    const dailyData = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, s]) => ({ date, revenue: s.revenue, orders: s.orders, visitors: 0 }));

    // ─── Page views / visitors / country / referrer / top pages (DB aggregation) ──
    // Daily visitor counts
    const dailyVisitorAgg: Array<{ day: string; visitors: bigint }> =
      await prisma.$queryRaw`
        SELECT DATE("createdAt") as day, COUNT(DISTINCT COALESCE("sessionId", "id")) as visitors
        FROM "PageView"
        WHERE "createdAt" >= ${startDate}
        GROUP BY DATE("createdAt")
      `;
    const visitorMap = new Map<string, number>();
    dailyVisitorAgg.forEach((row) => {
      const key = new Date(row.day).toISOString().split("T")[0];
      visitorMap.set(key, Number(row.visitors));
    });

    // Country breakdown
    const countryAgg: Array<{ country: string; visitors: bigint }> =
      await prisma.$queryRaw`
        SELECT COALESCE("country", 'Unknown') as country,
               COUNT(DISTINCT COALESCE("sessionId", "id")) as visitors
        FROM "PageView"
        WHERE "createdAt" >= ${startDate}
        GROUP BY COALESCE("country", 'Unknown')
        ORDER BY visitors DESC
      `;
    const visitorsByCountry = countryAgg.map((r) => ({
      country: r.country,
      visitors: Number(r.visitors),
    }));

    // Top pages
    const topPagesAgg: Array<{ path: string; views: bigint }> =
      await prisma.$queryRaw`
        SELECT "path", COUNT(*) as views
        FROM "PageView"
        WHERE "createdAt" >= ${startDate} AND "path" NOT LIKE '/admin%'
        GROUP BY "path"
        ORDER BY views DESC
        LIMIT 10
      `;
    const topPages = topPagesAgg.map((r) => ({ path: r.path, views: Number(r.views) }));

    // Referrer sources (fetch aggregated, classify in-app)
    const referrerAgg: Array<{ referrer: string | null; cnt: bigint }> =
      await prisma.$queryRaw`
        SELECT "referrer", COUNT(*) as cnt
        FROM "PageView"
        WHERE "createdAt" >= ${startDate}
        GROUP BY "referrer"
        ORDER BY cnt DESC
        LIMIT 100
      `;
    const referrerMap = new Map<string, number>();
    referrerAgg.forEach((row) => {
      let source = "Direct";
      if (row.referrer) {
        try {
          const url = new URL(row.referrer);
          const host = url.hostname.replace("www.", "");
          if (host.includes("ugsex.com")) return; // skip internal
          else if (host.includes("google")) source = "Google";
          else if (host.includes("facebook") || host.includes("fb.com")) source = "Facebook";
          else if (host.includes("instagram")) source = "Instagram";
          else if (host.includes("twitter") || host.includes("x.com")) source = "X / Twitter";
          else if (host.includes("tiktok")) source = "TikTok";
          else if (host.includes("youtube")) source = "YouTube";
          else if (host.includes("whatsapp")) source = "WhatsApp";
          else source = host;
        } catch { source = "Other"; }
      }
      referrerMap.set(source, (referrerMap.get(source) || 0) + Number(row.cnt));
    });
    const trafficSources = Array.from(referrerMap.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Bounce rate + avg pages per session (aggregated)
    const sessionStats: Array<{ total_sessions: bigint; bounce_sessions: bigint; total_views: bigint }> =
      await prisma.$queryRaw`
        SELECT
          COUNT(*) as total_sessions,
          SUM(CASE WHEN page_count = 1 THEN 1 ELSE 0 END) as bounce_sessions,
          SUM(page_count) as total_views
        FROM (
          SELECT COALESCE("sessionId", "id") as sid, COUNT(*) as page_count
          FROM "PageView"
          WHERE "createdAt" >= ${startDate}
          GROUP BY COALESCE("sessionId", "id")
        ) sub
      `;
    const totalSessions = Number(sessionStats[0]?.total_sessions) || 0;
    const bounceSessions = Number(sessionStats[0]?.bounce_sessions) || 0;
    const totalPageViews = Number(sessionStats[0]?.total_views) || 0;
    const bounceRate = totalSessions > 0 ? (bounceSessions / totalSessions) * 100 : 0;
    const avgPagesPerSession = totalSessions > 0 ? totalPageViews / totalSessions : 0;

    // Populate daily visitor counts
    dailyData.forEach((d) => { d.visitors = visitorMap.get(d.date) || 0; });

    // ─── Revenue calculations ─────────────────────────────────────────────
    const currentRevenue = dailyData.reduce((s, d) => s + d.revenue, 0);
    const currentOrders = dailyData.reduce((s, d) => s + d.orders, 0);

    const prevPaidAgg = await prisma.order.aggregate({
      where: { createdAt: { gte: previousStartDate, lt: startDate }, paymentStatus: "SUCCESSFUL" },
      _sum: { totalAmount: true },
      _count: { id: true },
    });
    const previousRevenue = Number(prevPaidAgg._sum.totalAmount) || 0;
    const previousOrderCount = prevPaidAgg._count.id;

    // ─── Monthly stats ────────────────────────────────────────────────────
    const [monthRevAgg, lastMonthRevAgg, monthOrderCount, lastMonthOrderCount,
      newCustomersMonth, newCustomersLastMonth, totalCustomers] = await Promise.all([
      prisma.order.aggregate({ where: { paymentStatus: "SUCCESSFUL", createdAt: { gte: startOfMonth } }, _sum: { totalAmount: true } }),
      prisma.order.aggregate({ where: { paymentStatus: "SUCCESSFUL", createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } }, _sum: { totalAmount: true } }),
      prisma.order.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.order.count({ where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
      prisma.user.count({ where: { role: "CUSTOMER", createdAt: { gte: startOfMonth } } }),
      prisma.user.count({ where: { role: "CUSTOMER", createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
    ]);

    const monthRev = Number(monthRevAgg._sum.totalAmount) || 0;
    const lastMonthRev = Number(lastMonthRevAgg._sum.totalAmount) || 0;
    const revenueGrowth = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;
    const ordersGrowth = previousOrderCount > 0 ? ((currentOrders - previousOrderCount) / previousOrderCount) * 100 : 0;

    // ─── Orders by status ─────────────────────────────────────────────────
    const statusGroups = await prisma.order.groupBy({
      by: ["status"],
      where: { createdAt: { gte: startDate } },
      _count: { id: true },
    });
    const byStatus: Record<string, number> = {};
    statusGroups.forEach((s) => { byStatus[s.status] = s._count.id; });

    // ─── Top selling products ─────────────────────────────────────────────
    const topItems = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: { order: { paymentStatus: "SUCCESSFUL", createdAt: { gte: startDate } } },
      _sum: { quantity: true, price: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 10,
    });
    const topProductIds = topItems.map((p) => p.productId);
    const productDetails = await prisma.product.findMany({
      where: { id: { in: topProductIds } },
      select: { id: true, name: true, slug: true },
    });
    const topSelling = topItems.map((p) => ({
      name: productDetails.find((pd) => pd.id === p.productId)?.name || "Unknown",
      slug: productDetails.find((pd) => pd.id === p.productId)?.slug || "",
      sold: p._sum.quantity || 0,
      revenue: Number(p._sum.price) || 0,
    }));

    // ─── Product & Inventory analytics ────────────────────────────────────
    const allProducts = await prisma.product.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true, name: true, slug: true, price: true, stock: true, categoryId: true,
        cjCost: true, aliexpressCost: true, cjProductId: true, aliexpressProductId: true,
        featured: true, isBestseller: true, isNew: true, createdAt: true,
        _count: { select: { orderItems: true, wishlist: true } },
      },
    });

    const categories = await prisma.category.findMany({
      select: { id: true, name: true, slug: true },
    });
    const categoryMap = new Map(categories.map(c => [c.id, c]));

    // Category breakdown
    const categoryBreakdown = new Map<string, { name: string; count: number; totalValue: number; totalStock: number }>();
    allProducts.forEach((p) => {
      const catId = p.categoryId || "uncategorized";
      const cat = categoryMap.get(catId);
      const catName = cat?.name || "Uncategorized";
      if (!categoryBreakdown.has(catId)) {
        categoryBreakdown.set(catId, { name: catName, count: 0, totalValue: 0, totalStock: 0 });
      }
      const entry = categoryBreakdown.get(catId)!;
      entry.count += 1;
      entry.totalValue += Number(p.price) * p.stock;
      entry.totalStock += p.stock;
    });

    const categoryStats = Array.from(categoryBreakdown.values())
      .sort((a, b) => b.count - a.count);

    // Inventory health
    const totalInventoryValue = allProducts.reduce((s, p) => s + Number(p.price) * p.stock, 0);
    const outOfStock = allProducts.filter(p => p.stock === 0);
    const lowStock = allProducts.filter(p => p.stock > 0 && p.stock <= 10);
    const healthyStock = allProducts.filter(p => p.stock > 10);
    const overstocked = allProducts.filter(p => p.stock > 100);

    // Product margin analysis (for dropship products)
    const dropshipProducts = allProducts
      .filter(p => p.cjCost || p.aliexpressCost)
      .map(p => {
        const cost = Number(p.cjCost || p.aliexpressCost || 0);
        const costUGX = cost * 3700; // approximate USD to UGX
        const price = Number(p.price);
        const margin = price > 0 ? ((price - costUGX) / price) * 100 : 0;
        return {
          name: p.name,
          slug: p.slug,
          price,
          costUSD: cost,
          costUGX: Math.round(costUGX),
          margin: Math.round(margin * 10) / 10,
          source: p.cjProductId ? "CJ" : "AliExpress",
        };
      })
      .sort((a, b) => b.margin - a.margin);

    // Most wishlisted products (demand signal)
    const mostWishlisted = allProducts
      .filter(p => p._count.wishlist > 0)
      .sort((a, b) => b._count.wishlist - a._count.wishlist)
      .slice(0, 5)
      .map(p => ({ name: p.name, slug: p.slug, wishlistCount: p._count.wishlist, stock: p.stock }));

    // Products with no orders (potential dead stock)
    const neverOrdered = allProducts
      .filter(p => p._count.orderItems === 0)
      .map(p => ({ name: p.name, slug: p.slug, stock: p.stock, price: Number(p.price), daysListed: Math.floor((now.getTime() - p.createdAt.getTime()) / 86400000) }))
      .sort((a, b) => b.daysListed - a.daysListed)
      .slice(0, 10);

    // ─── Revenue Projection (linear regression) ───────────────────────────
    const revenueValues = dailyData.map(d => d.revenue);
    const orderValues = dailyData.map(d => d.orders);
    const visitorValues = dailyData.map(d => d.visitors);

    function linearRegression(values: number[]): { slope: number; intercept: number } {
      const n = values.length;
      if (n < 2) return { slope: 0, intercept: 0 };
      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      for (let i = 0; i < n; i++) {
        sumX += i; sumY += values[i]; sumXY += i * values[i]; sumXX += i * i;
      }
      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;
      return { slope: isNaN(slope) ? 0 : slope, intercept: isNaN(intercept) ? 0 : intercept };
    }

    const revTrend = linearRegression(revenueValues);
    const visTrend = linearRegression(visitorValues);

    // Project next 30 days
    const projectedRevenue30d = Math.max(0, Array.from({ length: 30 }, (_, i) =>
      Math.max(0, revTrend.slope * (revenueValues.length + i) + revTrend.intercept)
    ).reduce((s, v) => s + v, 0));

    const projectedVisitors30d = Math.max(0, Math.round(Array.from({ length: 30 }, (_, i) =>
      Math.max(0, visTrend.slope * (visitorValues.length + i) + visTrend.intercept)
    ).reduce((s, v) => s + v, 0)));

    // Weekly comparison
    const last7 = dailyData.slice(-7);
    const prev7 = dailyData.slice(-14, -7);
    const lastWeekRevenue = last7.reduce((s, d) => s + d.revenue, 0);
    const prevWeekRevenue = prev7.reduce((s, d) => s + d.revenue, 0);
    const lastWeekVisitors = last7.reduce((s, d) => s + d.visitors, 0);
    const prevWeekVisitors = prev7.reduce((s, d) => s + d.visitors, 0);

    // ─── Order funnel (DB aggregation) ──────────────────────────────────
    const funnelAgg = await prisma.order.groupBy({
      by: ["paymentStatus"],
      where: { createdAt: { gte: startDate } },
      _count: { id: true },
      _sum: { totalAmount: true },
    });
    const funnelMap = new Map(funnelAgg.map((f) => [f.paymentStatus, { count: f._count.id, sum: Number(f._sum.totalAmount) || 0 }]));
    const orderFunnel = {
      totalOrders: funnelAgg.reduce((s, f) => s + f._count.id, 0),
      pending: funnelMap.get("PENDING")?.count || 0,
      successful: funnelMap.get("SUCCESSFUL")?.count || 0,
      failed: funnelMap.get("FAILED")?.count || 0,
      pendingValue: funnelMap.get("PENDING")?.sum || 0,
    };

    // ─── Payments ─────────────────────────────────────────────────────────
    const payments = await prisma.payment.groupBy({
      by: ["method"],
      where: { status: "SUCCESSFUL", createdAt: { gte: startDate } },
      _count: { id: true },
      _sum: { amount: true },
    });

    const hourlyAgg: Array<{ hour: number; cnt: bigint }> =
      await prisma.$queryRaw`
        SELECT EXTRACT(HOUR FROM "createdAt")::int as hour, COUNT(*) as cnt
        FROM "Order"
        WHERE "createdAt" >= ${startDate} AND "paymentStatus" = 'SUCCESSFUL'
        GROUP BY EXTRACT(HOUR FROM "createdAt")::int
      `;
    const hourlyMap = new Map<number, number>();
    for (let i = 0; i < 24; i++) hourlyMap.set(i, 0);
    hourlyAgg.forEach((row) => hourlyMap.set(row.hour, Number(row.cnt)));
    const hourlyOrders = Array.from(hourlyMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([hour, count]) => ({ hour: `${String(hour).padStart(2, "0")}:00`, count }));

    const totalVisitors = dailyData.reduce((s, d) => s + d.visitors, 0);
    const conversionRate = totalVisitors > 0 ? (currentOrders / totalVisitors) * 100 : 0;

    // ─── Auto-generated Business Insights ─────────────────────────────────
    const insights: Array<{ type: "success" | "warning" | "info" | "danger"; title: string; message: string }> = [];

    if (outOfStock.length > 0) {
      insights.push({
        type: "danger",
        title: "Out of Stock Alert",
        message: `${outOfStock.length} product${outOfStock.length > 1 ? "s are" : " is"} out of stock: ${outOfStock.slice(0, 3).map(p => p.name).join(", ")}${outOfStock.length > 3 ? ` and ${outOfStock.length - 3} more` : ""}.`,
      });
    }

    if (lowStock.length > 0) {
      insights.push({
        type: "warning",
        title: "Low Stock Warning",
        message: `${lowStock.length} product${lowStock.length > 1 ? "s have" : " has"} low stock (≤10 units). Consider restocking soon.`,
      });
    }

    if (orderFunnel.pending > 0) {
      insights.push({
        type: "info",
        title: "Pending Orders",
        message: `You have ${orderFunnel.pending} pending order${orderFunnel.pending > 1 ? "s" : ""} worth USh ${orderFunnel.pendingValue.toLocaleString()}. Follow up to convert them.`,
      });
    }

    if (neverOrdered.length > 5) {
      insights.push({
        type: "warning",
        title: "Slow Moving Products",
        message: `${neverOrdered.length} products have never been ordered. Consider running promotions or improving their listings.`,
      });
    }

    if (revTrend.slope > 0) {
      insights.push({ type: "success", title: "Revenue Trending Up", message: `Your daily revenue is trending upward. Projected revenue for next 30 days: USh ${Math.round(projectedRevenue30d).toLocaleString()}.` });
    } else if (revTrend.slope < 0 && currentRevenue > 0) {
      insights.push({ type: "warning", title: "Revenue Declining", message: "Your daily revenue is trending downward. Consider running promotions or expanding your product range." });
    }

    if (visTrend.slope > 0) {
      insights.push({ type: "success", title: "Traffic Growing", message: `Visitor traffic is increasing. Projected visitors next 30 days: ${projectedVisitors30d.toLocaleString()}.` });
    }

    if (bounceRate > 70) {
      insights.push({ type: "warning", title: "High Bounce Rate", message: `${bounceRate.toFixed(0)}% of visitors leave after one page. Improve product pages and site navigation.` });
    }

    if (conversionRate === 0 && totalVisitors > 50) {
      insights.push({ type: "info", title: "Conversion Opportunity", message: `You've had ${totalVisitors} visitors but no completed sales. Consider: lower prices, add reviews, improve checkout flow, or offer a first-order discount.` });
    }

    if (dropshipProducts.length > 0) {
      const avgMargin = dropshipProducts.reduce((s, p) => s + p.margin, 0) / dropshipProducts.length;
      if (avgMargin < 40) {
        insights.push({ type: "warning", title: "Low Profit Margins", message: `Average margin on dropship products is ${avgMargin.toFixed(0)}%. Consider increasing prices or finding cheaper suppliers.` });
      }
    }

    // ─── Return comprehensive response ────────────────────────────────────
    return res.json({
      revenue: {
        total: currentRevenue,
        growth: revenueGrowth,
        daily: dailyData.map((d) => ({ date: d.date, amount: d.revenue })),
        avgOrderValue: currentOrders > 0 ? Math.round(currentRevenue / currentOrders) : 0,
        thisMonth: monthRev,
        lastMonth: lastMonthRev,
        monthChange: lastMonthRev > 0 ? ((monthRev - lastMonthRev) / lastMonthRev) * 100 : 0,
      },
      orders: {
        total: currentOrders,
        growth: ordersGrowth,
        daily: dailyData.map((d) => ({ date: d.date, count: d.orders })),
        byStatus,
        avgPerDay: Math.round(currentOrders / days),
        thisMonth: monthOrderCount,
        lastMonth: lastMonthOrderCount,
        monthChange: lastMonthOrderCount > 0 ? ((monthOrderCount - lastMonthOrderCount) / lastMonthOrderCount) * 100 : 0,
        funnel: orderFunnel,
      },
      customers: {
        total: totalCustomers,
        newThisMonth: newCustomersMonth,
        newLastMonth: newCustomersLastMonth,
        returning: 0,
        conversionRate,
      },
      products: {
        topSelling,
        lowStock: lowStock.length,
        outOfStock: outOfStock.length,
        totalActive: allProducts.length,
        categoryBreakdown: categoryStats,
        dropshipMargins: dropshipProducts.slice(0, 10),
        mostWishlisted,
        neverOrdered: neverOrdered.slice(0, 10),
        inventoryValue: Math.round(totalInventoryValue),
        healthBreakdown: {
          outOfStock: outOfStock.length,
          lowStock: lowStock.length,
          healthy: healthyStock.length,
          overstocked: overstocked.length,
        },
      },
      traffic: {
        daily: dailyData,
        totalVisitors,
        bounceRate: Math.round(bounceRate * 10) / 10,
        avgPagesPerSession: Math.round(avgPagesPerSession * 10) / 10,
        visitorsByCountry,
        trafficSources,
        topPages,
      },
      projections: {
        revenue30d: Math.round(projectedRevenue30d),
        visitors30d: projectedVisitors30d,
        revenueTrend: revTrend.slope > 0 ? "up" : revTrend.slope < 0 ? "down" : "flat",
        visitorTrend: visTrend.slope > 0 ? "up" : visTrend.slope < 0 ? "down" : "flat",
        weekOverWeek: {
          revenue: { current: lastWeekRevenue, previous: prevWeekRevenue, change: prevWeekRevenue > 0 ? ((lastWeekRevenue - prevWeekRevenue) / prevWeekRevenue) * 100 : 0 },
          visitors: { current: lastWeekVisitors, previous: prevWeekVisitors, change: prevWeekVisitors > 0 ? ((lastWeekVisitors - prevWeekVisitors) / prevWeekVisitors) * 100 : 0 },
        },
      },
      paymentMethods: payments.map((p) => ({ name: p.method || "Other", count: p._count.id, amount: Number(p._sum.amount) || 0 })),
      hourlyOrders,
      insights,
    });
  } catch (error) {
    logger.error("Analytics GET error", { error });
    return res.status(500).json({ error: "Failed to load analytics" });
  }
}));

// POST /api/analytics/track - record a page view
router.post("/track", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { path, referrer, sessionId } = req.body;
    if (!path) return res.status(400).json({ error: "path required" });

    const ip = (req.headers["x-real-ip"] as string) || req.ip || "";
    const cleanIp = ip.replace(/^::ffff:/, "");
    const geo = geoip.lookup(cleanIp);

    await prisma.pageView.create({
      data: {
        path: String(path).slice(0, 500),
        referrer: referrer ? String(referrer).slice(0, 500) : null,
        userAgent: req.headers["user-agent"]?.slice(0, 500) || null,
        sessionId: sessionId ? String(sessionId).slice(0, 64) : null,
        ipAddress: cleanIp.slice(0, 45) || null,
        country: geo?.country || null,
        region: geo?.region || null,
        city: geo?.city || null,
      },
    });

    return res.status(204).send();
  } catch {
    return res.status(204).send();
  }
}));

export default router;
