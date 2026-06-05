import { Router, Response } from "express";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { asyncHandler } from "../../middleware/errorHandler";

const router = Router();

router.use(authenticate, requireAdmin);

// GET /conversations — List admin conversations
router.get("/conversations", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { adminId: { not: null } },
      orderBy: { lastMessageAt: "desc" },
      include: {
        seller: { select: { id: true, storeName: true, email: true, logo: true } },
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
    logger.error("List admin conversations error", { error });
    return res.status(500).json({ error: "Failed to load conversations" });
  }
}));

// POST /conversations — Start conversation with seller
router.post("/conversations", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { sellerId, message } = req.body;
    if (!sellerId) {
      return res.status(400).json({ error: "Seller ID is required" });
    }

    const seller = await prisma.seller.findUnique({
      where: { id: sellerId },
      select: { id: true, storeName: true },
    });
    if (!seller) {
      return res.status(404).json({ error: "Seller not found" });
    }

    // Check for existing admin conversation with this seller
    const existing = await prisma.conversation.findFirst({
      where: { adminId: { not: null }, sellerId },
    });

    if (existing) {
      // Add message to existing conversation if provided
      if (message && typeof message === "string" && message.trim()) {
        await prisma.$transaction([
          prisma.chatMessage.create({
            data: {
              conversationId: existing.id,
              senderId: req.user!.id,
              senderType: "ADMIN",
              message: message.trim(),
            },
          }),
          prisma.conversation.update({
            where: { id: existing.id },
            data: { lastMessageAt: new Date() },
          }),
        ]);
      }
      return res.json({ conversation: existing });
    }

    // Create new conversation
    const conversation = await prisma.conversation.create({
      data: {
        sellerId,
        adminId: req.user!.id,
        buyerId: null,
      },
    });

    // Add initial message if provided
    if (message && typeof message === "string" && message.trim()) {
      await prisma.$transaction([
        prisma.chatMessage.create({
          data: {
            conversationId: conversation.id,
            senderId: req.user!.id,
            senderType: "ADMIN",
            message: message.trim(),
          },
        }),
        prisma.conversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt: new Date() },
        }),
      ]);
    }

    return res.status(201).json({ conversation });
  } catch (error) {
    logger.error("Create admin conversation error", { error });
    return res.status(500).json({ error: "Failed to create conversation" });
  }
}));

// GET /conversations/:id/messages — Get messages
router.get("/conversations/:id/messages", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: {
        seller: { select: { id: true, storeName: true, logo: true } },
      },
    });
    if (!conversation || !conversation.adminId) {
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
    logger.error("Get admin messages error", { error });
    return res.status(500).json({ error: "Failed to load messages" });
  }
}));

// POST /conversations/:id/messages — Send message as admin
router.post("/conversations/:id/messages", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
    });
    if (!conversation || !conversation.adminId) {
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
          senderId: req.user!.id,
          senderType: "ADMIN",
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
    logger.error("Send admin message error", { error });
    return res.status(500).json({ error: "Failed to send message" });
  }
}));

export default router;
