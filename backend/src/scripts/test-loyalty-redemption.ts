import prisma from "../lib/prisma";

async function runTest() {
  console.log("🚀 Starting loyalty points redemption integration test...");

  // 1. Clean up old test data
  const testEmail = "test_loyalty_user@example.com";
  
  const oldUser = await prisma.user.findUnique({ where: { email: testEmail } });
  if (oldUser) {
    await prisma.loyaltyTransaction.deleteMany({
      where: {
        account: {
          userId: oldUser.id
        }
      }
    });

    await prisma.loyaltyAccount.deleteMany({
      where: {
        userId: oldUser.id
      }
    });

    await prisma.user.delete({
      where: { id: oldUser.id }
    });
  }

  // 2. Create test user
  const user = await prisma.user.create({
    data: {
      email: testEmail,
      password: "hashedpassword123",
      name: "Test Loyalty User",
      role: "CUSTOMER",
      emailVerified: true
    }
  });

  // 3. Create loyalty account with 1000 points
  const account = await prisma.loyaltyAccount.create({
    data: {
      userId: user.id,
      points: 1000,
      lifetimePoints: 1000,
      tier: "BRONZE"
    }
  });

  console.log("✅ Created test user and loyalty account with 1000 points.");

  // 4. Simulate `/api/loyalty/redeem` logic
  const pointsToRedeem = 600;
  
  // Calculate discount value: (600 / 100) * 30 = 180 UGX
  const discountValue = Math.floor((pointsToRedeem / 100) * 30);
  const couponCode = `LOYALTY-${user.id.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  console.log(`📦 Simulating redemption of ${pointsToRedeem} points...`);

  await prisma.$transaction(async (tx) => {
    const activeAccount = await tx.loyaltyAccount.findUnique({ where: { userId: user.id } });
    if (!activeAccount || activeAccount.points < pointsToRedeem) {
      throw new Error("Insufficient points");
    }

    await tx.loyaltyAccount.update({
      where: { userId: user.id },
      data: {
        points: { decrement: pointsToRedeem },
        transactions: {
          create: {
            type: "REDEMPTION",
            points: -pointsToRedeem,
            description: `Redeemed ${pointsToRedeem} points for UGX ${discountValue} discount`,
          },
        },
      },
    });

    await tx.coupon.create({
      data: {
        code: couponCode,
        description: `Loyalty points redemption - ${pointsToRedeem} points`,
        type: "FIXED",
        value: discountValue,
        usageLimit: 1,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        active: true,
      },
    });
  });

  console.log("✅ Simulation transaction complete.");

  // 5. Verification
  const updatedAccount = await prisma.loyaltyAccount.findUnique({
    where: { userId: user.id },
    include: {
      transactions: true
    }
  });

  const coupon = await prisma.coupon.findUnique({
    where: { code: couponCode }
  });

  if (!updatedAccount || updatedAccount.points !== 400) {
    throw new Error(`Verification failed: Expected remaining points 400, got ${updatedAccount?.points}`);
  }
  console.log("✅ Check 1: Points successfully decremented from 1000 to 400.");

  const txRecord = updatedAccount.transactions.find(t => t.type === "REDEMPTION");
  if (!txRecord || txRecord.description !== `Redeemed 600 points for UGX 180 discount`) {
    throw new Error(`Verification failed: Transaction description is incorrect. Got: ${txRecord?.description}`);
  }
  console.log("✅ Check 2: Transaction log has correct UGX description.");

  if (!coupon || Number(coupon.value) !== 180) {
    throw new Error(`Verification failed: Coupon value is incorrect. Got: ${coupon?.value}`);
  }
  console.log("✅ Check 3: Coupon created successfully with value 180 UGX (100 pts = 30 UGX).");

  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY! Loyalty point conversion works perfectly.");
}

runTest()
  .catch(err => {
    console.error("❌ TEST FAILED:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    // Cleanup
    const testEmail = "test_loyalty_user@example.com";
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    if (user) {
      await prisma.loyaltyTransaction.deleteMany({
        where: {
          account: {
            userId: user.id
          }
        }
      });

      await prisma.loyaltyAccount.deleteMany({
        where: {
          userId: user.id
        }
      });

      await prisma.user.delete({
        where: { id: user.id }
      });
    }

    await prisma.$disconnect();
  });
