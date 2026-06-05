import prisma from "../lib/prisma";
import { logger } from "../lib/logger";

async function getSetting(key: string): Promise<string | null> {
  const s = await prisma.setting.findUnique({ where: { key } });
  return s?.value || null;
}

export async function sendSMS(to: string, message: string): Promise<boolean> {
  try {
    const enabled = await getSetting("sms_enabled");
    if (enabled !== "true") return false;

    const username = await getSetting("sms_at_username");
    const apiKey = await getSetting("sms_at_api_key");
    const senderId = await getSetting("sms_sender_id");

    if (!username || !apiKey) {
      logger.warn("SMS not configured: missing Africa's Talking credentials");
      return false;
    }

    // Format phone number - ensure +256 format for Uganda
    let phone = to.replace(/[^0-9+]/g, "");
    if (phone.startsWith("0")) phone = "+256" + phone.slice(1);
    if (!phone.startsWith("+")) phone = "+" + phone;

    // Africa's Talking API
    const baseUrl = username === "sandbox"
      ? "https://api.sandbox.africastalking.com/version1/messaging"
      : "https://api.africastalking.com/version1/messaging";

    const params = new URLSearchParams({
      username,
      to: phone,
      message,
      ...(senderId ? { from: senderId } : {}),
    });

    const res = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "apiKey": apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      logger.error("SMS API error", { status: res.status, body: err });
      return false;
    }

    const data = await res.json();
    const recipients = data?.SMSMessageData?.Recipients || [];
    const success = recipients.some((r: any) => r.status === "Success");

    if (success) {
      logger.info("SMS sent to", { detail: phone });
    } else {
      logger.warn("SMS delivery issue", { recipients: JSON.stringify(recipients) });
    }

    return success;
  } catch (e: any) {
    logger.error("SMS send error", { error: e.message });
    return false;
  }
}

// Convenience functions
export async function sendOrderConfirmationSMS(phone: string, orderNumber: string, total: string) {
  const enabled = await getSetting("sms_order_confirmation");
  if (enabled !== "true") return;

  return sendSMS(phone, `Order #${orderNumber} confirmed! Total: UGX ${total}. Track at ugsex.com/track-order`);
}

export async function sendShippingUpdateSMS(phone: string, orderNumber: string) {
  const enabled = await getSetting("sms_shipping_update");
  if (enabled !== "true") return;

  return sendSMS(phone, `Your order #${orderNumber} has been shipped! Track at ugsex.com/track-order`);
}
