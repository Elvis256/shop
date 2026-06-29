import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";
import { optionalAuth, AuthRequest } from "../middleware/auth";

const router = Router();

async function getFullCart(cartId: string, userId?: string) {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: {
      items: {
        include: {
          product: {
            include: { images: { take: 1, orderBy: { position: "asc" } } },
          },
          variant: true,
        },
      },
    },
  });
  if (!cart) return null;

  // Fetch active price slashes if userId is provided
  const activePriceSlashes = userId
    ? await prisma.priceSlash.findMany({
        where: {
          initiatorId: userId,
          productId: { in: cart.items.map((item) => item.productId) },
          status: "active",
          expiresAt: { gt: new Date() },
        },
      })
    : [];
  const priceSlashMap = new Map(activePriceSlashes.map((ps) => [ps.productId, ps]));

  const items = cart.items.map((item) => {
    const product = item.product;
    const variant = item.variant;
    let unitPrice = variant?.price ? Math.round(Number(variant.price)) : Math.round(Number(product.price));

    // Check price slash (applies to product, not variant-specific)
    const activeSlash = priceSlashMap.get(item.productId);
    if (activeSlash) {
      unitPrice = Math.round(Number(activeSlash.currentPrice));
    }
    // Check flash sale pricing
    else if (product.flashSalePrice && product.flashSaleEndsAt && new Date(product.flashSaleEndsAt) > new Date()) {
      unitPrice = Math.round(Number(product.flashSalePrice));
    }
    // Check daily deal pricing
    else if (product.dailyDealPrice && product.dailyDealDate) {
      const dealDate = new Date(product.dailyDealDate).toDateString();
      if (dealDate === new Date().toDateString()) {
        unitPrice = Math.round(Number(product.dailyDealPrice));
      }
    }

    return {
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      product: {
        id: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        price: unitPrice,
        originalPrice: variant?.price ? Number(variant.price) : Number(item.product.price),
        currency: item.product.currency,
        imageUrl: item.product.images[0]?.url || null,
        stock: variant?.stock ?? item.product.stock,
        shippingBadge: (item.product as any).cjProductId || (item.product as any).aliexpressProductId ? "From Abroad" : "Express",
      },
      variant: variant
        ? {
            id: variant.id,
            name: variant.name,
            size: variant.size,
            color: variant.color,
            material: variant.material,
            stock: variant.stock,
          }
        : null,
      quantity: item.quantity,
      subtotal: unitPrice * item.quantity,
    };
  });

  const total = items.reduce((sum, item) => sum + item.subtotal, 0);

  return {
    id: cart.id,
    items,
    total,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

// POST /api/cart/create
router.post("/create", asyncHandler(async (_req: any, res: Response) => {
  try {
    const cart = await prisma.cart.create({ data: {} });
    return res.json({ id: cart.id });
  } catch (error) {
    logger.error("Create cart error", { error });
    return res.status(500).json({ error: "Failed to create cart" });
  }
}));

// GET /api/cart/:id
router.get("/:id", optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const cart = await getFullCart(id, req.user?.id);
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }
    return res.json(cart);
  } catch (error) {
    logger.error("Get cart error", { error });
    return res.status(500).json({ error: "Failed to fetch cart" });
  }
}));

const AddItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive().max(100).default(1),
  variantId: z.string().nullable().optional(),
});

// POST /api/cart/:id/items
router.post("/:id/items", optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { productId, quantity, variantId } = AddItemSchema.parse(req.body);

    // Verify cart exists and caller has access (knowing the UUID proves ownership)
    const cart = await prisma.cart.findUnique({ where: { id } });
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }
    // If cart is associated with a user, verify ownership via auth
    if (cart.userId && cart.userId !== req.user?.id) {
      return res.status(403).json({ error: "Access denied: This cart belongs to another user" });
    }

    // Limit cart to 50 unique items to prevent DB bloat / abuse
    const cartItemCount = await prisma.cartItem.count({ where: { cartId: id } });
    if (cartItemCount >= 50) {
      return res.status(400).json({ error: "Cart cannot contain more than 50 items" });
    }

    // Check product exists
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Validate stock at the variant or product level
    if (variantId) {
      const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
      if (!variant || variant.productId !== productId) {
        return res.status(404).json({ error: "Variant not found for this product" });
      }
      if (variant.stock - (variant.reservedStock || 0) < quantity) {
        return res.status(400).json({ error: "Insufficient stock for selected variant" });
      }
    } else if (product.stock - (product.reservedStock || 0) < quantity) {
      return res.status(400).json({ error: "Insufficient stock" });
    }

    // Check if item already in cart (same product + variant)
    const existingItem = await prisma.cartItem.findFirst({
      where: { cartId: id, productId, variantId: variantId || null },
    });

    if (existingItem) {
      // Update quantity
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + quantity },
      });
    } else {
      // Add new item
      await prisma.cartItem.create({
        data: { cartId: id, productId, variantId: variantId || null, quantity },
      });
    }

    return res.json(await getFullCart(id, req.user?.id));
  } catch (error) {
    logger.error("Add to cart error", { error });
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    return res.status(500).json({ error: "Failed to add to cart" });
  }
}));

// PUT /api/cart/:cartId/items/:itemId
router.put("/:cartId/items/:itemId", optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { cartId, itemId } = req.params;
    const { quantity } = z.object({ quantity: z.number().int().min(0) }).parse(req.body);

    // Verify cart exists (knowing the UUID proves ownership for guest carts)
    const cart = await prisma.cart.findUnique({ where: { id: cartId } });
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }
    if (cart.userId && cart.userId !== req.user?.id) {
      return res.status(403).json({ error: "Access denied: This cart belongs to another user" });
    }

    const item = await prisma.cartItem.findFirst({
      where: { id: itemId, cartId },
    });

    if (!item) {
      return res.status(404).json({ error: "Cart item not found" });
    }

    if (quantity === 0) {
      await prisma.cartItem.delete({ where: { id: itemId } });
    } else {
      // Validate stock before updating quantity
      if (item.variantId) {
        const variant = await prisma.productVariant.findUnique({ where: { id: item.variantId } });
        if (variant && variant.stock - (variant.reservedStock || 0) < quantity) {
          return res.status(400).json({ error: `Only ${variant.stock - (variant.reservedStock || 0)} available for this variant` });
        }
      } else {
        const product = await prisma.product.findUnique({ where: { id: item.productId } });
        if (product && product.stock - (product.reservedStock || 0) < quantity) {
          return res.status(400).json({ error: `Only ${product.stock - (product.reservedStock || 0)} available in stock` });
        }
      }
      await prisma.cartItem.update({
        where: { id: itemId },
        data: { quantity },
      });
    }

    return res.json(await getFullCart(cartId, req.user?.id));
  } catch (error) {
    logger.error("Update cart item error", { error });
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid quantity", details: error.errors });
    }
    return res.status(500).json({ error: "Failed to update cart item" });
  }
}));

// DELETE /api/cart/:cartId/items/:itemId
router.delete("/:cartId/items/:itemId", optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { cartId, itemId } = req.params;

    // Verify cart exists (knowing the UUID proves ownership for guest carts)
    const cart = await prisma.cart.findUnique({ where: { id: cartId } });
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }
    if (cart.userId && cart.userId !== req.user?.id) {
      return res.status(403).json({ error: "Access denied: This cart belongs to another user" });
    }

    const item = await prisma.cartItem.findFirst({
      where: { id: itemId, cartId },
    });

    if (!item) {
      return res.status(404).json({ error: "Cart item not found" });
    }

    await prisma.cartItem.delete({ where: { id: itemId } });

    return res.json(await getFullCart(cartId, req.user?.id));
  } catch (error) {
    logger.error("Delete cart item error", { error });
    return res.status(500).json({ error: "Failed to delete cart item" });
  }
}));

// DELETE /api/cart/:cartId/items - Clear all items from cart
router.delete("/:cartId/items", optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { cartId } = req.params;

    // Verify cart exists (knowing the UUID proves ownership for guest carts)
    const cart = await prisma.cart.findUnique({ where: { id: cartId } });
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }
    if (cart.userId && cart.userId !== req.user?.id) {
      return res.status(403).json({ error: "Access denied: This cart belongs to another user" });
    }

    await prisma.cartItem.deleteMany({ where: { cartId } });
    return res.json({ success: true });
  } catch (error) {
    logger.error("Clear cart error", { error });
    return res.status(500).json({ error: "Failed to clear cart" });
  }
}));

// Schema for cart sync
const SyncCartSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string(),
      variantId: z.string().nullable().optional(),
      quantity: z.number().int().positive(),
    })
  ),
});

// POST /api/cart/sync - Sync localStorage cart items to a new/existing cart
router.post("/sync", optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { items } = SyncCartSchema.parse(req.body);

    if (items.length === 0) {
      const cart = await prisma.cart.create({ data: {} });
      return res.json({ id: cart.id, items: [], total: 0, itemCount: 0 });
    }

    // Validate all products exist and have stock
    const productIds = items.map((item) => item.productId);
    const variantIds = items.map((item) => item.variantId).filter(Boolean) as string[];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, status: "ACTIVE" },
    });
    const variants = variantIds.length > 0
      ? await prisma.productVariant.findMany({ where: { id: { in: variantIds } } })
      : [];

    const productMap = new Map(products.map((p) => [p.id, p]));
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    // Filter to valid products with available stock (accounting for reservations)
    const validItems = items
      .filter((item) => {
        const product = productMap.get(item.productId);
        if (!product) return false;
        if (item.variantId) {
          const variant = variantMap.get(item.variantId);
          if (!variant || variant.productId !== product.id) return false;
          const availableStock = variant.stock - (variant.reservedStock || 0);
          return availableStock > 0;
        }
        const availableStock = product.stock - (product.reservedStock || 0);
        return availableStock > 0;
      })
      .map((item) => {
        let availableStock: number;
        if (item.variantId) {
          const variant = variantMap.get(item.variantId)!;
          availableStock = variant.stock - (variant.reservedStock || 0);
        } else {
          const product = productMap.get(item.productId)!;
          availableStock = product.stock - (product.reservedStock || 0);
        }
        // Cap quantity to available stock
        const quantity = Math.min(item.quantity, availableStock, 100);
        return { productId: item.productId, variantId: item.variantId || null, quantity };
      });

    // Create cart with items in a transaction
    const cart = await prisma.$transaction(async (tx) => {
      const newCart = await tx.cart.create({ data: {} });

      if (validItems.length > 0) {
        await tx.cartItem.createMany({
          data: validItems.map((item) => ({
            cartId: newCart.id,
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          })),
        });
      }

      return newCart;
    });

    const fullCart = await getFullCart(cart.id, req.user?.id);
    if (!fullCart) {
      return res.status(500).json({ error: "Failed to load sync cart" });
    }

    return res.json(fullCart);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid cart data", details: error.errors });
    }
    logger.error("Sync cart error", { error });
    return res.status(500).json({ error: "Failed to sync cart" });
  }
}));

export default router;
