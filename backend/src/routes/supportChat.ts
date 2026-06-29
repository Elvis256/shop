import { Router, Request, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { v4 as uuidv4 } from "uuid";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

// Simple in-memory chat store (for MVP — replace with DB later)
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
        message: "Welcome! How can we help you today? Our team typically responds within a few minutes.",
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

// Send a message
router.post("/:chatId/messages", (req: Request, res: Response) => {
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

  // Auto-reply after a delay (simulate agent) — in production, this would be real agents
  setTimeout(() => {
    chat.messages.push({
      id: uuidv4(),
      senderId: "agent",
      senderType: "agent",
      message: "Thanks for your message! Our team will get back to you shortly. For faster support, you can also reach us on WhatsApp.",
      createdAt: new Date().toISOString(),
    });
  }, 3000);

  res.json(msg);
});

// DELETE /api/support-chat/:chatId — Wipe chat history immediately
router.delete("/:chatId", (req: Request, res: Response) => {
  const deleted = chats.delete(req.params.chatId);
  if (!deleted) return res.status(404).json({ error: "Chat not found" });
  res.json({ message: "Chat session and history wiped from memory successfully" });
});

export default router;
