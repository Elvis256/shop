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

export default router;
