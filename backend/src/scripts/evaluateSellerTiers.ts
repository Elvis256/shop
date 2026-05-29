import prisma from "../lib/prisma";

/**
 * Evaluate and update seller tiers based on performance.
 * Rules:
 *   GOLD:   200+ totalSales OR UGX 20,000,000+ totalEarnings
 *   SILVER: 50+ totalSales  OR UGX 5,000,000+ totalEarnings
 *   BRONZE: default
 *
 * Run manually: npx ts-node src/scripts/evaluateSellerTiers.ts
 * Or automatically via startSellerTierJob() (daily).
 */
export async function evaluateSellerTiers() {
  const sellers = await prisma.seller.findMany({
    where: { status: "APPROVED" },
    select: { id: true, totalSales: true, totalEarnings: true, tier: true },
  });

  let updated = 0;

  for (const seller of sellers) {
    const sales = seller.totalSales;
    const earnings = Number(seller.totalEarnings);

    let newTier: "GOLD" | "SILVER" | "BRONZE" = "BRONZE";
    if (sales >= 200 || earnings >= 20_000_000) {
      newTier = "GOLD";
    } else if (sales >= 50 || earnings >= 5_000_000) {
      newTier = "SILVER";
    }

    if (newTier !== seller.tier) {
      await prisma.seller.update({
        where: { id: seller.id },
        data: { tier: newTier },
      });
      console.log(`Seller ${seller.id}: ${seller.tier} → ${newTier}`);
      updated++;
    }
  }

  console.log(`[SellerTiers] Evaluation complete. ${updated}/${sellers.length} sellers updated.`);
}

/**
 * Background job: runs evaluateSellerTiers() once daily (every 24h).
 */
export function startSellerTierJob() {
  const INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  // Run once on startup after a short delay
  setTimeout(() => {
    evaluateSellerTiers().catch((err) =>
      console.error("[SellerTiers] Evaluation failed:", err)
    );
  }, 30_000); // 30s after boot

  // Then run every 24 hours
  setInterval(() => {
    evaluateSellerTiers().catch((err) =>
      console.error("[SellerTiers] Evaluation failed:", err)
    );
  }, INTERVAL);

  console.log("[SellerTiers] Job scheduled (every 24h)");
}

// Allow direct execution: npx ts-node src/scripts/evaluateSellerTiers.ts
if (require.main === module) {
  evaluateSellerTiers()
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error("Tier evaluation failed:", err);
      prisma.$disconnect();
      process.exit(1);
    });
}
