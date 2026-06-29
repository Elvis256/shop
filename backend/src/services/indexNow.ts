import { logger } from "../lib/logger";

const SITE_URL = process.env.SITE_URL || process.env.FRONTEND_URL || "https://ugsex.com";
const INDEXNOW_KEY = process.env.INDEXNOW_KEY;

/**
 * Submit URLs to IndexNow for instant indexing on Bing, Yandex, and other search engines.
 * Call this when products, blog posts, or categories are created/updated.
 */
export async function submitToIndexNow(urls: string[]): Promise<void> {
  if (!INDEXNOW_KEY) {
    return; // IndexNow not configured
  }

  const fullUrls = urls.map((url) =>
    url.startsWith("http") ? url : `${SITE_URL}${url}`
  );

  try {
    const response = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: new URL(SITE_URL).hostname,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: fullUrls,
      }),
    });

    if (response.ok || response.status === 202) {
      logger.info("indexnow_submitted", { count: fullUrls.length });
    } else {
      logger.warn("indexnow_failed", {
        status: response.status,
        body: await response.text().catch(() => ""),
      });
    }
  } catch (err: any) {
    logger.warn("indexnow_error", { error: err.message });
  }
}

/**
 * Notify IndexNow about a product change
 */
export function notifyProductChange(slug: string) {
  submitToIndexNow([`/product/${slug}`]).catch(() => {});
}

/**
 * Notify IndexNow about a blog post change
 */
export function notifyBlogChange(slug: string) {
  submitToIndexNow([`/blog/${slug}`]).catch(() => {});
}

/**
 * Notify IndexNow about a category change
 */
export function notifyCategoryChange(slug: string) {
  submitToIndexNow([`/category/${slug}`]).catch(() => {});
}
