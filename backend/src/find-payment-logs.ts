import prisma from "./lib/prisma";

async function main() {
  const orderId = "cmqmi05vd000a50hnvqcd7t3v";

  console.log("=== Querying database for Order payments ===");
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      payments: true,
      mobileMoneyTxns: true,
      timeline: true
    }
  });

  console.log("Order info:", {
    orderNumber: order?.orderNumber,
    totalAmount: order?.totalAmount,
    splitPaidAmount: order?.splitPaidAmount,
    splitPartnerPaid: order?.splitPartnerPaid,
    paymentStatus: order?.paymentStatus,
    status: order?.status
  });

  console.log("\n=== Payment Records ===");
  console.log(JSON.stringify(order?.payments, null, 2));

  console.log("\n=== Mobile Money Transactions ===");
  console.log(JSON.stringify(order?.mobileMoneyTxns, null, 2));

  console.log("\n=== Timeline Events ===");
  console.log(JSON.stringify(order?.timeline, null, 2));

  console.log("\n=== Processed Webhooks (idempotency key matches) ===");
  const processedWebhooks = await prisma.processedWebhook.findMany({
    where: {
      webhookId: {
        contains: orderId
      }
    }
  });
  console.log(JSON.stringify(processedWebhooks, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
