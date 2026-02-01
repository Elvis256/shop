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
      // Low stock products
      prisma.product.count({
        where: {
          status: "ACTIVE",
          trackInventory: true,
          stock: { lte: prisma.product.fields.lowStockAlert },
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
          currency: "KES",
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

    // Daily revenue for chart
    const dailyRevenue = await prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        SUM(total_amount) as revenue,
        COUNT(*) as orders
      FROM orders
      WHERE created_at >= ${startDate}
        AND status IN ('PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED')
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    // Category performance
    const categoryStats = await prisma.$queryRaw`
      SELECT 
        c.name as category,
        SUM(oi.quantity) as sold,
        SUM(oi.price * oi.quantity) as revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.created_at >= ${startDate}
        AND o.status IN ('PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED')
      GROUP BY c.id, c.name
      ORDER BY revenue DESC
    `;

    // Payment method breakdown
    const paymentMethods = await prisma.payment.groupBy({
      by: ["method"],
      where: {
        status: "SUCCESSFUL",
        createdAt: { gte: startDate },
      },
      _count: { method: true },
      _sum: { amount: true },
    });

    return res.json({
      period: days,
      dailyRevenue,
      categoryStats,
      paymentMethods: paymentMethods.map((pm) => ({
        method: pm.method,
        count: pm._count.method,
        amount: pm._sum.amount,
      })),
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return res.status(500).json({ error: "Failed to load analytics" });
  }
});

export default router;
