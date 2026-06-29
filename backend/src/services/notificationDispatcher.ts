import prisma from "../lib/prisma";
import { logger } from "../lib/logger";
import { sendEmail } from "../lib/email";
import { sendSMS } from "./sms";
import { sendWhatsApp } from "./whatsapp";
import { sendPushToUser } from "./push";
import { notificationQueue } from "../lib/queue";

type NotificationEvent =
  | "ORDER_RECEIVED"
  | "ORDER_PROCESSING"
  | "ORDER_SHIPPED"
  | "ORDER_DELIVERED"
  | "ORDER_CANCELLED"
  | "ORDER_REFUNDED";

interface DispatchOptions {
  event: NotificationEvent;
  recipientEmail?: string;
  recipientPhone?: string;
  recipientUserId?: string;
  orderId?: string;
  data: Record<string, any>;
}

// Maps events to email templates and setting keys
const eventConfig: Record<
  NotificationEvent,
  {
    emailTemplate: string;
    emailSettingKey: string;
    smsSettingKey: string;
    whatsappSettingKey: string;
    pushSettingKey: string;
    pushTitle: string;
    pushBody: (data: Record<string, any>) => string;
    smsBody: (data: Record<string, any>) => string;
    whatsappBody: (data: Record<string, any>) => string;
  }
> = {
  ORDER_RECEIVED: {
    emailTemplate: "order-received",
    emailSettingKey: "email_order_confirmation",
    smsSettingKey: "sms_order_confirmation",
    whatsappSettingKey: "whatsapp_order_confirmation",
    pushSettingKey: "push_order_confirmation",
    pushTitle: "Order Received!",
    pushBody: (d) => `Your order #${d.orderNumber} has been received. Total: UGX ${Number(d.total).toLocaleString()}`,
    smsBody: (d) => `Order #${d.orderNumber} confirmed! Total: UGX ${d.total}. Track at ugsex.com/track-order`,
    whatsappBody: (d) => `✅ Order Confirmed!\n\nOrder #${d.orderNumber}\nTotal: UGX ${d.total}\n\nThank you for shopping with us! We'll notify you when your order ships.\n\nTrack: https://ugsex.com/track-order`,
  },
  ORDER_PROCESSING: {
    emailTemplate: "order-processing",
    emailSettingKey: "email_order_confirmation",
    smsSettingKey: "sms_order_confirmation",
    whatsappSettingKey: "whatsapp_order_confirmation",
    pushSettingKey: "push_order_confirmation",
    pushTitle: "Order Being Processed",
    pushBody: (d) => `Your order #${d.orderNumber} is now being processed.`,
    smsBody: (d) => `Your order #${d.orderNumber} is being processed. We'll notify you when it ships.`,
    whatsappBody: (d) => `📋 Order Processing\n\nYour order #${d.orderNumber} is now being prepared for shipping.`,
  },
  ORDER_SHIPPED: {
    emailTemplate: "order-shipped",
    emailSettingKey: "email_shipping_updates",
    smsSettingKey: "sms_shipping_update",
    whatsappSettingKey: "whatsapp_shipping_update",
    pushSettingKey: "push_shipping_update",
    pushTitle: "Order Shipped!",
    pushBody: (d) => `Your order #${d.orderNumber} is on its way!`,
    smsBody: (d) => `Your order #${d.orderNumber} has been shipped! Track at ugsex.com/track-order`,
    whatsappBody: (d) => {
      const trackingText = d.trackingNumber ? `\nTracking: ${d.trackingNumber}` : "";
      return `📦 Order Shipped!\n\nYour order #${d.orderNumber} is on its way!${trackingText}\n\nTrack: https://ugsex.com/track-order`;
    },
  },
  ORDER_DELIVERED: {
    emailTemplate: "order-delivered",
    emailSettingKey: "email_shipping_updates",
    smsSettingKey: "sms_shipping_update",
    whatsappSettingKey: "whatsapp_delivery_confirmation",
    pushSettingKey: "push_delivery_update",
    pushTitle: "Order Delivered!",
    pushBody: (d) => `Your order #${d.orderNumber} has been delivered.`,
    smsBody: (d) => `Your order #${d.orderNumber} has been delivered! Thank you for shopping with us.`,
    whatsappBody: (d) => `🎉 Order Delivered!\n\nYour order #${d.orderNumber} has been delivered.\n\nWe hope you enjoy your purchase! Leave a review to help others.\n\nhttps://ugsex.com/orders`,
  },
  ORDER_CANCELLED: {
    emailTemplate: "order-cancelled",
    emailSettingKey: "email_order_confirmation",
    smsSettingKey: "sms_order_confirmation",
    whatsappSettingKey: "whatsapp_order_confirmation",
    pushSettingKey: "push_order_confirmation",
    pushTitle: "Order Cancelled",
    pushBody: (d) => `Your order #${d.orderNumber} has been cancelled.${d.reason ? ` Reason: ${d.reason}` : ""}`,
    smsBody: (d) => `Your order #${d.orderNumber} has been cancelled.${d.reason ? ` Reason: ${d.reason}` : ""} Contact us if you have questions.`,
    whatsappBody: (d) => `❌ Order Cancelled\n\nYour order #${d.orderNumber} has been cancelled.${d.reason ? `\nReason: ${d.reason}` : ""}\n\nPlease contact support if you have questions.`,
  },
  ORDER_REFUNDED: {
    emailTemplate: "order-refunded",
    emailSettingKey: "email_order_confirmation",
    smsSettingKey: "sms_order_confirmation",
    whatsappSettingKey: "whatsapp_order_confirmation",
    pushSettingKey: "push_order_confirmation",
    pushTitle: "Refund Processed",
    pushBody: (d) => `Your refund of ${d.currency || 'UGX'} ${Number(d.refundAmount).toLocaleString()} for order #${d.orderNumber} has been processed.`,
    smsBody: (d) => `Refund of ${d.currency || 'UGX'} ${d.refundAmount} for order #${d.orderNumber} has been processed. Contact us if you have questions.`,
    whatsappBody: (d) => `💰 Refund Processed\n\nA refund of ${d.currency || 'UGX'} ${Number(d.refundAmount).toLocaleString()} for order #${d.orderNumber} has been processed.\n\n${d.reason ? `Reason: ${d.reason}\n\n` : ""}Please allow 3-5 business days for the refund to reflect.`,
  },
};

async function logNotification(
  event: string,
  channel: string,
  recipient: string,
  status: "SUCCESS" | "FAILED" | "SKIPPED",
  orderId?: string,
  userId?: string,
  subject?: string,
  error?: string,
  metadata?: Record<string, any>
) {
  try {
    await prisma.notificationLog.create({
      data: { event, channel, recipient, status, orderId, userId, subject, error, metadata: metadata || undefined },
    });
  } catch (e: any) {
    logger.error("Failed to write notification log", { error: e.message });
  }
}

// Load multiple settings in one query
async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const settings = await prisma.setting.findMany({
    where: { key: { in: keys } },
  });
  return Object.fromEntries(settings.map((s) => [s.key, s.value]));
}

export async function dispatch(opts: DispatchOptions): Promise<void> {
  const { event, recipientEmail, recipientPhone, recipientUserId, orderId, data } = opts;
  const config = eventConfig[event];
  if (!config) {
    logger.warn("Unknown notification event", { event });
    return;
  }

  // Load all needed settings in one batch
  const settingKeys = [
    config.emailSettingKey,
    config.smsSettingKey,
    config.whatsappSettingKey,
    config.pushSettingKey,
    "sms_enabled",
    "whatsapp_enabled",
  ];
  const settings = await getSettings(settingKeys);

  // EMAIL
  if (recipientEmail) {
    const enabled = settings[config.emailSettingKey];
    if (enabled === "false") {
      await logNotification(event, "EMAIL", recipientEmail, "SKIPPED", orderId, recipientUserId, config.emailTemplate, "Disabled by setting");
    } else {
      try {
        const result = await sendEmail({
          to: recipientEmail,
          template: config.emailTemplate as any,
          data,
        });
        await logNotification(
          event, "EMAIL", recipientEmail,
          result ? "SUCCESS" : "FAILED",
          orderId, recipientUserId, config.emailTemplate,
          result ? undefined : "sendEmail returned false"
        );
      } catch (e: any) {
        await logNotification(event, "EMAIL", recipientEmail, "FAILED", orderId, recipientUserId, config.emailTemplate, e.message);
      }
    }
  }

  // SMS
  if (recipientPhone) {
    const smsEnabled = settings["sms_enabled"];
    const channelEnabled = settings[config.smsSettingKey];
    if (smsEnabled !== "true" || channelEnabled === "false") {
      await logNotification(event, "SMS", recipientPhone, "SKIPPED", orderId, recipientUserId, undefined, "Disabled by setting");
    } else {
      try {
        const msg = config.smsBody(data);
        const result = await sendSMS(recipientPhone, msg);
        await logNotification(event, "SMS", recipientPhone, result ? "SUCCESS" : "FAILED", orderId, recipientUserId, undefined, result ? undefined : "sendSMS returned false");
      } catch (e: any) {
        await logNotification(event, "SMS", recipientPhone, "FAILED", orderId, recipientUserId, undefined, e.message);
      }
    }
  }

  // WHATSAPP
  if (recipientPhone) {
    const waEnabled = settings["whatsapp_enabled"];
    const channelEnabled = settings[config.whatsappSettingKey];
    if (waEnabled !== "true" || channelEnabled === "false") {
      await logNotification(event, "WHATSAPP", recipientPhone, "SKIPPED", orderId, recipientUserId, undefined, "Disabled by setting");
    } else {
      try {
        const msg = config.whatsappBody(data);
        const result = await sendWhatsApp({ to: recipientPhone, text: msg });
        await logNotification(event, "WHATSAPP", recipientPhone, result ? "SUCCESS" : "FAILED", orderId, recipientUserId, undefined, result ? undefined : "sendWhatsApp returned false");
      } catch (e: any) {
        await logNotification(event, "WHATSAPP", recipientPhone, "FAILED", orderId, recipientUserId, undefined, e.message);
      }
    }
  }

  // PUSH
  if (recipientUserId) {
    const pushEnabled = settings[config.pushSettingKey];
    if (pushEnabled === "false") {
      await logNotification(event, "PUSH", recipientUserId, "SKIPPED", orderId, recipientUserId, config.pushTitle, "Disabled by setting");
    } else {
      try {
        const result = await sendPushToUser(recipientUserId, {
          title: config.pushTitle,
          body: config.pushBody(data),
          url: orderId ? `/account/orders/${orderId}` : "/",
        });
        await logNotification(
          event, "PUSH", recipientUserId,
          result ? "SUCCESS" : "SKIPPED",
          orderId, recipientUserId, config.pushTitle,
          result ? undefined : "No push subscriptions"
        );
      } catch (e: any) {
        await logNotification(event, "PUSH", recipientUserId, "FAILED", orderId, recipientUserId, config.pushTitle, e.message);
      }
    }
  }
}

/**
 * Enqueue a notification to be sent asynchronously via BullMQ.
 * Use this instead of `dispatch()` for order-critical paths so a notification
 * provider outage does not block the request or lose the notification.
 */
export async function enqueueNotification(opts: DispatchOptions): Promise<void> {
  try {
    await notificationQueue.add(opts.event, opts, {
      jobId: opts.orderId ? `${opts.event}:${opts.orderId}` : undefined,
    });
  } catch (error: any) {
    logger.error("Failed to enqueue notification", { error: error.message, event: opts.event, orderId: opts.orderId });
    // Fall back to synchronous dispatch so the customer is not left without notice.
    await dispatch(opts);
  }
}
