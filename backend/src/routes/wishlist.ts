import { Router, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

// All wishlist routes require authentication
router.use(authenticate);

const isProduction = process.env.NODE_ENV === "production";
const WISHLIST_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "strict" as const : "lax" as const,
  maxAge: 15 * 60 * 1000,
  path: "/",
};

const checkOwnerPin = async (req: AuthRequest, res: Response, next: any) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { wishlistPin: true },
    });

    if (!user?.wishlistPin) {
      return next();
    }

    let token = req.cookies?.wishlist_token;
    if (!token) {
      const authHeader = req.headers["x-wishlist-token"];
      if (typeof authHeader === "string") {
        token = authHeader;
      }
    }

    if (!token) {
      return res.status(403).json({ error: "Wishlist is locked. PIN verification required.", code: "PIN_REQUIRED" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "") as any;
      if (decoded && decoded.userId === req.user!.id && decoded.type === "owner_verified") {
        return next();
      }
    } catch (err) {}

    return res.status(403).json({ error: "Wishlist is locked. PIN verification required.", code: "PIN_REQUIRED" });
  } catch (error) {
    return res.status(500).json({ error: "Failed to verify PIN status" });
  }
};

// GET /api/wishlist/pin-status - Check if user has a PIN set
router.get("/pin-status", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { wishlistPin: true },
    });
    return res.json({ hasPin: !!user?.wishlistPin });
  } catch (error) {
    logger.error("Get PIN status error", { error });
    return res.status(500).json({ error: "Failed to check PIN status" });
  }
}));

// POST /api/wishlist/set-pin - Set or update wishlist PIN
router.post("/set-pin", asyncHandler(async (req: AuthRequest, res: Response) => {
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

    // Automatically authorize the current session
    const token = jwt.sign(
      { userId: req.user!.id, type: "owner_verified" },
      process.env.JWT_SECRET || "",
      { expiresIn: "15m" }
    );

    res.cookie("wishlist_token", token, WISHLIST_COOKIE_OPTIONS);

    return res.json({ message: "Wishlist PIN set successfully", token });
  } catch (error) {
    logger.error("Set PIN error", { error });
    return res.status(500).json({ error: "Failed to set PIN" });
  }
}));

// POST /api/wishlist/verify-pin - Verify wishlist PIN
router.post("/verify-pin", asyncHandler(async (req: AuthRequest, res: Response) => {
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

    // Generate owner verification token
    const token = jwt.sign(
      { userId: req.user!.id, type: "owner_verified" },
      process.env.JWT_SECRET || "",
      { expiresIn: "15m" }
    );

    res.cookie("wishlist_token", token, WISHLIST_COOKIE_OPTIONS);

    return res.json({ valid: true, message: "PIN verified", token });
  } catch (error) {
    logger.error("Verify PIN error", { error });
    return res.status(500).json({ error: "Failed to verify PIN" });
  }
}));

// DELETE /api/wishlist/remove-pin - Remove wishlist PIN
router.delete("/remove-pin", asyncHandler(async (req: AuthRequest, res: Response) => {
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

    res.clearCookie("wishlist_token", WISHLIST_COOKIE_OPTIONS);

    return res.json({ message: "PIN removed successfully" });
  } catch (error) {
    logger.error("Remove PIN error", { error });
    return res.status(500).json({ error: "Failed to remove PIN" });
  }
}));

// GET /api/wishlist/collections — Get list of user's collection names
router.get("/collections", checkOwnerPin, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const items = await prisma.wishlistItem.findMany({
      where: { userId: req.user!.id },
      select: { collectionName: true },
      distinct: ["collectionName"],
      orderBy: { collectionName: "asc" },
    });

    return res.json({
      collections: items.map((item) => item.collectionName),
    });
  } catch (error) {
    logger.error("Get wishlist collections error", { error });
    return res.status(500).json({ error: "Failed to fetch collections" });
  }
}));

// GET /api/wishlist
router.get("/", checkOwnerPin, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const collection = req.query.collection as string | undefined;
    const where: any = { userId: req.user!.id };
    if (collection) {
      where.collectionName = collection;
    }

    const items = await prisma.wishlistItem.findMany({
      where,
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
        collectionName: item.collectionName,
        product: {
          ...item.product,
          imageUrl: item.product.images[0]?.url || null,
          inStock: item.product.stock > 0,
        },
      })),
      count: items.length,
    });
  } catch (error) {
    logger.error("Get wishlist error", { error });
    return res.status(500).json({ error: "Failed to fetch wishlist" });
  }
}));

// POST /api/wishlist
router.post("/", checkOwnerPin, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { productId } = z.object({ productId: z.string() }).parse(req.body);
    const collectionName = (req.body.collectionName as string) || "Wishlist";

    // Check if product exists
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Check if already in wishlist (same collection)
    const existing = await prisma.wishlistItem.findUnique({
      where: {
        userId_productId_collectionName: {
          userId: req.user!.id,
          productId,
          collectionName,
        },
      },
    });

    if (existing) {
      return res.status(400).json({ error: "Product already in wishlist" });
    }

    const item = await prisma.wishlistItem.create({
      data: { userId: req.user!.id, productId, collectionName },
    });

    return res.status(201).json({ message: "Added to wishlist", id: item.id });
  } catch (error) {
    logger.error("Add to wishlist error", { error });
    return res.status(500).json({ error: "Failed to add to wishlist" });
  }
}));

// DELETE /api/wishlist/:productId
router.delete("/:productId", checkOwnerPin, asyncHandler(async (req: AuthRequest, res: Response) => {
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
    logger.error("Remove from wishlist error", { error });
    return res.status(500).json({ error: "Failed to remove from wishlist" });
  }
}));

// POST /api/wishlist/:productId/move-to-cart
router.post("/:productId/move-to-cart", checkOwnerPin, asyncHandler(async (req: AuthRequest, res: Response) => {
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
      where: { cartId_productId_variantId: { cartId: cart.id, productId, variantId: null } },
      update: { quantity: { increment: 1 } },
      create: { cartId: cart.id, productId, variantId: null, quantity: 1 },
    });

    // Remove from wishlist
    await prisma.wishlistItem.deleteMany({
      where: { userId: req.user!.id, productId },
    });

    return res.json({ message: "Moved to cart" });
  } catch (error) {
    logger.error("Move to cart error", { error });
    return res.status(500).json({ error: "Failed to move to cart" });
  }
}));

// POST /api/wishlist/couple/verify-pin - Verify partner's wishlist PIN
router.post("/couple/verify-pin", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { pin } = z.object({
      pin: z.string().min(4).max(6),
    }).parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { partnerId: true },
    });

    if (!user?.partnerId) {
      return res.status(400).json({ error: "You do not have a connected partner" });
    }

    const partner = await prisma.user.findUnique({
      where: { id: user.partnerId },
      select: { id: true, wishlistPin: true },
    });

    if (!partner) {
      return res.status(404).json({ error: "Partner not found" });
    }

    if (!partner.wishlistPin) {
      return res.json({ valid: true, message: "Partner has no PIN set" });
    }

    const isValid = await bcrypt.compare(pin, partner.wishlistPin);
    if (!isValid) {
      return res.status(401).json({ valid: false, error: "Invalid PIN" });
    }

    // Generate partner verification token
    const token = jwt.sign(
      { userId: req.user!.id, partnerId: partner.id, type: "partner_verified" },
      process.env.JWT_SECRET || "",
      { expiresIn: "15m" }
    );

    res.cookie("partner_wishlist_token", token, WISHLIST_COOKIE_OPTIONS);

    return res.json({ valid: true, message: "Partner PIN verified successfully", token });
  } catch (error) {
    logger.error("Verify partner PIN error", { error });
    return res.status(500).json({ error: "Failed to verify partner PIN" });
  }
}));

// GET /api/wishlist/couple - Get partner's wishlist items
router.get("/couple", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { partnerId: true },
    });

    if (!user?.partnerId) {
      return res.json({ paired: false, items: [], partner: null });
    }

    const partner = await prisma.user.findUnique({
      where: { id: user.partnerId },
      select: { id: true, email: true, name: true, wishlistPin: true },
    });

    if (!partner) {
      // Clean up orphaned reference
      await prisma.user.update({
        where: { id: req.user!.id },
        data: { partnerId: null },
      });
      return res.json({ paired: false, items: [], partner: null });
    }

    // Check partner PIN protection
    if (partner.wishlistPin) {
      let partnerToken = req.cookies?.partner_wishlist_token;
      if (!partnerToken) {
        const authHeader = req.headers["x-partner-wishlist-token"];
        if (typeof authHeader === "string") {
          partnerToken = authHeader;
        }
      }

      let verified = false;
      if (partnerToken) {
        try {
          const decoded = jwt.verify(partnerToken, process.env.JWT_SECRET || "") as any;
          if (
            decoded &&
            decoded.userId === req.user!.id &&
            decoded.partnerId === partner.id &&
            decoded.type === "partner_verified"
          ) {
            verified = true;
          }
        } catch (err) {}
      }

      if (!verified) {
        return res.status(403).json({
          error: "Partner's wishlist is locked. PIN verification required.",
          code: "PARTNER_PIN_REQUIRED",
          paired: true,
          partner: { email: partner.email, name: partner.name },
        });
      }
    }

    const items = await prisma.wishlistItem.findMany({
      where: { userId: partner.id },
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
      paired: true,
      partner: { email: partner.email, name: partner.name },
      items: items.map((item) => ({
        id: item.id,
        addedAt: item.createdAt,
        collectionName: item.collectionName,
        product: {
          ...item.product,
          imageUrl: item.product.images[0]?.url || null,
          inStock: item.product.stock > 0,
        },
      })),
    });
  } catch (error) {
    logger.error("Get couple wishlist error", { error });
    return res.status(500).json({ error: "Failed to fetch couple wishlist" });
  }
}));

// POST /api/wishlist/couple/pair - Pair with partner by email
router.post("/couple/pair", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { email } = z.object({
      email: z.string().email(),
    }).parse(req.body);

    if (email.toLowerCase() === req.user!.email.toLowerCase()) {
      return res.status(400).json({ error: "You cannot pair with yourself" });
    }

    const partner = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!partner) {
      return res.status(404).json({ error: "Partner account not found. Make sure they have registered." });
    }

    // Link both accounts
    await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user!.id },
        data: { partnerId: partner.id },
      }),
      prisma.user.update({
        where: { id: partner.id },
        data: { partnerId: req.user!.id },
      }),
    ]);

    return res.json({ message: "Successfully paired with partner", partner: { email: partner.email, name: partner.name } });
  } catch (error) {
    logger.error("Pair couple error", { error });
    return res.status(500).json({ error: "Failed to pair accounts" });
  }
}));

// POST /api/wishlist/couple/unpair - Unpair from partner
router.post("/couple/unpair", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { partnerId: true },
    });

    if (user?.partnerId) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: req.user!.id },
          data: { partnerId: null },
        }),
        prisma.user.update({
          where: { id: user.partnerId },
          data: { partnerId: null },
        }),
      ]);
    }

    return res.json({ message: "Successfully unpaired" });
  } catch (error) {
    logger.error("Unpair couple error", { error });
    return res.status(500).json({ error: "Failed to unpair accounts" });
  }
}));

export default router;
