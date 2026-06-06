import prisma from "../lib/prisma";
import { sendWhatsApp } from "./whatsapp";
import { sendSMS } from "./sms";
import { logger } from "../lib/logger";

async function processLayawayReminders(): Promise<void> {
  try {
    const now = new Date();

    // 1. Send payment reminders for due plans
    const duePlans = await prisma.layawayPlan.findMany({
      where: {
        status: "ACTIVE",
        nextPaymentDate: { lte: now },
      },
      include: {
        user: { select: { phone: true, name: true } },
        product: { select: { name: true } },
      },
      take: 50,
    });

    for (const plan of duePlans) {
      if (!plan.user.phone) continue;

      const remaining = Number(plan.targetAmount) - Number(plan.paidAmount);
      const msg = `💰 PleasureZone: Your layaway payment of UGX ${Number(plan.installmentAmount).toLocaleString()} for ${plan.product.name} is due. UGX ${remaining.toLocaleString()} remaining. Visit your account to pay.`;

      const sent = await sendWhatsApp({ to: plan.user.phone, text: msg });
      if (!sent) await sendSMS(plan.user.phone, msg);
    }

    // 2. Mark plans EXPIRED after 14 days of no payment
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const expiredPlans = await prisma.layawayPlan.findMany({
      where: {
        status: "ACTIVE",
        nextPaymentDate: { lte: fourteenDaysAgo },
      },
      include: {
        user: { select: { id: true, phone: true } },
        product: { select: { name: true } },
      },
    });

    for (const plan of expiredPlans) {
      const paidAmount = Number(plan.paidAmount);

      await prisma.$transaction(async (tx) => {
        await tx.layawayPlan.update({
          where: { id: plan.id },
          data: { status: "EXPIRED" },
        });

        // Issue store credit for paid amount
        if (paidAmount > 0) {
          await tx.storeCredit.upsert({
            where: { userId: plan.userId },
            update: { balance: { increment: paidAmount } },
            create: { userId: plan.userId, balance: paidAmount },
          });
        }
      });

      if (plan.user.phone) {
        const msg = `⏰ Your layaway plan for ${plan.product.name} has expired due to missed payments. ${paidAmount > 0 ? `UGX ${paidAmount.toLocaleString()} has been added to your store credit.` : ""}`;
        await sendWhatsApp({ to: plan.user.phone, text: msg });
      }

      logger.info(`Layaway plan ${plan.id} expired`);
    }

    // 3. Send progress updates for plans > 50% paid
    const progressPlans = await prisma.layawayPlan.findMany({
      where: {
        status: "ACTIVE",
        updatedAt: {
          // Only send for plans updated in the last 24 hours (recent payment)
          gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        },
      },
      include: {
        user: { select: { phone: true } },
        product: { select: { name: true } },
      },
    });

    for (const plan of progressPlans) {
      const progress = Math.round((Number(plan.paidAmount) / Number(plan.targetAmount)) * 100);
      if (progress < 50 || !plan.user.phone) continue;

      const remaining = Number(plan.targetAmount) - Number(plan.paidAmount);
      const msg = `🎯 You're ${progress}% there! Only UGX ${remaining.toLocaleString()} left to own ${plan.product.name}. Keep going!`;
      await sendWhatsApp({ to: plan.user.phone, text: msg });
    }
  } catch (error) {
    logger.error("Layaway reminders error", { error });
  }
}

export async function startLayawayReminderJob(): Promise<void> {
  await processLayawayReminders();
  setInterval(processLayawayReminders, 24 * 60 * 60 * 1000); // Daily
}
