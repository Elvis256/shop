import prisma from "../lib/prisma";

const PERMISSIONS = [
  // Products
  { name: "products.view", description: "View products", category: "Products" },
  { name: "products.create", description: "Create products", category: "Products" },
  { name: "products.edit", description: "Edit products", category: "Products" },
  { name: "products.delete", description: "Delete products", category: "Products" },
  { name: "products.import", description: "Import products", category: "Products" },
  
  // Orders
  { name: "orders.view", description: "View orders", category: "Orders" },
  { name: "orders.edit", description: "Edit/update orders", category: "Orders" },
  { name: "orders.cancel", description: "Cancel orders", category: "Orders" },
  { name: "orders.refund", description: "Process refunds", category: "Orders" },
  
  // Customers
  { name: "customers.view", description: "View customers", category: "Customers" },
  { name: "customers.edit", description: "Edit customers", category: "Customers" },
  { name: "customers.block", description: "Block/unblock customers", category: "Customers" },
  
  // Analytics
  { name: "analytics.view", description: "View analytics", category: "Analytics" },
  { name: "analytics.export", description: "Export analytics data", category: "Analytics" },
  
  // Marketing
  { name: "coupons.view", description: "View coupons", category: "Marketing" },
  { name: "coupons.manage", description: "Create/edit coupons", category: "Marketing" },
  { name: "daily-deals.manage", description: "Manage daily deals", category: "Marketing" },
  { name: "referrals.view", description: "View referrals", category: "Marketing" },
  { name: "push-notifications.send", description: "Send push notifications", category: "Marketing" },
  
  // Content
  { name: "blog.view", description: "View blog posts", category: "Content" },
  { name: "blog.manage", description: "Create/edit blog posts", category: "Content" },
  { name: "banners.manage", description: "Manage banners", category: "Content" },
  
  // Support
  { name: "tickets.view", description: "View support tickets", category: "Support" },
  { name: "tickets.manage", description: "Manage support tickets", category: "Support" },
  { name: "returns.view", description: "View returns", category: "Support" },
  { name: "returns.manage", description: "Process returns", category: "Support" },
  { name: "reviews.view", description: "View reviews", category: "Support" },
  { name: "reviews.moderate", description: "Moderate reviews", category: "Support" },
  
  // Marketplace
  { name: "sellers.view", description: "View sellers", category: "Marketplace" },
  { name: "sellers.manage", description: "Approve/manage sellers", category: "Marketplace" },
  { name: "commissions.manage", description: "Manage commission rules", category: "Marketplace" },
  { name: "payouts.manage", description: "Manage seller payouts", category: "Marketplace" },
  
  // Finance
  { name: "invoices.view", description: "View invoices", category: "Finance" },
  { name: "gift-cards.manage", description: "Manage gift cards", category: "Finance" },
  { name: "store-credit.manage", description: "Manage store credit", category: "Finance" },
  
  // Settings
  { name: "settings.view", description: "View settings", category: "Settings" },
  { name: "settings.edit", description: "Edit settings", category: "Settings" },
  { name: "staff.manage", description: "Manage staff accounts", category: "Settings" },
  { name: "api-keys.manage", description: "Manage API keys", category: "Settings" },
  { name: "integrations.manage", description: "Manage integrations", category: "Settings" },
  { name: "webhooks.manage", description: "Manage webhooks", category: "Settings" },
];

// Default permissions for MANAGER role (everything except dangerous settings)
const MANAGER_PERMISSIONS = [
  "products.view", "products.create", "products.edit",
  "orders.view", "orders.edit",
  "customers.view", "customers.edit",
  "analytics.view",
  "coupons.view", "coupons.manage",
  "daily-deals.manage",
  "referrals.view",
  "blog.view", "blog.manage",
  "banners.manage",
  "tickets.view", "tickets.manage",
  "returns.view", "returns.manage",
  "reviews.view", "reviews.moderate",
  "sellers.view",
  "invoices.view",
  "settings.view",
];

async function seedPermissions() {
  console.log("Seeding permissions...");
  
  // Upsert all permissions
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: { description: perm.description, category: perm.category },
      create: perm,
    });
  }
  console.log(`Seeded ${PERMISSIONS.length} permissions`);
  
  // Set MANAGER default permissions
  const allPerms = await prisma.permission.findMany();
  
  for (const perm of allPerms) {
    const granted = MANAGER_PERMISSIONS.includes(perm.name);
    await prisma.rolePermission.upsert({
      where: { role_permissionId: { role: "MANAGER", permissionId: perm.id } },
      update: { granted },
      create: { role: "MANAGER", permissionId: perm.id, granted },
    });
  }
  console.log(`Set ${MANAGER_PERMISSIONS.length} permissions for MANAGER role`);
  
  console.log("Permission seeding complete!");
}

seedPermissions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
