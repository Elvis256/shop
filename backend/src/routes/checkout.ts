import { Router, Request, Response } from "express";
import { z } from "zod";
import { createFlutterwavePayment } from "../services/flutterwave";
import prisma from "../lib/prisma";
const router = Router();

// Stock reservation timeout (15 minutes)
const RESERVATION_TIMEOUT_MS = 15 * 60 * 1000;

// Validation schema
const CheckoutSchema = z.object({
  cartId: z.string(),
  currency: z.string().default("KES"),
  amount: z.number().positive(),
  paymentMethod: z.enum(["card", "mobile_money"]),
  mobileMoney: z
    .object({
      network: z.enum(["MPESA", "AIRTEL", "MTN"]),
      phone: z.string(),
    })
    .optional(),
  customer: z.object({
    name: z.string(),
    email: z.string().email(),
  }),
  discreet: z.boolean().default(true),
  shippingAddress: z.string().optional(),
});

// Helper: Check and reserve stock for cart items
async function reserveStock(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  cartItems: Array<{ productId: string; quantity: number; product: { stock: number; reservedStock: number; trackInventory: boolean; allowBackorder: boolean; name: string } }>,
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  const reservations = [];
  
  for (const item of cartItems) {
    const product = item.product;
    
    // Skip inventory check if not tracking or allows backorder
    if (!product.trackInventory || product.allowBackorder) {
      continue;
    }
    
    const availableStock = product.stock - product.reservedStock;
    
    if (availableStock < item.quantity) {
      return {
        success: false,
        error: `Insufficient stock for "${product.name}". Available: ${availableStock}, requested: ${item.quantity}`,
      };
    }
    
    reservations.push({
      productId: item.productId,
      quantity: item.quantity,
    });
  }
  
  // Create reservations and update reserved stock
  const expiresAt = new Date(Date.now() + RESERVATION_TIMEOUT_MS);
  
  for (const reservation of reservations) {
    await tx.stockReservation.create({
      data: {
        orderId,
        productId: reservation.productId,
        quantity: reservation.quantity,
        expiresAt,
      },
    });
    
    await tx.product.update({
      where: { id: reservation.productId },
      data: {
        reservedStock: { increment: reservation.quantity },
      },
    });
  }
  
  return { success: true };
}

// POST /api/checkout/create
router.post("/create", async (req: Request, res: Response) => {
  try {
    const body = CheckoutSchema.parse(req.body);

    // Fetch cart items
    const cart = await prisma.cart.findUnique({
      where: { id: body.cartId },
      include: { items: { include: { product: true } } },
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: "Cart is empty or not found" });
    }

    // Calculate total from cart (verify against submitted amount)
    const calculatedTotal = cart.items.reduce((sum, item) => {
      return sum + Number(item.product.price) * item.quantity;
    }, 0);

    if (Math.abs(calculatedTotal - body.amount) > 0.01) {
      return res.status(400).json({ error: "Amount mismatch" });
    }

    // Create order with stock reservation in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create order
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const order = await tx.order.create({
        data: {
          orderNumber,
          subtotal: body.amount,
          totalAmount: body.amount,
          currency: body.currency,
          status: "PENDING",
          discreet: body.discreet,
          customerName: body.customer.name,
          customerEmail: body.customer.email,
          shippingAddress: body.shippingAddress || "",
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.product.price,
              name: item.product.name,
            })),
          },
        },
      });

      // Reserve stock
      const stockResult = await reserveStock(tx, cart.items, order.id);
      if (!stockResult.success) {
        throw new Error(stockResult.error);
      }

      return order;
    });

    // Create Flutterwave payment
    const paymentResponse = await createFlutterwavePayment({
      tx_ref: result.id,
      amount: body.amount,
      currency: body.currency,
      customer: body.customer,
      paymentMethod: body.paymentMethod,
      mobileMoney: body.mobileMoney,
      redirect_url: `${process.env.BASE_URL}/checkout/confirm?orderId=${result.id}`,
    });

    // Save payment record
    const payment = await prisma.payment.create({
      data: {
        orderId: result.id,
        method: body.paymentMethod === "card" ? "CARD" : "MOBILE_MONEY",
        status: "PENDING",
        amount: body.amount,
        currency: body.currency,
        flwRef: paymentResponse.data?.flw_ref,
      },
    });

    // Clear cart after order created
    await prisma.cartItem.deleteMany({ where: { cartId: body.cartId } });

    return res.json({
      orderId: result.id,
      paymentId: payment.id,
      paymentLink: paymentResponse.data?.link,
      status: paymentResponse.status,
    });
  } catch (error) {
    console.error("Checkout error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    if (error instanceof Error && error.message.includes("Insufficient stock")) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: "Checkout failed" });
  }
});

export default router;
