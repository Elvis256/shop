import { Router, Response } from "express";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";

const router = Router();
router.use(authenticate, requireAdmin);

// GET /api/admin/permissions — list all permissions grouped by category
router.get("/", async (req: AuthRequest, res: Response) => {
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

    return res.json({ permissions: grouped });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load permissions" });
  }
});

// PUT /api/admin/permissions/role — update permissions for a role
router.put("/role", async (req: AuthRequest, res: Response) => {
  try {
    const { role, permissions } = req.body;
    
    if (!role || !permissions || !Array.isArray(permissions)) {
      return res.status(400).json({ error: "role and permissions[] required" });
    }
    
    // Only allow editing MANAGER permissions (ADMIN always has all, CUSTOMER/SELLER handled differently)
    if (role !== "MANAGER") {
      return res.status(400).json({ error: "Only MANAGER role permissions can be edited" });
    }
    
    // permissions is an array of { permissionId: string, granted: boolean }
    for (const p of permissions) {
      await prisma.rolePermission.upsert({
        where: { role_permissionId: { role, permissionId: p.permissionId } },
        update: { granted: p.granted },
        create: { role, permissionId: p.permissionId, granted: p.granted },
      });
    }
    
    return res.json({ message: "Permissions updated" });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update permissions" });
  }
});

// GET /api/admin/permissions/roles — list available roles
router.get("/roles", async (req: AuthRequest, res: Response) => {
  try {
    return res.json({
      roles: [
        { id: "ADMIN", name: "Admin", description: "Full access to everything", editable: false },
        { id: "MANAGER", name: "Manager", description: "Configurable access to admin features", editable: true },
        { id: "SELLER", name: "Seller", description: "Access to seller dashboard only", editable: false },
        { id: "CUSTOMER", name: "Customer", description: "Standard customer access", editable: false },
      ],
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load roles" });
  }
});

export default router;
