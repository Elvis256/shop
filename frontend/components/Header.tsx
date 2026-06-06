"use client";

import Link from "next/link";
import { Heart, ShoppingBag, Menu, X, User, Search, ChevronDown, Sparkles, Gift, Package, Star, BoxSelect, Wand2 } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/hooks/useCart";
import { useAuth } from "@/lib/hooks/useAuth";
import SearchBar from "@/components/SearchBar";
import { CountrySelector } from "@/components/CountrySelector";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSelector from "@/components/LanguageSelector";

export default function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [shopMenuOpen, setShopMenuOpen] = useState(false);
  const shopMenuTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { itemCount, openCart } = useCart();
  const { user } = useAuth();
  const [wishlistCount, setWishlistCount] = useState(0);

  // Lock body scroll when overlays open
  useEffect(() => {
    if (mobileMenuOpen || mobileSearchOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen, mobileSearchOpen]);

  // Track scroll for header background
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Load wishlist count from localStorage + server sync
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
      }
      if (e.key === "Escape") {
        setMobileSearchOpen(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
  }, [pathname]);

  const isActive = useCallback((href: string) => {
    if (href === "/category" && !href.includes("?")) {
      return pathname === "/category";
    }
    return pathname === href || pathname.startsWith(href.split("?")[0] + "/");
  }, [pathname]);

  // Desktop nav: Shop (mega-menu) + Sales + Subscriptions only
  // Toys/Lingerie/Wellness are inside the mega-menu, not duplicated in top nav
  const desktopNavLinks = [
    { href: "/sales", label: "Sales" },
    { href: "/blog", label: "Learn" },
    { href: "/beginners", label: "New? Start Here" },
  ];

  // Mobile nav: all links including categories
  const mobileNavLinks = [
    { href: "/category", label: "Shop All" },
    { href: "/sales", label: "Sales & Deals" },
    { href: "/beginners", label: "New? Start Here" },
    { href: "/couples", label: "Couples" },
    { href: "/category?cat=toys", label: "Toys" },
    { href: "/category?cat=lingerie", label: "Lingerie" },
    { href: "/category?cat=wellness", label: "Wellness" },
    { href: "/blog", label: "Learn" },
    { href: "/subscription-boxes", label: "Subscriptions" },
  ];

  return (
    <>
      <header className={`sticky top-0 z-40 transition-all duration-200 border-b ${
        scrolled
          ? "bg-surface/72 backdrop-blur-xl backdrop-saturate-[180%] border-border/60 shadow-sm"
          : "bg-surface border-transparent"
      }`}>
        <div className="container">
          <div className="flex items-center justify-between h-14 lg:h-16">
            {/* Logo */}
            <Logo variant="default" href="/" />

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-6">
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
                  className={`flex items-center gap-1 text-sm font-medium transition-colors duration-200 relative after:absolute after:bottom-[-2px] after:left-0 after:h-[2px] after:bg-primary after:transition-all after:duration-300 ${
                    isActive("/category")
                      ? "text-text after:w-full"
                      : "text-text-muted hover:text-text after:w-0 hover:after:w-full"
                  }`}
                >
                  Shop
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${shopMenuOpen ? "rotate-180" : ""}`} />
                </Link>

                {/* Mega-menu dropdown */}
                {shopMenuOpen && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-[520px] bg-surface border border-border rounded-2xl shadow-xl z-50 p-5 animate-fade-in">
                    {/* Arrow */}
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-surface border-l border-t border-border rotate-45" />

                    <div className="grid grid-cols-3 gap-5">
                      {/* Categories */}
                      <div>
                        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Categories</p>
                        <div className="space-y-1">
                          {[
                            { href: "/category?cat=toys", label: "Toys & Vibrators" },
                            { href: "/category?cat=lingerie", label: "Lingerie" },
                            { href: "/category?cat=wellness", label: "Wellness" },
                            { href: "/category?cat=lubricants", label: "Lubricants" },
                            { href: "/category?cat=couples", label: "Couples" },
                          ].map((item) => (
                            <Link
                              key={item.href}
                              href={item.href}
                              className="block text-sm py-1 text-text-muted hover:text-primary transition-colors"
                              onClick={() => setShopMenuOpen(false)}
                            >
                              {item.label}
                            </Link>
                          ))}
                          <Link
                            href="/category"
                            className="block text-sm py-1 text-primary font-medium hover:text-primary/80 transition-colors mt-2"
                            onClick={() => setShopMenuOpen(false)}
                          >
                            View All →
                          </Link>
                        </div>
                      </div>

                      {/* Specials */}
                      <div>
                        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Specials</p>
                        <div className="space-y-1">
                          {[
                            { href: "/sales", label: "Sales & Deals", icon: Star },
                            { href: "/subscription-boxes", label: "Subscription Boxes", icon: Package },
                            { href: "/send-to-uganda", label: "Send a Gift", icon: Gift },
                            { href: "/build-your-box", label: "Build Your Box", icon: BoxSelect },
                            { href: "/gift-finder", label: "Gift Finder", icon: Wand2 },
                            { href: "/couples", label: "Couples", icon: Heart },
                            { href: "/beginners", label: "Beginners Guide", icon: Sparkles },
                          ].map(({ href, label, icon: Icon }) => (
                            <Link
                              key={href}
                              href={href}
                              className="flex items-center gap-2 text-sm py-1 text-text-muted hover:text-primary transition-colors"
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

              {/* Other desktop nav links */}
              {desktopNavLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-colors duration-200 relative after:absolute after:bottom-[-2px] after:left-0 after:h-[2px] after:bg-primary after:transition-all after:duration-300 ${
                    isActive(link.href)
                      ? "text-text after:w-full"
                      : "text-text-muted hover:text-text after:w-0 hover:after:w-full"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Search - Desktop */}
            <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
              <SearchBar />
            </div>

            {/* Icons */}
            <div className="flex items-center gap-1">
              {/* Mobile Search */}
              <button
                onClick={() => setMobileSearchOpen(true)}
                className="btn-icon md:hidden"
                aria-label="Search"
              >
                <Search className="w-5 h-5" />
              </button>

              <div className="hidden sm:block">
                <LanguageSelector />
              </div>

              <div className="hidden sm:block">
                <CountrySelector />
              </div>

              <div className="hidden sm:block">
                <ThemeToggle />
              </div>

              <Link href={user ? "/account" : "/auth/login"} className="btn-icon relative" aria-label="Account">
                <User className="w-5 h-5" />
                {user && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-green-500 rounded-full" />
                )}
              </Link>

              <Link href="/wishlist" className="btn-icon relative" aria-label="Wishlist">
                <Heart className="w-5 h-5" />
                {wishlistCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-medium rounded-full flex items-center justify-center">
                    {wishlistCount > 9 ? "9+" : wishlistCount}
                  </span>
                )}
              </Link>

              {/* Cart */}
              <button
                onClick={openCart}
                className="btn-icon relative"
                aria-label="Cart"
              >
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
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <nav className="lg:hidden py-4 border-t border-border animate-fade-in">
              <div className="space-y-0.5">
                {mobileNavLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center px-4 py-3.5 rounded-12 font-medium transition-all duration-200 min-h-[44px] ${
                      isActive(link.href)
                        ? "text-primary bg-primary/5"
                        : "text-text hover:text-primary hover:bg-surface-secondary"
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="pt-3 border-t border-border mt-3">
                  <div className="px-4 py-3 flex items-center justify-between">
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

      {/* Mobile Menu backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Search Overlay — uses full SearchBar with suggestions */}
      {mobileSearchOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 animate-fade-in" onClick={() => setMobileSearchOpen(false)}>
          <div
            className="bg-surface p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <SearchBar autoFocus onNavigate={() => setMobileSearchOpen(false)} />
              </div>
              <button
                onClick={() => setMobileSearchOpen(false)}
                className="btn-icon flex-shrink-0"
                aria-label="Close search"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
