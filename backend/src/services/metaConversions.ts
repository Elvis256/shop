import prisma from "../lib/prisma";
import crypto from "crypto";
import { logger } from "../lib/logger";

async function getSetting(key: string): Promise<string | null> {
  const s = await prisma.setting.findUnique({ where: { key } });
  return s?.value || null;
}

function hashForMeta(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

interface MetaEvent {
  eventName: string; // Purchase, AddToCart, InitiateCheckout, ViewContent
  eventTime?: number;
  userData?: {
    email?: string;
    phone?: string;
    ip?: string;
    userAgent?: string;
  };
  customData?: {
    value?: number;
    currency?: string;
    contentIds?: string[];
    contentType?: string;
    numItems?: number;
    orderId?: string;
  };
  eventSourceUrl?: string;
}

export async function sendMetaConversionEvent(event: MetaEvent): Promise<boolean> {
  try {
    const enabled = await getSetting("tracking_fb_conversions_api_enabled");
    if (enabled !== "true") return false;

    const pixelId = await getSetting("tracking_fb_pixel_id");
    const accessToken = await getSetting("tracking_fb_conversions_api_token");

    if (!pixelId || !accessToken) return false;

    const eventData: any = {
      event_name: event.eventName,
      event_time: event.eventTime || Math.floor(Date.now() / 1000),
      action_source: "website",
      event_source_url: event.eventSourceUrl || "https://ugsex.com",
      user_data: {},
    };

    if (event.userData?.email) eventData.user_data.em = [hashForMeta(event.userData.email)];
    if (event.userData?.phone) eventData.user_data.ph = [hashForMeta(event.userData.phone)];
    if (event.userData?.ip) eventData.user_data.client_ip_address = event.userData.ip;
    if (event.userData?.userAgent) eventData.user_data.client_user_agent = event.userData.userAgent;

    if (event.customData) {
      eventData.custom_data = {
        value: event.customData.value,
        currency: event.customData.currency || "UGX",
        content_ids: event.customData.contentIds,
        content_type: event.customData.contentType || "product",
        num_items: event.customData.numItems,
        order_id: event.customData.orderId,
      };
    }

    const url = `https://graph.facebook.com/v18.0/${pixelId}/events`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [eventData],
        access_token: accessToken,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      logger.error("Meta Conversions API error", { status: res.status, body: err });
      return false;
    }

    return true;
  } catch (e: any) {
    logger.error("Meta Conversions error", { error: e.message });
    return false;
  }
}
