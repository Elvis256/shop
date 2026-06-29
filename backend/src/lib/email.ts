import nodemailer from "nodemailer";
import { logger } from "./logger";
import prisma from "./prisma";

function isSmtpConfigured(): boolean {
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  if (!user || !pass) return false;
  if (user.includes("your-") || user.includes("change_this") || pass.includes("your-") || pass.includes("change_this")) return false;
  return true;
}

const smtpReady = isSmtpConfigured();
if (!smtpReady) {
  logger.warn("Email sending disabled: SMTP credentials not configured (placeholder values detected)");
}

const envTransporter = smtpReady
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: parseInt(process.env.SMTP_PORT || "587") === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

// Dynamic SMTP: check Settings DB first, fall back to .env transporter
let cachedDbTransporter: nodemailer.Transporter | null = null;
let dbTransporterCacheTime = 0;
const DB_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function invalidateSmtpCache() {
  cachedDbTransporter = null;
  dbTransporterCacheTime = 0;
}

async function getTransporter(): Promise<nodemailer.Transporter | null> {
  // Try cached DB transporter
  if (cachedDbTransporter && Date.now() - dbTransporterCacheTime < DB_CACHE_TTL) {
    return cachedDbTransporter;
  }

  // Try loading from Settings DB
  try {
    const smtpSettings = await prisma.setting.findMany({
      where: { key: { in: ["email_smtp_host", "email_smtp_port", "email_smtp_user", "email_smtp_password", "email_smtp_secure"] } },
    });
    const cfg = Object.fromEntries(smtpSettings.map((s) => [s.key, s.value]));

    if (cfg.email_smtp_host && cfg.email_smtp_user && cfg.email_smtp_password) {
      const port = parseInt(cfg.email_smtp_port || "587");
      cachedDbTransporter = nodemailer.createTransport({
        host: cfg.email_smtp_host,
        port,
        secure: cfg.email_smtp_secure === "true" || port === 465,
        auth: { user: cfg.email_smtp_user, pass: cfg.email_smtp_password },
      });
      dbTransporterCacheTime = Date.now();
      return cachedDbTransporter;
    }
  } catch (e) {
    // DB not ready — fall back to env
  }

  return envTransporter;
}

// Export for test endpoint
export async function verifySmtpConnection(): Promise<{ success: boolean; error?: string }> {
  invalidateSmtpCache();
  const t = await getTransporter();
  if (!t) return { success: false, error: "No SMTP transporter configured" };
  try {
    await t.verify();
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

type EmailTemplate = "welcome" | "order-received" | "order-confirmation" | "order-shipped" | "order-processing" | "order-delivered" | "order-cancelled" | "order-refunded" | "password-reset" | "seller-approved" | "seller-rejected" | "seller-warning" | "seller-product-approved" | "seller-product-rejected" | "seller-product-changes" | "review-prompt" | "abandoned-cart" | "back-in-stock" | "price-drop";

interface SendEmailOptions {
  to: string;
  template: EmailTemplate;
  data: Record<string, any>;
}

const templates: Record<EmailTemplate, { subject: string; html: (data: any) => string }> = {
  welcome: {
    subject: "Welcome to Adult Store!",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2a2a2a;">Welcome, ${data.name}!</h1>
        <p>Thank you for joining Adult Store. We're committed to providing you with quality products and complete discretion.</p>
        <p><strong>Your privacy matters:</strong></p>
        <ul>
          <li>Plain, unmarked packaging</li>
          <li>Neutral billing name</li>
          <li>Secure, encrypted checkout</li>
        </ul>
        <a href="${process.env.BASE_URL}" style="display: inline-block; padding: 12px 24px; background: #2a2a2a; color: white; text-decoration: none; border-radius: 4px;">Start Shopping</a>
      </div>
    `,
  },
  "order-received": {
    subject: "Order Received - #${orderNumber}",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2a2a2a;">We've Received Your Order!</h1>
        <p>Hi ${data.customerName},</p>
        <p>Thank you for your order. We'll start processing it ${data.paymentMethod === "COD" ? "right away" : "once your payment is confirmed"}.</p>
        <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p><strong>Order Number:</strong> ${data.orderNumber}</p>
          <p><strong>Total:</strong> UGX ${Number(data.total).toLocaleString()}</p>
          <p><strong>Payment Method:</strong> ${data.paymentMethod}</p>
        </div>
        <h3>Items:</h3>
        <ul>
          ${data.items.map((item: any) => `<li>${item.name} x ${item.quantity} - UGX ${Number(item.price).toLocaleString()}</li>`).join("")}
        </ul>
        ${data.paymentMethod === "COD" ? '<p style="color: #2a2a2a; font-weight: bold;">Please have the exact amount ready at delivery.</p>' : ""}
        <p style="color: #666; font-size: 14px;"><em>Your order will be shipped in plain, unmarked packaging for your privacy.</em></p>
        <a href="${process.env.BASE_URL}/orders/${data.orderId}" style="display: inline-block; padding: 12px 24px; background: #2a2a2a; color: white; text-decoration: none; border-radius: 4px;">Track Order</a>
      </div>
    `,
  },
  "order-confirmation": {
    subject: "Order Confirmed - #${orderNumber}",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2a2a2a;">Order Confirmed!</h1>
        <p>Hi ${data.customerName},</p>
        <p>Thank you for your order. Here are your order details:</p>
        <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p><strong>Order Number:</strong> ${data.orderNumber}</p>
          <p><strong>Total:</strong> ${data.currency || 'UGX'} ${data.total.toLocaleString()}</p>
          <p><strong>Payment Method:</strong> ${data.paymentMethod}</p>
        </div>
        <h3>Items:</h3>
        <ul>
          ${data.items.map((item: any) => `<li>${item.name} x ${item.quantity} - ${data.currency || 'UGX'} ${item.price.toLocaleString()}</li>`).join("")}
        </ul>
        <p style="color: #666; font-size: 14px;"><em>Your order will be shipped in plain, unmarked packaging.</em></p>
        <a href="${process.env.BASE_URL}/account/orders/${data.orderId}" style="display: inline-block; padding: 12px 24px; background: #2a2a2a; color: white; text-decoration: none; border-radius: 4px;">Track Order</a>
      </div>
    `,
  },
  "order-shipped": {
    subject: "Your Order Has Shipped - #${orderNumber}",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2a2a2a;">Your Order is On Its Way!</h1>
        <p>Hi ${data.customerName},</p>
        <p>Great news! Your order #${data.orderNumber} has been shipped.</p>
        ${data.trackingNumber ? `<p><strong>Tracking Number:</strong> ${data.trackingNumber}</p>` : ""}
        <p><strong>Estimated Delivery:</strong> ${data.estimatedDelivery}</p>
        <p style="color: #666; font-size: 14px;"><em>Remember: Your package will arrive in plain, unmarked packaging with a neutral sender name.</em></p>
        <a href="${process.env.BASE_URL}/account/orders/${data.orderId}" style="display: inline-block; padding: 12px 24px; background: #2a2a2a; color: white; text-decoration: none; border-radius: 4px;">Track Order</a>
      </div>
    `,
  },
  "order-processing": {
    subject: "Your Order #${orderNumber} is Being Processed",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2a2a2a;">Your Order is Being Processed</h1>
        <p>Hi ${data.customerName},</p>
        <p>Great news! We've started processing your order #${data.orderNumber}.</p>
        <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p><strong>Order Number:</strong> ${data.orderNumber}</p>
          <p><strong>Total:</strong> ${data.currency || 'UGX'} ${Number(data.total).toLocaleString()}</p>
        </div>
        <p>We'll notify you once your order has been shipped.</p>
        <p style="color: #666; font-size: 14px;"><em>Your order will be shipped in plain, unmarked packaging.</em></p>
        <a href="${process.env.BASE_URL}/account/orders/${data.orderId}" style="display: inline-block; padding: 12px 24px; background: #2a2a2a; color: white; text-decoration: none; border-radius: 4px;">Track Order</a>
      </div>
    `,
  },
  "order-delivered": {
    subject: "Your Order #${orderNumber} Has Been Delivered",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2a2a2a;">Your Order Has Been Delivered!</h1>
        <p>Hi ${data.customerName},</p>
        <p>Your order #${data.orderNumber} has been delivered successfully.</p>
        <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p><strong>Order Number:</strong> ${data.orderNumber}</p>
          <p><strong>Total:</strong> ${data.currency || 'UGX'} ${Number(data.total).toLocaleString()}</p>
        </div>
        <p>We hope you enjoy your purchase! If you have any issues, please contact our support.</p>
        <a href="${process.env.BASE_URL}/account/orders/${data.orderId}" style="display: inline-block; padding: 12px 24px; background: #2a2a2a; color: white; text-decoration: none; border-radius: 4px;">View Order</a>
      </div>
    `,
  },
  "order-cancelled": {
    subject: "Your Order #${orderNumber} Has Been Cancelled",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2a2a2a;">Your Order Has Been Cancelled</h1>
        <p>Hi ${data.customerName},</p>
        <p>Your order #${data.orderNumber} has been cancelled.</p>
        <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p><strong>Order Number:</strong> ${data.orderNumber}</p>
          <p><strong>Total:</strong> ${data.currency || 'UGX'} ${Number(data.total).toLocaleString()}</p>
        </div>
        ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ""}
        <p>If you believe this is an error or have questions, please contact our support team.</p>
        <a href="${process.env.BASE_URL}/account/orders" style="display: inline-block; padding: 12px 24px; background: #2a2a2a; color: white; text-decoration: none; border-radius: 4px;">View Orders</a>
      </div>
    `,
  },
  "order-refunded": {
    subject: "Refund Processed - Order #${orderNumber}",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2a2a2a;">Refund Processed</h1>
        <p>Hi ${data.customerName},</p>
        <p>A refund has been processed for your order #${data.orderNumber}.</p>
        <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #bbf7d0;">
          <p><strong>Refund Amount:</strong> ${data.currency || 'UGX'} ${Number(data.refundAmount).toLocaleString()}</p>
          <p><strong>Order Number:</strong> ${data.orderNumber}</p>
        </div>
        ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ""}
        <p>Please allow 3-5 business days for the refund to reflect in your account.</p>
        <p>If you have any questions, please contact our support team.</p>
        <a href="${process.env.BASE_URL}/account/orders/${data.orderId}" style="display: inline-block; padding: 12px 24px; background: #2a2a2a; color: white; text-decoration: none; border-radius: 4px;">View Order</a>
      </div>
    `,
  },
  "seller-approved": {
    subject: "Your Seller Application Has Been Approved!",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #16a34a;">Congratulations, ${data.storeName}!</h1>
        <p>Great news! Your seller application has been approved. You can now start listing products and selling on our marketplace.</p>
        <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #bbf7d0;">
          <p><strong>Store Name:</strong> ${data.storeName}</p>
          <p><strong>Status:</strong> ✅ Approved</p>
        </div>
        <h3>Next Steps:</h3>
        <ol>
          <li>Log in to your <a href="${process.env.FRONTEND_URL || process.env.BASE_URL}/seller">Seller Dashboard</a></li>
          <li>Add your first products</li>
          <li>Configure your payout settings</li>
        </ol>
        <a href="${process.env.FRONTEND_URL || process.env.BASE_URL}/seller" style="display: inline-block; padding: 12px 24px; background: #16a34a; color: white; text-decoration: none; border-radius: 4px;">Go to Seller Dashboard</a>
      </div>
    `,
  },
  "seller-rejected": {
    subject: "Update on Your Seller Application",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2a2a2a;">Seller Application Update</h1>
        <p>Hi ${data.storeName},</p>
        <p>Thank you for your interest in selling on our marketplace. Unfortunately, we are unable to approve your application at this time.</p>
        ${data.rejectionNote ? `
        <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #fecaca;">
          <p><strong>Reason:</strong> ${data.rejectionNote}</p>
        </div>
        ` : ""}
        <p>If you have questions or would like to re-apply in the future, please contact our support team.</p>
        <a href="${process.env.FRONTEND_URL || process.env.BASE_URL}/seller/register" style="display: inline-block; padding: 12px 24px; background: #2a2a2a; color: white; text-decoration: none; border-radius: 4px;">Contact Support</a>
      </div>
    `,
  },
  "seller-warning": {
    subject: "Important: A Warning Has Been Issued for Your Store",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #dc2626;">Warning Notice — ${data.storeName}</h1>
        <p>A <strong>${data.type}</strong> has been issued for your store.</p>
        <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #fecaca;">
          <p><strong>Type:</strong> ${data.type}</p>
          <p><strong>Reason:</strong> ${data.reason}</p>
          <p><strong>Active warnings:</strong> ${data.activeCount}</p>
        </div>
        <p>Please review and address this matter promptly. Continued violations may result in account suspension.</p>
        <a href="${process.env.FRONTEND_URL || process.env.BASE_URL}/seller" style="display: inline-block; padding: 12px 24px; background: #2a2a2a; color: white; text-decoration: none; border-radius: 4px;">View Dashboard</a>
      </div>
    `,
  },
  "password-reset": {
    subject: "Reset Your Password",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2a2a2a;">Reset Your Password</h1>
        <p>Hi ${data.name},</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <a href="${process.env.BASE_URL}/auth/reset-password?token=${data.token}" style="display: inline-block; padding: 12px 24px; background: #2a2a2a; color: white; text-decoration: none; border-radius: 4px;">Reset Password</a>
        <p style="color: #666; font-size: 14px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  },
  "seller-product-approved": {
    subject: "Your Product Has Been Approved!",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #16a34a;">Product Approved!</h1>
        <p>Great news! Your product <strong>"${data.productName}"</strong> has been reviewed and approved.</p>
        <p>It is now live and visible to customers on the store.</p>
        <a href="${process.env.FRONTEND_URL || process.env.BASE_URL}/seller" style="display: inline-block; padding: 12px 24px; background: #2a2a2a; color: white; text-decoration: none; border-radius: 4px;">View Dashboard</a>
      </div>
    `,
  },
  "seller-product-rejected": {
    subject: "Product Review: Changes Required",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #dc2626;">Product Not Approved</h1>
        <p>Your product <strong>"${data.productName}"</strong> was not approved for the following reason:</p>
        <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #fecaca;">
          <p>${data.reason}</p>
        </div>
        <p>Please update your product and resubmit for review.</p>
        <a href="${process.env.FRONTEND_URL || process.env.BASE_URL}/seller" style="display: inline-block; padding: 12px 24px; background: #2a2a2a; color: white; text-decoration: none; border-radius: 4px;">Edit Product</a>
      </div>
    `,
  },
  "seller-product-changes": {
    subject: "Product Review: Changes Requested",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #ca8a04;">Changes Requested</h1>
        <p>The review team has requested changes to your product <strong>"${data.productName}"</strong>:</p>
        <div style="background: #fefce8; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #fde68a;">
          <p>${data.reason}</p>
        </div>
        <p>Please make the requested changes and the product will be reviewed again.</p>
        <a href="${process.env.FRONTEND_URL || process.env.BASE_URL}/seller" style="display: inline-block; padding: 12px 24px; background: #2a2a2a; color: white; text-decoration: none; border-radius: 4px;">Edit Product</a>
      </div>
    `,
  },
  "review-prompt": {
    subject: "How was your order? Leave a review!",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2a2a2a;">How was your order?</h1>
        <p>Hi ${data.name},</p>
        <p>Your order <strong>#${data.orderNumber}</strong> was delivered ${data.daysAgo} days ago. We'd love to hear what you think!</p>
        <p>Your feedback helps other customers and helps us improve.</p>
        <a href="${process.env.FRONTEND_URL || process.env.BASE_URL}/account/orders/${data.orderId}" style="display: inline-block; padding: 12px 24px; background: #2a2a2a; color: white; text-decoration: none; border-radius: 4px;">Write a Review</a>
        <p style="color: #666; font-size: 14px; margin-top: 16px;">Thank you for shopping with us!</p>
      </div>
    `,
  },
  "abandoned-cart": {
    subject: "You left something behind!",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2a2a2a;">Still interested?</h1>
        <p>Hi${data.name ? ` ${data.name}` : ""},</p>
        <p>You left ${data.itemCount} item${data.itemCount > 1 ? "s" : ""} in your cart worth <strong>${data.currency || "UGX"} ${Number(data.total).toLocaleString()}</strong>.</p>
        ${data.discount ? `<div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #bbf7d0;"><p style="margin:0;"><strong>Special offer:</strong> Use code <strong>${data.discount}</strong> for ${data.discountAmount} off your order!</p></div>` : ""}
        <a href="${process.env.FRONTEND_URL || process.env.BASE_URL}/checkout" style="display: inline-block; padding: 12px 24px; background: #2a2a2a; color: white; text-decoration: none; border-radius: 4px;">Complete Your Order</a>
        <p style="color: #666; font-size: 14px; margin-top: 16px;">Items in your cart are not reserved and may sell out.</p>
      </div>
    `,
  },
  "back-in-stock": {
    subject: "Intimate Wellness: \\${productName} is back in stock!",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #2a2a2a; border-bottom: 2px solid #eaeaea; padding-bottom: 10px;">Back In Stock Alert!</h2>
        <p>Good news! The item you were waiting for, <strong>"${data.productName}"</strong>, is now back in stock.</p>
        <p>We wanted you to be the first to know so you don't miss out again.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.productUrl}" style="display: inline-block; padding: 12px 28px; background: #c2410c; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Shop Now</a>
        </div>
        <p style="color: #666; font-size: 13px; border-top: 1px solid #eaeaea; padding-top: 15px; margin-top: 20px;">
          You received this email because you subscribed to receive notifications when this product became available.
        </p>
      </div>
    `,
  },
  "price-drop": {
    subject: "Price Drop Alert: \\${productName} is now \\${newPrice}!",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #2a2a2a; border-bottom: 2px solid #eaeaea; padding-bottom: 10px;">Price Drop Alert!</h2>
        <p>Good news! The item you were watching, <strong>"${data.productName}"</strong>, has dropped in price.</p>
        <p>It is now available for <strong>${data.currency || "UGX"} ${Number(data.newPrice).toLocaleString()}</strong> (your target price was ${data.currency || "UGX"} ${Number(data.targetPrice).toLocaleString()}).</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.productUrl}" style="display: inline-block; padding: 12px 28px; background: #c2410c; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Shop Now</a>
        </div>
        <p style="color: #666; font-size: 13px; border-top: 1px solid #eaeaea; padding-top: 15px; margin-top: 20px;">
          You received this email because you subscribed to receive notifications when this product dropped in price.
        </p>
      </div>
    `,
  },
};

export async function sendEmail({ to, template, data }: SendEmailOptions): Promise<boolean> {
  try {
    const transporter = await getTransporter();
    if (!transporter) {
      logger.info(`Email sending skipped (${template} to ${to}): SMTP not configured`);
      return false;
    }

    const emailTemplate = templates[template];
    if (!emailTemplate) {
      throw new Error(`Template ${template} not found`);
    }

    // Replace variables in subject
    let subject = emailTemplate.subject;
    Object.entries(data).forEach(([key, value]) => {
      subject = subject.replace(`\${${key}}`, String(value));
    });

    // Check for from address in settings, fall back to env
    let fromAddress = process.env.EMAIL_FROM;
    try {
      const fromSetting = await prisma.setting.findUnique({ where: { key: "email_from_address" } });
      const fromName = await prisma.setting.findUnique({ where: { key: "email_from_name" } });
      if (fromSetting?.value) {
        fromAddress = fromName?.value ? `"${fromName.value}" <${fromSetting.value}>` : fromSetting.value;
      }
    } catch {}

    await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      html: emailTemplate.html(data),
    });

    logger.info(`Email sent: ${template} to ${to}`);
    return true;
  } catch (error) {
    logger.error("Email send error", { error });
    return false;
  }
}

export async function sendOrderReceivedEmail(order: any) {
  const paymentMethodLabels: Record<string, string> = {
    CARD: "Credit/Debit Card",
    MOBILE_MONEY: "Mobile Money",
    PAYPAL: "PayPal",
    COD: "Cash on Delivery",
  };
  return sendEmail({
    to: order.customerEmail,
    template: "order-received",
    data: {
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      orderId: order.id,
      total: Number(order.totalAmount),
      paymentMethod: paymentMethodLabels[order.payments?.[0]?.method] || order.payments?.[0]?.method || "Card",
      items: order.items.map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        price: Number(item.price) * item.quantity,
      })),
    },
  });
}

export async function sendOrderConfirmation(order: any) {
  return sendEmail({
    to: order.customerEmail,
    template: "order-confirmation",
    data: {
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      orderId: order.id,
      total: Number(order.totalAmount),
      currency: order.currency || "UGX",
      paymentMethod: order.payments?.[0]?.method || "Card",
      items: order.items.map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        price: Number(item.price) * item.quantity,
      })),
    },
  });
}

export async function sendShippingNotification(order: any) {
  return sendEmail({
    to: order.customerEmail,
    template: "order-shipped",
    data: {
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      orderId: order.id,
      trackingNumber: order.trackingNumber,
      estimatedDelivery: "2-3 business days",
    },
  });
}

export async function sendWelcomeEmail(user: { email: string; name?: string }) {
  return sendEmail({
    to: user.email,
    template: "welcome",
    data: { name: user.name || "there" },
  });
}

export async function sendPasswordResetEmail(user: { email: string; name?: string }, token: string) {
  return sendEmail({
    to: user.email,
    template: "password-reset",
    data: { name: user.name || "there", token },
  });
}

export async function sendProcessingNotification(order: any) {
  return sendEmail({
    to: order.customerEmail,
    template: "order-processing",
    data: {
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      orderId: order.id,
      total: Number(order.totalAmount),
      currency: order.currency || "UGX",
    },
  });
}

export async function sendDeliveredNotification(order: any) {
  return sendEmail({
    to: order.customerEmail,
    template: "order-delivered",
    data: {
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      orderId: order.id,
      total: Number(order.totalAmount),
      currency: order.currency || "UGX",
    },
  });
}

export async function sendCancelledNotification(order: any, reason?: string) {
  return sendEmail({
    to: order.customerEmail,
    template: "order-cancelled",
    data: {
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      orderId: order.id,
      total: Number(order.totalAmount),
      currency: order.currency || "UGX",
      reason,
    },
  });
}

// ── Raw email sender (replaces services/email.ts sendEmail) ───────────
// Uses the dynamic DB-aware getTransporter() so admin UI SMTP config is always used.
export async function sendRawEmail(opts: { to: string; subject: string; html: string; text?: string }): Promise<boolean> {
  try {
    const transporter = await getTransporter();
    if (!transporter) {
      logger.info(`Email sending skipped (raw to ${opts.to}): SMTP not configured`);
      return false;
    }

    let fromAddress = process.env.EMAIL_FROM;
    try {
      const fromSetting = await prisma.setting.findUnique({ where: { key: "email_from_address" } });
      const fromName = await prisma.setting.findUnique({ where: { key: "email_from_name" } });
      if (fromSetting?.value) {
        fromAddress = fromName?.value ? `"${fromName.value}" <${fromSetting.value}>` : fromSetting.value;
      }
    } catch {}

    await transporter.sendMail({
      from: fromAddress,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      ...(opts.text ? { text: opts.text } : {}),
    });

    logger.info(`Raw email sent to ${opts.to}: ${opts.subject}`);
    return true;
  } catch (error) {
    logger.error("Raw email send error", { error });
    return false;
  }
}

// ── Verification email (ported from services/email.ts) ────────────────
export async function sendVerificationEmail(email: string, token: string, name?: string): Promise<boolean> {
  const BASE_URL = process.env.FRONTEND_URL || "http://localhost:3001";
  const verifyUrl = `${BASE_URL}/verify-email?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ec4899; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #ec4899; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Verify Your Email</h1>
        </div>
        <div class="content">
          <p>Hi${name ? ` ${name}` : ""},</p>
          <p>Thank you for creating an account with Pleasure Zone Uganda. Please verify your email address to access all features.</p>
          <p style="text-align: center;">
            <a href="${verifyUrl}" class="button">Verify Email Address</a>
          </p>
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all; color: #666;">${verifyUrl}</p>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create an account, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Pleasure Zone Uganda. All rights reserved.</p>
          <p>This email was sent to ${email}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendRawEmail({
    to: email,
    subject: "Verify Your Email - Pleasure Zone Uganda",
    html,
    text: `Verify your email by visiting: ${verifyUrl}`,
  });
}

// ── Newsletter welcome (ported from services/email.ts) ────────────────
export async function sendNewsletterWelcome(email: string): Promise<boolean> {
  const BASE_URL = process.env.FRONTEND_URL || "http://localhost:3001";
  const unsubscribeUrl = `${BASE_URL}/newsletter/unsubscribe?email=${encodeURIComponent(email)}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ec4899; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .discount { background: #fce7f3; border: 2px dashed #ec4899; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
        .code { font-size: 24px; font-weight: bold; color: #ec4899; }
        .button { display: inline-block; background: #ec4899; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>You're In!</h1>
        </div>
        <div class="content">
          <p>Thanks for subscribing to our newsletter!</p>
          <p>Here's a special welcome gift:</p>
          <div class="discount">
            <p>Use code</p>
            <p class="code">WELCOME10</p>
            <p>for 10% off your first order</p>
          </div>
          <p>You'll receive:</p>
          <p>Exclusive deals & flash sales</p>
          <p>New product announcements</p>
          <p>Tips & guides</p>
          <p style="text-align: center;">
            <a href="${BASE_URL}/products" class="button">Shop Now</a>
          </p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Pleasure Zone Uganda. All rights reserved.</p>
          <p><a href="${unsubscribeUrl}" style="color: #666;">Unsubscribe</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendRawEmail({
    to: email,
    subject: "Welcome! Here's 10% Off Your First Order",
    html,
    text: `Thanks for subscribing! Use code WELCOME10 for 10% off your first order. Shop at ${BASE_URL}/products`,
  });
}
