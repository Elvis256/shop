import prisma from "../lib/prisma";
import { sendWhatsApp } from "./whatsapp";
import { sendSMS } from "./sms";
import { logger } from "../lib/logger";

async function processInstallmentReminders(): Promise<void> {
  try {
    // Find overdue installments
    const overduePlans = await prisma.installmentPlan.findMany({
      where: {
        status: { in: ["ACTIVE", "OVERDUE"] },
        nextDueDate: { lt: new Date() },
      },
      include: {
        order: {
          select: {
            orderNumber: true,
            customerPhone: true,
            customerName: true,
            currency: true,
          },
        },
        payments: {
          where: { status: { in: ["PENDING", "OVERDUE"] } },
          orderBy: { number: "asc" },
          take: 1,
        },
      },
      take: 50,
    });

    for (const plan of overduePlans) {
      const nextPayment = plan.payments[0];
      if (!nextPayment || !plan.order.customerPhone) continue;

      // Mark as overdue if not already
      if (plan.status === "ACTIVE") {
        await prisma.$transaction([
          prisma.installmentPlan.update({
            where: { id: plan.id },
            data: { status: "OVERDUE" },
          }),
          prisma.installmentPayment.update({
            where: { id: nextPayment.id },
            data: { status: "OVERDUE" },
          }),
        ]);
      }

      const msg = `⏰ PleasureZone: Your installment of ${plan.order.currency} ${Number(nextPayment.amount).toLocaleString()} for order ${plan.order.orderNumber} is overdue. Pay now to avoid cancellation. Visit your account to make the payment.`;

      const sent = await sendWhatsApp({ to: plan.order.customerPhone, text: msg });
      if (!sent) {
        await sendSMS(plan.order.customerPhone, msg);
      }

      logger.info(`Installment reminder sent for plan ${plan.id}`);
    }
  } catch (err) {
    logger.error("Installment reminders error", { error: err });
  }
}

export async function startInstallmentReminderJob(): Promise<void> {
  await processInstallmentReminders();
  setInterval(processInstallmentReminders, 24 * 60 * 60 * 1000); // Daily
}
