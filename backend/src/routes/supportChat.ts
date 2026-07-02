import { Router, Request, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { v4 as uuidv4 } from "uuid";
import { asyncHandler } from "../middleware/errorHandler";
import prisma from "../lib/prisma";
import { logger } from "../lib/logger";

const router = Router();

// Simple in-memory chat store (for support session mappings)
interface ChatMessage {
  id: string;
  senderId: string;
  senderType: "user" | "agent";
  message: string;
  createdAt: string;
}

interface Chat {
  id: string;
  userId?: string;
  guestEmail?: string;
  messages: ChatMessage[];
  status: "open" | "closed";
  createdAt: string;
}

const chats = new Map<string, Chat>();

// Create a new chat
router.post("/", asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const userId = (req as any).user?.id;

  const chat: Chat = {
    id: uuidv4(),
    userId,
    guestEmail: email,
    messages: [
      {
        id: uuidv4(),
        senderId: "system",
        senderType: "agent",
        message: "Hello! I am your AI Product Consultant. Ask me about our catalog, discreet packaging, or shipping times. All chat data is ephemeral.",
        createdAt: new Date().toISOString(),
      },
    ],
    status: "open",
    createdAt: new Date().toISOString(),
  };

  chats.set(chat.id, chat);
  res.json({ chatId: chat.id, messages: chat.messages });
}));

// Get messages for a chat
router.get("/:chatId/messages", (req: Request, res: Response) => {
  const chat = chats.get(req.params.chatId);
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  res.json({ messages: chat.messages });
});

// Send a message (AI Product Consultant routing)
router.post("/:chatId/messages", asyncHandler(async (req: Request, res: Response) => {
  const chat = chats.get(req.params.chatId);
  if (!chat) return res.status(404).json({ error: "Chat not found" });

  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: "Message required" });

  const msg: ChatMessage = {
    id: uuidv4(),
    senderId: (req as any).user?.id || "guest",
    senderType: "user",
    message: message.trim(),
    createdAt: new Date().toISOString(),
  };

  chat.messages.push(msg);

  // Background processor: generates database-aware smart response in 1 second
  setTimeout(async () => {
    try {
      const userQuery = message.trim().toLowerCase();
      let responseText = "";

      const productKeywords = ["product", "buy", "vibrator", "lingerie", "condom", "toy", "lube", "lubricant", "shop", "items", "show", "prices"];
      const matchesProduct = productKeywords.some(keyword => userQuery.includes(keyword));

      if (matchesProduct) {
        // Build SQL search query terms, filtering out generic structural words
        const genericWords = ["product", "products", "buy", "show", "need", "want", "for", "please", "lube", "lubes", "toys", "vibrators"];
        const searchTerms = userQuery
          .split(/\s+/)
          .map(w => w.replace(/[^a-zA-Z0-9]/g, ""))
          .filter(word => word.length > 2 && !genericWords.includes(word));

        // Fallback to searching category-specific keywords if terms is empty
        if (searchTerms.length === 0) {
          if (userQuery.includes("vibrator")) searchTerms.push("vibrat");
          if (userQuery.includes("lingerie")) searchTerms.push("linger");
          if (userQuery.includes("lube") || userQuery.includes("lubricant")) searchTerms.push("lubric");
          if (userQuery.includes("condom")) searchTerms.push("condom");
        }

        const OR_conditions = searchTerms.map(term => ({
          OR: [
            { name: { contains: term, mode: "insensitive" as const } },
            { description: { contains: term, mode: "insensitive" as const } },
          ]
        }));

        const products = await prisma.product.findMany({
          where: {
            status: "ACTIVE",
            AND: OR_conditions.length > 0 ? OR_conditions : undefined,
          },
          take: 3,
          select: { name: true, price: true, slug: true },
        });

        if (products.length > 0) {
          const itemsList = products.map(p => `• **${p.name}** - UGX ${Number(p.price).toLocaleString()} ([View Product](https://ugsex.com/product/${p.slug}))`).join("\n");
          responseText = `Here are the top products matching your interest:\n\n${itemsList}\n\nAll items are packaged 100% discreetly with no external branding!`;
        } else {
          // Fallback to top featured products
          const featured = await prisma.product.findMany({
            where: { status: "ACTIVE", featured: true },
            take: 3,
            select: { name: true, price: true, slug: true },
          });
          const itemsList = featured.map(p => `• **${p.name}** - UGX ${Number(p.price).toLocaleString()} ([View Product](https://ugsex.com/product/${p.slug}))`).join("\n");
          responseText = `I couldn't find matching items, but check out our popular featured products:\n\n${itemsList}`;
        }
      } else if (userQuery.includes("packaging") || userQuery.includes("discreet") || userQuery.includes("anonymous") || userQuery.includes("secret") || userQuery.includes("box")) {
        responseText = `🔒 **Our Packaging Promise:**\n- All orders are sent in completely plain brown cardboard boxes or solid courier flyers.\n- No mention of 'PleasureZone' or product contents is written on the shipping label (labeled as 'Logistics Dept').\n- Scent-proof and non-rattling seal protocols are applied to all packages.`;
      } else if (userQuery.includes("shipping") || userQuery.includes("delivery") || userQuery.includes("kampala") || userQuery.includes("arrive") || userQuery.includes("time")) {
        responseText = `🚚 **Delivery Timelines:**\n- **Kampala:** Same-day express delivery within 2-4 hours.\n- **Upcountry Uganda:** Next-day shipping (within 24 hours).\n- **International:** Arrives in 7-14 days.`;
      } else if (userQuery.includes("payment") || userQuery.includes("momo") || userQuery.includes("mobile money") || userQuery.includes("cod") || userQuery.includes("cash")) {
        responseText = `💳 **Payment Options Available:**\n- **Mobile Money (MTN & Airtel):** Fast & direct automated checkout.\n- **Cash on Delivery (COD):** Available in Kampala with a 20% commitment deposit (80% paid to courier on delivery).`;
      } else if (userQuery.includes("points") || userQuery.includes("coupon") || userQuery.includes("loyalty") || userQuery.includes("discount")) {
        responseText = `🎁 **Loyalty Program:**\n- You earn points on every purchase (100 points = 30 UGX value).\n- You can redeem points directly in your Account dashboard for discount coupons!`;
      } else {
        responseText = `Hello! I am your AI Product Consultant. I can help you with:\n1. 🛍️ **Finding Products:** Just type 'show vibrators', 'lingerie', or 'lubes'.\n2. 📦 **Discreet Packaging:** Ask 'is delivery packaging secret?'\n3. 🚚 **Delivery times:** Ask 'how long does Kampala shipping take?'\n4. 💳 **Payments:** Ask 'what payment options are supported?'\n\nHow can I help you today?`;
      }

      chat.messages.push({
        id: uuidv4(),
        senderId: "agent",
        senderType: "agent",
        message: responseText,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      logger.error("AI chat responder failed", { error: err });
    }
  }, 1000);

  res.json(msg);
}));

// DELETE /api/support-chat/:chatId — Wipe chat history immediately
router.delete("/:chatId", (req: Request, res: Response) => {
  const deleted = chats.delete(req.params.chatId);
  if (!deleted) return res.status(404).json({ error: "Chat not found" });
  res.json({ message: "Chat session and history wiped from memory successfully" });
});

export default router;
