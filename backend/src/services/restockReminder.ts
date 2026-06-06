import prisma from "../lib/prisma";
import { sendWhatsApp } from "./whatsapp";
import { sendSMS } from "./sms";
import { logger } from "../lib/logger";
import { generateReorderToken } from "../routes/quickReorder";

// Called after an order is marked DELIVERED
// Schedules restock reminders for consumable products
export async function scheduleRestockReminders(orderId: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, phone: true, smsOptIn: true } },
        items: { include: { product: { select: { id: true, name: true, avgDurationDays: true, slug: true } } } },
      },
    });

    if (!order || !order.userId || !order.user?.smsOptIn || !order.user.phone) return;

    for (const item of order.items) {
      if (!item.product.avgDurationDays) continue; // Not a consumable

      const remindAt = new Date();
      remindAt.setDate(remindAt.getDate() + item.product.avgDurationDays);

      // Avoid duplicate reminders
      const existing = await prisma.restockReminder.findFirst({
        where: { userId: order.userId, productId: item.product.id, sent: false },
      });
      if (existing) continue;

      await prisma.restockReminder.create({
        data: {
          userId: order.userId,
          productId: item.product.id,
          orderId: order.id,
          remindAt,
        },
      });
    }
  } catch (error) {
    logger.error("Schedule restock reminders error", { error });
  }
}

// Background job — runs every hour, sends due reminders
export async function startRestockReminderJob(): Promise<void> {
  const run = async () => {
    try {
      const due = await prisma.restockReminder.findMany({
        where: { sent: false, remindAt: { lte: new Date() } },
        include: {
          user: { select: { phone: true, name: true } },
          product: { select: { name: true, slug: true, price: true } },
        },
        take: 50,
      });

      for (const reminder of due) {
        if (!reminder.user.phone) continue;

        const BASE_URL = process.env.FRONTEND_URL || "https://ugsex.com";
        let reorderUrl = `${BASE_URL}/product/${reminder.product.slug}`;

        // Try to generate a quick-reorder deep link
        const token = await generateReorderToken(reminder.userId, reminder.productId);
        if (token) {
          reorderUrl = `${BASE_URL}/reorder/${token}`;
        }

        const message = `💊 PleasureZone: Time to restock ${reminder.product.name}!\n\nRunning low? Reorder in one tap:\n${reorderUrl}`;

        const sent = await sendWhatsApp({ to: reminder.user.phone, text: message });
        if (!sent) await sendSMS(reminder.user.phone, message);

        await prisma.restockReminder.update({
          where: { id: reminder.id },
          data: { sent: true, sentAt: new Date() },
        });
      }
    } catch (error) {
      logger.error("Restock reminder job error", { error });
    }
  };

  // Run immediately, then every hour
  await run();
  setInterval(run, 60 * 60 * 1000);
}
