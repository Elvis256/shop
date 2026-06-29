/**
 * Subscription Boxes Service
 * Processes due subscriptions and auto-creates orders.
 * Runs every hour. Sends WhatsApp/SMS reminder 3 days before renewal.
 */
import prisma from "../lib/prisma";
import { sendWhatsApp } from "./whatsapp";
import { sendSMS } from "./sms";
import { scheduleRestockReminders } from "./restockReminder";
import { logger } from "../lib/logger";

// Box definitions — admin can create these as products with isSubscribable=true
export const BOX_DEFINITIONS = [
  {
    slug: "solo-wellness-box",
    name: "Solo Wellness Box",
    description: "Curated monthly wellness essentials for you",
    defaultIntervalDays: 30,
  },
  {
    slug: "couples-box",
    name: "Couples Box",
    description: "Monthly couples wellness package",
    defaultIntervalDays: 30,
  },
  {
    slug: "skincare-box",
    name: "Skincare Box",
    description: "Premium skincare products monthly",
    defaultIntervalDays: 30,
  },
];

// Process all due subscriptions — create renewal orders
async function processDueSubscriptions(): Promise<void> {
  const now = new Date();

  const due = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      nextDelivery: { lte: now },
    },
    include: {
      user: { select: { id: true, email: true, name: true, phone: true } },
      product: {
        select: {
          id: true,
          name: true,
          price: true,
          stock: true,
          reservedStock: true,
          trackInventory: true,
          allowBackorder: true,
        },
      },
    },
    take: 50, // Process 50 at a time
  });

  for (const sub of due) {
    try {
      // Check stock
      if (sub.product.trackInventory && !sub.product.allowBackorder) {
        const available = sub.product.stock - sub.product.reservedStock;
        if (available < sub.quantity) {
          // Notify user and skip
          if (sub.user.phone) {
            await sendWhatsApp({
              to: sub.user.phone,
              text: `⚠️ PleasureZone: Your ${sub.product.name} subscription couldn't renew — product is temporarily out of stock. We'll retry when back in stock.`,
            });
          }
          continue;
        }
      }

      const unitPrice = Number(sub.product.price);
      const discount = Number(sub.discount);
      const effectivePrice = unitPrice * (1 - discount / 100);
      const totalAmount = effectivePrice * sub.quantity;
      const orderNumber = `PZ-SUB-${Date.now().toString(36).toUpperCase()}`;

      // Get user's default address
      const defaultAddress = await prisma.address.findFirst({
        where: { userId: sub.userId, isDefault: true },
      });

      const order = await prisma.$transaction(async (tx) => {
        // Concurrency-safe stock check inside the transaction using FOR UPDATE row locking
        if (sub.product.trackInventory && !sub.product.allowBackorder) {
          const [product] = await tx.$queryRaw<any[]>`
            SELECT stock, "reservedStock" FROM "Product" WHERE id = ${sub.productId} FOR UPDATE`;
          if (product) {
            const available = product.stock - (product.reservedStock || 0);
            if (available < sub.quantity) {
              throw new Error("INSUFFICIENT_STOCK");
            }
          }
        }

        const o = await tx.order.create({
          data: {
            orderNumber,
            userId: sub.userId,
            customerName: sub.user.name || "Subscriber",
            customerEmail: sub.user.email,
            customerPhone: sub.user.phone,
            shippingAddress: defaultAddress
              ? JSON.stringify({
                  name: defaultAddress.name,
                  phone: defaultAddress.phone,
                  street: defaultAddress.street,
                  city: defaultAddress.city,
                  county: defaultAddress.county,
                  country: defaultAddress.country,
                })
              : JSON.stringify({ pending: true }),
            subtotal: totalAmount,
            totalAmount,
            status: "CONFIRMED",
            paymentStatus: "PENDING", // Will be charged via mobile money
            discreet: true,
            notes: `Subscription renewal — ${sub.intervalDays} day interval`,
            items: {
              create: [{
                productId: sub.productId,
                name: sub.product.name,
                price: effectivePrice,
                quantity: sub.quantity,
              }],
            },
          },
        });

        // Create a stock reservation so that payment confirmation correctly decrements stock
        const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days reservation timeout
        await tx.stockReservation.create({
          data: {
            orderId: o.id,
            productId: sub.productId,
            quantity: sub.quantity,
            expiresAt,
          },
        });

        // Increment reserved stock on product
        if (sub.product.trackInventory) {
          await tx.product.update({
            where: { id: sub.productId },
            data: {
              reservedStock: { increment: sub.quantity },
            },
          });
        }

        // Update subscription next delivery date
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + sub.intervalDays);
        await tx.subscription.update({
          where: { id: sub.id },
          data: { nextDelivery: nextDate },
        });

        return o;
      });

      // Notify user
      if (sub.user.phone) {
        const msg =
          `📦 PleasureZone: Your ${sub.product.name} subscription has renewed!\n\n` +
          `Order: ${orderNumber}\n` +
          `Amount: UGX ${totalAmount.toLocaleString()}\n` +
          `${discount > 0 ? `Subscriber discount: ${discount}% off ✓\n` : ""}` +
          `\nWe'll notify you when shipped. Reply PAUSE to pause.`;
        const sent = await sendWhatsApp({ to: sub.user.phone, text: msg });
        if (!sent) await sendSMS(sub.user.phone, `PleasureZone: ${sub.product.name} subscription renewed. Order ${orderNumber}. UGX ${totalAmount.toLocaleString()}`);
      }

      // Schedule restock reminder for consumable products
      await scheduleRestockReminders(order.id);

    } catch (err: any) {
      if (err.message === "INSUFFICIENT_STOCK") {
        if (sub.user.phone) {
          await sendWhatsApp({
            to: sub.user.phone,
            text: `⚠️ PleasureZone: Your ${sub.product.name} subscription couldn't renew — product is temporarily out of stock. We'll retry when back in stock.`,
          });
        }
      } else {
        logger.error(`Subscription processing failed for ${sub.id}`, { error: err.message });
      }
    }
  }
}

// Send renewal reminders 3 days before next delivery
async function sendRenewalReminders(): Promise<void> {
  const in3Days = new Date();
  in3Days.setDate(in3Days.getDate() + 3);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);

  const upcoming = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      nextDelivery: { gte: tomorrow, lte: in3Days },
    },
    include: {
      user: { select: { phone: true, name: true } },
      product: { select: { name: true, price: true } },
    },
  });

  for (const sub of upcoming) {
    if (!sub.user.phone) continue;
    const discount = Number(sub.discount);
    const price = Number(sub.product.price) * sub.quantity * (1 - discount / 100);

    await sendWhatsApp({
      to: sub.user.phone,
      text: `🔔 PleasureZone: Your ${sub.product.name} subscription renews in 3 days.\n\nAmount: UGX ${price.toLocaleString()}\n\nReply PAUSE to skip this renewal or CANCEL to cancel subscription.`,
    });
  }
}

// Handle SMS replies for subscription management
export async function handleSubscriptionSMSReply(phone: string, message: string): Promise<void> {
  const text = message.trim().toUpperCase();
  if (text !== "PAUSE" && text !== "CANCEL") return;

  let normalized = phone.replace(/\s/g, "");
  if (normalized.startsWith("0")) normalized = "+256" + normalized.slice(1);
  if (!normalized.startsWith("+")) normalized = "+" + normalized;

  const user = await prisma.user.findFirst({ where: { phone: normalized } });
  if (!user) return;

  const subs = await prisma.subscription.findMany({
    where: { userId: user.id, status: "ACTIVE" },
    include: { product: { select: { name: true } } },
  });

  if (subs.length === 0) return;

  const newStatus = text === "PAUSE" ? "PAUSED" : "CANCELLED";
  await prisma.subscription.updateMany({
    where: { userId: user.id, status: "ACTIVE" },
    data: { status: newStatus },
  });

  const names = subs.map((s) => s.product.name).join(", ");
  await sendWhatsApp({
    to: phone,
    text: text === "PAUSE"
      ? `✅ Your subscriptions (${names}) have been paused. Reply RESUME to restart anytime.`
      : `✅ Your subscriptions (${names}) have been cancelled. Visit ugsex.com to resubscribe anytime.`,
  });
}

export function startSubscriptionBoxJob(): void {
  const run = async () => {
    try {
      await processDueSubscriptions();
      await sendRenewalReminders();
    } catch (err: any) {
      logger.error("Subscription box job error", { error: err.message });
    }
  };

  // Run immediately, then every hour
  run();
  setInterval(run, 60 * 60 * 1000);
}
