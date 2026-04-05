import prisma from "../lib/prisma";

async function getSetting(key: string): Promise<string | null> {
  const s = await prisma.setting.findUnique({ where: { key } });
  return s?.value || null;
}

interface WhatsAppMessage {
  to: string; // phone number with country code, e.g. "256700000000"
  template?: string;
  text?: string;
  parameters?: Record<string, string>;
}

export async function sendWhatsApp(msg: WhatsAppMessage): Promise<boolean> {
  try {
    const enabled = await getSetting("whatsapp_enabled");
    if (enabled !== "true") return false;

    const apiUrl = await getSetting("whatsapp_api_url");
    const token = await getSetting("whatsapp_api_token");
    const phoneNumberId = await getSetting("whatsapp_phone_number_id");

    if (!apiUrl || !token || !phoneNumberId) {
      console.warn("WhatsApp not configured: missing API URL, token, or phone number ID");
      return false;
    }

    // Format phone number - ensure it starts with country code, no +
    const phone = msg.to.replace(/[^0-9]/g, "");

    const body = msg.template ? {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: msg.template,
        language: { code: "en" },
        components: msg.parameters ? [{
          type: "body",
          parameters: Object.values(msg.parameters).map(v => ({ type: "text", text: v }))
        }] : undefined,
      }
    } : {
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: msg.text || "" }
    };

    const url = `${apiUrl}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("WhatsApp API error:", res.status, err);
      return false;
    }

    console.log("WhatsApp message sent to", phone);
    return true;
  } catch (e: any) {
    console.error("WhatsApp send error:", e.message);
    return false;
  }
}

// Convenience functions for order events
export async function sendOrderConfirmationWhatsApp(phone: string, orderNumber: string, total: string) {
  const enabled = await getSetting("whatsapp_order_confirmation");
  if (enabled !== "true") return;

  return sendWhatsApp({
    to: phone,
    text: `✅ Order Confirmed!\n\nOrder #${orderNumber}\nTotal: UGX ${total}\n\nThank you for shopping with us! We'll notify you when your order ships.\n\nTrack: https://ugsex.com/track-order`,
  });
}

export async function sendShippingUpdateWhatsApp(phone: string, orderNumber: string, trackingNumber?: string) {
  const enabled = await getSetting("whatsapp_shipping_update");
  if (enabled !== "true") return;

  const trackingText = trackingNumber ? `\nTracking: ${trackingNumber}` : "";
  return sendWhatsApp({
    to: phone,
    text: `📦 Order Shipped!\n\nYour order #${orderNumber} is on its way!${trackingText}\n\nTrack: https://ugsex.com/track-order`,
  });
}

export async function sendDeliveryConfirmationWhatsApp(phone: string, orderNumber: string) {
  const enabled = await getSetting("whatsapp_delivery_confirmation");
  if (enabled !== "true") return;

  return sendWhatsApp({
    to: phone,
    text: `🎉 Order Delivered!\n\nYour order #${orderNumber} has been delivered.\n\nWe hope you enjoy your purchase! Leave a review to help others.\n\nhttps://ugsex.com/orders`,
  });
}
