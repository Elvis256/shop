import { Router } from "express";
import prisma from "../lib/prisma";
import { getLastUpdated } from "../services/exchangeRates";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

// Get all active currencies
router.get("/", asyncHandler(async (req, res) => {
  try {
    const currencies = await prisma.currency.findMany({
      where: { isActive: true },
      orderBy: [{ isBase: "desc" }, { code: "asc" }],
    });

    res.json({ currencies, lastUpdated: getLastUpdated() });
  } catch (error) {
    logger.error("Get currencies error", { error });
    res.status(500).json({ error: "Failed to fetch currencies" });
  }
}));

// Get exchange rates
router.get("/rates", asyncHandler(async (req, res) => {
  try {
    const currencies = await prisma.currency.findMany({
      where: { isActive: true },
      select: {
        code: true,
        symbol: true,
        exchangeRate: true,
        decimalPlaces: true,
      },
    });

    const rates: Record<string, number> = {};
    currencies.forEach((c) => {
      rates[c.code] = Number(c.exchangeRate);
    });

    res.json({ base: "UGX", rates, currencies });
  } catch (error) {
    logger.error("Get exchange rates error", { error });
    res.status(500).json({ error: "Failed to fetch exchange rates" });
  }
}));

// Convert amount between currencies
router.get("/convert", asyncHandler(async (req, res) => {
  try {
    const { amount, from = "UGX", to = "USD" } = req.query;

    if (!amount || isNaN(Number(amount))) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const currencies = await prisma.currency.findMany({
      where: { code: { in: [from as string, to as string] } },
    });

    const fromCurrency = currencies.find((c) => c.code === from);
    const toCurrency = currencies.find((c) => c.code === to);

    if (!fromCurrency || !toCurrency) {
      return res.status(400).json({ error: "Invalid currency code" });
    }

    // Convert to base (UGX) first, then to target
    const amountInBase = Number(amount) / Number(fromCurrency.exchangeRate);
    const convertedAmount = amountInBase * Number(toCurrency.exchangeRate);

    res.json({
      from: { code: from, amount: Number(amount) },
      to: {
        code: to,
        amount: Number(convertedAmount.toFixed(toCurrency.decimalPlaces)),
        symbol: toCurrency.symbol,
      },
      rate: Number(toCurrency.exchangeRate) / Number(fromCurrency.exchangeRate),
    });
  } catch (error) {
    logger.error("Currency conversion error", { error });
    res.status(500).json({ error: "Failed to convert currency" });
  }
}));

export default router;
