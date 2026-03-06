import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";

const router = Router();

// Public settings keys allowed to be exposed
const PUBLIC_KEYS = [
  "store_name",
  "store_description",
  "store_email",
  "store_phone",
  "store_address",
  "store_currency",
  "contact_email",
  "contact_phone",
  "contact_whatsapp",
  "contact_hours",
  "faq_items",
  "appearance_logo_url",
  "appearance_favicon_url",
  "appearance_primary_color",
  "appearance_accent_color",
  "appearance_banner_text",
  "appearance_footer_text",
  "store_social_facebook",
  "store_social_instagram",
  "store_social_twitter",
  "store_social_tiktok",
  "store_seo_title",
  "store_seo_description",
  "store_seo_keywords",
  "security_maintenance_mode",
  "security_maintenance_message",
  // Shipping config (needed by frontend for calculations)
  "shipping_enabled",
  "shipping_free_threshold",
  "shipping_default_rate",
  "shipping_express_rate",
  "shipping_upcountry_rate",
  "shipping_intl_included",
  "shipping_intl_rate",
  "shipping_standard_days",
  "shipping_express_days",
  "shipping_upcountry_days",
  "shipping_intl_days",
  "shipping_processing_days",
  "shipping_allow_pickup",
  "shipping_pickup_address",
  "shipping_discreet_default",
  "shipping_discreet_note",
  // Payment method availability
  "payment_flutterwave_enabled",
  "payment_mobile_money_enabled",
  "payment_card_enabled",
  "payment_paypal_enabled",
  "payment_cod_enabled",
  "payment_min_order",
  "payment_instructions",
];

// GET /api/settings/public - Return safe public settings
router.get("/public", async (_req: Request, res: Response) => {
  try {
    const settings = await prisma.setting.findMany({
      where: { key: { in: PUBLIC_KEYS } },
    });

    const map = settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {} as Record<string, string>);

    return res.json({ settings: map });
  } catch (error) {
    console.error("Public settings error:", error);
    return res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// GET /api/settings/shipping — shipping config + available zones for the storefront
router.get("/shipping", async (_req: Request, res: Response) => {
  try {
    const shippingKeys = PUBLIC_KEYS.filter((k) => k.startsWith("shipping_"));
    const [settings, zones] = await Promise.all([
      prisma.setting.findMany({ where: { key: { in: shippingKeys } } }),
      prisma.shippingZone.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    ]);

    const config = settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {} as Record<string, string>);

    return res.json({
      config,
      zones: zones.map((z) => ({
        id: z.id,
        name: z.name,
        cities: z.cities,
        rate: Number(z.rate),
        freeAbove: z.freeAbove ? Number(z.freeAbove) : null,
        estimatedDays: z.estimatedDays,
      })),
    });
  } catch (error) {
    console.error("Shipping config error:", error);
    return res.status(500).json({ error: "Failed to fetch shipping config" });
  }
});

// POST /api/settings/shipping/calculate — calculate shipping for a given cart + address
router.post("/shipping/calculate", async (req: Request, res: Response) => {
  try {
    const { city, items } = req.body as {
      city?: string;
      items: Array<{ productId: string; quantity: number; shippingBadge?: string }>;
    };

    if (!items?.length) {
      return res.json({ shipping: 0, method: "none", breakdown: [] });
    }

    // Load settings
    const shippingKeys = PUBLIC_KEYS.filter((k) => k.startsWith("shipping_"));
    const [settings, zones] = await Promise.all([
      prisma.setting.findMany({ where: { key: { in: shippingKeys } } }),
      prisma.shippingZone.findMany({ where: { isActive: true } }),
    ]);
    const cfg = settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {} as Record<string, string>);

    const freeThreshold = parseInt(cfg.shipping_free_threshold || "100000", 10);
    const standardRate = parseInt(cfg.shipping_default_rate || "5000", 10);
    const expressRate = parseInt(cfg.shipping_express_rate || "15000", 10);
    const upcountryRate = parseInt(cfg.shipping_upcountry_rate || "10000", 10);
    const intlIncluded = cfg.shipping_intl_included !== "false";
    const intlRate = parseInt(cfg.shipping_intl_rate || "0", 10);

    // Separate local vs international items
    const localItems = items.filter((i) => i.shippingBadge !== "From Abroad");
    const intlItems = items.filter((i) => i.shippingBadge === "From Abroad");

    // Look up product prices for local total
    let localTotal = 0;
    if (localItems.length > 0) {
      const products = await prisma.product.findMany({
        where: { id: { in: localItems.map((i) => i.productId) } },
        select: { id: true, price: true },
      });
      const priceMap = new Map(products.map((p) => [p.id, Number(p.price)]));
      localTotal = localItems.reduce((s, i) => s + (priceMap.get(i.productId) || 0) * i.quantity, 0);
    }

    // Try zone-based rate first
    let localShipping = standardRate;
    let shippingMethod = "standard";
    const cityLower = (city || "").toLowerCase();

    const matchedZone = zones.find((z) =>
      z.cities.some((c) => c.toLowerCase() === cityLower)
    );

    if (matchedZone) {
      localShipping = Number(matchedZone.rate);
      shippingMethod = matchedZone.name.toLowerCase();
      if (matchedZone.freeAbove && localTotal >= Number(matchedZone.freeAbove)) {
        localShipping = 0;
      }
    } else if (cityLower === "kampala" || !city) {
      // Default Kampala rates
      localShipping = standardRate;
      if (localTotal >= freeThreshold) localShipping = 0;
    } else {
      // Upcountry
      localShipping = upcountryRate;
      shippingMethod = "upcountry";
      if (localTotal >= freeThreshold) localShipping = 0;
    }

    // International shipping
    const intlShipping = intlItems.length > 0 && !intlIncluded ? intlRate * intlItems.length : 0;

    // No local items? No local shipping
    if (localItems.length === 0) localShipping = 0;

    const totalShipping = localShipping + intlShipping;

    const breakdown = [];
    if (localItems.length > 0) {
      breakdown.push({
        type: "local",
        method: shippingMethod,
        amount: localShipping,
        freeThreshold,
        qualifiesForFree: localTotal >= freeThreshold,
      });
    }
    if (intlItems.length > 0) {
      breakdown.push({
        type: "international",
        method: intlIncluded ? "included" : "flat_rate",
        amount: intlShipping,
        note: intlIncluded ? "Shipping included in price" : undefined,
      });
    }

    const methods = [
      { id: "standard", label: "Standard Delivery", rate: standardRate, days: cfg.shipping_standard_days || "2-4 business days" },
      { id: "express", label: "Express Delivery (Kampala)", rate: expressRate, days: cfg.shipping_express_days || "Same day - 1 day" },
    ];

    if (upcountryRate > 0) {
      methods.push({ id: "upcountry", label: "Upcountry Delivery", rate: upcountryRate, days: cfg.shipping_upcountry_days || "3-7 business days" });
    }

    return res.json({
      shipping: totalShipping,
      method: shippingMethod,
      breakdown,
      availableMethods: methods,
      config: {
        freeThreshold,
        standardRate,
        expressRate,
        upcountryRate,
        intlIncluded,
        intlDays: cfg.shipping_intl_days || "7-21 business days",
        standardDays: cfg.shipping_standard_days || "2-4 business days",
        expressDays: cfg.shipping_express_days || "Same day - 1 day",
        processingDays: cfg.shipping_processing_days || "1",
        discreetDefault: cfg.shipping_discreet_default === "true",
        discreetNote: cfg.shipping_discreet_note || "Plain packaging with neutral sender name",
      },
    });
  } catch (error) {
    console.error("Shipping calculate error:", error);
    return res.status(500).json({ error: "Failed to calculate shipping" });
  }
});

export default router;
