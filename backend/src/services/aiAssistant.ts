import prisma from "../lib/prisma";
import { logger } from "../lib/logger";

interface AIResponse {
  text: string;
  products?: Array<{ name: string; slug: string; price: number }>;
  action?: string;
}

// Rate limiting: 10 AI calls per phone per hour
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(phone: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(phone);

  if (!entry || now > entry.resetAt) {
    rateLimits.set(phone, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }

  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

export async function generateAIResponse(
  phone: string,
  message: string,
  context: { cart: Array<{ name: string; price: number }>; language: string }
): Promise<AIResponse | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your-anthropic-api-key") {
    return null;
  }

  if (!checkRateLimit(phone)) {
    return { text: "You've reached the AI assistant limit for this hour. Reply *menu* to browse or *help* for customer support." };
  }

  try {
    // Fetch top products for context
    const products = await prisma.product.findMany({
      where: { status: "ACTIVE", stock: { gt: 0 } },
      select: {
        name: true,
        slug: true,
        price: true,
        category: { select: { name: true } },
        tags: true,
      },
      orderBy: [{ featured: "desc" }, { reviewCount: "desc" }],
      take: 30,
    });

    const catalog = products.map((p, i) =>
      `${i + 1}. ${p.name} (${p.category?.name || "General"}) — UGX ${Number(p.price).toLocaleString()} — slug:${p.slug}`
    ).join("\n");

    const cartSummary = context.cart.length > 0
      ? `Customer's current cart: ${context.cart.map(i => `${i.name} (UGX ${i.price.toLocaleString()})`).join(", ")}`
      : "Customer's cart is empty.";

    const systemPrompt = `You are a WhatsApp shopping assistant for PleasureZone Uganda — a discreet wellness and lifestyle store.

Your job: Help customers find and buy products via WhatsApp. Be warm, concise, and helpful.

Rules:
- Keep responses SHORT (2-4 lines max — this is WhatsApp)
- When recommending products, list them as numbered items
- Always be discreet and professional
- If the customer asks about ordering, tell them to reply with the product number
- If you can't help, suggest replying *menu* or *help*
- Respond in ${context.language === "lg" ? "Luganda" : context.language === "sw" ? "Swahili" : "English"}

${cartSummary}

Product catalog:
${catalog}

Respond with JSON: {"text": "your message", "products": [{"name": "...", "slug": "...", "price": 0}]}
Only include "products" if you're recommending specific items.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: "user", content: message }],
      }),
    });

    if (!response.ok) {
      logger.error("AI Assistant API error", { status: response.status });
      return null;
    }

    const data = await response.json() as any;
    const rawText = data.content?.[0]?.text || "";

    // Try to parse as JSON
    try {
      const parsed = JSON.parse(rawText);
      return {
        text: parsed.text || rawText,
        products: parsed.products,
        action: parsed.action,
      };
    } catch {
      // Not JSON — return as plain text
      return { text: rawText };
    }
  } catch (error) {
    logger.error("AI Assistant error", { error });
    return null;
  }
}
