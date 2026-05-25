import { Router, Response } from "express";
import { z } from "zod";
import { nanoid } from "nanoid";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

// ─── Create registry ──────────────────────────────────────────────────────────
router.post("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = z.object({
      title: z.string().min(2).max(100),
      eventDate: z.string().optional(),
      eventType: z.enum(["introduction", "wedding", "anniversary", "birthday", "other"]).default("introduction"),
      message: z.string().max(500).optional(),
    }).parse(req.body);

    const slug = nanoid(10);

    const registry = await prisma.registry.create({
      data: {
        userId: req.user!.id,
        slug,
        title: data.title,
        eventDate: data.eventDate ? new Date(data.eventDate) : null,
        eventType: data.eventType,
        message: data.message,
      },
    });

    return res.status(201).json({
      id: registry.id,
      slug: registry.slug,
      shareUrl: `${process.env.FRONTEND_URL}/registry/${registry.slug}`,
      message: "Registry created",
    });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Create registry error:", error);
    return res.status(500).json({ error: "Failed to create registry" });
  }
});

// ─── Get my registries ────────────────────────────────────────────────────────
router.get("/mine", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const registries = await prisma.registry.findMany({
      where: { userId: req.user!.id, isActive: true },
      include: {
        items: {
          include: { product: { include: { images: { take: 1, orderBy: { position: "asc" } } } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json(registries.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      eventDate: r.eventDate,
      eventType: r.eventType,
      message: r.message,
      shareUrl: `${process.env.FRONTEND_URL}/registry/${r.slug}`,
      itemCount: r.items.length,
      items: r.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        purchased: item.purchased,
        priority: item.priority,
        note: item.note,
        product: {
          id: item.product.id,
          name: item.product.name,
          slug: item.product.slug,
          price: Number(item.product.price),
          imageUrl: item.product.images[0]?.url || null,
        },
      })),
    })));
  } catch (error) {
    return res.status(500).json({ error: "Failed to load registries" });
  }
});

// ─── View registry by slug (public) ──────────────────────────────────────────
router.get("/:slug", async (req, res: Response) => {
  try {
    const registry = await prisma.registry.findUnique({
      where: { slug: req.params.slug },
      include: {
        items: {
          include: { product: { include: { images: { take: 1, orderBy: { position: "asc" } } } } },
        },
      },
    });

    if (!registry || !registry.isActive) return res.status(404).json({ error: "Registry not found" });

    return res.json({
      id: registry.id,
      title: registry.title,
      eventDate: registry.eventDate,
      eventType: registry.eventType,
      message: registry.message,
      items: registry.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        purchased: item.purchased,
        remaining: Math.max(0, item.quantity - item.purchased),
        priority: item.priority,
        note: item.note,
        product: {
          id: item.product.id,
          name: item.product.name,
          slug: item.product.slug,
          price: Number(item.product.price),
          imageUrl: item.product.images[0]?.url || null,
        },
      })),
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load registry" });
  }
});

// ─── Add item to registry ─────────────────────────────────────────────────────
router.post("/:id/items", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = z.object({
      productId: z.string(),
      quantity: z.number().int().min(1).default(1),
      priority: z.enum(["high", "medium", "low"]).default("medium"),
      note: z.string().max(200).optional(),
    }).parse(req.body);

    const registry = await prisma.registry.findUnique({ where: { id: req.params.id } });
    if (!registry) return res.status(404).json({ error: "Registry not found" });
    if (registry.userId !== req.user!.id) return res.status(403).json({ error: "Not your registry" });

    const item = await prisma.registryItem.create({
      data: {
        registryId: registry.id,
        productId: data.productId,
        quantity: data.quantity,
        priority: data.priority,
        note: data.note,
      },
    });

    return res.status(201).json({ id: item.id, message: "Item added to registry" });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    return res.status(500).json({ error: "Failed to add item" });
  }
});

// ─── Remove item from registry ────────────────────────────────────────────────
router.delete("/:id/items/:itemId", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const registry = await prisma.registry.findUnique({ where: { id: req.params.id } });
    if (!registry) return res.status(404).json({ error: "Registry not found" });
    if (registry.userId !== req.user!.id) return res.status(403).json({ error: "Not your registry" });

    await prisma.registryItem.delete({ where: { id: req.params.itemId } });
    return res.json({ message: "Item removed" });
  } catch (error) {
    return res.status(500).json({ error: "Failed to remove item" });
  }
});

// ─── Mark item as purchased (called from checkout) ───────────────────────────
router.post("/:slug/purchased/:itemId", async (req, res: Response) => {
  try {
    const item = await prisma.registryItem.findUnique({
      where: { id: req.params.itemId },
      include: { registry: true },
    });
    if (!item || item.registry.slug !== req.params.slug) {
      return res.status(404).json({ error: "Item not found" });
    }

    await prisma.registryItem.update({
      where: { id: item.id },
      data: { purchased: { increment: 1 } },
    });

    return res.json({ message: "Marked as purchased" });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update registry" });
  }
});

// ─── Delete registry ──────────────────────────────────────────────────────────
router.delete("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const registry = await prisma.registry.findUnique({ where: { id: req.params.id } });
    if (!registry) return res.status(404).json({ error: "Registry not found" });
    if (registry.userId !== req.user!.id) return res.status(403).json({ error: "Not your registry" });

    await prisma.registry.update({ where: { id: req.params.id }, data: { isActive: false } });
    return res.json({ message: "Registry deleted" });
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete registry" });
  }
});

export default router;
