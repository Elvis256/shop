import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";

const router = Router();

router.use(authenticate, requireAdmin);

// GET /api/admin/customers — Combined registered users + guest order customers
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const {
      search,
      sort = "lastOrder",
      order = "desc",
      page = "1",
      limit = "20",
      filter,
    } = req.query;

    const take = Math.min(parseInt(limit as string) || 20, 100);
    const pageNum = Math.max(parseInt(page as string) || 1, 1);
    const skip = (pageNum - 1) * take;
    const searchStr = (search as string || "").trim().toLowerCase();

    // Aggregate all customers from orders (both registered and guest)
    const allOrders = await prisma.order.findMany({
      select: {
        userId: true,
        customerEmail: true,
        customerName: true,
        customerPhone: true,
        totalAmount: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Build customer map keyed by email (lowercase)
    const customerMap = new Map<string, {
      id: string | null;
      email: string;
      name: string;
      phone: string | null;
      isRegistered: boolean;
      orderCount: number;
      totalSpent: number;
      activeOrders: number;
      lastOrderDate: Date | null;
      firstOrderDate: Date | null;
    }>();

    for (const o of allOrders) {
      const key = o.customerEmail.toLowerCase();
      const existing = customerMap.get(key);
      const amt = Number(o.totalAmount) || 0;
      const isActive = !["CANCELLED", "REFUNDED"].includes(o.status);

      if (existing) {
        existing.orderCount++;
        if (isActive) {
          existing.totalSpent += amt;
          existing.activeOrders++;
        }
        if (!existing.name && o.customerName) existing.name = o.customerName;
        if (!existing.phone && o.customerPhone) existing.phone = o.customerPhone;
        if (!existing.firstOrderDate || o.createdAt < existing.firstOrderDate) existing.firstOrderDate = o.createdAt;
      } else {
        customerMap.set(key, {
          id: o.userId,
          email: o.customerEmail,
          name: o.customerName || "",
          phone: o.customerPhone || null,
          isRegistered: !!o.userId,
          orderCount: 1,
          totalSpent: isActive ? amt : 0,
          activeOrders: isActive ? 1 : 0,
          lastOrderDate: o.createdAt,
          firstOrderDate: o.createdAt,
        });
      }
    }

    // Also include registered customers who may not have ordered
    const registeredUsers = await prisma.user.findMany({
      where: { role: "CUSTOMER" },
      select: { id: true, email: true, name: true, phone: true, createdAt: true, isBlocked: true },
    });

    for (const u of registeredUsers) {
      const key = u.email.toLowerCase();
      if (customerMap.has(key)) {
        const c = customerMap.get(key)!;
        c.id = u.id;
        c.isRegistered = true;
        if (!c.name && u.name) c.name = u.name || "";
        if (!c.phone && u.phone) c.phone = u.phone;
      } else {
        customerMap.set(key, {
          id: u.id,
          email: u.email,
          name: u.name || "",
          phone: u.phone || null,
          isRegistered: true,
          orderCount: 0,
          totalSpent: 0,
          activeOrders: 0,
          lastOrderDate: null,
          firstOrderDate: u.createdAt,
        });
      }
    }

    // Convert to array and apply search/filter
    let customers = Array.from(customerMap.values());

    if (searchStr) {
      customers = customers.filter((c) =>
        c.email.toLowerCase().includes(searchStr) ||
        c.name.toLowerCase().includes(searchStr) ||
        (c.phone && c.phone.includes(searchStr))
      );
    }

    if (filter === "registered") {
      customers = customers.filter((c) => c.isRegistered);
    } else if (filter === "guest") {
      customers = customers.filter((c) => !c.isRegistered);
    }

    // Sort
    const sortField = sort as string;
    customers.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "email": cmp = a.email.localeCompare(b.email); break;
        case "orders": cmp = a.orderCount - b.orderCount; break;
        case "spent": cmp = a.totalSpent - b.totalSpent; break;
        case "lastOrder":
          cmp = (a.lastOrderDate?.getTime() || 0) - (b.lastOrderDate?.getTime() || 0);
          break;
        default:
          cmp = (a.firstOrderDate?.getTime() || 0) - (b.firstOrderDate?.getTime() || 0);
      }
      return order === "asc" ? cmp : -cmp;
    });

    const total = customers.length;
    const paginated = customers.slice(skip, skip + take);

    return res.json({
      customers: paginated.map((c) => ({
        id: c.id,
        email: c.email,
        name: c.name,
        phone: c.phone,
        isRegistered: c.isRegistered,
        isBlocked: false,
        orderCount: c.orderCount,
        activeOrders: c.activeOrders,
        totalSpent: c.totalSpent,
        lastOrderDate: c.lastOrderDate,
        firstOrderDate: c.firstOrderDate,
      })),
      pagination: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
      stats: {
        total,
        registered: Array.from(customerMap.values()).filter((c) => c.isRegistered).length,
        guest: Array.from(customerMap.values()).filter((c) => !c.isRegistered).length,
        withOrders: Array.from(customerMap.values()).filter((c) => c.orderCount > 0).length,
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

    // Calculate total spent (active orders, not just SUCCESSFUL payment)
    const totalSpent = await prisma.order.aggregate({
      where: {
        userId: id,
        status: { notIn: ["CANCELLED", "REFUNDED"] },
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
        isBlocked: z.boolean().optional(),
      })
      .parse(req.body);

    const customer = await prisma.user.findUnique({ where: { id } });
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: body,
      select: { id: true, email: true, name: true, phone: true, role: true, isBlocked: true },
    });

    return res.json({ message: "Customer updated", customer: updated });
  } catch (error) {
    console.error("Admin update customer error:", error);
    return res.status(500).json({ error: "Failed to update customer" });
  }
});

export default router;
