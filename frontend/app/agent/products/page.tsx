"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const STORE_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || "https://ugsex.com";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  imageUrl: string | null;
  category: { name: string } | null;
}

export default function AgentProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [agentCode, setAgentCode] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("agent_token");
    const code = localStorage.getItem("agent_code");
    if (!token || !code) { router.push("/agent"); return; }
    setAgentCode(code);

    fetch(`${API_URL}/api/products?limit=50&status=ACTIVE`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []))
      .finally(() => setLoading(false));
  }, [router]);

  function getShareLink(slug: string) {
    return `${STORE_URL}/product/${slug}?ref=${agentCode}`;
  }

  function shareProduct(product: Product) {
    const link = getShareLink(product.slug);
    const text = `🛍️ Check out ${product.name} — UGX ${product.price.toLocaleString()}\nPlain packaging, discreet delivery 🔒\n${link}`;
    if (navigator.share) {
      navigator.share({ title: product.name, text, url: link });
    } else {
      navigator.clipboard.writeText(text);
      setCopiedId(product.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading products...</div>;

  return (
    <div className="px-4 py-6 space-y-4">
      <h1 className="text-xl font-bold text-white">Products</h1>
      <p className="text-gray-400 text-sm">Tap "Share" to get your commission link</p>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search products..."
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-primary"
      />

      {/* Products */}
      <div className="space-y-3">
        {filtered.map((product) => (
          <div key={product.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="flex gap-3 p-3">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 bg-gray-800 rounded-lg flex-shrink-0 flex items-center justify-center text-2xl">
                  🛍️
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white leading-tight">{product.name}</p>
                {product.category && (
                  <p className="text-xs text-gray-500 mt-0.5">{product.category.name}</p>
                )}
                <p className="text-sm font-bold text-primary mt-1">
                  UGX {product.price.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="border-t border-gray-800 px-3 py-2 flex gap-2">
              <button
                onClick={() => { navigator.clipboard.writeText(getShareLink(product.slug)); setCopiedId(product.id); setTimeout(() => setCopiedId(null), 2000); }}
                className="flex-1 text-xs text-gray-400 hover:text-white py-1.5 rounded bg-gray-800 hover:bg-gray-700 transition-colors"
              >
                {copiedId === product.id ? "✓ Copied!" : "Copy Link"}
              </button>
              <button
                onClick={() => shareProduct(product)}
                className="flex-1 text-xs text-white py-1.5 rounded bg-primary hover:bg-primary/90 transition-colors font-medium"
              >
                Share & Earn
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-gray-500 py-12">No products found</div>
      )}
    </div>
  );
}
