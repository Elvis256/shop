"use client";

import Link from "next/link";
import { Heart, ShoppingBag, Menu, X, User, Search, ChevronDown, Sparkles, Gift, Package, Star } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/hooks/useCart";
import { useAuth } from "@/lib/hooks/useAuth";
import SearchBar from "@/components/SearchBar";
import { CountrySelector } from "@/components/CountrySelector";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";

export default function Header() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [shopMenuOpen, setShopMenuOpen] = useState(false);
  const shopMenuTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    { href: "/sales", label: "Sales" },
    { href: "/subscription-boxes", label: "Subscriptions" },
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
            <nav className="hidden lg:flex items-center gap-8">
              {/* Shop — with mega-menu */}
              <div
                className="relative"
                onMouseEnter={() => {
                  if (shopMenuTimeout.current) clearTimeout(shopMenuTimeout.current);
                  setShopMenuOpen(true);
                }}
                onMouseLeave={() => {
                  shopMenuTimeout.current = setTimeout(() => setShopMenuOpen(false), 150);
                }}
              >
                <Link
                  href="/category"
                  className="flex items-center gap-1 text-sm font-medium text-text-muted hover:text-text transition-colors duration-200 relative after:absolute after:bottom-[-2px] after:left-0 after:w-0 after:h-[2px] after:bg-primary after:transition-all after:duration-300 hover:after:w-full"
                >
                  Shop
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${shopMenuOpen ? "rotate-180" : ""}`} />
                </Link>

                {/* Mega-menu dropdown */}
                {shopMenuOpen && (
                  <div className="absolute top-full left-0 mt-3 w-[520px] bg-surface border border-border rounded-2xl shadow-xl z-50 p-5 animate-fade-in">
                    {/* Arrow */}
                    <div className="absolute -top-1.5 left-8 w-3 h-3 bg-surface border-l border-t border-border rotate-45" />

                    <div className="grid grid-cols-3 gap-5">
                      {/* Categories */}
                      <div>
                        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Categories</p>
                        <div className="space-y-2">
                          {[
                            { href: "/category?cat=toys", label: "Toys & Vibrators" },
                            { href: "/category?cat=lingerie", label: "Lingerie" },
                            { href: "/category?cat=wellness", label: "Wellness" },
                            { href: "/category?cat=lubricants", label: "Lubricants" },
                            { href: "/category?cat=couples", label: "Couples" },
                            { href: "/category", label: "View All →" },
                          ].map((item) => (
                            <Link
                              key={item.href}
                              href={item.href}
                              className="block text-sm text-text-muted hover:text-primary transition-colors"
                              onClick={() => setShopMenuOpen(false)}
                            >
                              {item.label}
                            </Link>
                          ))}
                        </div>
                      </div>

                      {/* Specials */}
                      <div>
                        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Specials</p>
                        <div className="space-y-2">
                          {[
                            { href: "/sales", label: "Sales & Deals", icon: Star },
                            { href: "/subscription-boxes", label: "Subscription Boxes", icon: Package },
                            { href: "/send-to-uganda", label: "Send a Gift", icon: Gift },
                          ].map(({ href, label, icon: Icon }) => (
                            <Link
                              key={href}
                              href={href}
                              className="flex items-center gap-2 text-sm text-text-muted hover:text-primary transition-colors"
                              onClick={() => setShopMenuOpen(false)}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              {label}
                            </Link>
                          ))}
                        </div>
                      </div>

                      {/* Featured CTA */}
                      <div>
                        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Featured</p>
                        <Link
                          href="/sales"
                          className="block bg-primary/10 hover:bg-primary/15 rounded-xl p-3 transition-colors"
                          onClick={() => setShopMenuOpen(false)}
                        >
                          <div className="flex items-center gap-1.5 text-primary font-semibold text-sm mb-1">
                            <Sparkles className="w-3.5 h-3.5" />
                            Current Deals
                          </div>
                          <p className="text-xs text-text-muted leading-relaxed">Up to 40% off on selected wellness products.</p>
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Other nav links */}
              {navLinks.filter(l => l.href !== "/category").map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-text-muted hover:text-text transition-colors duration-200 relative after:absolute after:bottom-[-2px] after:left-0 after:w-0 after:h-[2px] after:bg-primary after:transition-all after:duration-300 hover:after:w-full"
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
              {/* Mobile Search — link fallback to /search if JS not ready */}
              <a
                href="/search"
                onClick={(e) => { e.preventDefault(); setMobileSearchOpen(true); }}
                className="btn-icon md:hidden inline-flex items-center justify-center"
                aria-label="Search"
              >
                <Search className="w-5 h-5" />
              </a>

              <div className="hidden sm:block">
                <CountrySelector />
              </div>
              
              <div className="hidden sm:block">
                <ThemeToggle />
              </div>
              
              <Link href={user ? "/account" : "/auth/login"} className="btn-icon inline-flex items-center justify-center" aria-label="Account">
                <User className="w-5 h-5" />
              </Link>
              
              <Link href="/wishlist" className="btn-icon inline-flex items-center justify-center relative" aria-label="Wishlist">
                <Heart className="w-5 h-5" />
                {wishlistCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-medium rounded-full flex items-center justify-center">
                    {wishlistCount > 9 ? "9+" : wishlistCount}
                  </span>
                )}
              </Link>
              
              {/* Cart — <a> link fallback to /checkout if JS not hydrated */}
              <a
                href="/checkout"
                onClick={(e) => { e.preventDefault(); openCart(); }}
                className="btn-icon inline-flex items-center justify-center relative"
                aria-label="Cart"
              >
                <ShoppingBag className="w-5 h-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-white text-[10px] font-medium rounded-full flex items-center justify-center">
                    {itemCount > 9 ? "9+" : itemCount}
                  </span>
                )}
              </a>
              
              <button
                className="btn-icon inline-flex items-center justify-center lg:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Menu"
                suppressHydrationWarning
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Menu — slide-down with backdrop */}
          {mobileMenuOpen && (
            <nav className="lg:hidden py-4 border-t border-border animate-fade-in">
              <div className="space-y-0.5">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center px-4 py-3.5 text-text hover:text-primary hover:bg-surface-secondary rounded-12 font-medium transition-all duration-200 min-h-[44px]"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="pt-3 border-t border-border mt-3">
                  <div className="px-4 py-3 flex items-center justify-between">
                    {/* Only show on <sm screens where header version is hidden */}
                    <div className="sm:hidden">
                      <CountrySelector />
                    </div>
                    <ThemeToggle showLabel />
                  </div>
                  {user ? (
                    <Link
                      href="/account"
                      className="flex items-center px-4 py-3.5 text-text hover:text-primary hover:bg-surface-secondary rounded-12 font-medium min-h-[44px]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      My Account
                    </Link>
                  ) : (
                    <Link
                      href="/auth/login"
                      className="flex items-center px-4 py-3.5 text-primary font-medium min-h-[44px]"
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
                  suppressHydrationWarning
                />
              </div>
              <button 
                type="button"
                onClick={() => setMobileSearchOpen(false)}
                className="btn-icon"
                suppressHydrationWarning
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
