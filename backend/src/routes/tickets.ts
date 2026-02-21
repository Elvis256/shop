import { Router, Response } from "express";
import { PrismaClient, TicketCategory, TicketPriority } from "@prisma/client";
import { z } from "zod";
import { authenticate, optionalAuth, AuthRequest } from "../middleware/auth";
import { v4 as uuidv4 } from "uuid";

const router = Router();
const prisma = new PrismaClient();

// Create ticket schema
const createTicketSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  subject: z.string().min(1).max(200),
  category: z.nativeEnum(TicketCategory),
  message: z.string().min(10),
  orderId: z.string().optional(),
});

// Generate ticket number
const generateTicketNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TKT-${timestamp}-${random}`;
};

// Create support ticket
router.post("/", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const data = createTicketSchema.parse(req.body);
    const userId = req.user?.id;

    const ticket = await prisma.supportTicket.create({
      data: {
        ticketNumber: generateTicketNumber(),
        userId,
        email: data.email,
        name: data.name,
        subject: data.subject,
        category: data.category,
        orderId: data.orderId,
        messages: {
          create: {
            senderId: userId,
            senderType: "customer",
            senderName: data.name,
            message: data.message,
          },
        },
      },
      include: {
        messages: true,
      },
    });

    res.status(201).json({ 
      ticket,
      message: "Support ticket created. We'll respond within 24 hours." 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Create ticket error:", error);
    res.status(500).json({ error: "Failed to create support ticket" });
  }
});

// Get user's tickets
router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { status } = req.query;

    const where: Record<string, unknown> = { userId };
    if (status) {
      where.status = status;
    }

    const tickets = await prisma.supportTicket.findMany({
      where,
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    res.json({ tickets });
  } catch (error) {
    console.error("Get tickets error:", error);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

// Get ticket by number (for guests)
router.get("/lookup/:ticketNumber", async (req, res) => {
  try {
    const { ticketNumber } = req.params;
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: "Email required for ticket lookup" });
    }

    const ticket = await prisma.supportTicket.findFirst({
      where: {
        ticketNumber,
        email: email as string,
      },
      include: {
        messages: {
          where: { isInternal: false },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    res.json({ ticket });
  } catch (error) {
    console.error("Lookup ticket error:", error);
    res.status(500).json({ error: "Failed to lookup ticket" });
  }
});

// Get single ticket
router.get("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const ticket = await prisma.supportTicket.findFirst({
      where: { id, userId },
      include: {
        messages: {
          where: { isInternal: false },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    res.json({ ticket });
  } catch (error) {
    console.error("Get ticket error:", error);
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
});

// Add message to ticket
router.post("/:id/messages", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { message } = req.body;

    if (!message || message.trim().length < 1) {
      return res.status(400).json({ error: "Message is required" });
    }

    const ticket = await prisma.supportTicket.findFirst({
      where: { id, userId },
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Add message and update ticket status
    const [newMessage] = await prisma.$transaction([
      prisma.ticketMessage.create({
        data: {
          ticketId: id,
          senderId: userId,
          senderType: "customer",
          senderName: ticket.name || "Customer",
          message: message.trim(),
        },
      }),
      prisma.supportTicket.update({
        where: { id },
        data: {
          status: "OPEN",
          updatedAt: new Date(),
        },
      }),
    ]);

    res.status(201).json({ message: newMessage });
  } catch (error) {
    console.error("Add message error:", error);
    res.status(500).json({ error: "Failed to add message" });
  }
});

export default router;
