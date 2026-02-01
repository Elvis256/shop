"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, ShoppingCart, Heart, User } from "lucide-react";
import { useCart } from "@/lib/hooks/useCart";

export default function MobileNav() {
  const pathname = usePathname();
  const { itemCount, openCart } = useCart();

  // Don't show on admin pages
  if (pathname.startsWith("/admin")) return null;

  const navItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/search", icon: Search, label: "Search" },
    { href: "/wishlist", icon: Heart, label: "Wishlist" },
    { href: "/account", icon: User, label: "Account" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 lg:hidden z-20 pb-safe">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full ${
                isActive ? "text-accent" : "text-gray-500"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] mt-1">{item.label}</span>
            </Link>
          );
        })}
        
        {/* Cart Button */}
        <button
          onClick={openCart}
          className="flex flex-col items-center justify-center flex-1 h-full text-gray-500 relative"
        >
          <ShoppingCart className="w-5 h-5" />
          {itemCount > 0 && (
            <span className="absolute top-2 right-1/4 w-4 h-4 bg-accent text-white text-[10px] rounded-full flex items-center justify-center">
              {itemCount > 9 ? "9+" : itemCount}
            </span>
          )}
          <span className="text-[10px] mt-1">Cart</span>
        </button>
      </div>
    </nav>
  );
}
