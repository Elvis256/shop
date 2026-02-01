import { Router, Request, Response } from "express";
import { z } from "zod";
import { createFlutterwavePayment } from "../services/flutterwave";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

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

    // Create order
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const order = await prisma.order.create({
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

    // Create Flutterwave payment
    const paymentResponse = await createFlutterwavePayment({
      tx_ref: order.id,
      amount: body.amount,
      currency: body.currency,
      customer: body.customer,
      paymentMethod: body.paymentMethod,
      mobileMoney: body.mobileMoney,
      redirect_url: `${process.env.BASE_URL}/checkout/confirm?orderId=${order.id}`,
    });

    // Save payment record
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
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
      orderId: order.id,
      paymentId: payment.id,
      paymentLink: paymentResponse.data?.link,
      status: paymentResponse.status,
    });
  } catch (error) {
    console.error("Checkout error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    return res.status(500).json({ error: "Checkout failed" });
  }
});

export default router;
