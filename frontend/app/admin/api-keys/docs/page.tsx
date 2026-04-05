"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Key,
  Shield,
  Clock,
  Package,
  ShoppingCart,
  Users,
  FolderTree,
  Warehouse,
  Webhook,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";

const sections = [
  { id: "auth", label: "Authentication", icon: Key },
  { id: "rate-limiting", label: "Rate Limiting", icon: Clock },
  { id: "response-format", label: "Response Format", icon: Shield },
  { id: "products", label: "Products", icon: Package },
  { id: "orders", label: "Orders", icon: ShoppingCart },
  { id: "customers", label: "Customers", icon: Users },
  { id: "categories", label: "Categories", icon: FolderTree },
  { id: "inventory", label: "Inventory", icon: Warehouse },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
  { id: "permissions", label: "Permissions", icon: Shield },
  { id: "examples", label: "Code Examples", icon: ChevronRight },
];

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group">
      <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-sm overflow-x-auto font-mono leading-relaxed">
        {lang && (
          <span className="absolute top-2 left-4 text-xs text-gray-500 uppercase">
            {lang}
          </span>
        )}
        <code>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 p-1.5 rounded bg-gray-700 text-gray-300 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

function Endpoint({
  method,
  path,
  desc,
  params,
  body,
  response,
}: {
  method: string;
  path: string;
  desc: string;
  params?: { name: string; type: string; desc: string }[];
  body?: string;
  response: string;
}) {
  const color = method === "GET" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800";
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${color}`}>{method}</span>
        <code className="text-sm font-mono font-medium text-gray-900">{path}</code>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-sm text-gray-600">{desc}</p>
        {params && params.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Parameters</p>
            <div className="bg-gray-50 rounded-lg divide-y divide-gray-200">
              {params.map((p) => (
                <div key={p.name} className="flex items-start gap-3 px-3 py-2 text-sm">
                  <code className="font-mono text-xs bg-white px-1.5 py-0.5 rounded border border-gray-200 shrink-0">
                    {p.name}
                  </code>
                  <span className="text-xs text-gray-400 shrink-0">{p.type}</span>
                  <span className="text-gray-600">{p.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {body && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Request Body</p>
            <CodeBlock code={body} lang="json" />
          </div>
        )}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Response</p>
          <CodeBlock code={response} lang="json" />
        </div>
      </div>
    </div>
  );
}

export default function ApiDocsPage() {
  const [activeSection, setActiveSection] = useState("auth");

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar TOC */}
      <div className="hidden lg:block w-64 shrink-0 border-r border-gray-200 bg-gray-50 p-6 sticky top-0 h-screen overflow-y-auto">
        <Link
          href="/admin/api-keys"
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to API Keys
        </Link>
        <h2 className="text-xs font-bold uppercase text-gray-400 mb-3">Documentation</h2>
        <nav className="space-y-1">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`w-full flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors text-left ${
                activeSection === s.id
                  ? "bg-black text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <s.icon className="w-4 h-4 shrink-0" />
              {s.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-4xl mx-auto px-4 lg:px-8 py-8">
        <div className="lg:hidden mb-6">
          <Link
            href="/admin/api-keys"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" /> Back to API Keys
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Developer API Reference</h1>
        <p className="text-gray-500 mb-8">
          Complete reference for the v1 REST API. All endpoints require API key authentication.
        </p>

        {/* Authentication */}
        <section id="auth" className="mb-12 scroll-mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Key className="w-5 h-5" /> Authentication
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            All API requests require an API key passed via the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">Authorization</code> header. API keys are hashed with SHA-256 before storage — the full key is only shown once at creation time.
          </p>

          <div className="space-y-3 mb-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Authorization Header</p>
              <CodeBlock code={`curl -H "Authorization: Bearer sk_live_your_key_here" \\
  https://api.example.com/api/v1/products`} />
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            <strong>Security:</strong> Never expose your API key in client-side code, URLs, or query parameters. Always make API calls from your server.
          </div>
        </section>

        {/* Rate Limiting */}
        <section id="rate-limiting" className="mb-12 scroll-mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" /> Rate Limiting
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Each API key has a per-minute rate limit (default: 100 requests/min). Rate limit info is included in response headers:
          </p>
          <div className="bg-gray-50 rounded-lg divide-y divide-gray-200 mb-4">
            {[
              { header: "X-RateLimit-Limit", desc: "Maximum requests per minute" },
              { header: "X-RateLimit-Remaining", desc: "Remaining requests in current window" },
              { header: "X-RateLimit-Reset", desc: "Unix timestamp when the window resets" },
            ].map((h) => (
              <div key={h.header} className="flex items-center gap-4 px-4 py-3 text-sm">
                <code className="font-mono text-xs bg-white px-2 py-1 rounded border border-gray-200 shrink-0">
                  {h.header}
                </code>
                <span className="text-gray-600">{h.desc}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-600">
            Exceeding the limit returns <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">429 Too Many Requests</code>.
          </p>
        </section>

        {/* Response Format */}
        <section id="response-format" className="mb-12 scroll-mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5" /> Response Format
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            All responses use JSON with a consistent structure.
          </p>

          <div className="grid gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Success (Single Object)</p>
              <CodeBlock code={`{
  "data": {
    "id": "clx...",
    "name": "Product Name",
    "price": 29.99
  }
}`} lang="json" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Success (List with Pagination)</p>
              <CodeBlock code={`{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "total": 156,
    "totalPages": 8
  }
}`} lang="json" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Error</p>
              <CodeBlock code={`{
  "error": {
    "code": "NOT_FOUND",
    "message": "Product not found"
  }
}`} lang="json" />
            </div>
          </div>
        </section>

        {/* Products */}
        <section id="products" className="mb-12 scroll-mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5" /> Products
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Requires <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">products:read</code> permission.
          </p>

          <Endpoint
            method="GET"
            path="/api/v1/products"
            desc="List products with optional filters and pagination."
            params={[
              { name: "page", type: "integer", desc: "Page number (default: 1)" },
              { name: "per_page", type: "integer", desc: "Items per page, max 100 (default: 20)" },
              { name: "category", type: "string", desc: "Filter by category slug" },
              { name: "status", type: "string", desc: "Filter by status: ACTIVE, DRAFT, ARCHIVED" },
              { name: "search", type: "string", desc: "Search by product name" },
            ]}
            response={`{
  "data": [
    {
      "id": "clx123",
      "name": "Wireless Headphones",
      "slug": "wireless-headphones",
      "price": "49.99",
      "stock": 150,
      "status": "ACTIVE",
      "category": { "id": "cat1", "name": "Electronics", "slug": "electronics" },
      "images": [{ "url": "/uploads/img.jpg", "position": 0 }],
      "variants": []
    }
  ],
  "pagination": { "page": 1, "perPage": 20, "total": 42, "totalPages": 3 }
}`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/products/:idOrSlug"
            desc="Get a single product by ID or slug."
            params={[{ name: "idOrSlug", type: "string", desc: "Product ID or slug" }]}
            response={`{
  "data": {
    "id": "clx123",
    "name": "Wireless Headphones",
    "slug": "wireless-headphones",
    "description": "Premium wireless headphones...",
    "price": "49.99",
    "stock": 150,
    "category": { "id": "cat1", "name": "Electronics", "slug": "electronics" },
    "images": [...],
    "variants": [...]
  }
}`}
          />
        </section>

        {/* Orders */}
        <section id="orders" className="mb-12 scroll-mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" /> Orders
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Requires <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">orders:read</code> for read,{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">orders:write</code> for updates.
          </p>

          <Endpoint
            method="GET"
            path="/api/v1/orders"
            desc="List orders with optional filters."
            params={[
              { name: "page", type: "integer", desc: "Page number (default: 1)" },
              { name: "per_page", type: "integer", desc: "Items per page, max 100 (default: 20)" },
              { name: "status", type: "string", desc: "PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED, REFUNDED" },
              { name: "since", type: "string", desc: "ISO 8601 date to filter orders from" },
            ]}
            response={`{
  "data": [
    {
      "id": "clx456",
      "orderNumber": "ORD-001234",
      "customerName": "John Doe",
      "totalAmount": "129.99",
      "status": "PROCESSING",
      "items": [{ "id": "i1", "quantity": 2, "price": "64.99", "product": { "name": "..." } }]
    }
  ],
  "pagination": { "page": 1, "perPage": 20, "total": 89, "totalPages": 5 }
}`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/orders/:id"
            desc="Get a single order by ID or order number."
            params={[{ name: "id", type: "string", desc: "Order ID or order number" }]}
            response={`{
  "data": {
    "id": "clx456",
    "orderNumber": "ORD-001234",
    "customerName": "John Doe",
    "status": "PROCESSING",
    "items": [...],
    "payments": [...],
    "timeline": [...]
  }
}`}
          />

          <Endpoint
            method="PUT"
            path="/api/v1/orders/:id"
            desc="Update order status, tracking number, or notes."
            params={[{ name: "id", type: "string", desc: "Order ID or order number" }]}
            body={`{
  "status": "SHIPPED",
  "trackingNumber": "TRK123456",
  "notes": "Shipped via Express"
}`}
            response={`{
  "data": {
    "id": "clx456",
    "orderNumber": "ORD-001234",
    "status": "SHIPPED",
    "trackingNumber": "TRK123456",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}`}
          />
        </section>

        {/* Customers */}
        <section id="customers" className="mb-12 scroll-mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" /> Customers
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Requires <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">customers:read</code> permission.
          </p>

          <Endpoint
            method="GET"
            path="/api/v1/customers"
            desc="List customers with search."
            params={[
              { name: "page", type: "integer", desc: "Page number (default: 1)" },
              { name: "per_page", type: "integer", desc: "Items per page, max 100 (default: 20)" },
              { name: "search", type: "string", desc: "Search by name or email" },
            ]}
            response={`{
  "data": [
    {
      "id": "usr123",
      "email": "john@example.com",
      "name": "John Doe",
      "phone": "+1234567890",
      "createdAt": "2024-01-01T00:00:00Z",
      "_count": { "orders": 5, "reviews": 2 }
    }
  ],
  "pagination": { "page": 1, "perPage": 20, "total": 340, "totalPages": 17 }
}`}
          />
        </section>

        {/* Categories */}
        <section id="categories" className="mb-12 scroll-mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FolderTree className="w-5 h-5" /> Categories
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Requires <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">products:read</code> permission.
          </p>

          <Endpoint
            method="GET"
            path="/api/v1/categories"
            desc="List all product categories."
            response={`{
  "data": [
    {
      "id": "cat1",
      "name": "Electronics",
      "slug": "electronics",
      "description": "Electronic devices and accessories",
      "imageUrl": "/uploads/cat-electronics.jpg",
      "_count": { "products": 45 }
    }
  ]
}`}
          />
        </section>

        {/* Inventory */}
        <section id="inventory" className="mb-12 scroll-mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Warehouse className="w-5 h-5" /> Inventory
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Requires <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">inventory:read</code> for read,{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">inventory:write</code> for updates.
          </p>

          <Endpoint
            method="GET"
            path="/api/v1/inventory"
            desc="Get stock levels for all active products."
            params={[
              { name: "page", type: "integer", desc: "Page number (default: 1)" },
              { name: "per_page", type: "integer", desc: "Items per page, max 100 (default: 50)" },
              { name: "low_stock", type: "boolean", desc: "Filter to only low-stock items (true/false)" },
            ]}
            response={`{
  "data": [
    {
      "id": "clx123",
      "name": "Wireless Headphones",
      "sku": "WH-001",
      "stock": 5,
      "reservedStock": 2,
      "lowStockAlert": 10,
      "trackInventory": true,
      "allowBackorder": false,
      "variants": []
    }
  ],
  "pagination": { "page": 1, "perPage": 50, "total": 120, "totalPages": 3 }
}`}
          />

          <Endpoint
            method="PUT"
            path="/api/v1/inventory/:id"
            desc="Update stock level for a product."
            params={[{ name: "id", type: "string", desc: "Product ID" }]}
            body={`{ "stock": 100 }`}
            response={`{
  "data": {
    "id": "clx123",
    "name": "Wireless Headphones",
    "sku": "WH-001",
    "stock": 100
  }
}`}
          />
        </section>

        {/* Webhooks */}
        <section id="webhooks" className="mb-12 scroll-mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Webhook className="w-5 h-5" /> Webhooks
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Requires <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">webhooks:read</code> permission.
          </p>

          <Endpoint
            method="GET"
            path="/api/v1/webhooks"
            desc="List all configured webhook endpoints."
            response={`{
  "data": [
    {
      "id": "wh1",
      "url": "https://yourapp.com/webhook",
      "events": ["ORDER_CREATED", "ORDER_SHIPPED"],
      "isActive": true,
      "failCount": 0,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}`}
          />
        </section>

        {/* Permissions */}
        <section id="permissions" className="mb-12 scroll-mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5" /> Permissions Reference
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Each API key has scoped permissions. The key can only access endpoints matching its permissions.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                  <th className="px-4 py-3 border-b">Permission</th>
                  <th className="px-4 py-3 border-b">Description</th>
                  <th className="px-4 py-3 border-b">Endpoints</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { perm: "products:read", desc: "Read product data", endpoints: "GET /products, /products/:id, /categories" },
                  { perm: "products:write", desc: "Modify products", endpoints: "POST/PUT /products" },
                  { perm: "orders:read", desc: "Read order data", endpoints: "GET /orders, /orders/:id" },
                  { perm: "orders:write", desc: "Update order status & tracking", endpoints: "PUT /orders/:id" },
                  { perm: "customers:read", desc: "Read customer data", endpoints: "GET /customers" },
                  { perm: "inventory:read", desc: "Read stock levels", endpoints: "GET /inventory" },
                  { perm: "inventory:write", desc: "Update stock levels", endpoints: "PUT /inventory/:id" },
                  { perm: "webhooks:read", desc: "Read webhook config", endpoints: "GET /webhooks" },
                ].map((r) => (
                  <tr key={r.perm} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <code className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{r.perm}</code>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.desc}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{r.endpoints}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Code Examples */}
        <section id="examples" className="mb-12 scroll-mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <ChevronRight className="w-5 h-5" /> Code Examples
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">cURL</h3>
              <CodeBlock
                lang="bash"
                code={`# List products
curl -H "Authorization: Bearer sk_live_your_key" \\
  "https://api.example.com/api/v1/products?page=1&per_page=10"

# Get single order
curl -H "Authorization: Bearer sk_live_your_key" \\
  "https://api.example.com/api/v1/orders/ORD-001234"

# Update order status
curl -X PUT \\
  -H "Authorization: Bearer sk_live_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"status":"SHIPPED","trackingNumber":"TRK123"}' \\
  "https://api.example.com/api/v1/orders/ORD-001234"

# Update stock
curl -X PUT \\
  -H "Authorization: Bearer sk_live_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"stock":50}' \\
  "https://api.example.com/api/v1/inventory/product_id"`}
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">JavaScript (Node.js / fetch)</h3>
              <CodeBlock
                lang="javascript"
                code={`const API_KEY = "sk_live_your_key";
const BASE = "https://api.example.com/api/v1";

// List products
const res = await fetch(\`\${BASE}/products?page=1&per_page=10\`, {
  headers: { Authorization: \`Bearer \${API_KEY}\` },
});
const { data, pagination } = await res.json();
console.log(\`Found \${pagination.total} products\`);

// Update order status
await fetch(\`\${BASE}/orders/ORD-001234\`, {
  method: "PUT",
  headers: {
    Authorization: \`Bearer \${API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    status: "SHIPPED",
    trackingNumber: "TRK123456",
  }),
});

// Get low stock items
const inv = await fetch(\`\${BASE}/inventory?low_stock=true\`, {
  headers: { Authorization: \`Bearer \${API_KEY}\` },
});
const lowStock = await inv.json();
console.log("Low stock items:", lowStock.data.length);`}
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Python (requests)</h3>
              <CodeBlock
                lang="python"
                code={`import requests

API_KEY = "sk_live_your_key"
BASE = "https://api.example.com/api/v1"
headers = {"Authorization": f"Bearer {API_KEY}"}

# List products
resp = requests.get(f"{BASE}/products", headers=headers, params={
    "page": 1, "per_page": 10, "status": "ACTIVE"
})
data = resp.json()
print(f"Found {data['pagination']['total']} products")

# Update order
requests.put(f"{BASE}/orders/ORD-001234", headers=headers, json={
    "status": "SHIPPED",
    "trackingNumber": "TRK123456"
})

# Search customers
resp = requests.get(f"{BASE}/customers", headers=headers, params={
    "search": "john"
})
customers = resp.json()["data"]
for c in customers:
    print(f"{c['name']} — {c['email']} — {c['_count']['orders']} orders")`}
              />
            </div>
          </div>
        </section>

        <div className="border-t border-gray-200 pt-6 text-center text-sm text-gray-400">
          Need help? Contact support for API assistance.
        </div>
      </div>
    </div>
  );
}
