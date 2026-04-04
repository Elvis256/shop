"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, ShoppingCart, Heart, User } from "lucide-react";
import { useCart } from "@/lib/hooks/useCart";

export default function MobileNav() {
  const pathname = usePathname();
  const { itemCount, openCart } = useCart();

  if (pathname.startsWith("/admin")) return null;

  const navItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/search", icon: Search, label: "Search" },
    { href: "/wishlist", icon: Heart, label: "Wishlist" },
    { href: "/account", icon: User, label: "Account" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface/80 backdrop-blur-xl border-t border-border lg:hidden z-20 safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full min-w-[44px] transition-colors duration-200 ${
                isActive ? "text-primary" : "text-text-muted"
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "scale-110" : ""} transition-transform duration-200`} />
              <span className="text-[10px] mt-1 font-medium">{item.label}</span>
            </Link>
          );
        })}
        
        {/* Cart Button — <a> fallback to /checkout */}
        <a
          href="/checkout"
          onClick={(e) => { e.preventDefault(); openCart(); }}
          className="flex flex-col items-center justify-center flex-1 h-full min-w-[44px] text-text-muted relative transition-colors duration-200"
        >
          <ShoppingCart className="w-5 h-5" />
          {itemCount > 0 && (
            <span className="absolute top-2 right-1/4 w-4 h-4 bg-primary text-white text-[10px] font-medium rounded-full flex items-center justify-center">
              {itemCount > 9 ? "9+" : itemCount}
            </span>
          )}
          <span className="text-[10px] mt-1 font-medium">Cart</span>
        </a>
      </div>
    </nav>
  );
}
