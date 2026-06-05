import { Router, Response } from "express";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";

const router = Router();
router.use(authenticate, requireAdmin);

// GET /api/admin/permissions — list all permissions grouped by category with role grants
router.get("/", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: {
        rolePermissions: {
          select: { role: true, granted: true },
        },
      },
    });

    // Group by category
    const grouped: Record<string, any[]> = {};
    for (const p of permissions) {
      if (!grouped[p.category]) grouped[p.category] = [];
      const roles: Record<string, boolean> = {};
      for (const rp of p.rolePermissions) {
        roles[rp.role] = rp.granted;
      }
      grouped[p.category].push({
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
        roles,
      });
    }

    // Stats
    const totalPermissions = permissions.length;
    const categories = Object.keys(grouped).length;
    const managerGranted = permissions.filter(p =>
      p.rolePermissions.some(rp => rp.role === "MANAGER" && rp.granted)
    ).length;
    const sellerGranted = permissions.filter(p =>
      p.rolePermissions.some(rp => rp.role === "SELLER" && rp.granted)
    ).length;

    return res.json({
      permissions: grouped,
      stats: { totalPermissions, categories, managerGranted, sellerGranted },
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load permissions" });
  }
}));

// PUT /api/admin/permissions/role — update permissions for a role
router.put("/role", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { role, permissions } = req.body;

    if (!role || !permissions || !Array.isArray(permissions)) {
      return res.status(400).json({ error: "role and permissions[] required" });
    }

    // Allow editing MANAGER and SELLER permissions
    if (!["MANAGER", "SELLER"].includes(role)) {
      return res.status(400).json({ error: "Only MANAGER and SELLER role permissions can be edited" });
    }

    // permissions is an array of { permissionId: string, granted: boolean }
    for (const p of permissions) {
      await prisma.rolePermission.upsert({
        where: { role_permissionId: { role, permissionId: p.permissionId } },
        update: { granted: p.granted },
        create: { role, permissionId: p.permissionId, granted: p.granted },
      });
    }

    return res.json({ message: `${role} permissions updated` });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update permissions" });
  }
}));

// PUT /api/admin/permissions/role/bulk — toggle all permissions in a category for a role
router.put("/role/bulk", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { role, category, granted } = req.body;

    if (!role || !category || typeof granted !== "boolean") {
      return res.status(400).json({ error: "role, category, and granted required" });
    }

    if (!["MANAGER", "SELLER"].includes(role)) {
      return res.status(400).json({ error: "Only MANAGER and SELLER role permissions can be edited" });
    }

    const permsInCategory = await prisma.permission.findMany({
      where: { category },
      select: { id: true },
    });

    for (const perm of permsInCategory) {
      await prisma.rolePermission.upsert({
        where: { role_permissionId: { role, permissionId: perm.id } },
        update: { granted },
        create: { role, permissionId: perm.id, granted },
      });
    }

    return res.json({ message: `${permsInCategory.length} permissions ${granted ? "granted" : "revoked"} for ${role} in ${category}` });
  } catch (error) {
    return res.status(500).json({ error: "Failed to bulk update permissions" });
  }
}));

// GET /api/admin/permissions/roles — list available roles
router.get("/roles", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    // Get user counts per role
    const roleCounts = await prisma.user.groupBy({
      by: ["role"],
      _count: { id: true },
    });
    const countMap: Record<string, number> = {};
    for (const rc of roleCounts) {
      countMap[rc.role] = rc._count.id;
    }

    return res.json({
      roles: [
        { id: "ADMIN", name: "Admin", description: "Full access to everything. Cannot be restricted.", editable: false, userCount: countMap["ADMIN"] || 0 },
        { id: "MANAGER", name: "Manager", description: "Configurable access to admin features. Ideal for staff with limited responsibilities.", editable: true, userCount: countMap["MANAGER"] || 0 },
        { id: "SELLER", name: "Seller", description: "Access to seller dashboard. Configurable marketplace permissions.", editable: true, userCount: countMap["SELLER"] || 0 },
        { id: "CUSTOMER", name: "Customer", description: "Standard customer access. Storefront only.", editable: false, userCount: countMap["CUSTOMER"] || 0 },
      ],
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load roles" });
  }
}));

// GET /api/admin/permissions/security — security overview
router.get("/security", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const isProduction = process.env.NODE_ENV === "production";

    // Data isolation checks
    const sellerCount = await prisma.seller.count({ where: { status: "APPROVED" } });
    const apiKeyCount = await prisma.apiKey.count({ where: { isActive: true } });

    const securityOverview = {
      rateLimiting: {
        general: { windowMs: 900000, max: isProduction ? 500 : 1000, label: "General API", path: "/api/*" },
        auth: { windowMs: 900000, max: isProduction ? 20 : 100, label: "Authentication", path: "/api/auth/*" },
        checkout: { windowMs: 60000, max: 5, label: "Checkout", path: "/api/checkout" },
        newsletter: { windowMs: 60000, max: 5, label: "Newsletter", path: "/api/newsletter/subscribe" },
        orderTracking: { windowMs: 60000, max: 10, label: "Order Tracking", path: "/api/orders/track" },
        coupon: { windowMs: 60000, max: 10, label: "Coupon Apply", path: "/api/coupons/apply" },
      },
      securityHeaders: {
        helmet: true,
        hsts: isProduction,
        noSniff: true,
        xssFilter: true,
        csp: isProduction,
        referrerPolicy: "strict-origin-when-cross-origin",
      },
      authentication: {
        method: "JWT (access + refresh tokens)",
        accessTokenExpiry: "15 minutes",
        refreshTokenExpiry: "7 days",
        portalSeparation: true,
        csrfProtection: true,
      },
      accessControl: {
        model: "RBAC (Role-Based Access Control)",
        roles: 4,
        totalPermissions: await prisma.permission.count(),
        sellerDataIsolation: "Query-level (sellerId filter on all seller routes)",
        adminBypass: "ADMIN role bypasses all permission checks",
      },
      dataIsolation: {
        sellerIsolation: {
          status: "active",
          method: "sellerId filter on all seller API routes",
          activeSellers: sellerCount,
          note: "Each seller can only access their own products, orders, payouts",
        },
        customerIsolation: {
          status: "active",
          method: "userId filter on customer-facing routes",
          note: "Customers can only view their own orders, addresses, disputes",
        },
        apiKeyIsolation: {
          status: "active",
          activeKeys: apiKeyCount,
          method: "Per-key rate limiting with in-memory tracking",
        },
      },
      environment: isProduction ? "production" : "development",
    };

    return res.json(securityOverview);
  } catch (error) {
    return res.status(500).json({ error: "Failed to load security overview" });
  }
}));

export default router;
