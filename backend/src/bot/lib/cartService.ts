import prisma from "../../lib/prisma";
import type { BotContext } from "./context";
import type { Product } from "@prisma/client";

export interface CartItemWithProduct {
  productId: string;
  quantity: number;
  product: Product;
}

export interface UnifiedCart {
  items: CartItemWithProduct[];
  subtotal: number;
}

/**
 * Retrieves the unified cart depending on user linking state.
 */
export async function getCart(ctx: BotContext): Promise<UnifiedCart> {
  const userId = ctx.tgUser.userId;

  if (userId) {
    // Linked user: read from database
    let cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });
    }

    // Filter out inactive products
    const activeItems = cart.items.filter((item) => item.product.status === "ACTIVE");
    const subtotal = activeItems.reduce(
      (sum, item) => sum + Number(item.product.price) * item.quantity,
      0
    );

    return {
      items: activeItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        product: item.product,
      })),
      subtotal,
    };
  } else {
    // Unlinked user: read from session
    const sessionCart = ctx.session.cart || {};
    const productIds = Object.keys(sessionCart);

    if (productIds.length === 0) {
      return { items: [], subtotal: 0 };
    }

    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        status: "ACTIVE",
      },
    });

    const items: CartItemWithProduct[] = products
      .map((product) => ({
        productId: product.id,
        quantity: sessionCart[product.id] || 0,
        product,
      }))
      .filter((item) => item.quantity > 0);

    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.product.price) * item.quantity,
      0
    );

    return { items, subtotal };
  }
}

/**
 * Adds an item to the unified cart.
 */
export async function addToCart(
  ctx: BotContext,
  productId: string,
  quantity = 1
): Promise<{ success: boolean; quantity: number; message?: string }> {
  // Check product existence and status
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, status: true, stock: true },
  });

  if (!product || product.status !== "ACTIVE") {
    return { success: false, quantity: 0, message: "Product is not available." };
  }

  const userId = ctx.tgUser.userId;

  if (userId) {
    // Linked user: database operations
    let cart = await prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
      });
    }

    const existingItem = await prisma.cartItem.findUnique({
      where: {
        cartId_productId_variantId: {
          cartId: cart.id,
          productId,
          variantId: null,
        },
      },
    });

    const newQty = (existingItem?.quantity || 0) + quantity;
    if (product.stock < newQty) {
      return { success: false, quantity: existingItem?.quantity || 0, message: `Only ${product.stock} items in stock.` };
    }

    const updatedItem = await prisma.cartItem.upsert({
      where: {
        cartId_productId_variantId: {
          cartId: cart.id,
          productId,
          variantId: null,
        },
      },
      update: {
        quantity: { increment: quantity },
      },
      create: {
        cartId: cart.id,
        productId,
        quantity,
      },
    });

    return { success: true, quantity: updatedItem.quantity };
  } else {
    // Unlinked user: session operations
    if (!ctx.session.cart) {
      ctx.session.cart = {};
    }

    const cart = ctx.session.cart;
    const currentQty = cart[productId] || 0;
    const newQty = currentQty + quantity;

    if (product.stock < newQty) {
      return { success: false, quantity: currentQty, message: `Only ${product.stock} items in stock.` };
    }

    cart[productId] = newQty;

    return { success: true, quantity: newQty };
  }
}

/**
 * Updates the quantity of a cart item. Setting quantity to 0 removes the item.
 */
export async function updateQuantity(
  ctx: BotContext,
  productId: string,
  quantity: number
): Promise<{ success: boolean; message?: string }> {
  const userId = ctx.tgUser.userId;

  // Check product stock if increasing
  if (quantity > 0) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { stock: true },
    });
    if (product && product.stock < quantity) {
      return { success: false, message: `Only ${product.stock} items in stock.` };
    }
  }

  if (userId) {
    const cart = await prisma.cart.findUnique({
      where: { userId },
    });
    if (!cart) return { success: false, message: "Cart not found." };

    if (quantity <= 0) {
      await prisma.cartItem.deleteMany({
        where: {
          cartId: cart.id,
          productId,
        },
      });
    } else {
      await prisma.cartItem.upsert({
        where: {
          cartId_productId_variantId: {
            cartId: cart.id,
            productId,
            variantId: null,
          },
        },
        update: {
          quantity,
        },
        create: {
          cartId: cart.id,
          productId,
          quantity,
        },
      });
    }
    return { success: true };
  } else {
    if (!ctx.session.cart) {
      ctx.session.cart = {};
    }
    const cart = ctx.session.cart;
    if (quantity <= 0) {
      delete cart[productId];
    } else {
      cart[productId] = quantity;
    }
    return { success: true };
  }
}

/**
 * Empties the cart.
 */
export async function clearCart(ctx: BotContext): Promise<void> {
  const userId = ctx.tgUser.userId;

  if (userId) {
    const cart = await prisma.cart.findUnique({
      where: { userId },
    });
    if (cart) {
      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id },
      });
    }
  }

  ctx.session.cart = {};
}

/**
 * Migrates temporary session-based cart items to the database cart.
 */
export async function syncSessionCartToDb(ctx: BotContext, dbUserId: string): Promise<void> {
  const sessionCart = ctx.session.cart;
  if (!sessionCart || Object.keys(sessionCart).length === 0) return;

  let dbCart = await prisma.cart.findUnique({
    where: { userId: dbUserId },
  });

  if (!dbCart) {
    dbCart = await prisma.cart.create({
      data: { userId: dbUserId },
    });
  }

  for (const [productId, quantity] of Object.entries(sessionCart)) {
    if (quantity <= 0) continue;

    // Verify product is still active
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { status: true },
    });
    if (!product || product.status !== "ACTIVE") continue;

    await prisma.cartItem.upsert({
      where: {
        cartId_productId_variantId: {
          cartId: dbCart.id,
          productId,
          variantId: null,
        },
      },
      update: {
        quantity: { increment: quantity },
      },
      create: {
        cartId: dbCart.id,
        productId,
        quantity,
      },
    });
  }

  // Clear session cart
  delete ctx.session.cart;
}
