import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@pleasurezone.ug";
const FROM_NAME = process.env.FROM_NAME || "Pleasure Zone Uganda";
const BASE_URL = process.env.FRONTEND_URL || "http://localhost:3001";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

export async function sendVerificationEmail(email: string, token: string, name?: string): Promise<boolean> {
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
          <p>© ${new Date().getFullYear()} Pleasure Zone Uganda. All rights reserved.</p>
          <p>This email was sent to ${email}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: "Verify Your Email - Pleasure Zone Uganda",
    html,
    text: `Verify your email by visiting: ${verifyUrl}`,
  });
}

export async function sendWelcomeEmail(email: string, name?: string): Promise<boolean> {
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
        .features { margin: 20px 0; }
        .feature { display: flex; align-items: center; margin: 10px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Pleasure Zone Uganda!</h1>
        </div>
        <div class="content">
          <p>Hi${name ? ` ${name}` : ""},</p>
          <p>Your email has been verified! Welcome to Kenya's premier adult wellness store.</p>
          
          <div class="features">
            <p><strong>What you can enjoy:</strong></p>
            <p>✅ 100% Discreet Packaging - Plain boxes, no logos</p>
            <p>✅ Secure Payments - M-Pesa & Card accepted</p>
            <p>✅ Fast Delivery - Same-day in Nairobi</p>
            <p>✅ 24/7 Support - We're here to help</p>
          </div>
          
          <p style="text-align: center;">
            <a href="${BASE_URL}/products" class="button">Start Shopping</a>
          </p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Pleasure Zone Uganda. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: "Welcome to Pleasure Zone Uganda!",
    html,
    text: `Welcome to Pleasure Zone Uganda! Start shopping at ${BASE_URL}/products`,
  });
}

export async function sendOrderConfirmation(
  email: string,
  orderNumber: string,
  items: { name: string; quantity: number; price: number }[],
  total: number,
  name?: string
): Promise<boolean> {
  const itemsHtml = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">KES ${item.price.toLocaleString()}</td>
      </tr>
    `
    )
    .join("");

  const trackUrl = `${BASE_URL}/orders/${orderNumber}`;

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
        table { width: 100%; border-collapse: collapse; }
        th { background: #eee; padding: 10px; text-align: left; }
        .total { font-size: 18px; font-weight: bold; margin-top: 20px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Order Confirmed!</h1>
          <p>Order #${orderNumber}</p>
        </div>
        <div class="content">
          <p>Hi${name ? ` ${name}` : ""},</p>
          <p>Thank you for your order! We're preparing it for discreet shipment.</p>
          
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <p class="total" style="text-align: right;">Total: KES ${total.toLocaleString()}</p>
          
          <p style="text-align: center;">
            <a href="${trackUrl}" class="button">Track Your Order</a>
          </p>
          
          <p style="text-align: center; color: #666;">
            📦 Your order will arrive in plain, discreet packaging
          </p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Pleasure Zone Uganda. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `Order Confirmed - #${orderNumber}`,
    html,
    text: `Your order #${orderNumber} has been confirmed. Total: KES ${total.toLocaleString()}. Track at: ${trackUrl}`,
  });
}

export async function sendNewsletterWelcome(email: string): Promise<boolean> {
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
          <h1>You're In! 🎉</h1>
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
          <p>✨ Exclusive deals & flash sales</p>
          <p>🆕 New product announcements</p>
          <p>💡 Tips & guides</p>
          
          <p style="text-align: center;">
            <a href="${BASE_URL}/products" class="button">Shop Now</a>
          </p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Pleasure Zone Uganda. All rights reserved.</p>
          <p><a href="${unsubscribeUrl}" style="color: #666;">Unsubscribe</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: "Welcome! Here's 10% Off Your First Order",
    html,
    text: `Thanks for subscribing! Use code WELCOME10 for 10% off your first order. Shop at ${BASE_URL}/products`,
  });
}
