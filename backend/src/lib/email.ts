import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

type EmailTemplate = "welcome" | "order-confirmation" | "order-shipped" | "password-reset";

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
