/**
 * Minimal i18n for the customer Telegram bot.
 *
 * Currently English-only, but typed so we can drop in Luganda / Swahili later
 * (the WhatsApp bot already ships those translations — see services/whatsapp).
 *
 * Adding a language: extend `Locale`, then fill each key in the same shape.
 */
export type Locale = "en";

export const DEFAULT_LOCALE: Locale = "en";

type Dict = Record<string, string | ((vars: any) => string)>;

const en: Dict = {
  // Age gate
  ageGatePrompt:
    "🔞 *Welcome to Ug Connect*\n\n" +
    "This bot sells adult wellness products. *You must be 18 years or older to continue.*\n\n" +
    "By tapping *I'm 18+*, you confirm you meet the legal age in your country to view and buy these products.",
  ageGateAccept: "✅ I'm 18+",
  ageGateDecline: "❌ I'm under 18",
  ageGateAccepted:
    "Thanks — confirmed. 🔒\n\n" +
    "Everything stays discreet: plain packaging, no product names on receipts, no public posts on your behalf.\n\n" +
    "Tap *Menu* to start.",
  ageGateDeclined:
    "Sorry — you can't use this bot. " +
    "If this was a mistake, send /start again.",

  // Privacy
  privacyShort:
    "🔒 *Privacy*\n" +
    "We store only your Telegram chat ID and any phone number you choose to link to your account. " +
    "Order details stay on ugsex.com — we send you links, not card numbers. " +
    "Use /unlink any time to disconnect, or /delete to remove your bot record.",

  // Main menu / help
  helpHeader: "🛍️ *Ug Connect — commands*",
  helpBody:
    "• /start — main menu\n" +
    "• /shop — browse categories\n" +
    "• /search `term` — find products\n" +
    "• /orders — your recent orders *(coming soon)*\n" +
    "• /track `ORDER_NUMBER` — order status *(coming soon)*\n" +
    "• /link — connect your ugsex.com account\n" +
    "• /unlink — disconnect this Telegram from your account\n" +
    "• /privacy — how we handle your data\n" +
    "• /delete — wipe your record from this bot\n" +
    "• /help — this list",
  menuButton: "📋 Menu",
  shopButton: "🛍️ Shop",
  ordersButton: "📦 My orders",
  linkButton: "🔗 Link account",
  supportButton: "💬 Support",

  // Shop & Search
  shopCategorySelect: "🗂️ *Categories*\n\nSelect a category to browse products:",
  shopNoCategories: "No categories found.",
  shopProductsHeader: (vars: { category: string; page: number; totalPages: number }) =>
    `🛍️ *${vars.category}*\n\nPage ${vars.page + 1} of ${vars.totalPages}:`,
  shopNoProducts: "No products found in this category.",
  searchPrompt: "🔍 *Search*\n\nPlease type your search term, e.g. `/search massage`.",
  searchResultsHeader: (vars: { query: string; page: number; totalPages: number }) =>
    `🔍 *Search Results: "${vars.query}"*\n\nPage ${vars.page + 1} of ${vars.totalPages}:`,
  searchNoResults: (vars: { query: string }) =>
    `❌ No products found matching *"${vars.query}"*.`,

  // Link flow
  linkPromptPhone:
    "🔗 *Link your ugsex.com account*\n\n" +
    "Tap *Share my number* below (Telegram only sends it to this bot — not to ugsex.com or anyone else).\n\n" +
    "If the number matches an existing ugsex.com account we'll send you a 6-digit code to confirm.",
  linkSharePhoneButton: "📱 Share my number",
  linkCancelButton: "Cancel",
  linkPromptManualPhone:
    "OK — please type your phone number including country code, e.g. `+256700000000`.",
  linkPhoneInvalid:
    "That doesn't look like a valid phone number. " +
    "Use international format like `+256700000000`, or tap /cancel.",
  linkNoMatch:
    "No ugsex.com account matched that phone. " +
    "Sign up first at https://ugsex.com/auth/register, then run /link again.",
  linkCodeSent:
    "📩 Code sent to your account's phone. " +
    "Enter the 6-digit code here, or tap /cancel.",
  linkCodeInvalid: "❌ Wrong code. Try again, or /cancel.",
  linkCodeExpired: "⏰ Code expired. Run /link again.",
  linkCodeRateLimited:
    "🚫 Too many attempts. Try again in 30 minutes.",
  linkSuccess: (vars: { name: string }) =>
    `✅ *Linked!* Welcome, ${vars.name}.\n\n` +
    `You'll now get order updates here. ` +
    `Use /orders to list your purchases or /shop to browse.`,
  linkAlreadyLinked: (vars: { name: string }) =>
    `You're already linked as *${vars.name}*. Use /unlink to switch accounts.`,
  linkConflict:
    "⚠️ That account is already linked to a different Telegram chat. " +
    "Unlink it there first, then try again.",
  linkCancelled: "Link cancelled.",

  // Unlink
  unlinkConfirm:
    "Are you sure you want to unlink your ugsex.com account from this Telegram chat? " +
    "You'll stop receiving order updates here.",
  unlinkConfirmButton: "Yes, unlink",
  unlinkNotLinked: "Nothing to unlink — this chat isn't connected to any account.",
  unlinkDone:
    "🔓 Account unlinked. Your Telegram and ugsex.com are now separate again. " +
    "Run /link any time to reconnect.",

  // Delete
  deleteConfirm:
    "⚠️ This will delete your bot record (chat ID, link, preferences). " +
    "Your ugsex.com account is *not* deleted. Continue?",
  deleteConfirmButton: "Yes, delete my bot record",
  deleteDone:
    "🗑️ Done — all bot data for this chat has been wiped. " +
    "Send /start any time to use the bot again.",

  // Generic
  cancelButton: "Cancel",
  unknown:
    "I didn't understand that. Tap /help for the list of commands.",
  blocked:
    "🚫 Your access to this bot is currently blocked. Contact support@ugsex.com if you think this is a mistake.",
  internalError:
    "Something went wrong on my side. Try again in a moment — if it keeps failing, message support@ugsex.com.",

  // Cart
  cartTitle: "🛒 *Your Cart*\n\n",
  cartEmpty: "Your cart is empty. Send /shop to browse our catalog.",
  cartItemLine: (vars: { name: string; quantity: number; price: string; total: string }) =>
    `• *${vars.name}*\n  Qty: ${vars.quantity} × ${vars.price} = *${vars.total}*\n`,
  cartTotalLine: (vars: { total: string }) =>
    `\n-------------------\n*Total: ${vars.total}*\n`,
  cartInstruction: "\nTap an item button below to adjust its quantity or remove it.",
  cartClearButton: "🗑️ Clear Cart",
  cartCheckoutButton: "🛒 Checkout",
  cartEditTitle: (vars: { name: string }) =>
    `✏️ *Edit Cart Item*\n\n*${vars.name}*`,
  cartEditInfo: (vars: { price: string; quantity: number; total: string }) =>
    `\nPrice: ${vars.price}\nQuantity: ${vars.quantity}\nSubtotal: *${vars.total}*`,
  cartDecButton: "➖ Decrease",
  cartIncButton: "➕ Increase",
  cartRemoveButton: "🗑️ Remove Item",
  cartBackButton: "🔙 Back to Cart",
  cartItemRemoved: "Item removed from cart.",
  cartCleared: "Cart cleared.",
  cartAddSuccess: "Added to cart!",

  // Checkout
  checkoutEmpty: "Your cart is empty. Add items first.",
  checkoutSelectAddress: "🚚 *Delivery Address*\n\nPlease select a saved address or enter custom details:",
  checkoutCustomAddressButton: "✏️ Enter Custom Address",
  checkoutAwaitingDetails:
    "✍️ *Delivery Details*\n\nPlease send your delivery details in a *single message*. Copy, paste, and edit this format:\n\n" +
    "`John Doe`\n" +
    "`0770000000`\n" +
    "`Plot 12 Kampala Road`\n" +
    "`Kampala`\n\n" +
    "_Please write each detail on a new line (Name, Phone, Street, and City)._",
  checkoutDetailsInvalid:
    "⚠️ *Invalid Format*\n\n" +
    "I couldn't parse that. Please write at least 3 lines:\n" +
    "1. Name\n" +
    "2. Phone\n" +
    "3. Street Address\n" +
    "4. City (optional)\n\n" +
    "Please try again or tap /cancel.",
  checkoutAwaitingName: "👤 *Recipient Name*\n\nPlease type the recipient's full name:",
  checkoutAwaitingPhone: "📱 *Recipient Phone*\n\nPlease type the delivery phone number (e.g. 0770000000 or +256770000000):",
  checkoutAwaitingStreet: "🏠 *Street Address*\n\nPlease type the street address / landmark details:",
  checkoutAwaitingCity: "🏙️ *City*\n\nPlease type the delivery city (e.g. Kampala):",
  checkoutSelectPayment: "💳 *Payment Method*\n\nChoose your preferred payment method:",
  checkoutAwaitingMomoPhone: "📱 *Mobile Money Phone*\n\nPlease enter the phone number to charge (e.g. 0770000000 or +256770000000):",
  checkoutReviewTitle: "📋 *Order Review*\n\nPlease confirm your order details below:\n\n",
  checkoutReviewItems: "📦 *Items:*\n",
  checkoutReviewSummary: (vars: { subtotal: string; shipping: string; total: string; name: string; phone: string; address: string; payment: string }) =>
    `💰 *Subtotal:* ${vars.subtotal}\n` +
    `🚚 *Shipping:* ${vars.shipping}\n` +
    `💵 *Total:* ${vars.total}\n\n` +
    `📬 *Deliver To:* ${vars.name} (${vars.phone})\n` +
    `📍 *Address:* ${vars.address}\n` +
    `💳 *Payment:* ${vars.payment}`,
  checkoutConfirmButton: "✅ Place Order",
  checkoutCancelButton: "❌ Cancel Checkout",
  checkoutSuccessCOD: (vars: { orderNumber: string; total: string }) =>
    `✅ *Order Placed!*\n\n` +
    `🔢 Order #: *${vars.orderNumber}*\n` +
    `💰 Total: *${vars.total}*\n` +
    `💳 Payment: *Cash on Delivery*\n\n` +
    `We'll package and deliver your order discreetly. 🔒`,
  checkoutSuccessMoMo: (vars: { orderNumber: string; total: string; network: string }) =>
    `📱 *Payment Initiated!*\n\n` +
    `🔢 Order #: *${vars.orderNumber}*\n` +
    `💰 Total: *${vars.total}*\n` +
    `💳 Payment: *${vars.network} Mobile Money*\n\n` +
    `Check your phone for the PIN prompt to complete payment. We'll send order updates here. 🔒`,
  checkoutSuccessMoMoFailed: (vars: { orderNumber: string }) =>
    `⚠️ *Payment Prompt Failed*\n\n` +
    `We saved order *${vars.orderNumber}*, but could not trigger the MoMo prompt. ` +
    `Please contact support or retry payment from your orders. /orders`,
  checkoutCancelled: "Checkout cancelled.",

  // Orders
  ordersTitle: "📦 *Your Recent Orders*\n\n",
  ordersEmpty: "You haven't placed any orders yet. Send /shop to start shopping.",
  ordersItemLine: (vars: { orderNumber: string; date: string; status: string; total: string }) =>
    `• *${vars.orderNumber}* (${vars.date})\n` +
    `  Status: *${vars.status}* | Total: *${vars.total}*\n`,
  ordersTrackButton: (vars: { orderNumber: string }) => `🔍 Track ${vars.orderNumber}`,
  orderTrackingTitle: (vars: { orderNumber: string; status: string }) =>
    `📦 *Order Tracking: ${vars.orderNumber}*\n` +
    `Current Status: *${vars.status}*\n\n` +
    `🕒 *Timeline:*\n`,
  orderTrackingEvent: (vars: { date: string; status: string; note: string }) =>
    `• *${vars.date}* - *${vars.status}*\n` +
    `  ${vars.note}\n`,
  orderTrackingNoEvents: "No status history found.",
  orderTrackingDeliveryCode: (vars: { code: string }) => `🚚 Delivery Tracking Code: \`${vars.code}\`\n`,
};

const dicts: Record<Locale, Dict> = { en };

export function t(
  locale: Locale,
  key: keyof typeof en,
  vars?: Record<string, any>
): string {
  const dict = dicts[locale] || dicts[DEFAULT_LOCALE];
  const entry = dict[key as string] ?? en[key as string];
  if (typeof entry === "function") return entry(vars || {});
  return entry || String(key);
}
