import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: {
    default: "PleasureZone Agents",
    template: "%s | PZ Agents",
  },
  description: "PleasureZone agent portal — share products and earn commission.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f2937",
};

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Lightweight header */}
      <header className="sticky top-0 z-40 bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center text-white font-bold text-xs">
            PZ
          </div>
          <span className="font-semibold text-sm text-white">Agent Portal</span>
        </div>
        <a
          href="https://wa.me/256742020610"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-400 hover:text-white"
        >
          Support
        </a>
      </header>

      <main className="pb-20">{children}</main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex z-40">
        {[
          { href: "/agent/dashboard", label: "Dashboard", icon: "📊" },
          { href: "/agent/products", label: "Products", icon: "🛍️" },
          { href: "/agent/earnings", label: "Earnings", icon: "💰" },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex-1 flex flex-col items-center py-3 gap-1 text-gray-400 hover:text-white transition-colors text-xs"
          >
            <span className="text-lg">{item.icon}</span>
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
