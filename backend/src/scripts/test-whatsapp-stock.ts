import prisma from "../lib/prisma";
import axios from "axios";
const BASE_URL = "http://127.0.0.1:4000/api/whatsapp-bot/webhook";
const PHONE = "256770000000";

async function sendWhatsAppMock(text: string) {
  const payload = {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  from: PHONE,
                  type: "text",
                  text: {
                    body: text,
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  try {
    const response = await axios.post(BASE_URL, payload);
    console.log(`🤖 Sent "${text}" -> Response status: ${response.status}`);
    return response.status;
  } catch (err: any) {
    console.error(`❌ Sent "${text}" -> Error: ${err.message}`, err.response?.data || "");
    throw err;
  }
}

async function runTest() {
  console.log("🚀 Starting WhatsApp Bot Stock Integration Tests...");

  const categorySlug = "whatsapp-test-category-" + Date.now();
  let category = await prisma.category.findFirst({
    where: { name: "!WhatsApp Test Category" },
  });
  if (!category) {
    category = await prisma.category.create({
      data: {
        name: "!WhatsApp Test Category",
        slug: categorySlug,
      },
    });
  }

  const productSlug = "whatsapp-test-toy-" + Date.now();
  const product = await prisma.product.create({
    data: {
      name: "!WhatsApp Test Toy",
      slug: productSlug,
      price: 1500,
      stock: 10,
      trackInventory: true,
      allowBackorder: false,
      featured: true,
      status: "ACTIVE",
      categoryId: category.id,
      description: "A cool test product for WhatsApp Bot stock integration checks.",
    },
  });
  console.log(`✅ Created test product: ${product.name} (Stock: 10)`);

  // Query and log chatbot lists
  const activeCategories = await prisma.category.findMany({ take: 8, orderBy: { name: "asc" } });
  console.log("📂 Chatbot Top Categories:");
  activeCategories.forEach((c, idx) => console.log(`  [${idx + 1}] ${c.name} (ID: ${c.id})`));

  const activeProducts = await prisma.product.findMany({
    where: { categoryId: category.id, status: "ACTIVE" },
    take: 8,
    orderBy: { featured: "desc" },
  });
  console.log("🛍️ Chatbot Products in Category:");
  activeProducts.forEach((p, idx) => console.log(`  [${idx + 1}] ${p.name} (ID: ${p.id})`));

  // Clear any existing test orders referencing our test product
  const oldItems = await prisma.orderItem.findMany({
    where: { productId: product.id },
    select: { orderId: true },
  });
  const oldOrderIds = oldItems.map(item => item.orderId);
  if (oldOrderIds.length > 0) {
    await prisma.payment.deleteMany({ where: { orderId: { in: oldOrderIds } } });
    await prisma.stockReservation.deleteMany({ where: { orderId: { in: oldOrderIds } } });
    await prisma.orderEvent.deleteMany({ where: { orderId: { in: oldOrderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: oldOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: oldOrderIds } } });
  }

  try {
    // --- TEST CASE 1: Cash on Delivery (Direct Stock Decrement) ---
    console.log("\n📦 --- Test Case 1: Cash on Delivery (Stock Decrement) ---");

    // Initialize session and browse
    await sendWhatsAppMock("hello");
    await new Promise((resolve) => setTimeout(resolve, 500));
    await sendWhatsAppMock("1"); // category menu
    await new Promise((resolve) => setTimeout(resolve, 500));
    await sendWhatsAppMock("1"); // select category
    await new Promise((resolve) => setTimeout(resolve, 500));
    await sendWhatsAppMock("1"); // select product
    await new Promise((resolve) => setTimeout(resolve, 500));
    await sendWhatsAppMock("3"); // add 3 to cart
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Start checkout details
    await sendWhatsAppMock("checkout");
    await new Promise((resolve) => setTimeout(resolve, 500));
    await sendWhatsAppMock("Test Recipient"); // Name
    await new Promise((resolve) => setTimeout(resolve, 500));
    await sendWhatsAppMock(PHONE); // Phone
    await new Promise((resolve) => setTimeout(resolve, 500));
    await sendWhatsAppMock("Kampala Road 45"); // Street
    await new Promise((resolve) => setTimeout(resolve, 500));
    await sendWhatsAppMock("Kampala"); // City
    await new Promise((resolve) => setTimeout(resolve, 500));
    await sendWhatsAppMock("3"); // Cash on Delivery (COD)
    await new Promise((resolve) => setTimeout(resolve, 500));
    await sendWhatsAppMock("confirm"); // Confirm checkout
    await new Promise((resolve) => setTimeout(resolve, 1500)); // Wait for order insertion

    // Verify DB state
    const orderItemCod = await prisma.orderItem.findFirst({
      where: { productId: product.id },
      include: { order: true },
    });
    const orderCod = orderItemCod?.order;

    if (!orderCod) {
      throw new Error("COD Order was not created successfully");
    }
    console.log(`✅ Created COD Order: ${orderCod.orderNumber} (Status: ${orderCod.status})`);

    const productCod = await prisma.product.findUnique({
      where: { id: product.id },
    });

    if (!productCod) throw new Error("Product missing");
    console.log(`📊 Stock after COD Order: ${productCod.stock} (Expected: 7)`);
    if (productCod.stock !== 7) {
      throw new Error(`Stock mismatch: expected 7, got ${productCod.stock}`);
    }
    console.log("🟢 Test Case 1 Passed!");

    // --- TEST CASE 2: Mobile Money (Stock Reservation) ---
    console.log("\n📱 --- Test Case 2: Mobile Money (Stock Reservation) ---");

    // Reset stock to 10 for clean test
    await prisma.product.update({
      where: { id: product.id },
      data: { stock: 10, reservedStock: 0 },
    });

    // Start a new session
    await sendWhatsAppMock("hello");
    await new Promise((resolve) => setTimeout(resolve, 500));
    await sendWhatsAppMock("1");
    await new Promise((resolve) => setTimeout(resolve, 500));
    await sendWhatsAppMock("1");
    await new Promise((resolve) => setTimeout(resolve, 500));
    await sendWhatsAppMock("1");
    await new Promise((resolve) => setTimeout(resolve, 500));
    await sendWhatsAppMock("2"); // add 2 to cart
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Checkout
    await sendWhatsAppMock("checkout");
    await new Promise((resolve) => setTimeout(resolve, 500));
    await sendWhatsAppMock("Test Recipient");
    await new Promise((resolve) => setTimeout(resolve, 500));
    await sendWhatsAppMock(PHONE);
    await new Promise((resolve) => setTimeout(resolve, 500));
    await sendWhatsAppMock("Kampala Road 45");
    await new Promise((resolve) => setTimeout(resolve, 500));
    await sendWhatsAppMock("Kampala");
    await new Promise((resolve) => setTimeout(resolve, 500));
    await sendWhatsAppMock("1"); // MTN MoMo
    await new Promise((resolve) => setTimeout(resolve, 500));
    await sendWhatsAppMock(PHONE); // Momo phone number
    await new Promise((resolve) => setTimeout(resolve, 500));
    await sendWhatsAppMock("confirm"); // Confirm checkout
    await new Promise((resolve) => setTimeout(resolve, 1500)); // Wait for order insertion

    // Verify DB state
    const orderItemMomo = await prisma.orderItem.findFirst({
      where: { productId: product.id, order: { status: "PENDING" } },
      include: { order: true },
    });
    const orderMomo = orderItemMomo?.order;

    if (!orderMomo) {
      throw new Error("Mobile Money Order was not created successfully");
    }
    console.log(`✅ Created Mobile Money Order: ${orderMomo.orderNumber} (Status: ${orderMomo.status})`);

    const productMomo = await prisma.product.findUnique({
      where: { id: product.id },
    });

    if (!productMomo) throw new Error("Product missing");
    console.log(`📊 Stock after Momo: ${productMomo.stock} (Expected: 10)`);
    console.log(`📊 Reserved Stock: ${productMomo.reservedStock} (Expected: 2)`);

    if (productMomo.stock !== 10 || productMomo.reservedStock !== 2) {
      throw new Error(`Inventory mismatch: expected stock=10 reserved=2, got stock=${productMomo.stock} reserved=${productMomo.reservedStock}`);
    }

    const reservation = await prisma.stockReservation.findFirst({
      where: { orderId: orderMomo.id, released: false },
    });

    if (!reservation || reservation.quantity !== 2) {
      throw new Error(`Reservation missing or invalid: ${JSON.stringify(reservation)}`);
    }
    console.log(`✅ Validated Stock Reservation: Order ID ${reservation.orderId}, quantity ${reservation.quantity}`);
    console.log("🟢 Test Case 2 Passed!");

  } finally {
    // Cleanup database changes
    const testItems = await prisma.orderItem.findMany({
      where: { productId: product.id },
      select: { orderId: true },
    });
    const orderIds = testItems.map(item => item.orderId);
    if (orderIds.length > 0) {
      await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.stockReservation.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.orderEvent.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    }
    await prisma.product.delete({ where: { id: product.id } }).catch(() => {});
    await prisma.category.delete({ where: { id: category.id } }).catch(() => {});
    console.log("\n🧹 Database cleaned up.");
  }
}

runTest()
  .then(() => {
    console.log("🏆 All tests passed successfully!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
  });
