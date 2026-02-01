"use client";

import Link from "next/link";
import { Heart, ShoppingCart, Menu, X, User } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/hooks/useCart";
import { useAuth } from "@/lib/hooks/useAuth";
import SearchBar from "@/components/SearchBar";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { itemCount, openCart } = useCart();
  const { user } = useAuth();

  return (
    <header className="border-b border-border sticky top-0 bg-white z-30">
      <div className="container">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="font-head font-bold text-xl">
            AdultStore
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/category" className="text-small hover:text-accent">
              Shop
            </Link>
            <Link href="/category?cat=toys" className="text-small hover:text-accent">
              Toys
            </Link>
            <Link href="/category?cat=lingerie" className="text-small hover:text-accent">
              Lingerie
            </Link>
            <Link href="/category?cat=wellness" className="text-small hover:text-accent">
              Wellness
            </Link>
          </nav>

          {/* Search */}
          <div className="hidden lg:flex items-center flex-1 max-w-md mx-8">
            <SearchBar />
          </div>

          {/* Icons */}
          <div className="flex items-center gap-2">
            {user ? (
              <Link href="/account" className="btn-icon">
                <User className="w-5 h-5" />
              </Link>
            ) : (
              <Link href="/auth/login" className="btn-icon">
                <User className="w-5 h-5" />
              </Link>
            )}
            <Link href="/wishlist" className="btn-icon relative">
              <Heart className="w-5 h-5" />
            </Link>
            <button onClick={openCart} className="btn-icon relative">
              <ShoppingCart className="w-5 h-5" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent text-white text-xs rounded-full flex items-center justify-center">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </button>
            <button
              className="btn-icon md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <nav className="md:hidden py-4 border-t border-border">
            <div className="space-y-4">
              <SearchBar />
              <Link href="/category" className="block py-2 hover:text-accent">
                Shop All
              </Link>
              <Link href="/category?cat=toys" className="block py-2 hover:text-accent">
                Toys
              </Link>
              <Link href="/category?cat=lingerie" className="block py-2 hover:text-accent">
                Lingerie
              </Link>
              <Link href="/category?cat=wellness" className="block py-2 hover:text-accent">
                Wellness
              </Link>
              {user ? (
                <Link href="/account" className="block py-2 hover:text-accent">
                  My Account
                </Link>
              ) : (
                <Link href="/auth/login" className="block py-2 hover:text-accent">
                  Sign In
                </Link>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
