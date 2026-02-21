import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { sendEmail } from "../services/email";

const router = Router();

// Generate unique gift card code
function generateGiftCardCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "GC-";
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (i < 3) code += "-";
  }
  return code;
}

// GET /api/gift-cards/check/:code - Check gift card balance
router.get("/check/:code", async (req: Request, res: Response) => {
  try {
    const { code } = req.params;

    const giftCard = await prisma.giftCard.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!giftCard) {
      return res.status(404).json({ error: "Gift card not found" });
    }

    if (!giftCard.isActive) {
      return res.status(400).json({ error: "Gift card is inactive" });
    }

    if (giftCard.expiresAt && giftCard.expiresAt < new Date()) {
      return res.status(400).json({ error: "Gift card has expired" });
    }

    return res.json({
      code: giftCard.code,
      balance: giftCard.currentValue,
      currency: giftCard.currency,
      expiresAt: giftCard.expiresAt,
    });
  } catch (error) {
    console.error("Check gift card error:", error);
    return res.status(500).json({ error: "Failed to check gift card" });
  }
});

// POST /api/gift-cards/purchase - Purchase a gift card
router.post("/purchase", async (req: Request, res: Response) => {
  try {
    const {
      amount,
      currency = "UGX",
      purchaserEmail,
      purchaserName,
      recipientEmail,
      recipientName,
      message,
      sendToRecipient = true,
    } = req.body;

    // Validate amount (common denominations)
    const validAmounts = [50000, 100000, 200000, 500000, 1000000]; // UGX
    if (!validAmounts.includes(Number(amount))) {
      return res.status(400).json({
        error: "Invalid amount",
        validAmounts,
      });
    }

    if (!purchaserEmail) {
      return res.status(400).json({ error: "Purchaser email is required" });
    }

    // Create gift card
    const code = generateGiftCardCode();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year validity

    const giftCard = await prisma.giftCard.create({
      data: {
        code,
        initialValue: amount,
        currentValue: amount,
        currency,
        purchaserEmail,
        purchaserName,
        recipientEmail,
        recipientName,
        message,
        expiresAt,
      },
    });

    // Send email to recipient if requested
    if (sendToRecipient && recipientEmail) {
      await sendGiftCardEmail(giftCard);
    }

    return res.status(201).json({
      message: "Gift card created successfully",
      giftCard: {
        id: giftCard.id,
        code: giftCard.code,
        value: giftCard.initialValue,
        currency: giftCard.currency,
        expiresAt: giftCard.expiresAt,
      },
    });
  } catch (error) {
    console.error("Purchase gift card error:", error);
    return res.status(500).json({ error: "Failed to create gift card" });
  }
});

// POST /api/gift-cards/redeem - Redeem gift card (apply to order)
router.post("/redeem", async (req: Request, res: Response) => {
  try {
    const { code, amount, orderId } = req.body;

    if (!code || !amount) {
      return res.status(400).json({ error: "Code and amount are required" });
    }

    const giftCard = await prisma.giftCard.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!giftCard) {
      return res.status(404).json({ error: "Gift card not found" });
    }

    if (!giftCard.isActive) {
      return res.status(400).json({ error: "Gift card is inactive" });
    }

    if (giftCard.expiresAt && giftCard.expiresAt < new Date()) {
      return res.status(400).json({ error: "Gift card has expired" });
    }

    const redeemAmount = Math.min(Number(amount), Number(giftCard.currentValue));

    if (redeemAmount <= 0) {
      return res.status(400).json({ error: "Gift card has no remaining balance" });
    }

    // Update gift card and create redemption record
    const [updatedCard, redemption] = await prisma.$transaction([
      prisma.giftCard.update({
        where: { id: giftCard.id },
        data: {
          currentValue: { decrement: redeemAmount },
          isActive: Number(giftCard.currentValue) - redeemAmount > 0,
        },
      }),
      prisma.giftCardRedemption.create({
        data: {
          giftCardId: giftCard.id,
          orderId,
          amount: redeemAmount,
        },
      }),
    ]);

    return res.json({
      message: "Gift card redeemed successfully",
      amountRedeemed: redeemAmount,
      remainingBalance: updatedCard.currentValue,
    });
  } catch (error) {
    console.error("Redeem gift card error:", error);
    return res.status(500).json({ error: "Failed to redeem gift card" });
  }
});

// Send gift card email to recipient
async function sendGiftCardEmail(giftCard: any): Promise<void> {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3001";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ec4899, #8b5cf6); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 12px 12px; }
        .gift-card { background: white; border: 2px solid #ec4899; border-radius: 12px; padding: 30px; text-align: center; margin: 20px 0; }
        .code { font-size: 28px; font-weight: bold; color: #ec4899; letter-spacing: 2px; margin: 15px 0; font-family: monospace; }
        .value { font-size: 36px; font-weight: bold; color: #333; }
        .message { background: #fce7f3; padding: 20px; border-radius: 8px; margin: 20px 0; font-style: italic; }
        .button { display: inline-block; background: #ec4899; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎁 You've Received a Gift!</h1>
        </div>
        <div class="content">
          <p>Hi${giftCard.recipientName ? ` ${giftCard.recipientName}` : ""}!</p>
          <p>${giftCard.purchaserName || "Someone special"} has sent you a gift card to Pleasure Zone Uganda!</p>
          
          <div class="gift-card">
            <p class="value">${giftCard.currency} ${Number(giftCard.initialValue).toLocaleString()}</p>
            <p>Your Gift Card Code:</p>
            <p class="code">${giftCard.code}</p>
            <p style="color: #666; font-size: 14px;">Valid until ${new Date(giftCard.expiresAt).toLocaleDateString()}</p>
          </div>
          
          ${giftCard.message ? `
            <div class="message">
              <p>"${giftCard.message}"</p>
              <p style="text-align: right; margin-top: 10px;">— ${giftCard.purchaserName || "Your friend"}</p>
            </div>
          ` : ""}
          
          <p style="text-align: center;">
            <a href="${frontendUrl}/products" class="button">Start Shopping</a>
          </p>
          
          <p style="text-align: center; color: #666; font-size: 14px; margin-top: 20px;">
            Enter your code at checkout to redeem your gift card.
          </p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Pleasure Zone Uganda. All rights reserved.</p>
          <p>📦 100% Discreet Packaging • 🔒 Private & Secure</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: giftCard.recipientEmail,
    subject: `🎁 You've received a ${giftCard.currency} ${Number(giftCard.initialValue).toLocaleString()} Gift Card!`,
    html,
  });
}

export default router;
