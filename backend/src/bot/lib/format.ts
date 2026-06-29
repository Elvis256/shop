export function formatCurrency(amount: any, currency = "UGX"): string {
  const val =
    amount && typeof amount === "object" && "toNumber" in amount
      ? (amount as any).toNumber()
      : Number(amount);
  const safeVal = isNaN(val) ? 0 : val;
  return `${currency} ${safeVal.toLocaleString()}`;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
