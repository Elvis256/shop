import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import redis from "../lib/redis";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

// Africa's Talking USSD callback
// Dial *XXX# → routes here
// Sessions stored in Redis with 5-minute TTL
router.post("/", asyncHandler(async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/plain");

  try {
    const { sessionId, phoneNumber, networkCode, text } = req.body as {
      sessionId: string;
      phoneNumber: string;
      networkCode: string;
      text: string; // Full input chain e.g. "1*2*1"
    };

    const inputs = text ? text.split("*") : [];
    const depth = inputs.length;

    // ── Level 0: Main menu ────────────────────────────────────────────────────
    if (depth === 0 || text === "") {
      return res.send(
        "CON Welcome to PleasureZone\n" +
        "1. Browse Products\n" +
        "2. Track Order\n" +
        "3. Contact Us"
      );
    }

    const level1 = inputs[0];

    // ── Track order ───────────────────────────────────────────────────────────
    if (level1 === "2") {
      if (depth === 1) {
        return res.send("CON Enter your order number:");
      }
      if (depth === 2) {
        const orderNumber = inputs[1].toUpperCase();
        const order = await prisma.order.findFirst({
          where: { orderNumber: { contains: orderNumber, mode: "insensitive" } },
        });

        if (!order) {
          return res.send(`END Order "${orderNumber}" not found.\nCheck your confirmation SMS.`);
        }

        const status = order.status.replace(/_/g, " ");
        const total = Number(order.totalAmount).toLocaleString();
        return res.send(
          `END Order: ${order.orderNumber}\n` +
          `Status: ${status}\n` +
          `Total: UGX ${total}\n` +
          `Visit ugsex.com to track delivery.`
        );
      }
    }

    // ── Contact ───────────────────────────────────────────────────────────────
    if (level1 === "3") {
      return res.send(
        "END PleasureZone Support\n" +
        "WhatsApp: +256742020610\n" +
        "Web: ugsex.com\n" +
        "Plain packaging guaranteed."
      );
    }

    // ── Browse products ───────────────────────────────────────────────────────
    if (level1 === "1") {
      if (depth === 1) {
        const categories = await prisma.category.findMany({
          take: 6,
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        });

        // Cache category list for this session
        await redis.setex(`ussd:cats:${sessionId}`, 300, JSON.stringify(categories));

        const list = categories.map((c, i) => `${i + 1}. ${c.name}`).join("\n");
        return res.send(`CON Choose category:\n${list}`);
      }

      if (depth === 2) {
        const catIdx = parseInt(inputs[1]) - 1;
        const catsRaw = await redis.get(`ussd:cats:${sessionId}`);
        const categories = catsRaw ? JSON.parse(catsRaw) : [];

        if (catIdx < 0 || catIdx >= categories.length) {
          return res.send("END Invalid selection. Please try again.");
        }

        const category = categories[catIdx];
        const products = await prisma.product.findMany({
          where: { categoryId: category.id, status: "ACTIVE" },
          take: 6,
          orderBy: { featured: "desc" },
          select: { id: true, name: true, price: true },
        });

        if (products.length === 0) {
          return res.send("END No products in this category.\nDial again to browse others.");
        }

        await redis.setex(`ussd:prods:${sessionId}`, 300, JSON.stringify(products));

        const list = products
          .map((p, i) => `${i + 1}. ${p.name.slice(0, 25)} ${Number(p.price).toLocaleString()}`)
          .join("\n");
        return res.send(`CON ${category.name}:\n${list}`);
      }

      if (depth === 3) {
        const prodIdx = parseInt(inputs[2]) - 1;
        const prodsRaw = await redis.get(`ussd:prods:${sessionId}`);
        const products = prodsRaw ? JSON.parse(prodsRaw) : [];

        if (prodIdx < 0 || prodIdx >= products.length) {
          return res.send("END Invalid selection. Please try again.");
        }

        const product = products[prodIdx];
        return res.send(
          `CON ${product.name}\n` +
          `Price: UGX ${Number(product.price).toLocaleString()}\n\n` +
          `1. Order this product\n` +
          `2. Back to menu`
        );
      }

      if (depth === 4 && inputs[3] === "1") {
        // Direct to website to complete order
        const prodsRaw = await redis.get(`ussd:prods:${sessionId}`);
        const products = prodsRaw ? JSON.parse(prodsRaw) : [];
        const prodIdx = parseInt(inputs[2]) - 1;
        const product = products[prodIdx];

        return res.send(
          `END To order ${product?.name || "this product"}:\n` +
          `1. Visit ugsex.com\n` +
          `2. WhatsApp: +256742020610\n` +
          `Plain packaging guaranteed.`
        );
      }
    }

    return res.send("END Invalid option. Dial again to restart.");
  } catch (error) {
    logger.error("USSD error", { error });
    return res.send("END Service temporarily unavailable. Try again shortly.");
  }
}));

export default router;
