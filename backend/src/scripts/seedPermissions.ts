import prisma from "../lib/prisma";
import { logger } from "../lib/logger";

const PERMISSIONS = [
  // Products
  { name: "products.view", description: "View products", category: "Products" },
  { name: "products.create", description: "Create products", category: "Products" },
  { name: "products.edit", description: "Edit products", category: "Products" },
  { name: "products.delete", description: "Delete products", category: "Products" },
  { name: "products.import", description: "Import products", category: "Products" },

  // Inventory
  { name: "inventory.view", description: "View inventory levels", category: "Inventory" },
  { name: "inventory.manage", description: "Update stock & warehouses", category: "Inventory" },

  // Categories
  { name: "categories.view", description: "View categories", category: "Catalog" },
  { name: "categories.manage", description: "Create/edit/delete categories", category: "Catalog" },
  { name: "bundles.view", description: "View product bundles", category: "Catalog" },
  { name: "bundles.manage", description: "Create/edit bundles", category: "Catalog" },

  // Orders
  { name: "orders.view", description: "View orders", category: "Orders" },
  { name: "orders.edit", description: "Edit/update order status", category: "Orders" },
  { name: "orders.cancel", description: "Cancel orders", category: "Orders" },
  { name: "orders.refund", description: "Process refunds", category: "Orders" },
  { name: "orders.export", description: "Export order data", category: "Orders" },

  // Returns
  { name: "returns.view", description: "View return requests", category: "Orders" },
  { name: "returns.manage", description: "Approve/reject returns", category: "Orders" },

  // Disputes & Escrow
  { name: "disputes.view", description: "View disputes", category: "Disputes" },
  { name: "disputes.manage", description: "Resolve & mediate disputes", category: "Disputes" },
  { name: "disputes.escalate", description: "Escalate disputes", category: "Disputes" },
  { name: "escrow.view", description: "View escrow transactions", category: "Disputes" },
  { name: "escrow.release", description: "Release/refund escrow funds", category: "Disputes" },

  // Customers
  { name: "customers.view", description: "View customers", category: "Customers" },
  { name: "customers.edit", description: "Edit customer details", category: "Customers" },
  { name: "customers.block", description: "Block/unblock customers", category: "Customers" },
  { name: "customers.export", description: "Export customer data", category: "Customers" },

  // Analytics
  { name: "analytics.view", description: "View analytics dashboard", category: "Analytics" },
  { name: "analytics.export", description: "Export analytics data", category: "Analytics" },

  // Marketing — Coupons & Deals
  { name: "coupons.view", description: "View coupons", category: "Marketing" },
  { name: "coupons.manage", description: "Create/edit coupons", category: "Marketing" },
  { name: "daily-deals.manage", description: "Manage daily deals", category: "Marketing" },
  { name: "gift-cards.view", description: "View gift cards", category: "Marketing" },
  { name: "gift-cards.manage", description: "Issue/manage gift cards", category: "Marketing" },
  { name: "store-credit.view", description: "View store credits", category: "Marketing" },
  { name: "store-credit.manage", description: "Issue/adjust store credit", category: "Marketing" },

  // Marketing — Engagement
  { name: "referrals.view", description: "View referral program", category: "Engagement" },
  { name: "referrals.manage", description: "Configure referral rules", category: "Engagement" },
  { name: "loyalty.view", description: "View loyalty program", category: "Engagement" },
  { name: "loyalty.manage", description: "Configure loyalty points/tiers", category: "Engagement" },
  { name: "affiliates.view", description: "View affiliate program", category: "Engagement" },
  { name: "affiliates.manage", description: "Manage affiliates & payouts", category: "Engagement" },
  { name: "social.view", description: "View social shopping", category: "Engagement" },
  { name: "social.manage", description: "Manage social shopping features", category: "Engagement" },

  // Communications
  { name: "push-notifications.send", description: "Send push notifications", category: "Communications" },
  { name: "broadcast.send", description: "Send broadcast messages", category: "Communications" },
  { name: "messages.view", description: "View marketplace messages", category: "Communications" },
  { name: "messages.manage", description: "Moderate/reply to messages", category: "Communications" },

  // Content
  { name: "blog.view", description: "View blog posts", category: "Content" },
  { name: "blog.manage", description: "Create/edit blog posts", category: "Content" },
  { name: "banners.manage", description: "Manage banners & pages", category: "Content" },

  // Support
  { name: "tickets.view", description: "View support tickets", category: "Support" },
  { name: "tickets.manage", description: "Manage support tickets", category: "Support" },
  { name: "reviews.view", description: "View product reviews", category: "Support" },
  { name: "reviews.moderate", description: "Approve/reject reviews", category: "Support" },

  // Marketplace — Sellers
  { name: "sellers.view", description: "View seller applications & profiles", category: "Marketplace" },
  { name: "sellers.manage", description: "Approve/suspend/manage sellers", category: "Marketplace" },
  { name: "sellers.badges", description: "Manage seller trust badges", category: "Marketplace" },
  { name: "product-moderation.view", description: "View products pending review", category: "Marketplace" },
  { name: "product-moderation.manage", description: "Approve/reject seller products", category: "Marketplace" },

  // Marketplace — Finance
  { name: "commissions.view", description: "View commission rules", category: "Finance" },
  { name: "commissions.manage", description: "Create/edit commission rules", category: "Finance" },
  { name: "payouts.view", description: "View seller payouts", category: "Finance" },
  { name: "payouts.manage", description: "Process/approve seller payouts", category: "Finance" },
  { name: "invoices.view", description: "View invoices", category: "Finance" },
  { name: "invoices.manage", description: "Create/edit invoices", category: "Finance" },
  { name: "ads.view", description: "View ad revenue & campaigns", category: "Finance" },
  { name: "ads.manage", description: "Manage sponsored ads settings", category: "Finance" },

  // Supply Chain
  { name: "shipping.view", description: "View shipping settings", category: "Supply Chain" },
  { name: "shipping.manage", description: "Configure shipping methods/rates", category: "Supply Chain" },
  { name: "dropshipping.view", description: "View dropshipping suppliers", category: "Supply Chain" },
  { name: "dropshipping.manage", description: "Import/sync supplier products", category: "Supply Chain" },

  // System — Staff & Roles
  { name: "staff.view", description: "View staff accounts", category: "System" },
  { name: "staff.manage", description: "Add/remove staff members", category: "System" },
  { name: "permissions.manage", description: "Manage roles & permissions", category: "System" },

  // System — Configuration
  { name: "settings.view", description: "View system settings", category: "System" },
  { name: "settings.edit", description: "Edit system settings", category: "System" },
  { name: "api-keys.manage", description: "Manage API keys", category: "System" },
  { name: "webhooks.manage", description: "Manage webhooks", category: "System" },
  { name: "subscriptions.manage", description: "Manage subscriptions", category: "System" },

  // System — Audit & Security
  { name: "activity.view", description: "View activity/audit log", category: "System" },
  { name: "security.view", description: "View security settings", category: "System" },
  { name: "security.manage", description: "Configure rate limits & access controls", category: "System" },
];

// Default permissions for MANAGER role
const MANAGER_DEFAULTS = [
  "products.view", "products.create", "products.edit",
  "inventory.view", "inventory.manage",
  "categories.view", "bundles.view",
  "orders.view", "orders.edit",
  "returns.view", "returns.manage",
  "disputes.view", "disputes.manage",
  "escrow.view",
  "customers.view", "customers.edit",
  "analytics.view",
  "coupons.view", "coupons.manage",
  "daily-deals.manage",
  "gift-cards.view", "store-credit.view",
  "referrals.view", "loyalty.view",
  "affiliates.view", "social.view",
  "push-notifications.send",
  "messages.view",
  "blog.view", "blog.manage",
  "banners.manage",
  "tickets.view", "tickets.manage",
  "reviews.view", "reviews.moderate",
  "sellers.view",
  "product-moderation.view", "product-moderation.manage",
  "commissions.view", "payouts.view",
  "invoices.view",
  "ads.view",
  "shipping.view",
  "dropshipping.view",
  "staff.view",
  "settings.view",
  "activity.view",
  "security.view",
];

// Default permissions for SELLER role (what sellers can do in admin-like contexts)
const SELLER_DEFAULTS = [
  "products.view", "products.create", "products.edit", "products.delete",
  "inventory.view", "inventory.manage",
  "orders.view",
  "returns.view",
  "disputes.view",
  "analytics.view",
  "messages.view",
  "reviews.view",
  "shipping.view",
];

async function seedPermissions() {
  logger.info("Seeding permissions...");

  // Upsert all permissions
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: { description: perm.description, category: perm.category },
      create: perm,
    });
  }
  logger.info(`Seeded ${PERMISSIONS.length} permissions`);

  const allPerms = await prisma.permission.findMany();

  // Set MANAGER default permissions
  for (const perm of allPerms) {
    const granted = MANAGER_DEFAULTS.includes(perm.name);
    await prisma.rolePermission.upsert({
      where: { role_permissionId: { role: "MANAGER", permissionId: perm.id } },
      update: { granted },
      create: { role: "MANAGER", permissionId: perm.id, granted },
    });
  }
  logger.info(`Set ${MANAGER_DEFAULTS.length} permissions for MANAGER role`);

  // Set SELLER default permissions
  for (const perm of allPerms) {
    const granted = SELLER_DEFAULTS.includes(perm.name);
    await prisma.rolePermission.upsert({
      where: { role_permissionId: { role: "SELLER", permissionId: perm.id } },
      update: { granted },
      create: { role: "SELLER", permissionId: perm.id, granted },
    });
  }
  logger.info(`Set ${SELLER_DEFAULTS.length} permissions for SELLER role`);

  logger.info("Permission seeding complete!");
}

seedPermissions()
  .catch(err => logger.error('seed_permissions_failed', { error: err }))
  .finally(() => prisma.$disconnect());
