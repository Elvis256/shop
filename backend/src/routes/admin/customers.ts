import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { asyncHandler } from "../../middleware/errorHandler";

const router = Router();

router.use(authenticate, requireAdmin);

// GET /api/admin/customers — Combined registered users + guest order customers
router.get("/", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const {
      search,
      sort = "lastOrder",
      order = "desc",
      page = "1",
      limit = "20",
      filter,
      includeAllRoles,
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
      role: string | null;
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
          role: null,
          orderCount: 1,
          totalSpent: isActive ? amt : 0,
          activeOrders: isActive ? 1 : 0,
          lastOrderDate: o.createdAt,
          firstOrderDate: o.createdAt,
        });
      }
    }

    // Also include registered customers who may not have ordered
    const showAllRoles = includeAllRoles === "true";
    const registeredUsers = await prisma.user.findMany({
      where: showAllRoles ? {} : { role: "CUSTOMER" },
      select: { id: true, email: true, name: true, phone: true, role: true, createdAt: true, isBlocked: true },
    });

    for (const u of registeredUsers) {
      const key = u.email.toLowerCase();
      if (customerMap.has(key)) {
        const c = customerMap.get(key)!;
        c.id = u.id;
        c.isRegistered = true;
        c.role = u.role;
        if (!c.name && u.name) c.name = u.name || "";
        if (!c.phone && u.phone) c.phone = u.phone;
      } else {
        customerMap.set(key, {
          id: u.id,
          email: u.email,
          name: u.name || "",
          phone: u.phone || null,
          isRegistered: true,
          role: u.role,
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
        role: c.role || "CUSTOMER",
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
    logger.error("Admin get customers error", { error });
    return res.status(500).json({ error: "Failed to fetch customers" });
  }
}));

// GET /api/admin/customers/segments — Get all unique segment tags with user counts
// Must be defined before /:id to avoid route conflict
router.get("/segments", asyncHandler(async (_req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { segmentTags: { isEmpty: false } },
      select: { segmentTags: true },
    });

    const tagCounts = new Map<string, number>();
    for (const user of users) {
      for (const tag of user.segmentTags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    const segments = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);

    return res.json({ segments });
  } catch (error) {
    logger.error("Get segments error", { error });
    return res.status(500).json({ error: "Failed to fetch segments" });
  }
}));

// GET /api/admin/customers/:id
router.get("/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
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
    logger.error("Admin get customer error", { error });
    return res.status(500).json({ error: "Failed to fetch customer" });
  }
}));

// PUT /api/admin/customers/:id
router.put("/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const body = z
      .object({
        name: z.string().optional(),
        phone: z.string().optional(),
        role: z.enum(["CUSTOMER", "SELLER", "ADMIN", "MANAGER"]).optional(),
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
    logger.error("Admin update customer error", { error });
    return res.status(500).json({ error: "Failed to update customer" });
  }
}));

// POST /api/admin/customers/:id/segment — Set segment tags
router.post("/:id/segment", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { tags } = req.body;

    if (!tags || !Array.isArray(tags)) {
      return res.status(400).json({ error: "tags array is required" });
    }

    const customer = await prisma.user.findUnique({ where: { id } });
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { segmentTags: tags },
      select: { id: true, email: true, name: true, segmentTags: true },
    });

    return res.json({ message: "Segment tags updated", customer: updated });
  } catch (error) {
    logger.error("Set segment tags error", { error });
    return res.status(500).json({ error: "Failed to set segment tags" });
  }
}));

/**
 * Auto-segment users based on behavior:
 * - "new": registered < 30 days ago
 * - "vip": total orders > 5
 * - "at_risk": last order > 60 days ago
 * - "high_value": total spend > 500000 UGX
 */
export async function autoSegmentUsers(): Promise<number> {
  let updated = 0;
  try {
    const users = await prisma.user.findMany({
      where: { role: "CUSTOMER" },
      select: { id: true, createdAt: true, segmentTags: true },
    });

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    for (const user of users) {
      const tags = new Set<string>(user.segmentTags);

      // "new" check
      if (user.createdAt > thirtyDaysAgo) {
        tags.add("new");
      } else {
        tags.delete("new");
      }

      // Get order stats
      const orderStats = await prisma.order.aggregate({
        where: { userId: user.id, status: { notIn: ["CANCELLED", "REFUNDED"] } },
        _count: { id: true },
        _sum: { totalAmount: true },
        _max: { createdAt: true },
      });

      // "vip" check
      if ((orderStats._count.id || 0) > 5) {
        tags.add("vip");
      } else {
        tags.delete("vip");
      }

      // "at_risk" check
      if (orderStats._max.createdAt && orderStats._max.createdAt < sixtyDaysAgo) {
        tags.add("at_risk");
      } else {
        tags.delete("at_risk");
      }

      // "high_value" check
      if (Number(orderStats._sum.totalAmount || 0) > 500000) {
        tags.add("high_value");
      } else {
        tags.delete("high_value");
      }

      const newTags = Array.from(tags);
      const oldTags = new Set(user.segmentTags);
      if (newTags.length !== oldTags.size || newTags.some((t) => !oldTags.has(t))) {
        await prisma.user.update({
          where: { id: user.id },
          data: { segmentTags: newTags },
        });
        updated++;
      }
    }
  } catch (error) {
    logger.error("Auto-segment users error", { error });
  }
  return updated;
}

// PUT /api/admin/customers/:id/role - Change a user's role
router.put("/:id/role", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = z.object({
      role: z.enum(["CUSTOMER", "SELLER", "ADMIN", "MANAGER"]),
    }).parse(req.body);

    // Prevent self-demotion
    if (req.user?.id === id) {
      return res.status(400).json({ error: "Cannot change your own role" });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const oldRole = user.role;

    // If promoting to SELLER, ensure they have a Seller record
    if (role === "SELLER") {
      const existingSeller = await prisma.seller.findUnique({ where: { userId: id } });
      if (!existingSeller) {
        await prisma.seller.create({
          data: {
            userId: id,
            storeName: user.name || user.email.split("@")[0],
            storeSlug: user.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "-"),
            description: "",
            status: "APPROVED",
          },
        });
      } else if (existingSeller.status !== "APPROVED") {
        await prisma.seller.update({
          where: { userId: id },
          data: { status: "APPROVED" },
        });
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, name: true, role: true },
    });

    // Log the role change
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: "ROLE_CHANGE",
        entityType: "User",
        entityId: id,
        description: `Changed role from ${oldRole} to ${role} for ${user.email}`,
        metadata: { oldRole, newRole: role, targetEmail: user.email },
        ipAddress: req.ip || "unknown",
      },
    }).catch(() => {});

    return res.json({ message: `Role changed to ${role}`, user: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid role" });
    }
    return res.status(500).json({ error: "Failed to change role" });
  }
}));

export default router;
