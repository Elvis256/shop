import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create admin user
  const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || "admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL || "admin@adultstore.com" },
    update: {},
    create: {
      email: process.env.ADMIN_EMAIL || "admin@adultstore.com",
      password: adminPassword,
      name: "Admin",
      role: "ADMIN",
      emailVerified: true,
    },
  });
  console.log("✅ Admin user created:", admin.email);

  // Create categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: "toys" },
      update: {},
      create: { name: "Toys", slug: "toys", description: "Premium adult toys for all preferences" },
    }),
    prisma.category.upsert({
      where: { slug: "lingerie" },
      update: {},
      create: { name: "Lingerie", slug: "lingerie", description: "Elegant and seductive lingerie" },
    }),
    prisma.category.upsert({
      where: { slug: "wellness" },
      update: {},
      create: { name: "Wellness", slug: "wellness", description: "Massage oils, lubricants, and wellness products" },
    }),
    prisma.category.upsert({
      where: { slug: "accessories" },
      update: {},
      create: { name: "Accessories", slug: "accessories", description: "Enhance your experience" },
    }),
    prisma.category.upsert({
      where: { slug: "couples" },
      update: {},
      create: { name: "Couples", slug: "couples", description: "Products designed for couples" },
    }),
  ]);
  console.log("✅ Categories created:", categories.length);

  // Create products
  const products = [
    // Toys
    {
      name: "Premium Silicone Massager",
      slug: "premium-silicone-massager",
      description: "Experience ultimate pleasure with our premium medical-grade silicone massager. Features 10 vibration modes, whisper-quiet motor, and is fully waterproof (IPX7). USB rechargeable with 2-hour runtime.",
      price: 4999,
      comparePrice: 6499,
      stock: 50,
      categoryId: categories[0].id,
      status: "ACTIVE",
      featured: true,
      rating: 4.8,
      reviewCount: 128,
      tags: ["bestseller", "waterproof", "rechargeable"],
    },
    {
      name: "Wireless Remote Vibrator",
      slug: "wireless-remote-vibrator",
      description: "Discreet wearable vibrator with wireless remote control. Perfect for couples looking for adventure. Range up to 10 meters.",
      price: 5499,
      stock: 35,
      categoryId: categories[0].id,
      status: "ACTIVE",
      featured: true,
      rating: 4.6,
      reviewCount: 89,
      tags: ["couples", "wireless", "discreet"],
    },
    {
      name: "Luxury Rabbit Vibrator",
      slug: "luxury-rabbit-vibrator",
      description: "Dual-stimulation rabbit vibrator with 12 patterns and 3 speeds. Premium silicone, waterproof, and rechargeable.",
      price: 7999,
      comparePrice: 9999,
      stock: 25,
      categoryId: categories[0].id,
      status: "ACTIVE",
      rating: 4.9,
      reviewCount: 256,
      tags: ["premium", "dual-stimulation"],
    },
    {
      name: "Compact Bullet Vibrator",
      slug: "compact-bullet-vibrator",
      description: "Powerful yet discreet bullet vibrator. Perfect for travel. 10 vibration modes, USB rechargeable.",
      price: 1999,
      stock: 100,
      categoryId: categories[0].id,
      status: "ACTIVE",
      rating: 4.5,
      reviewCount: 312,
      tags: ["travel", "discreet", "beginner"],
    },
    // Lingerie
    {
      name: "Luxury Lace Bodysuit",
      slug: "luxury-lace-bodysuit",
      description: "Elegant French lace bodysuit with adjustable straps. Available in Black, Red, and White. Sizes S-XL.",
      price: 2999,
      stock: 60,
      categoryId: categories[1].id,
      status: "ACTIVE",
      featured: true,
      rating: 4.7,
      reviewCount: 78,
      tags: ["lace", "elegant"],
    },
    {
      name: "Satin Robe Set",
      slug: "satin-robe-set",
      description: "Luxurious satin robe with matching chemise. Includes lace trim details. One size fits most.",
      price: 3499,
      stock: 45,
      categoryId: categories[1].id,
      status: "ACTIVE",
      rating: 4.8,
      reviewCount: 92,
      tags: ["satin", "set"],
    },
    {
      name: "Sheer Babydoll Set",
      slug: "sheer-babydoll-set",
      description: "Flirty babydoll with matching thong. Delicate mesh with lace trim. Sizes S-XXL.",
      price: 1999,
      comparePrice: 2499,
      stock: 80,
      categoryId: categories[1].id,
      status: "ACTIVE",
      rating: 4.4,
      reviewCount: 145,
      tags: ["sheer", "set", "sale"],
    },
    // Wellness
    {
      name: "Premium Massage Oil Set",
      slug: "premium-massage-oil-set",
      description: "Set of 3 premium massage oils: Warming, Cooling, and Sensual. Natural ingredients, skin-safe. 100ml each.",
      price: 1499,
      stock: 120,
      categoryId: categories[2].id,
      status: "ACTIVE",
      featured: true,
      rating: 4.6,
      reviewCount: 203,
      tags: ["natural", "set"],
    },
    {
      name: "Water-Based Lubricant",
      slug: "water-based-lubricant",
      description: "Premium water-based lubricant. Compatible with all toys and condoms. Hypoallergenic. 200ml.",
      price: 799,
      stock: 200,
      categoryId: categories[2].id,
      status: "ACTIVE",
      rating: 4.7,
      reviewCount: 456,
      tags: ["bestseller", "essential"],
    },
    {
      name: "Silicone Lubricant",
      slug: "silicone-lubricant",
      description: "Long-lasting silicone-based lubricant. Waterproof formula, perfect for intimate moments. 100ml.",
      price: 1299,
      stock: 150,
      categoryId: categories[2].id,
      status: "ACTIVE",
      rating: 4.5,
      reviewCount: 178,
      tags: ["long-lasting", "waterproof"],
    },
    {
      name: "Massage Candle",
      slug: "massage-candle",
      description: "Luxurious massage candle that melts into warm massage oil. Vanilla & Jasmine scent. 60-hour burn time.",
      price: 999,
      stock: 90,
      categoryId: categories[2].id,
      status: "ACTIVE",
      rating: 4.8,
      reviewCount: 134,
      tags: ["romantic", "gift"],
    },
    // Accessories
    {
      name: "Silk Blindfold",
      slug: "silk-blindfold",
      description: "Luxurious silk blindfold for sensory play. Adjustable elastic band. One size fits all.",
      price: 599,
      stock: 150,
      categoryId: categories[3].id,
      status: "ACTIVE",
      rating: 4.4,
      reviewCount: 89,
      tags: ["beginner", "sensory"],
    },
    {
      name: "Feather Tickler",
      slug: "feather-tickler",
      description: "Soft ostrich feather tickler for teasing and foreplay. 12-inch handle.",
      price: 499,
      stock: 100,
      categoryId: categories[3].id,
      status: "ACTIVE",
      rating: 4.3,
      reviewCount: 67,
      tags: ["beginner", "foreplay"],
    },
    {
      name: "Storage Case",
      slug: "storage-case",
      description: "Discreet lockable storage case for your toys. Antibacterial lining. Fits most products.",
      price: 1499,
      stock: 60,
      categoryId: categories[3].id,
      status: "ACTIVE",
      rating: 4.6,
      reviewCount: 45,
      tags: ["storage", "discreet"],
    },
    // Couples
    {
      name: "Couples Vibrating Ring",
      slug: "couples-vibrating-ring",
      description: "Stretchy vibrating ring designed for couples. 10 vibration modes. USB rechargeable.",
      price: 2499,
      stock: 70,
      categoryId: categories[4].id,
      status: "ACTIVE",
      featured: true,
      rating: 4.7,
      reviewCount: 198,
      tags: ["couples", "bestseller"],
    },
    {
      name: "Couples Game Set",
      slug: "couples-game-set",
      description: "Intimate game set including dice, cards, and scratch-off adventures. 52 exciting activities.",
      price: 1299,
      stock: 85,
      categoryId: categories[4].id,
      status: "ACTIVE",
      rating: 4.5,
      reviewCount: 112,
      tags: ["game", "fun"],
    },
    {
      name: "Partner Massage Kit",
      slug: "partner-massage-kit",
      description: "Complete couples massage kit with oils, candles, and guide book. Perfect gift set.",
      price: 3999,
      comparePrice: 4999,
      stock: 40,
      categoryId: categories[4].id,
      status: "ACTIVE",
      rating: 4.8,
      reviewCount: 76,
      tags: ["gift", "massage", "set"],
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {},
      create: {
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        comparePrice: product.comparePrice,
        stock: product.stock,
        categoryId: product.categoryId,
        status: product.status as any,
        featured: product.featured || false,
        rating: product.rating,
        reviewCount: product.reviewCount,
        tags: product.tags,
      },
    });
  }
  console.log("✅ Products created:", products.length);

  // Create coupons
  const coupons = await Promise.all([
    prisma.coupon.upsert({
      where: { code: "WELCOME10" },
      update: {},
      create: {
        code: "WELCOME10",
        description: "10% off your first order",
        type: "PERCENTAGE",
        value: 10,
        minOrderAmount: 1000,
        maxDiscount: 500,
        usageLimit: 1000,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        active: true,
      },
    }),
    prisma.coupon.upsert({
      where: { code: "SAVE500" },
      update: {},
      create: {
        code: "SAVE500",
        description: "KES 500 off orders over KES 3000",
        type: "FIXED",
        value: 500,
        minOrderAmount: 3000,
        usageLimit: 500,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        active: true,
      },
    }),
    prisma.coupon.upsert({
      where: { code: "COUPLES20" },
      update: {},
      create: {
        code: "COUPLES20",
        description: "20% off couples products",
        type: "PERCENTAGE",
        value: 20,
        minOrderAmount: 2000,
        maxDiscount: 2000,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        active: true,
      },
    }),
  ]);
  console.log("✅ Coupons created:", coupons.length);

  // Create settings
  const settings = [
    { key: "store_name", value: "Adult Store" },
    { key: "store_email", value: "support@adultstore.com" },
    { key: "store_phone", value: "+254 700 000 000" },
    { key: "store_currency", value: "KES" },
    { key: "free_shipping_threshold", value: "5000" },
    { key: "standard_shipping_cost", value: "300" },
    { key: "express_shipping_cost", value: "500" },
    { key: "same_day_shipping_cost", value: "800" },
    { key: "low_stock_threshold", value: "5" },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }
  console.log("✅ Settings created:", settings.length);

  console.log("🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
