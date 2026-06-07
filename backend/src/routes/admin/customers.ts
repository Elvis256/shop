import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest, invalidateAuthCache } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { asyncHandler } from "../../middleware/errorHandler";

const router = Router();

router.use(authenticate, requireAdmin);

// GET /api/admin/customers — Combined registered users + guest order customers
// Uses DB-level aggregation instead of loading all orders into memory
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

    // Whitelist sort columns (prevents SQL injection)
    const sortMap: Record<string, string> = {
      name: "name", email: "email", orders: "order_count",
      spent: "total_spent", lastOrder: "last_order_date",
    };
    const sortCol = sortMap[sort as string] || "last_order_date";
    const sortDir = order === "asc" ? "ASC" : "DESC";
    const showAllRoles = includeAllRoles === "true";
    const roleFilter = showAllRoles ? "" : `WHERE u."id" IS NULL OR u."role" = 'CUSTOMER'`;

    // CTE: aggregate orders at DB level, then FULL OUTER JOIN with users
    const cte = `
      WITH order_stats AS (
        SELECT
          LOWER("customerEmail") as email,
          MAX("customerName") as cust_name,
          MAX("customerPhone") as phone,
          MAX("userId") as user_id,
          COUNT(*)::int as order_count,
          COALESCE(SUM(CASE WHEN "status" NOT IN ('CANCELLED','REFUNDED') THEN "totalAmount"::numeric ELSE 0 END),0)::float8 as total_spent,
          COUNT(CASE WHEN "status" NOT IN ('CANCELLED','REFUNDED') THEN 1 END)::int as active_orders,
          MAX("createdAt") as last_order_date,
          MIN("createdAt") as first_order_date
        FROM "Order"
        GROUP BY LOWER("customerEmail")
      ),
      combined AS (
        SELECT
          COALESCE(u."id", os.user_id)::text as id,
          COALESCE(os.email, LOWER(u."email")) as email,
          COALESCE(NULLIF(os.cust_name,''), u."name", '') as name,
          COALESCE(os.phone, u."phone") as phone,
          (u."id" IS NOT NULL) as is_registered,
          COALESCE(u."isBlocked", false) as is_blocked,
          COALESCE(u."role"::text, 'CUSTOMER') as role,
          COALESCE(os.order_count, 0)::int as order_count,
          COALESCE(os.total_spent, 0)::float8 as total_spent,
          COALESCE(os.active_orders, 0)::int as active_orders,
          os.last_order_date,
          COALESCE(os.first_order_date, u."createdAt") as first_order_date
        FROM order_stats os
        FULL OUTER JOIN "User" u ON
          (os.user_id IS NOT NULL AND os.user_id = u."id")
          OR (os.user_id IS NULL AND LOWER(u."email") = os.email)
        ${roleFilter}
      )`;

    // Build WHERE conditions and params
    const conditions: string[] = [];
    const params: any[] = [];

    if (searchStr) {
      const escaped = searchStr.replace(/[%_\\]/g, "\\$&");
      params.push(`%${escaped}%`);
      conditions.push(`(LOWER(c.email) LIKE $${params.length} OR LOWER(c.name) LIKE $${params.length} OR c.phone LIKE $${params.length})`);
    }

    if (filter === "registered") {
      conditions.push("c.is_registered = true");
    } else if (filter === "guest") {
      conditions.push("c.is_registered = false");
    }

    const whereStr = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Count query for pagination + stats
    const countParams = [...params];
    const countSql = `${cte}
      SELECT
        COUNT(*)::int as total,
        COUNT(CASE WHEN c.is_registered THEN 1 END)::int as registered,
        COUNT(CASE WHEN NOT c.is_registered THEN 1 END)::int as guest,
        COUNT(CASE WHEN c.order_count > 0 THEN 1 END)::int as with_orders
      FROM combined c ${whereStr}`;

    // Data query with sort + pagination
    params.push(take);
    const limitIdx = params.length;
    params.push(skip);
    const offsetIdx = params.length;

    const dataSql = `${cte}
      SELECT c.* FROM combined c ${whereStr}
      ORDER BY c.${sortCol} ${sortDir} NULLS LAST
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`;

    const [stats] = await prisma.$queryRawUnsafe<any[]>(countSql, ...countParams);
    const customers = await prisma.$queryRawUnsafe<any[]>(dataSql, ...params);

    return res.json({
      customers: customers.map((c: any) => ({
        id: c.id,
        email: c.email,
        name: c.name,
        phone: c.phone,
        isRegistered: c.is_registered,
        isBlocked: c.is_blocked,
        role: c.role || "CUSTOMER",
        orderCount: c.order_count,
        activeOrders: c.active_orders,
        totalSpent: Number(c.total_spent),
        lastOrderDate: c.last_order_date,
        firstOrderDate: c.first_order_date,
      })),
      pagination: {
        total: stats.total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(stats.total / take),
      },
      stats: {
        total: stats.total,
        registered: stats.registered,
        guest: stats.guest,
        withOrders: stats.with_orders,
      },
    });
  } catch (error) {
    logger.error("Admin get customers error", { error });
    return res.status(500).json({ error: "Failed to fetch customers" });
  }
}));

// GET /api/admin/customers/segments — Get all unique segment tags with user counts (SQL aggregation)
// Must be defined before /:id to avoid route conflict
router.get("/segments", asyncHandler(async (_req: AuthRequest, res: Response) => {
  try {
    const segments = await prisma.$queryRaw<Array<{ tag: string; count: number }>>`
      SELECT tag, COUNT(*)::int as count
      FROM "User", UNNEST("segmentTags") as tag
      GROUP BY tag
      ORDER BY count DESC`;

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

    // Invalidate auth cache so changes take effect immediately
    await invalidateAuthCache(id);

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
 * Auto-segment users based on behavior — pure SQL, no N+1.
 * Uses a single UPDATE ... FROM to compute and apply tags in one query.
 * - "new": registered < 30 days ago
 * - "vip": total orders > 5
 * - "at_risk": last order > 60 days ago
 * - "high_value": total spend > 500000 UGX
 */
export async function autoSegmentUsers(): Promise<number> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    // Single SQL: compute tags and bulk update in one statement
    const result = await prisma.$executeRaw`
      UPDATE "User" u
      SET "segmentTags" = computed.new_tags
      FROM (
        SELECT u2.id,
          ARRAY_REMOVE(ARRAY[
            CASE WHEN u2."createdAt" > ${thirtyDaysAgo} THEN 'new' END,
            CASE WHEN COALESCE(os.cnt, 0) > 5 THEN 'vip' END,
            CASE WHEN os.last_order IS NOT NULL AND os.last_order < ${sixtyDaysAgo} THEN 'at_risk' END,
            CASE WHEN COALESCE(os.total, 0) > 500000 THEN 'high_value' END
          ], NULL) as new_tags
        FROM "User" u2
        LEFT JOIN (
          SELECT "userId",
            COUNT(*)::int as cnt,
            SUM("totalAmount"::numeric)::float8 as total,
            MAX("createdAt") as last_order
          FROM "Order"
          WHERE status NOT IN ('CANCELLED', 'REFUNDED')
          GROUP BY "userId"
        ) os ON os."userId" = u2.id
        WHERE u2.role = 'CUSTOMER'
      ) computed
      WHERE u.id = computed.id
        AND u."segmentTags" IS DISTINCT FROM computed.new_tags`;

    return result;
  } catch (error) {
    logger.error("Auto-segment users error", { error });
    return 0;
  }
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
