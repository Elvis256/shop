/**
 * Country Configuration — returns country-specific payment methods,
 * currencies, and phone formats for multi-country checkout.
 *
 * Supports: Uganda, Kenya, Tanzania, Rwanda
 * GET  /api/country-config             — all supported countries
 * GET  /api/country-config/:code       — single country config
 * POST /api/country-config/seed-currencies — seed KES/TZS/RWF into Currency table (admin)
 */
import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

// Static country definitions
export const SUPPORTED_COUNTRIES = [
  {
    code: "UG",
    name: "Uganda",
    flag: "🇺🇬",
    currency: "UGX",
    currencySymbol: "UGX",
    dialCode: "+256",
    phonePlaceholder: "07XX XXX XXX",
    paymentMethods: ["mobile_money", "card", "cod"],
    mobileNetworks: [
      { id: "MTN", name: "MTN MoMo", logo: "📱" },
      { id: "AIRTEL", name: "Airtel Money", logo: "📱" },
    ],
    cities: ["Kampala", "Entebbe", "Jinja", "Gulu", "Mbarara", "Mbale"],
  },
  {
    code: "KE",
    name: "Kenya",
    flag: "🇰🇪",
    currency: "KES",
    currencySymbol: "KSh",
    dialCode: "+254",
    phonePlaceholder: "07XX XXX XXX",
    paymentMethods: ["mobile_money", "card"],
    mobileNetworks: [
      { id: "MPESA", name: "M-Pesa", logo: "📱" },
    ],
    cities: ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret"],
  },
  {
    code: "TZ",
    name: "Tanzania",
    flag: "🇹🇿",
    currency: "TZS",
    currencySymbol: "TSh",
    dialCode: "+255",
    phonePlaceholder: "07XX XXX XXX",
    paymentMethods: ["mobile_money", "card"],
    mobileNetworks: [
      { id: "MPESA", name: "M-Pesa (Vodacom)", logo: "📱" },
      { id: "AIRTEL", name: "Airtel Money", logo: "📱" },
    ],
    cities: ["Dar es Salaam", "Dodoma", "Arusha", "Zanzibar City", "Mwanza"],
  },
  {
    code: "RW",
    name: "Rwanda",
    flag: "🇷🇼",
    currency: "RWF",
    currencySymbol: "RWF",
    dialCode: "+250",
    phonePlaceholder: "07XX XXX XXX",
    paymentMethods: ["mobile_money", "card"],
    mobileNetworks: [
      { id: "MTN", name: "MTN MoMo", logo: "📱" },
    ],
    cities: ["Kigali", "Huye", "Musanze", "Rubavu", "Nyagatare"],
  },
];

// GET /api/country-config
router.get("/", asyncHandler(async (_req: Request, res: Response) => {
  // Enrich with live exchange rates
  const currencies = await prisma.currency.findMany({
    where: { code: { in: ["UGX", "KES", "TZS", "RWF"] }, isActive: true },
    select: { code: true, exchangeRate: true, symbol: true },
  }).catch(() => []);

  const rateMap: Record<string, number> = {};
  currencies.forEach((c) => { rateMap[c.code] = Number(c.exchangeRate); });

  const result = SUPPORTED_COUNTRIES.map((country) => ({
    ...country,
    exchangeRateToUgx: rateMap[country.currency] || null,
  }));

  return res.json({ countries: result });
}));

// GET /api/country-config/:code
router.get("/:code", asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.params;
  const country = SUPPORTED_COUNTRIES.find(
    (c) => c.code.toLowerCase() === code.toLowerCase() || c.currency.toLowerCase() === code.toLowerCase()
  );

  if (!country) {
    return res.status(404).json({ error: "Country not supported" });
  }

  const dbCurrency = await prisma.currency.findFirst({
    where: { code: country.currency, isActive: true },
    select: { exchangeRate: true, symbol: true },
  }).catch(() => null);

  return res.json({
    ...country,
    exchangeRateToUgx: dbCurrency ? Number(dbCurrency.exchangeRate) : null,
  });
}));

// POST /api/country-config/seed-currencies — admin only
// Seeds KES, TZS, RWF into the Currency table with approximate rates
router.post("/seed-currencies", authenticate, requireAdmin, asyncHandler(async (_req: AuthRequest, res: Response) => {
  const seedData = [
    { code: "KES", name: "Kenyan Shilling", symbol: "KSh", exchangeRate: 28.5, decimalPlaces: 0 },
    { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh", exchangeRate: 1.45, decimalPlaces: 0 },
    { code: "RWF", name: "Rwandan Franc", symbol: "RWF", exchangeRate: 3.1, decimalPlaces: 0 },
    { code: "USD", name: "US Dollar", symbol: "$", exchangeRate: 3700, decimalPlaces: 2 },
    { code: "GBP", name: "British Pound", symbol: "£", exchangeRate: 4700, decimalPlaces: 2 },
    { code: "EUR", name: "Euro", symbol: "€", exchangeRate: 4100, decimalPlaces: 2 },
  ];

  const results = await Promise.all(
    seedData.map((d) =>
      prisma.currency.upsert({
        where: { code: d.code },
        update: { exchangeRate: d.exchangeRate, isActive: true },
        create: {
          code: d.code,
          name: d.name,
          symbol: d.symbol,
          exchangeRate: d.exchangeRate,
          decimalPlaces: d.decimalPlaces,
          isBase: false,
          isActive: true,
        },
      }).catch((e: any) => ({ error: e.message, code: d.code }))
    )
  );

  return res.json({ message: "Currencies seeded", results });
}));

export default router;
