import { Router, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

// All wishlist routes require authentication
router.use(authenticate);

// GET /api/wishlist/pin-status - Check if user has a PIN set
router.get("/pin-status", async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { wishlistPin: true },
    });
    return res.json({ hasPin: !!user?.wishlistPin });
  } catch (error) {
    console.error("Get PIN status error:", error);
    return res.status(500).json({ error: "Failed to check PIN status" });
  }
});

// POST /api/wishlist/set-pin - Set or update wishlist PIN
router.post("/set-pin", async (req: AuthRequest, res: Response) => {
  try {
    const { pin, currentPin } = z.object({
      pin: z.string().min(4).max(6).regex(/^\d+$/, "PIN must be digits only"),
      currentPin: z.string().optional(),
    }).parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { wishlistPin: true },
    });

    // If user already has a PIN, verify current PIN first
    if (user?.wishlistPin) {
      if (!currentPin) {
        return res.status(400).json({ error: "Current PIN required" });
      }
      const isValid = await bcrypt.compare(currentPin, user.wishlistPin);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid current PIN" });
      }
    }

    // Hash and save new PIN
    const hashedPin = await bcrypt.hash(pin, 10);
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { wishlistPin: hashedPin },
    });

    return res.json({ message: "Wishlist PIN set successfully" });
  } catch (error) {
    console.error("Set PIN error:", error);
    return res.status(500).json({ error: "Failed to set PIN" });
  }
});

// POST /api/wishlist/verify-pin - Verify wishlist PIN
router.post("/verify-pin", async (req: AuthRequest, res: Response) => {
  try {
    const { pin } = z.object({
      pin: z.string().min(4).max(6),
    }).parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { wishlistPin: true },
    });

    if (!user?.wishlistPin) {
      return res.json({ valid: true, message: "No PIN set" });
    }

    const isValid = await bcrypt.compare(pin, user.wishlistPin);
    if (!isValid) {
      return res.status(401).json({ valid: false, error: "Invalid PIN" });
    }

    return res.json({ valid: true, message: "PIN verified" });
  } catch (error) {
    console.error("Verify PIN error:", error);
    return res.status(500).json({ error: "Failed to verify PIN" });
  }
});

// DELETE /api/wishlist/remove-pin - Remove wishlist PIN
router.delete("/remove-pin", async (req: AuthRequest, res: Response) => {
  try {
    const { pin } = z.object({
      pin: z.string().min(4).max(6),
    }).parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { wishlistPin: true },
    });

    if (!user?.wishlistPin) {
      return res.status(400).json({ error: "No PIN set" });
    }

    const isValid = await bcrypt.compare(pin, user.wishlistPin);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid PIN" });
    }

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { wishlistPin: null },
    });

    return res.json({ message: "PIN removed successfully" });
  } catch (error) {
    console.error("Remove PIN error:", error);
    return res.status(500).json({ error: "Failed to remove PIN" });
  }
});

// GET /api/wishlist
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const items = await prisma.wishlistItem.findMany({
      where: { userId: req.user!.id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            comparePrice: true,
            currency: true,
            rating: true,
            stock: true,
            images: { take: 1, orderBy: { position: "asc" } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({
      items: items.map((item) => ({
        id: item.id,
        addedAt: item.createdAt,
        product: {
          ...item.product,
          imageUrl: item.product.images[0]?.url || null,
          inStock: item.product.stock > 0,
        },
      })),
      count: items.length,
    });
  } catch (error) {
    console.error("Get wishlist error:", error);
    return res.status(500).json({ error: "Failed to fetch wishlist" });
  }
});

// POST /api/wishlist
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const { productId } = z.object({ productId: z.string() }).parse(req.body);

    // Check if product exists
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Check if already in wishlist
    const existing = await prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId: req.user!.id, productId } },
    });

    if (existing) {
      return res.status(400).json({ error: "Product already in wishlist" });
    }

    const item = await prisma.wishlistItem.create({
      data: { userId: req.user!.id, productId },
    });

    return res.status(201).json({ message: "Added to wishlist", id: item.id });
  } catch (error) {
    console.error("Add to wishlist error:", error);
    return res.status(500).json({ error: "Failed to add to wishlist" });
  }
});

// DELETE /api/wishlist/:productId
router.delete("/:productId", async (req: AuthRequest, res: Response) => {
  try {
    const { productId } = req.params;

    const result = await prisma.wishlistItem.deleteMany({
      where: { userId: req.user!.id, productId },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: "Item not in wishlist" });
    }

    return res.json({ message: "Removed from wishlist" });
  } catch (error) {
    console.error("Remove from wishlist error:", error);
    return res.status(500).json({ error: "Failed to remove from wishlist" });
  }
});

// POST /api/wishlist/:productId/move-to-cart
router.post("/:productId/move-to-cart", async (req: AuthRequest, res: Response) => {
  try {
    const { productId } = req.params;

    // Get or create user's cart
    let cart = await prisma.cart.findUnique({
      where: { userId: req.user!.id },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId: req.user!.id },
      });
    }

    // Check product exists and has stock
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    if (product.stock < 1) {
      return res.status(400).json({ error: "Product out of stock" });
    }

    // Add to cart (or update quantity)
    await prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId } },
      update: { quantity: { increment: 1 } },
      create: { cartId: cart.id, productId, quantity: 1 },
    });

    // Remove from wishlist
    await prisma.wishlistItem.deleteMany({
      where: { userId: req.user!.id, productId },
    });

    return res.json({ message: "Moved to cart" });
  } catch (error) {
    console.error("Move to cart error:", error);
    return res.status(500).json({ error: "Failed to move to cart" });
  }
});

export default router;
