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

    // Get daily revenue and orders
    const dailyStats = await prisma.order.groupBy({
      by: ["createdAt"],
      where: {
        createdAt: { gte: startDate },
        paymentStatus: "SUCCESSFUL",
      },
      _sum: { totalAmount: true },
      _count: { id: true },
    });

    // Aggregate by date (since groupBy gives per-record, we need to aggregate)
    const dailyMap = new Map<string, { revenue: number; orders: number }>();
    
    // Initialize all days in range
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dateKey = d.toISOString().split("T")[0];
      dailyMap.set(dateKey, { revenue: 0, orders: 0 });
    }

    // Get actual daily data
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: startDate },
        paymentStatus: "SUCCESSFUL",
      },
      select: {
        createdAt: true,
        totalAmount: true,
      },
    });

    orders.forEach((order) => {
      const dateKey = order.createdAt.toISOString().split("T")[0];
      const existing = dailyMap.get(dateKey) || { revenue: 0, orders: 0 };
      existing.revenue += Number(order.totalAmount);
      existing.orders += 1;
      dailyMap.set(dateKey, existing);
    });

    const dailyData = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({
        date,
        revenue: stats.revenue,
        orders: stats.orders,
        visitors: 0, // filled below from real PageView data
      }));

    // Real visitor data from PageView table
    const pageViews = await prisma.pageView.findMany({
      where: { createdAt: { gte: startDate } },
      select: { createdAt: true, sessionId: true },
    });
    const visitorMap = new Map<string, Set<string>>();
    pageViews.forEach((pv) => {
      const dateKey = pv.createdAt.toISOString().split("T")[0];
      if (!visitorMap.has(dateKey)) visitorMap.set(dateKey, new Set());
      visitorMap.get(dateKey)!.add(pv.sessionId || pv.createdAt.toISOString());
    });
    dailyData.forEach((d) => {
      d.visitors = visitorMap.get(d.date)?.size || 0;
    });

    // Current period totals
    const currentRevenue = dailyData.reduce((sum, d) => sum + d.revenue, 0);
    const currentOrders = dailyData.reduce((sum, d) => sum + d.orders, 0);

    // Previous period totals for comparison
    const previousOrders = await prisma.order.findMany({
      where: {
        createdAt: { gte: previousStartDate, lt: startDate },
        paymentStatus: "SUCCESSFUL",
      },
      select: { totalAmount: true },
    });
    const previousRevenue = previousOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const previousOrderCount = previousOrders.length;

    // Orders by status
    const ordersByStatus = await prisma.order.groupBy({
      by: ["status"],
      where: { createdAt: { gte: startDate } },
      _count: { id: true },
    });
    const byStatus: Record<string, number> = {};
    ordersByStatus.forEach((s) => {
      byStatus[s.status] = s._count.id;
    });

    // Customer stats
    const totalCustomers = await prisma.user.count({ where: { role: "CUSTOMER" } });
    const newCustomers = await prisma.user.count({
      where: {
        role: "CUSTOMER",
        createdAt: { gte: startDate },
      },
    });
    const returningCustomers = await prisma.order.groupBy({
      by: ["userId"],
      where: {
        createdAt: { gte: startDate },
        paymentStatus: "SUCCESSFUL",
      },
      _count: { id: true },
      having: {
        id: { _count: { gt: 1 } },
      },
    });

    // Top selling products
    const topProducts = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        order: {
          createdAt: { gte: startDate },
          paymentStatus: "SUCCESSFUL",
        },
      },
      _sum: { quantity: true, price: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 6,
    });

    const productDetails = await prisma.product.findMany({
      where: { id: { in: topProducts.map((p) => p.productId) } },
      select: { id: true, name: true },
    });

    const topSellingProducts = topProducts.map((p) => {
      const product = productDetails.find((pd) => pd.id === p.productId);
      return {
        name: product?.name || "Unknown",
        sold: p._sum.quantity || 0,
        revenue: Number(p._sum.price) || 0,
      };
    });

    // Low stock products
    const lowStockCount = await prisma.product.count({
      where: {
        stock: { lte: 10 },
        status: "ACTIVE",
      },
    });

    const totalActiveProducts = await prisma.product.count({
      where: { status: "ACTIVE" },
    });

    // Payment methods
    const payments = await prisma.payment.groupBy({
      by: ["method"],
      where: {
        status: "SUCCESSFUL",
        createdAt: { gte: startDate },
      },
      _count: { id: true },
      _sum: { amount: true },
    });

    const paymentMethods = payments.map((p) => ({
      name: p.method || "Other",
      count: p._count.id,
      amount: Number(p._sum.amount) || 0,
    }));

    // Hourly orders distribution
    const hourlyOrders = await prisma.order.findMany({
      where: {
        createdAt: { gte: startDate },
        paymentStatus: "SUCCESSFUL",
      },
      select: { createdAt: true },
    });

    const hourlyMap = new Map<number, number>();
    for (let i = 0; i < 24; i++) hourlyMap.set(i, 0);
    hourlyOrders.forEach((o) => {
      const hour = o.createdAt.getHours();
      hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
    });

    const hourlyData = Array.from(hourlyMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([hour, count]) => ({
        hour: `${hour.toString().padStart(2, "0")}:00`,
        count,
      }));

    // Calculate growth percentages
    const revenueGrowth = previousRevenue > 0 
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 
      : 0;
    const ordersGrowth = previousOrderCount > 0 
      ? ((currentOrders - previousOrderCount) / previousOrderCount) * 100 
      : 0;

    // Total visitors (simulated based on orders with conversion rate)
    const totalVisitors = dailyData.reduce((sum, d) => sum + d.visitors, 0);
    const conversionRate = totalVisitors > 0 ? (currentOrders / totalVisitors) * 100 : 0;

    return res.json({
      revenue: {
        total: currentRevenue,
        growth: revenueGrowth,
        daily: dailyData.map((d) => ({ date: d.date, amount: d.revenue })),
        avgOrderValue: currentOrders > 0 ? Math.round(currentRevenue / currentOrders) : 0,
      },
      orders: {
        total: currentOrders,
        growth: ordersGrowth,
        daily: dailyData.map((d) => ({ date: d.date, count: d.orders })),
        byStatus,
        avgPerDay: Math.round(currentOrders / days),
      },
      customers: {
        total: totalCustomers,
        newThisMonth: newCustomers,
        returning: returningCustomers.length,
        conversionRate,
      },
      products: {
        topSelling: topSellingProducts,
        lowStock: lowStockCount,
        totalActive: totalActiveProducts,
      },
      traffic: {
        daily: dailyData.map((d) => ({
          date: d.date,
          visitors: d.visitors,
          orders: d.orders,
          revenue: d.revenue,
        })),
        totalVisitors,
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
