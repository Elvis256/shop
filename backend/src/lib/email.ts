import nodemailer from "nodemailer";

function isSmtpConfigured(): boolean {
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  if (!user || !pass) return false;
  if (user.includes("your-") || user.includes("change_this") || pass.includes("your-") || pass.includes("change_this")) return false;
  return true;
}

const smtpReady = isSmtpConfigured();
if (!smtpReady) {
  console.warn("⚠️  Email sending disabled: SMTP credentials not configured (placeholder values detected)");
}

const transporter = smtpReady
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

type EmailTemplate = "welcome" | "order-received" | "order-confirmation" | "order-shipped" | "order-processing" | "order-delivered" | "order-cancelled" | "password-reset" | "seller-approved" | "seller-rejected" | "seller-warning";

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
        ${data.paymentMethod === "COD" ? '<p style="color: #2a2a2a; font-weight: bold;">💰 Please have the exact amount ready at delivery.</p>' : ""}
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
          <p><strong>Total:</strong> KES ${data.total.toLocaleString()}</p>
          <p><strong>Payment Method:</strong> ${data.paymentMethod}</p>
        </div>
        <h3>Items:</h3>
        <ul>
          ${data.items.map((item: any) => `<li>${item.name} x ${item.quantity} - KES ${item.price.toLocaleString()}</li>`).join("")}
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
          <p><strong>Total:</strong> KES ${Number(data.total).toLocaleString()}</p>
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
          <p><strong>Total:</strong> KES ${Number(data.total).toLocaleString()}</p>
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
          <p><strong>Total:</strong> KES ${Number(data.total).toLocaleString()}</p>
        </div>
        ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ""}
        <p>If you believe this is an error or have questions, please contact our support team.</p>
        <a href="${process.env.BASE_URL}/account/orders" style="display: inline-block; padding: 12px 24px; background: #2a2a2a; color: white; text-decoration: none; border-radius: 4px;">View Orders</a>
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
};

export async function sendEmail({ to, template, data }: SendEmailOptions): Promise<boolean> {
  try {
    if (!transporter) {
      console.log(`📧 Email sending skipped (${template} to ${to}): SMTP not configured`);
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

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html: emailTemplate.html(data),
    });

    console.log(`📧 Email sent: ${template} to ${to}`);
    return true;
  } catch (error) {
    console.error("Email send error:", error);
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
      reason,
    },
  });
}
