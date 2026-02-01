import { Router, Request, Response } from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

// POST /api/cart/create
router.post("/create", async (_req: Request, res: Response) => {
  try {
    const cart = await prisma.cart.create({ data: {} });
    return res.json({ cartId: cart.id });
  } catch (error) {
    console.error("Create cart error:", error);
    return res.status(500).json({ error: "Failed to create cart" });
  }
});

// GET /api/cart/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const cart = await prisma.cart.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: { take: 1, orderBy: { position: 'asc' } },
              },
            },
          },
        },
      },
    });

    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
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
        },
        quantity: item.quantity,
        subtotal: Number(item.product.price) * item.quantity,
      })),
      total,
      itemCount: cart.items.reduce((sum: number, item) => sum + item.quantity, 0),
    });
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

    // Check cart exists
    const cart = await prisma.cart.findUnique({ where: { id } });
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
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

    return res.json({ success: true });
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

    return res.json({ success: true });
  } catch (error) {
    console.error("Update cart item error:", error);
    return res.status(500).json({ error: "Failed to update cart item" });
  }
});

// DELETE /api/cart/:cartId/items/:itemId
router.delete("/:cartId/items/:itemId", async (req: Request, res: Response) => {
  try {
    const { cartId, itemId } = req.params;

    const item = await prisma.cartItem.findFirst({
      where: { id: itemId, cartId },
    });

    if (!item) {
      return res.status(404).json({ error: "Cart item not found" });
    }

    await prisma.cartItem.delete({ where: { id: itemId } });

    return res.json({ success: true });
  } catch (error) {
    console.error("Delete cart item error:", error);
    return res.status(500).json({ error: "Failed to delete cart item" });
  }
});

export default router;
