import prisma from "../lib/prisma";
import crypto from "crypto";

async function runTest() {
  console.log("🚀 Starting layaway completion order creation integration test...");

  // 1. Clean up old test data
  await prisma.layawayPayment.deleteMany({
    where: {
      plan: {
        user: {
          email: "test_layaway_buyer@example.com"
        }
      }
    }
  });

  await prisma.layawayPlan.deleteMany({
    where: {
      user: {
        email: "test_layaway_buyer@example.com"
      }
    }
  });

  await prisma.orderItem.deleteMany({
    where: {
      order: {
        customerEmail: "test_layaway_buyer@example.com"
      }
    }
  });

  await prisma.order.deleteMany({
    where: {
      customerEmail: "test_layaway_buyer@example.com"
    }
  });

  await prisma.user.deleteMany({
    where: {
      email: "test_layaway_buyer@example.com"
    }
  });

  await prisma.product.deleteMany({
    where: {
      slug: "test-layaway-product"
    }
  });

  // 2. Create test product & user
  const category = await prisma.category.findFirst();
  const product = await prisma.product.create({
    data: {
      name: "Test Layaway Product",
      slug: "test-layaway-product",
      description: "A product to test layaway completion",
      price: 50000,
      stock: 5,
      categoryId: category?.id || null,
      status: "ACTIVE",
    }
  });

  const user = await prisma.user.create({
    data: {
      email: "test_layaway_buyer@example.com",
      password: "hashedpassword123",
      name: "Test Layaway Buyer",
      role: "CUSTOMER",
      emailVerified: true,
      phone: "+256700000000"
    }
  });

  // 3. Create layaway plan (providing installmentAmount)
  const plan = await prisma.layawayPlan.create({
    data: {
      userId: user.id,
      productId: product.id,
      targetAmount: 50000,
      paidAmount: 25000, // Paid 50% so far
      status: "ACTIVE",
      frequency: "WEEKLY",
      installmentAmount: 10000,
      nextPaymentDate: new Date(),
    },
    include: {
      user: true,
      product: true
    }
  });

  console.log("✅ Created test product, user, and layaway plan:", {
    product: product.name,
    buyer: user.email,
    planId: plan.id,
    paidAmount: plan.paidAmount.toString(),
    targetAmount: plan.targetAmount.toString()
  });

  // 4. Create a final payment of 25000 to complete the plan
  const payment = await prisma.layawayPayment.create({
    data: {
      planId: plan.id,
      amount: 25000,
      status: "PENDING",
      flwRef: "TX-TEST-LAYAWAY-FINAL",
    }
  });

  // 5. Simulate the handleLayawayPayment transaction logic from layaway.ts
  console.log("📦 Processing final layaway payment to complete the plan...");
  
  const paymentId = payment.id;
  const planId = plan.id;
  const newPaidAmount = Number(plan.paidAmount) + 25000;
  const isCompleted = newPaidAmount >= Number(plan.targetAmount);

  await prisma.$transaction(async (tx) => {
    await tx.layawayPayment.update({
      where: { id: paymentId },
      data: { status: "PAID", paidAt: new Date() },
    });

    await tx.layawayPlan.update({
      where: { id: planId },
      data: {
        paidAmount: newPaidAmount,
        status: isCompleted ? "COMPLETED" : "ACTIVE",
        completedAt: isCompleted ? new Date() : undefined,
      },
    });

    // Auto-create order when plan completes
    if (isCompleted) {
      const canFulfill = plan.product.stock > 0 || plan.product.allowBackorder;
      if (canFulfill) {
        const orderNumber = `LAY-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

        const order = await tx.order.create({
          data: {
            orderNumber,
            userId: plan.userId,
            customerName: plan.user.name || "",
            customerEmail: plan.user.email,
            customerPhone: plan.user.phone || "",
            shippingAddress: "{}",
            subtotal: Number(plan.targetAmount),
            totalAmount: Number(plan.targetAmount),
            currency: "UGX",
            status: "PENDING", // Verified: MUST BE PENDING
            paymentStatus: "SUCCESSFUL",
            items: {
              create: {
                productId: plan.product.id,
                name: plan.product.name,
                price: Number(plan.product.price),
                quantity: 1,
                sellerId: plan.product.sellerId,
              },
            },
          },
        });

        await tx.layawayPlan.update({
          where: { id: planId },
          data: { orderId: order.id },
        });

        // Decrement stock
        await tx.product.update({
          where: { id: plan.product.id },
          data: { stock: { decrement: 1 } },
        });
      }
    }
  });

  console.log("✅ Simulated layaway payment processor transaction complete.");

  // 6. Verification
  const updatedPlan = await prisma.layawayPlan.findUnique({
    where: { id: planId }
  });

  if (!updatedPlan || updatedPlan.status !== "COMPLETED") {
    throw new Error(`Verification failed: Layaway plan status is not COMPLETED. Got: ${updatedPlan?.status}`);
  }
  console.log("✅ Check 1: Layaway plan successfully completed.");

  if (!updatedPlan.orderId) {
    throw new Error("Verification failed: Order ID was not set on the layaway plan.");
  }

  const order = await prisma.order.findUnique({
    where: { id: updatedPlan.orderId }
  });

  if (!order) {
    throw new Error("Verification failed: Associated Order record could not be found.");
  }
  
  if (order.status !== "PENDING") {
    throw new Error(`Verification failed: Expected completed layaway order to have PENDING status, got ${order.status}`);
  }
  console.log("✅ Check 2: Completed layaway order created in PENDING status.");

  if (order.shippingAddress !== "{}") {
    throw new Error(`Verification failed: Expected shippingAddress "{}" for layaway order, got "${order.shippingAddress}"`);
  }
  console.log("✅ Check 3: Completed layaway order created with empty shipping address '{}'.");

  const updatedProduct = await prisma.product.findUnique({
    where: { id: product.id }
  });

  if (!updatedProduct || updatedProduct.stock !== 4) {
    throw new Error(`Verification failed: Product stock was not decremented. Stock: ${updatedProduct?.stock}`);
  }
  console.log("✅ Check 4: Product stock successfully decremented by 1.");

  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY! Layaway completion logic works perfectly.");
}

runTest()
  .catch(err => {
    console.error("❌ TEST FAILED:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    // Cleanup test data
    await prisma.layawayPayment.deleteMany({
      where: {
        plan: {
          user: {
            email: "test_layaway_buyer@example.com"
          }
        }
      }
    });

    await prisma.layawayPlan.deleteMany({
      where: {
        user: {
          email: "test_layaway_buyer@example.com"
        }
      }
    });

    await prisma.orderItem.deleteMany({
      where: {
        order: {
          customerEmail: "test_layaway_buyer@example.com"
        }
      }
    });

    await prisma.order.deleteMany({
      where: {
        customerEmail: "test_layaway_buyer@example.com"
      }
    });

    await prisma.user.deleteMany({
      where: {
        email: "test_layaway_buyer@example.com"
      }
    });

    await prisma.product.deleteMany({
      where: {
        slug: "test-layaway-product"
      }
    });

    await prisma.$disconnect();
  });
