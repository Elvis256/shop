import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";

const prisma = new PrismaClient();

// Email transporter (configure with your SMTP settings)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.mailtrap.io",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const formatCurrency = (amount: number, currency: string): string => {
  return `${currency} ${Number(amount).toLocaleString()}`;
};

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

const generateCartEmailHtml = (cart: { cartData: CartItem[]; cartValue: number; currency: string }, type: "reminder1" | "reminder2"): string => {
  const items = cart.cartData;
  const subject = type === "reminder1" 
    ? "You left something behind!" 
    : "Your cart is about to expire";
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f5f5f7; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #0071e3; color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .content { padding: 40px 30px; }
    .content h2 { color: #1d1d1f; margin-bottom: 20px; }
    .content p { color: #86868b; line-height: 1.6; }
    .items { margin: 30px 0; }
    .item { display: flex; padding: 15px 0; border-bottom: 1px solid #e5e5e5; }
    .item-image { width: 80px; height: 80px; background: #f5f5f7; border-radius: 8px; margin-right: 15px; }
    .item-details { flex: 1; }
    .item-name { font-weight: 500; color: #1d1d1f; margin-bottom: 5px; }
    .item-price { color: #86868b; }
    .total { text-align: right; padding: 20px 0; font-size: 18px; font-weight: 600; color: #1d1d1f; }
    .cta { text-align: center; padding: 20px 0; }
    .cta a { display: inline-block; background: #0071e3; color: white; text-decoration: none; padding: 14px 40px; border-radius: 30px; font-weight: 500; }
    .footer { padding: 30px; text-align: center; color: #86868b; font-size: 12px; background: #f5f5f7; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>PleasureZone</h1>
    </div>
    <div class="content">
      <h2>${type === "reminder1" ? "Your cart misses you!" : "Last chance to complete your order"}</h2>
      <p>${type === "reminder1" 
        ? "You left some amazing items in your cart. Complete your order now before they sell out!"
        : "Your cart items are reserved but won't be for long. Complete your purchase now to avoid disappointment."}</p>
      
      <div class="items">
        ${items.map((item: CartItem) => `
          <div class="item">
            <div class="item-image"></div>
            <div class="item-details">
              <div class="item-name">${item.productName}</div>
              <div class="item-price">Qty: ${item.quantity} × ${formatCurrency(item.price, cart.currency || "UGX")}</div>
            </div>
          </div>
        `).join("")}
      </div>
      
      <div class="total">
        Total: ${formatCurrency(Number(cart.cartValue), cart.currency || "UGX")}
      </div>
      
      <div class="cta">
        <a href="${process.env.BASE_URL || "http://localhost:3000"}/cart">Complete Your Order</a>
      </div>
      
      ${type === "reminder2" ? `
      <p style="text-align: center; margin-top: 20px; color: #f5a623; font-weight: 500;">
        ⏰ Your cart expires in 24 hours
      </p>
      ` : ""}
    </div>
    <div class="footer">
      <p>You're receiving this because you have items in your PleasureZone cart.</p>
      <p>Discreet billing and shipping guaranteed.</p>
    </div>
  </div>
</body>
</html>
  `;
};

// Create or update abandoned cart tracking
export const trackAbandonedCart = async (
  cartId: string,
  userId: string | null,
  email: string,
  items: CartItem[],
  totalAmount: number,
  currency: string
): Promise<void> => {
  try {
    // Upsert abandoned cart
    await prisma.abandonedCart.upsert({
      where: { cartId },
      update: {
        cartData: items as unknown as object,
        cartValue: totalAmount,
        currency,
      },
      create: {
        cartId,
        userId,
        email,
        cartData: items as unknown as object,
        cartValue: totalAmount,
        currency,
      },
    });
  } catch (error) {
    console.error("Track abandoned cart error:", error);
  }
};

// Mark cart as recovered
export const markCartRecovered = async (userId: string): Promise<void> => {
  try {
    await prisma.abandonedCart.updateMany({
      where: {
        userId,
        recoveredAt: null,
      },
      data: {
        recoveredAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Mark cart recovered error:", error);
  }
};

// Send abandoned cart emails (run as cron job)
export const processAbandonedCartEmails = async (): Promise<void> => {
  const now = new Date();
  
  try {
    // Get carts for 1-hour reminder (created 1+ hours ago, no reminder sent)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const cartsForReminder1 = await prisma.abandonedCart.findMany({
      where: {
        createdAt: { lte: oneHourAgo },
        recoveredAt: null,
        email1SentAt: null,
      },
      take: 50,
    });

    for (const cart of cartsForReminder1) {
      if (!cart.email) continue;
      try {
        const cartItems = cart.cartData as unknown as CartItem[];
        const html = generateCartEmailHtml({
          cartData: cartItems,
          cartValue: Number(cart.cartValue),
          currency: cart.currency,
        }, "reminder1");
        
        await transporter.sendMail({
          from: `"PleasureZone" <${process.env.SMTP_FROM || "noreply@pleasurezone.ug"}>`,
          to: cart.email,
          subject: "You left something behind! 🛒",
          html,
        });

        await prisma.abandonedCart.update({
          where: { id: cart.id },
          data: { email1SentAt: new Date() },
        });

        console.log(`Sent reminder 1 to ${cart.email}`);
      } catch (err) {
        console.error(`Failed to send reminder 1 to ${cart.email}:`, err);
      }
    }

    // Get carts for 24-hour reminder (created 24+ hours ago, reminder 1 sent, no reminder 2)
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const cartsForReminder2 = await prisma.abandonedCart.findMany({
      where: {
        createdAt: { lte: twentyFourHoursAgo },
        recoveredAt: null,
        email1SentAt: { not: null },
        email2SentAt: null,
      },
      take: 50,
    });

    for (const cart of cartsForReminder2) {
      if (!cart.email) continue;
      try {
        const cartItems = cart.cartData as unknown as CartItem[];
        const html = generateCartEmailHtml({
          cartData: cartItems,
          cartValue: Number(cart.cartValue),
          currency: cart.currency,
        }, "reminder2");
        
        await transporter.sendMail({
          from: `"PleasureZone" <${process.env.SMTP_FROM || "noreply@pleasurezone.ug"}>`,
          to: cart.email,
          subject: "Last chance! Your cart expires soon ⏰",
          html,
        });

        await prisma.abandonedCart.update({
          where: { id: cart.id },
          data: { email2SentAt: new Date() },
        });

        console.log(`Sent reminder 2 to ${cart.email}`);
      } catch (err) {
        console.error(`Failed to send reminder 2 to ${cart.email}:`, err);
      }
    }
  } catch (error) {
    console.error("Process abandoned cart emails error:", error);
  }
};

// Start cron job for abandoned cart emails (every 15 minutes)
export const startAbandonedCartJob = (): void => {
  console.log("📧 Abandoned cart email job started");
  setInterval(() => {
    processAbandonedCartEmails();
  }, 15 * 60 * 1000); // Every 15 minutes
  
  // Run immediately on startup
  setTimeout(processAbandonedCartEmails, 5000);
};
