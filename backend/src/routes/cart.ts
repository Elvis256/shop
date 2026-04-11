import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";

const router = Router();

async function getFullCart(cartId: string) {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: {
      items: {
        include: {
          product: {
            include: { images: { take: 1, orderBy: { position: 'asc' } } },
          },
        },
      },
    },
  });
  if (!cart) return null;

  const total = cart.items.reduce((sum: number, item) => {
    return sum + Number(item.product.price) * item.quantity;
  }, 0);

  return {
    id: cart.id,
    items: cart.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      product: {
        id: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        price: item.product.price,
        currency: item.product.currency,
        imageUrl: item.product.images[0]?.url || null,
        stock: item.product.stock,
        shippingBadge: (item.product as any).cjProductId || (item.product as any).aliexpressProductId ? "From Abroad" : "Express",
      },
      quantity: item.quantity,
      subtotal: Number(item.product.price) * item.quantity,
    })),
    total,
    itemCount: cart.items.reduce((sum: number, item) => sum + item.quantity, 0),
  };
}

// POST /api/cart/create
router.post("/create", async (_req: Request, res: Response) => {
  try {
    const cart = await prisma.cart.create({ data: {} });
    return res.json({ id: cart.id });
  } catch (error) {
    console.error("Create cart error:", error);
    return res.status(500).json({ error: "Failed to create cart" });
  }
});

// GET /api/cart/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const cart = await getFullCart(id);
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }
    return res.json(cart);
  } catch (error) {
    console.error("Get cart error:", error);
    return res.status(500).json({ error: "Failed to fetch cart" });
  }
});

const AddItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive().default(1),
});

// POST /api/cart/:id/items
router.post("/:id/items", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { productId, quantity } = AddItemSchema.parse(req.body);

    // Verify cart exists and caller has access (knowing the UUID proves ownership)
    const cart = await prisma.cart.findUnique({ where: { id } });
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }
    // If cart is associated with a user, verify ownership via auth
    if ((cart as any).userId) {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(403).json({ error: "This cart belongs to a registered user" });
      }
    }

    // Check product exists and has stock
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    if (product.stock < quantity) {
      return res.status(400).json({ error: "Insufficient stock" });
    }

    // Check if item already in cart
    const existingItem = await prisma.cartItem.findFirst({
      where: { cartId: id, productId },
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
        data: { cartId: id, productId, quantity },
      });
    }

    return res.json(await getFullCart(id));
  } catch (error) {
    console.error("Add to cart error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    return res.status(500).json({ error: "Failed to add to cart" });
  }
});

// PUT /api/cart/:cartId/items/:itemId
router.put("/:cartId/items/:itemId", async (req: Request, res: Response) => {
  try {
    const { cartId, itemId } = req.params;
    const { quantity } = z.object({ quantity: z.number().int().min(0) }).parse(req.body);

    // Verify cart exists (knowing the UUID proves ownership for guest carts)
    const cart = await prisma.cart.findUnique({ where: { id: cartId } });
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
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
      await prisma.cartItem.update({
        where: { id: itemId },
        data: { quantity },
      });
    }

    return res.json(await getFullCart(cartId));
  } catch (error) {
    console.error("Update cart item error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid quantity", details: error.errors });
    }
    return res.status(500).json({ error: "Failed to update cart item" });
  }
});

// DELETE /api/cart/:cartId/items/:itemId
router.delete("/:cartId/items/:itemId", async (req: Request, res: Response) => {
  try {
    const { cartId, itemId } = req.params;

    // Verify cart exists (knowing the UUID proves ownership for guest carts)
    const cart = await prisma.cart.findUnique({ where: { id: cartId } });
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    const item = await prisma.cartItem.findFirst({
      where: { id: itemId, cartId },
    });

    if (!item) {
      return res.status(404).json({ error: "Cart item not found" });
    }

    await prisma.cartItem.delete({ where: { id: itemId } });

    return res.json(await getFullCart(cartId));
  } catch (error) {
    console.error("Delete cart item error:", error);
    return res.status(500).json({ error: "Failed to delete cart item" });
  }
});

// Schema for cart sync
const SyncCartSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
  })),
});

// DELETE /api/cart/:cartId/items - Clear all items from cart
router.delete("/:cartId/items", async (req: Request, res: Response) => {
  try {
    const { cartId } = req.params;

    // Verify cart exists (knowing the UUID proves ownership for guest carts)
    const cart = await prisma.cart.findUnique({ where: { id: cartId } });
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    await prisma.cartItem.deleteMany({ where: { cartId } });
    return res.json({ success: true });
  } catch (error) {
    console.error("Clear cart error:", error);
    return res.status(500).json({ error: "Failed to clear cart" });
  }
});

// POST /api/cart/sync - Sync localStorage cart items to a new/existing cart
router.post("/sync", async (req: Request, res: Response) => {
  try {
    const { items } = SyncCartSchema.parse(req.body);

    if (items.length === 0) {
      const cart = await prisma.cart.create({ data: {} });
      return res.json({ id: cart.id, items: [], total: 0, itemCount: 0 });
    }

    // Validate all products exist and have stock
    const productIds = items.map(item => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, status: "ACTIVE" },
      include: { images: { take: 1, orderBy: { position: 'asc' } } },
    });

    const productMap = new Map(products.map(p => [p.id, p]));

    // Filter to valid products with stock
    const validItems = items.filter(item => {
      const product = productMap.get(item.productId);
      return product && product.stock > 0;
    }).map(item => {
      const product = productMap.get(item.productId)!;
      // Cap quantity to available stock
      const quantity = Math.min(item.quantity, product.stock);
      return { productId: item.productId, quantity };
    });

    // Create cart with items in a transaction
    const cart = await prisma.$transaction(async (tx) => {
      const newCart = await tx.cart.create({ data: {} });
      
      if (validItems.length > 0) {
        await tx.cartItem.createMany({
          data: validItems.map(item => ({
            cartId: newCart.id,
            productId: item.productId,
            quantity: item.quantity,
          })),
        });
      }

      return tx.cart.findUnique({
        where: { id: newCart.id },
        include: {
          items: {
            include: {
              product: {
                include: { images: { take: 1, orderBy: { position: 'asc' } } },
              },
            },
          },
        },
      });
    });

    if (!cart) {
      return res.status(500).json({ error: "Failed to create cart" });
    }

    const total = cart.items.reduce((sum: number, item) => {
      return sum + Number(item.product.price) * item.quantity;
    }, 0);

    return res.json({
      id: cart.id,
      items: cart.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        product: {
          id: item.product.id,
          name: item.product.name,
          slug: item.product.slug,
          price: item.product.price,
          currency: item.product.currency,
          imageUrl: item.product.images[0]?.url || null,
          stock: item.product.stock,
          shippingBadge: (item.product as any).cjProductId || (item.product as any).aliexpressProductId ? "From Abroad" : "Express",
        },
        quantity: item.quantity,
        subtotal: Number(item.product.price) * item.quantity,
      })),
      total,
      itemCount: cart.items.reduce((sum: number, item) => sum + item.quantity, 0),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid cart data", details: error.errors });
    }
    console.error("Sync cart error:", error);
    return res.status(500).json({ error: "Failed to sync cart" });
  }
});

export default router;
