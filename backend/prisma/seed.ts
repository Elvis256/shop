import { PrismaClient, BlogStatus } from "@prisma/client";
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
    { key: "store_name", value: "Pleasure Zone Uganda" },
    { key: "store_email", value: "support@pleasurezone.ug" },
    { key: "store_phone", value: "+256 700 000 000" },
    { key: "store_currency", value: "UGX" },
    { key: "free_shipping_threshold", value: "150000" },
    { key: "standard_shipping_cost", value: "10000" },
    { key: "express_shipping_cost", value: "20000" },
    { key: "same_day_shipping_cost", value: "35000" },
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

  // Create blog posts
  const blogPosts = [
    {
      title: "The Complete Guide to Choosing Your First Toy",
      slug: "choosing-your-first-toy",
      excerpt: "Explore our beginner-friendly guide to finding the perfect intimate toy. We cover materials, features, and what to look for.",
      content: `<p>Choosing your first intimate toy can feel overwhelming with so many options available. This guide will help you navigate the selection process with confidence.</p>
      <h2>1. Consider the Material</h2>
      <p>Body-safe silicone is the gold standard for intimate toys. It's non-porous, easy to clean, and hypoallergenic. Avoid toys with questionable materials or strong chemical smells.</p>
      <h2>2. Start Simple</h2>
      <p>For beginners, we recommend starting with something simple and non-intimidating. A small, quiet vibrator with multiple speeds is often a great choice.</p>
      <h2>3. Think About Your Preferences</h2>
      <p>Consider what type of stimulation you enjoy. External, internal, or both? This will help narrow down your options significantly.</p>
      <h2>4. Read Reviews</h2>
      <p>Customer reviews can provide valuable insights about a product's actual performance and quality.</p>`,
      category: "Guides",
      tags: ["beginners", "toys", "guide"],
      author: "Wellness Team",
      featured: true,
      status: BlogStatus.PUBLISHED,
      publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      title: "5 Ways to Enhance Intimacy in Your Relationship",
      slug: "enhance-intimacy-relationship",
      excerpt: "Discover simple but powerful techniques to deepen connection and enhance intimacy with your partner.",
      content: `<p>Intimacy is the foundation of a healthy relationship. Here are five ways to strengthen your bond.</p>
      <h2>1. Prioritize Quality Time</h2>
      <p>Set aside dedicated time for each other without distractions. Put away phones and focus on being present.</p>
      <h2>2. Communicate Openly</h2>
      <p>Share your desires, boundaries, and fantasies with your partner. Open communication builds trust and understanding.</p>
      <h2>3. Try New Experiences Together</h2>
      <p>Novelty can reignite passion. Consider exploring new products, positions, or date ideas together.</p>
      <h2>4. Physical Touch Beyond the Bedroom</h2>
      <p>Hold hands, cuddle, and maintain physical connection throughout the day.</p>
      <h2>5. Show Appreciation</h2>
      <p>Express gratitude for your partner regularly. Small gestures of appreciation go a long way.</p>`,
      category: "Relationships",
      tags: ["couples", "intimacy", "tips"],
      author: "Wellness Team",
      featured: false,
      status: BlogStatus.PUBLISHED,
      publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
    {
      title: "Self-Care Sunday: A Guide to Solo Wellness",
      slug: "self-care-sunday-solo-wellness",
      excerpt: "Taking time for yourself is essential. Learn how to create the perfect self-care routine for enhanced wellbeing.",
      content: `<p>Self-care isn't selfish—it's necessary. Here's how to create a meaningful solo wellness routine.</p>
      <h2>Create Your Space</h2>
      <p>Set the mood with candles, comfortable bedding, and relaxing music. Your environment matters.</p>
      <h2>Explore at Your Own Pace</h2>
      <p>There's no rush. Take time to discover what feels good and what you enjoy.</p>
      <h2>Invest in Quality Products</h2>
      <p>Quality lubricants, massage oils, and premium toys can significantly enhance your experience.</p>`,
      category: "Self-Care",
      tags: ["self-care", "wellness", "solo"],
      author: "Wellness Team",
      featured: false,
      status: BlogStatus.PUBLISHED,
      publishedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    },
  ];

  for (const post of blogPosts) {
    await prisma.blogPost.upsert({
      where: { slug: post.slug },
      update: {},
      create: post,
    });
  }
  console.log("✅ Blog posts created:", blogPosts.length);

  // Create banners
  const banners = [
    {
      title: "Explore Your Desires",
      subtitle: "Premium intimate products with 100% discreet packaging",
      imageUrl: "/images/banners/hero-1.jpg",
      linkUrl: "/products",
      buttonText: "Shop Now",
      position: "home-hero",
      sortOrder: 1,
      isActive: true,
    },
    {
      title: "Valentine's Special",
      subtitle: "Up to 30% off on couples products",
      imageUrl: "/images/banners/hero-2.jpg",
      linkUrl: "/category?cat=couples",
      buttonText: "Shop Couples",
      position: "home-hero",
      sortOrder: 2,
      isActive: true,
    },
  ];

  for (const banner of banners) {
    await prisma.banner.upsert({
      where: { id: banner.title.toLowerCase().replace(/\s+/g, "-") },
      update: {},
      create: banner,
    });
  }
  console.log("✅ Banners created:", banners.length);

  // Create currencies
  const currencies = [
    {
      code: "UGX",
      name: "Ugandan Shilling",
      symbol: "USh",
      exchangeRate: 1,
      isBase: true,
      isActive: true,
      decimalPlaces: 0,
    },
    {
      code: "USD",
      name: "US Dollar",
      symbol: "$",
      exchangeRate: 0.00027, // 1 UGX = 0.00027 USD (approx 3700 UGX = 1 USD)
      isBase: false,
      isActive: true,
      decimalPlaces: 2,
    },
    {
      code: "KES",
      name: "Kenyan Shilling",
      symbol: "KSh",
      exchangeRate: 0.035, // 1 UGX = 0.035 KES
      isBase: false,
      isActive: true,
      decimalPlaces: 0,
    },
    {
      code: "TZS",
      name: "Tanzanian Shilling",
      symbol: "TSh",
      exchangeRate: 0.68, // 1 UGX = 0.68 TZS
      isBase: false,
      isActive: true,
      decimalPlaces: 0,
    },
  ];

  for (const currency of currencies) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      update: { exchangeRate: currency.exchangeRate },
      create: currency,
    });
  }
  console.log("✅ Currencies created:", currencies.length);

  // Create payment providers
  const paymentProviders = [
    {
      name: "MTN Mobile Money Uganda",
      code: "mtn_ug",
      type: "MOBILE_MONEY" as const,
      currencies: ["UGX"],
      feeType: "PERCENTAGE" as const,
      feeValue: 1.0, // 1% fee
      isActive: true,
      isTest: true,
    },
    {
      name: "Airtel Money Uganda",
      code: "airtel_ug",
      type: "MOBILE_MONEY" as const,
      currencies: ["UGX"],
      feeType: "PERCENTAGE" as const,
      feeValue: 1.0,
      isActive: true,
      isTest: true,
    },
    {
      name: "Flutterwave",
      code: "flutterwave",
      type: "CARD" as const,
      currencies: ["UGX", "USD", "KES", "TZS"],
      feeType: "PERCENTAGE" as const,
      feeValue: 2.9,
      isActive: true,
      isTest: true,
    },
  ];

  for (const provider of paymentProviders) {
    await prisma.paymentProvider.upsert({
      where: { code: provider.code },
      update: {},
      create: provider,
    });
  }
  console.log("✅ Payment providers created:", paymentProviders.length);

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
