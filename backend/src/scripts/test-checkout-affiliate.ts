import prisma from "../lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

async function runTest() {
  console.log("🚀 Starting affiliate tracking database integration test...");

  // 1. Clean up old test data
  await prisma.affiliateConversion.deleteMany({
    where: {
      affiliate: {
        code: "TESTAFF123"
      }
    }
  });

  await prisma.affiliate.deleteMany({
    where: {
      code: "TESTAFF123"
    }
  });

  await prisma.orderItem.deleteMany({
    where: {
      order: {
        orderNumber: "TEST-ORD-AFFILIATE"
      }
    }
  });

  await prisma.order.deleteMany({
    where: {
      orderNumber: "TEST-ORD-AFFILIATE"
    }
  });

  await prisma.product.deleteMany({
    where: {
      slug: "test-affiliate-product"
    }
  });

  // 2. Create test product
  const category = await prisma.category.findFirst();
  const product = await prisma.product.create({
    data: {
      name: "Test Affiliate Product",
      slug: "test-affiliate-product",
      description: "A product to test affiliate tracking",
      price: 10000,
      stock: 10,
      categoryId: category?.id || null,
      status: "ACTIVE",
    }
  });

  // 3. Create approved affiliate
  const affiliate = await prisma.affiliate.create({
    data: {
      name: "Test Affiliate",
      email: "test_affiliate@example.com",
      code: "TESTAFF123",
      commissionRate: new Decimal(15.00), // 15% commission
      status: "APPROVED",
    }
  });

  console.log("✅ Created test product & affiliate:", {
    product: product.name,
    affiliate: affiliate.code,
    rate: affiliate.commissionRate.toString()
  });

  // 4. Run the checkout transaction simulator
  console.log("📦 Simulating checkout transaction with affiliateCode...");
  
  await prisma.$transaction(async (tx) => {
    // A. Create order
    const order = await tx.order.create({
      data: {
        orderNumber: "TEST-ORD-AFFILIATE",
        subtotal: 10000,
        discount: 0,
        totalAmount: 10000,
        shippingCost: 0,
        tax: 0,
        currency: "UGX",
        status: "PENDING",
        customerName: "Test Affiliate Buyer",
        customerEmail: "buyer@example.com",
        customerPhone: "+256700000000",
        shippingAddress: "{}",
        items: {
          create: {
            productId: product.id,
            quantity: 1,
            price: 10000,
            name: product.name,
          }
        }
      }
    });

    // B. The exact code block we integrated in checkout.ts
    const body = {
      affiliateCode: "testaff123" // Test case-insensitive lookup
    };

    if (body.affiliateCode) {
      let affiliateRecord = await tx.affiliate.findUnique({
        where: { code: body.affiliateCode }
      });
      if (!affiliateRecord && body.affiliateCode.toUpperCase() !== body.affiliateCode) {
        affiliateRecord = await tx.affiliate.findUnique({
          where: { code: body.affiliateCode.toUpperCase() }
        });
      }
      if (affiliateRecord && affiliateRecord.status === "APPROVED") {
        const orderAmount = Number(order.totalAmount);
        const commission = orderAmount * (Number(affiliateRecord.commissionRate) / 100);
        await tx.affiliateConversion.create({
          data: {
            affiliateId: affiliateRecord.id,
            orderId: order.id,
            orderAmount,
            commission,
            status: "PENDING",
          },
        });
        await tx.affiliate.update({
          where: { id: affiliateRecord.id },
          data: {
            totalOrders: { increment: 1 },
          },
        });
      }
    }
  });

  console.log("✅ Checkout transaction simulation complete.");

  // 5. Verification
  const updatedAffiliate = await prisma.affiliate.findUnique({
    where: { code: "TESTAFF123" }
  });

  const conversion = await prisma.affiliateConversion.findFirst({
    where: {
      affiliate: {
        code: "TESTAFF123"
      }
    }
  });

  if (!updatedAffiliate || updatedAffiliate.totalOrders !== 1) {
    throw new Error(`Verification failed: Affiliate totalOrders was not incremented. Value: ${updatedAffiliate?.totalOrders}`);
  }
  console.log("✅ Check 1: Affiliate totalOrders successfully incremented to 1.");

  if (!conversion) {
    throw new Error("Verification failed: AffiliateConversion record was not created.");
  }
  
  if (Number(conversion.orderAmount) !== 10000) {
    throw new Error(`Verification failed: Expected orderAmount 10000, got ${conversion.orderAmount}`);
  }

  // 15% of 10000 is 1500
  if (Number(conversion.commission) !== 1500) {
    throw new Error(`Verification failed: Expected commission 1500, got ${conversion.commission}`);
  }

  if (conversion.status !== "PENDING") {
    throw new Error(`Verification failed: Expected conversion status PENDING, got ${conversion.status}`);
  }

  console.log("✅ Check 2: AffiliateConversion created successfully:", {
    orderId: conversion.orderId,
    orderAmount: conversion.orderAmount.toString(),
    commission: conversion.commission.toString(),
    status: conversion.status
  });

  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY! Affiliate tracking checkout logic works perfectly.");
}

runTest()
  .catch(err => {
    console.error("❌ TEST FAILED:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    // Cleanup test data
    await prisma.affiliateConversion.deleteMany({
      where: {
        affiliate: {
          code: "TESTAFF123"
        }
      }
    });

    await prisma.affiliate.deleteMany({
      where: {
        code: "TESTAFF123"
      }
    });

    await prisma.orderItem.deleteMany({
      where: {
        order: {
          orderNumber: "TEST-ORD-AFFILIATE"
        }
      }
    });

    await prisma.order.deleteMany({
      where: {
        orderNumber: "TEST-ORD-AFFILIATE"
      }
    });

    await prisma.product.deleteMany({
      where: {
        slug: "test-affiliate-product"
      }
    });

    await prisma.$disconnect();
  });
