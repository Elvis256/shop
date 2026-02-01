import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";

const router = Router();

router.use(authenticate, requireAdmin);

// GET /api/admin/customers
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const {
      search,
      sort = "createdAt",
      order = "desc",
      page = "1",
      limit = "20",
    } = req.query;

    const take = Math.min(parseInt(limit as string) || 20, 100);
    const skip = (Math.max(parseInt(page as string) || 1, 1) - 1) * take;

    const where: any = { role: "CUSTOMER" };

    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const orderBy: any = {};
    orderBy[sort as string] = order;

    const [customers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy,
        take,
        skip,
        include: {
          _count: { select: { orders: true, wishlist: true, reviews: true } },
          orders: {
            where: { paymentStatus: "SUCCESSFUL" },
            select: { totalAmount: true },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return res.json({
      customers: customers.map((c) => ({
        id: c.id,
        email: c.email,
        name: c.name,
        phone: c.phone,
        orderCount: c._count.orders,
        totalSpent: c.orders.reduce((sum: number, o) => sum + Number(o.totalAmount), 0),
        wishlistCount: c._count.wishlist,
        reviewCount: c._count.reviews,
        createdAt: c.createdAt,
      })),
      pagination: {
        total,
        page: Math.floor(skip / take) + 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error("Admin get customers error:", error);
    return res.status(500).json({ error: "Failed to fetch customers" });
  }
});

// GET /api/admin/customers/:id
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const customer = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        addresses: true,
        orders: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            status: true,
            createdAt: true,
          },
        },
        reviews: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { product: { select: { name: true } } },
        },
        _count: { select: { orders: true, wishlist: true, reviews: true } },
      },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Calculate total spent
    const totalSpent = await prisma.order.aggregate({
      where: {
        userId: id,
        paymentStatus: "SUCCESSFUL",
      },
      _sum: { totalAmount: true },
    });

    return res.json({
      ...customer,
      totalSpent: Number(totalSpent._sum?.totalAmount) || 0,
    });
  } catch (error) {
    console.error("Admin get customer error:", error);
    return res.status(500).json({ error: "Failed to fetch customer" });
  }
});

// PUT /api/admin/customers/:id
router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const body = z
      .object({
        name: z.string().optional(),
        phone: z.string().optional(),
        role: z.enum(["CUSTOMER", "ADMIN", "MANAGER"]).optional(),
      })
      .parse(req.body);

    const customer = await prisma.user.findUnique({ where: { id } });
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: body,
      select: { id: true, email: true, name: true, phone: true, role: true },
    });

    return res.json({ message: "Customer updated", customer: updated });
  } catch (error) {
    console.error("Admin update customer error:", error);
    return res.status(500).json({ error: "Failed to update customer" });
  }
});

export default router;
