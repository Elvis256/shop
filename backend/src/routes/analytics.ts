import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../middleware/auth";

const router = Router();

// GET /api/analytics - Admin analytics
router.get("/", authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
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

    // Build daily map
    const dailyMap = new Map<string, { revenue: number; orders: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      dailyMap.set(d.toISOString().split("T")[0], { revenue: 0, orders: 0 });
    }

    const paidOrders = await prisma.order.findMany({
      where: { createdAt: { gte: startDate }, paymentStatus: "SUCCESSFUL" },
      select: { createdAt: true, totalAmount: true },
    });
    paidOrders.forEach((o) => {
      const key = o.createdAt.toISOString().split("T")[0];
      const e = dailyMap.get(key) || { revenue: 0, orders: 0 };
      e.revenue += Number(o.totalAmount);
      e.orders += 1;
      dailyMap.set(key, e);
    });

    const dailyData = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, s]) => ({ date, revenue: s.revenue, orders: s.orders, visitors: 0 }));

    // Page views for visitors
    const pageViews = await prisma.pageView.findMany({
      where: { createdAt: { gte: startDate } },
      select: { createdAt: true, sessionId: true },
    });
    const visitorMap = new Map<string, Set<string>>();
    pageViews.forEach((pv) => {
      const key = pv.createdAt.toISOString().split("T")[0];
      if (!visitorMap.has(key)) visitorMap.set(key, new Set());
      visitorMap.get(key)!.add(pv.sessionId || pv.createdAt.toISOString());
    });
    dailyData.forEach((d) => { d.visitors = visitorMap.get(d.date)?.size || 0; });

    const currentRevenue = dailyData.reduce((s, d) => s + d.revenue, 0);
    const currentOrders = dailyData.reduce((s, d) => s + d.orders, 0);

    const prevPaid = await prisma.order.findMany({
      where: { createdAt: { gte: previousStartDate, lt: startDate }, paymentStatus: "SUCCESSFUL" },
      select: { totalAmount: true },
    });
    const previousRevenue = prevPaid.reduce((s, o) => s + Number(o.totalAmount), 0);
    const previousOrderCount = prevPaid.length;

    // Monthly stats for cards
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

    // Orders by status
    const statusGroups = await prisma.order.groupBy({
      by: ["status"],
      where: { createdAt: { gte: startDate } },
      _count: { id: true },
    });
    const byStatus: Record<string, number> = {};
    statusGroups.forEach((s) => { byStatus[s.status] = s._count.id; });

    // Top products
    const topItems = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: { order: { paymentStatus: "SUCCESSFUL", createdAt: { gte: startDate } } },
      _sum: { quantity: true, price: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    });
    const productDetails = await prisma.product.findMany({
      where: { id: { in: topItems.map((p) => p.productId) } },
      select: { id: true, name: true },
    });
    const topSelling = topItems.map((p) => ({
      name: productDetails.find((pd) => pd.id === p.productId)?.name || "Unknown",
      sold: p._sum.quantity || 0,
      revenue: Number(p._sum.price) || 0,
    }));

    const [lowStockCount, totalActiveProducts] = await Promise.all([
      prisma.product.count({ where: { stock: { lte: 10 }, status: "ACTIVE" } }),
      prisma.product.count({ where: { status: "ACTIVE" } }),
    ]);

    const payments = await prisma.payment.groupBy({
      by: ["method"],
      where: { status: "SUCCESSFUL", createdAt: { gte: startDate } },
      _count: { id: true },
      _sum: { amount: true },
    });

    const hourlyRaw = await prisma.order.findMany({
      where: { createdAt: { gte: startDate }, paymentStatus: "SUCCESSFUL" },
      select: { createdAt: true },
    });
    const hourlyMap = new Map<number, number>();
    for (let i = 0; i < 24; i++) hourlyMap.set(i, 0);
    hourlyRaw.forEach((o) => hourlyMap.set(o.createdAt.getHours(), (hourlyMap.get(o.createdAt.getHours()) || 0) + 1));
    const hourlyOrders = Array.from(hourlyMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([hour, count]) => ({ hour: `${String(hour).padStart(2, "0")}:00`, count }));

    const totalVisitors = dailyData.reduce((s, d) => s + d.visitors, 0);
    const conversionRate = totalVisitors > 0 ? (currentOrders / totalVisitors) * 100 : 0;

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
        lowStock: lowStockCount,
        totalActive: totalActiveProducts,
      },
      traffic: {
        daily: dailyData,
        totalVisitors,
        bounceRate: 0,
      },
      paymentMethods: payments.map((p) => ({ name: p.method || "Other", count: p._count.id, amount: Number(p._sum.amount) || 0 })),
      hourlyOrders,
    });
  } catch (error) {
    console.error("Analytics GET error:", error);
    return res.status(500).json({ error: "Failed to load analytics" });
  }
});

// POST /api/analytics/track - record a page view
router.post("/track", async (req: Request, res: Response) => {
  try {
    const { path, referrer, sessionId } = req.body;
    if (!path) return res.status(400).json({ error: "path required" });

    await prisma.pageView.create({
      data: {
        path: String(path).slice(0, 500),
        referrer: referrer ? String(referrer).slice(0, 500) : null,
        userAgent: req.headers["user-agent"]?.slice(0, 500) || null,
        sessionId: sessionId ? String(sessionId).slice(0, 64) : null,
      },
    });

    return res.status(204).send();
  } catch {
    return res.status(204).send(); // silently fail — never break the page
  }
});

export default router;
