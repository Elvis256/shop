import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { optionalAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// ─── Private AI Wellness Advisor ──────────────────────────────────────────────
// Powered by Claude API. No chat history stored. Fully private.
router.post("/chat", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { message } = z.object({
      message: z.string().min(1).max(500),
    }).parse(req.body);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === "your-anthropic-api-key") {
      return res.status(503).json({ error: "AI advisor not configured yet" });
    }

    // Fetch top products for context (limit to avoid token overflow)
    const products = await prisma.product.findMany({
      where: { status: "ACTIVE" },
      select: {
        name: true,
        slug: true,
        description: true,
        price: true,
        category: { select: { name: true } },
        tags: true,
      },
      orderBy: [{ featured: "desc" }, { reviewCount: "desc" }],
      take: 30,
    });

    const catalog = products.map((p) =>
      `- ${p.name} (${p.category?.name || "General"}) — UGX ${Number(p.price).toLocaleString()} — /product/${p.slug}`
    ).join("\n");

    const systemPrompt = `You are a discreet, professional wellness advisor for PleasureZone Uganda — Uganda's most trusted discreet wellness shop.

Your role: Help customers find the right products for their needs — couples products, lingerie, skincare, and wellness items.

Guidelines:
- Be warm, helpful, and completely non-judgmental
- Recommend specific products from our catalog when relevant
- Keep responses concise (2–4 sentences max)
- Always mention our plain packaging and discreet delivery when relevant
- Never share customer conversations or data
- If asked about something outside our catalog, gently redirect to what we carry

Our current product catalog:
${catalog}

When recommending products, include the product name and price. Keep it natural and helpful.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: "user", content: message }],
      }),
    });

    if (!response.ok) {
      console.error("Claude API error:", response.status, await response.text());
      return res.status(502).json({ error: "Advisor temporarily unavailable" });
    }

    const data = await response.json() as any;
    const reply = data.content?.[0]?.text || "I'm sorry, I couldn't process that. Please try again.";

    return res.json({ reply });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Message too long or empty" });
    console.error("Advisor chat error:", error);
    return res.status(500).json({ error: "Advisor temporarily unavailable" });
  }
});

// ─── AI Size Recommendation ───────────────────────────────────────────────────
router.post("/size-recommendation", async (req: Request, res: Response) => {
  try {
    const { bust, waist, hips, height, productCategory } = z.object({
      bust: z.number().min(50).max(200),   // cm
      waist: z.number().min(40).max(180),  // cm
      hips: z.number().min(50).max(200),   // cm
      height: z.number().min(100).max(220).optional(), // cm
      productCategory: z.string().optional(),
    }).parse(req.body);

    // Standard size chart lookup (cm)
    const sizeChart = [
      { size: "XS", bustMin: 76, bustMax: 81, waistMin: 58, waistMax: 63, hipsMin: 83, hipsMax: 88 },
      { size: "S",  bustMin: 82, bustMax: 87, waistMin: 64, waistMax: 69, hipsMin: 89, hipsMax: 94 },
      { size: "M",  bustMin: 88, bustMax: 93, waistMin: 70, waistMax: 75, hipsMin: 95, hipsMax: 100 },
      { size: "L",  bustMin: 94, bustMax: 99, waistMin: 76, waistMax: 81, hipsMin: 101, hipsMax: 106 },
      { size: "XL", bustMin: 100, bustMax: 107, waistMin: 82, waistMax: 89, hipsMin: 107, hipsMax: 114 },
      { size: "2XL",bustMin: 108, bustMax: 116, waistMin: 90, waistMax: 97, hipsMin: 115, hipsMax: 122 },
      { size: "3XL",bustMin: 117, bustMax: 127, waistMin: 98, waistMax: 107, hipsMin: 123, hipsMax: 132 },
    ];

    // Score each size by how well measurements fit
    const scores = sizeChart.map((s) => {
      let score = 0;
      if (bust >= s.bustMin && bust <= s.bustMax) score += 3;
      else if (bust < s.bustMin) score -= (s.bustMin - bust) / 5;
      else score -= (bust - s.bustMax) / 5;

      if (waist >= s.waistMin && waist <= s.waistMax) score += 3;
      else if (waist < s.waistMin) score -= (s.waistMin - waist) / 5;
      else score -= (waist - s.waistMax) / 5;

      if (hips >= s.hipsMin && hips <= s.hipsMax) score += 2;
      else if (hips < s.hipsMin) score -= (s.hipsMin - hips) / 5;
      else score -= (hips - s.hipsMax) / 5;

      return { size: s.size, score };
    });

    scores.sort((a, b) => b.score - a.score);
    const recommended = scores[0].size;
    const alternative = scores[1]?.size;

    return res.json({
      recommendedSize: recommended,
      alternativeSize: alternative,
      tip: bust > waist + 25
        ? "You have a more pronounced bust — consider sizing up for comfort."
        : hips > waist + 25
        ? "You have a more pronounced hip — consider sizing up for the best fit."
        : "Your proportions fit standard sizing well.",
      measurements: { bust, waist, hips },
    });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid measurements", details: (error as z.ZodError).errors });
    return res.status(500).json({ error: "Size recommendation failed" });
  }
});

export default router;
