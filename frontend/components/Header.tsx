"use client";

import Link from "next/link";
import { Heart, ShoppingBag, Menu, X, User, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/hooks/useCart";
import { useAuth } from "@/lib/hooks/useAuth";
import SearchBar from "@/components/SearchBar";
import CurrencySelector from "@/components/CurrencySelector";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";

export default function Header() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const { itemCount, openCart } = useCart();
  const { user } = useAuth();
  const [wishlistCount, setWishlistCount] = useState(0);

  // Track scroll for header background
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Load wishlist count from localStorage
  useEffect(() => {
    const loadWishlistCount = () => {
      try {
        const wishlist = JSON.parse(localStorage.getItem("wishlist") || "[]");
        setWishlistCount(wishlist.length);
      } catch {
        setWishlistCount(0);
      }
    };
    loadWishlistCount();
    window.addEventListener("wishlist-updated", loadWishlistCount);
    return () => window.removeEventListener("wishlist-updated", loadWishlistCount);
  }, []);

  // Keyboard shortcut for search (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setMobileSearchOpen(true);
        document.getElementById("global-search-input")?.focus();
      }
      if (e.key === "Escape") {
        setMobileSearchOpen(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleMobileSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setMobileSearchOpen(false);
      setSearchQuery("");
    }
  };

  const navLinks = [
    { href: "/category", label: "Shop" },
    { href: "/category?cat=toys", label: "Toys" },
    { href: "/category?cat=lingerie", label: "Lingerie" },
    { href: "/category?cat=wellness", label: "Wellness" },
  ];

  return (
    <>
      <header className={`sticky top-0 z-40 transition-all duration-300 border-b ${
        scrolled 
          ? "bg-surface/80 backdrop-blur-xl border-border shadow-sm" 
          : "bg-surface border-transparent"
      }`}>
        <div className="container">
          <div className="flex items-center justify-between h-14 lg:h-16">
            {/* Logo */}
            <Logo variant="default" href="/" />

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-7">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-text-muted hover:text-text transition-colors duration-200"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Search - Desktop */}
            <div className="hidden md:flex items-center flex-1 max-w-xs mx-8">
              <SearchBar />
            </div>

            {/* Icons */}
            <div className="flex items-center gap-1">
              {/* Mobile Search Button */}
              <button 
                onClick={() => setMobileSearchOpen(true)}
                className="btn-icon md:hidden"
                aria-label="Search"
              >
                <Search className="w-5 h-5" />
              </button>

              <div className="hidden sm:block">
                <CurrencySelector variant="compact" />
              </div>
              
              <div className="hidden sm:block">
                <ThemeToggle />
              </div>
              
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
                {wishlistCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-medium rounded-full flex items-center justify-center">
                    {wishlistCount > 9 ? "9+" : wishlistCount}
                  </span>
                )}
              </Link>
              
              <button onClick={openCart} className="btn-icon relative">
                <ShoppingBag className="w-5 h-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-white text-[10px] font-medium rounded-full flex items-center justify-center">
                    {itemCount > 9 ? "9+" : itemCount}
                  </span>
                )}
              </button>
              
              <button
                className="btn-icon lg:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <nav className="lg:hidden py-6 border-t border-border animate-fade-in">
              <div className="space-y-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block px-4 py-3 text-text hover:text-primary hover:bg-surface-secondary rounded-12 font-medium transition-all duration-200"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="pt-4 border-t border-border mt-4">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <CurrencySelector variant="default" />
                    <ThemeToggle showLabel />
                  </div>
                  {user ? (
                    <Link
                      href="/account"
                      className="block px-4 py-3 text-text hover:text-primary hover:bg-surface-secondary rounded-12 font-medium"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      My Account
                    </Link>
                  ) : (
                    <Link
                      href="/auth/login"
                      className="block px-4 py-3 text-primary font-medium"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Sign In / Register
                    </Link>
                  )}
                </div>
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Mobile Search Overlay */}
      {mobileSearchOpen && (
        <div className="fixed inset-0 bg-text/20 backdrop-blur-sm z-50 animate-fade-in" onClick={() => setMobileSearchOpen(false)}>
          <div 
            className="bg-surface p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleMobileSearch} className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input
                  id="global-search-input"
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input pl-12"
                  autoFocus
                />
              </div>
              <button 
                type="button"
                onClick={() => setMobileSearchOpen(false)}
                className="btn-icon"
              >
                <X className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
