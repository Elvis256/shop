import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

// POST /conversations — Create or find a conversation
router.post("/conversations", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });

    const { sellerId, productId } = req.body;
    if (!sellerId) return res.status(400).json({ error: "sellerId is required" });

    // Verify seller exists
    const seller = await prisma.seller.findUnique({
      where: { id: sellerId },
      select: { id: true, status: true, userId: true },
    });
    if (!seller || seller.status !== "APPROVED") {
      return res.status(404).json({ error: "Seller not found" });
    }

    // Cannot message yourself
    if (seller.userId === req.user.id) {
      return res.status(400).json({ error: "Cannot message your own store" });
    }

    // Find or create conversation
    const existing = await prisma.conversation.findFirst({
      where: {
        buyerId: req.user.id,
        sellerId,
        productId: productId || null,
      },
    });

    if (existing) {
      return res.json({ conversation: existing });
    }

    const conversation = await prisma.conversation.create({
      data: {
        buyerId: req.user.id,
        sellerId,
        productId: productId || null,
      },
    });

    return res.status(201).json({ conversation });
  } catch (error) {
    console.error("Create conversation error:", error);
    return res.status(500).json({ error: "Failed to create conversation" });
  }
});

// GET /conversations — List buyer's conversations
router.get("/conversations", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });

    const conversations = await prisma.conversation.findMany({
      where: { buyerId: req.user.id },
      orderBy: { lastMessageAt: "desc" },
      include: {
        seller: { select: { id: true, storeName: true, logo: true } },
        product: { select: { id: true, name: true, slug: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    const result = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await prisma.chatMessage.count({
          where: { conversationId: conv.id, senderType: "SELLER", isRead: false },
        });
        return {
          ...conv,
          lastMessage: conv.messages[0] || null,
          unreadCount,
          messages: undefined,
        };
      })
    );

    return res.json({ conversations: result });
  } catch (error) {
    console.error("List conversations error:", error);
    return res.status(500).json({ error: "Failed to load conversations" });
  }
});

// GET /conversations/:id/messages — Get messages, mark as read
router.get("/conversations/:id/messages", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });

    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: {
        seller: { select: { id: true, storeName: true, logo: true } },
        product: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!conversation || conversation.buyerId !== req.user.id) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const messages = await prisma.chatMessage.findMany({
      where: { conversationId: req.params.id },
      orderBy: { createdAt: "asc" },
    });

    // Mark seller messages as read
    await prisma.chatMessage.updateMany({
      where: { conversationId: req.params.id, senderType: "SELLER", isRead: false },
      data: { isRead: true },
    });

    return res.json({ conversation, messages });
  } catch (error) {
    console.error("Get messages error:", error);
    return res.status(500).json({ error: "Failed to load messages" });
  }
});

// POST /conversations/:id/messages — Send message as buyer
router.post("/conversations/:id/messages", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });

    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
    });
    if (!conversation || conversation.buyerId !== req.user.id) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const { message } = req.body;
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "Message is required" });
    }

    const [chatMessage] = await prisma.$transaction([
      prisma.chatMessage.create({
        data: {
          conversationId: req.params.id,
          senderId: req.user.id,
          senderType: "BUYER",
          message: message.trim(),
        },
      }),
      prisma.conversation.update({
        where: { id: req.params.id },
        data: { lastMessageAt: new Date() },
      }),
    ]);

    return res.status(201).json({ message: chatMessage });
  } catch (error) {
    console.error("Send message error:", error);
    return res.status(500).json({ error: "Failed to send message" });
  }
});

export default router;
