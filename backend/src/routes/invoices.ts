import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// Generate invoice HTML
const generateInvoiceHtml = (order: Record<string, unknown>, items: Array<Record<string, unknown>>) => {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return `${currency} ${Number(amount).toLocaleString()}`;
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${order.orderNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1d1d1f; line-height: 1.6; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid #e5e5e5; }
    .logo { font-size: 24px; font-weight: 600; color: #0071e3; }
    .invoice-title { text-align: right; }
    .invoice-title h1 { font-size: 28px; font-weight: 600; margin-bottom: 5px; }
    .invoice-title p { color: #86868b; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
    .info-section h3 { font-size: 12px; text-transform: uppercase; color: #86868b; margin-bottom: 10px; letter-spacing: 0.5px; }
    .info-section p { margin-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    th { text-align: left; padding: 12px 0; border-bottom: 2px solid #1d1d1f; font-size: 12px; text-transform: uppercase; color: #86868b; letter-spacing: 0.5px; }
    td { padding: 16px 0; border-bottom: 1px solid #e5e5e5; }
    .item-name { font-weight: 500; }
    .text-right { text-align: right; }
    .totals { margin-left: auto; width: 300px; }
    .totals-row { display: flex; justify-content: space-between; padding: 8px 0; }
    .totals-row.total { font-size: 18px; font-weight: 600; border-top: 2px solid #1d1d1f; margin-top: 10px; padding-top: 15px; }
    .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #86868b; font-size: 14px; }
    .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .status-paid { background: #d1fae5; color: #065f46; }
    .status-pending { background: #fef3c7; color: #92400e; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">PleasureZone</div>
    <div class="invoice-title">
      <h1>Invoice</h1>
      <p>#${order.orderNumber}</p>
    </div>
  </div>
  
  <div class="info-grid">
    <div class="info-section">
      <h3>Bill To</h3>
      <p><strong>${order.customerName}</strong></p>
      <p>${order.customerEmail}</p>
      ${order.customerPhone ? `<p>${order.customerPhone}</p>` : ""}
    </div>
    <div class="info-section">
      <h3>Invoice Details</h3>
      <p><strong>Date:</strong> ${formatDate(order.createdAt as Date)}</p>
      <p><strong>Order #:</strong> ${order.orderNumber}</p>
      <p><strong>Status:</strong> <span class="status ${order.paymentStatus === 'SUCCESSFUL' ? 'status-paid' : 'status-pending'}">${order.paymentStatus === 'SUCCESSFUL' ? 'Paid' : 'Pending'}</span></p>
    </div>
  </div>
  
  <div class="info-section" style="margin-bottom: 30px;">
    <h3>Ship To</h3>
    <p>${(order.shippingAddress as string).replace(/\n/g, "<br>")}</p>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th class="text-right">Qty</th>
        <th class="text-right">Price</th>
        <th class="text-right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((item: Record<string, unknown>) => `
        <tr>
          <td class="item-name">${item.name}</td>
          <td class="text-right">${item.quantity}</td>
          <td class="text-right">${formatCurrency(item.price as number, order.currency as string)}</td>
          <td class="text-right">${formatCurrency((item.price as number) * (item.quantity as number), order.currency as string)}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>
  
  <div class="totals">
    <div class="totals-row">
      <span>Subtotal</span>
      <span>${formatCurrency(order.subtotal as number, order.currency as string)}</span>
    </div>
    ${Number(order.discount) > 0 ? `
    <div class="totals-row">
      <span>Discount</span>
      <span>-${formatCurrency(order.discount as number, order.currency as string)}</span>
    </div>
    ` : ""}
    ${Number(order.shippingCost) > 0 ? `
    <div class="totals-row">
      <span>Shipping</span>
      <span>${formatCurrency(order.shippingCost as number, order.currency as string)}</span>
    </div>
    ` : ""}
    ${Number(order.tax) > 0 ? `
    <div class="totals-row">
      <span>Tax</span>
      <span>${formatCurrency(order.tax as number, order.currency as string)}</span>
    </div>
    ` : ""}
    <div class="totals-row total">
      <span>Total</span>
      <span>${formatCurrency(order.totalAmount as number, order.currency as string)}</span>
    </div>
  </div>
  
  <div class="footer">
    <p>Thank you for your order!</p>
    <p style="margin-top: 10px;">PleasureZone • Discreet shipping guaranteed</p>
  </div>
</body>
</html>
  `;
};

// Get invoice HTML for order
router.get("/:orderId", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { orderId } = req.params;
    const { format } = req.query;

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: userId,
      },
      include: {
        items: {
          include: {
            product: {
              select: { name: true, slug: true },
            },
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const invoiceHtml = generateInvoiceHtml(order as unknown as Record<string, unknown>, order.items as unknown as Array<Record<string, unknown>>);

    if (format === "html") {
      res.setHeader("Content-Type", "text/html");
      return res.send(invoiceHtml);
    }

    // Return JSON with HTML for frontend to handle
    res.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      html: invoiceHtml,
    });
  } catch (error) {
    console.error("Get invoice error:", error);
    res.status(500).json({ error: "Failed to generate invoice" });
  }
});

// Download invoice (HTML format - frontend converts to PDF)
router.get("/:orderId/download", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { orderId } = req.params;

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: userId,
      },
      include: {
        items: {
          include: {
            product: {
              select: { name: true, slug: true },
            },
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const invoiceHtml = generateInvoiceHtml(order as unknown as Record<string, unknown>, order.items as unknown as Array<Record<string, unknown>>);

    res.setHeader("Content-Type", "text/html");
    res.setHeader("Content-Disposition", `attachment; filename="invoice-${order.orderNumber}.html"`);
    res.send(invoiceHtml);
  } catch (error) {
    console.error("Download invoice error:", error);
    res.status(500).json({ error: "Failed to download invoice" });
  }
});

export default router;
