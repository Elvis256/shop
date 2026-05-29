"use client";

import { ReactNode, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Wallet,
  Banknote,
  Star,
  Settings,
  ChevronLeft,
  LogOut,
  Menu,
  X,
  Store,
  UserPlus,
  RotateCcw,
  BarChart2,
  MessageCircle,
  Bell,
  Zap,
} from "lucide-react";

interface NavItem {
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
  exact?: boolean;
}

const navItems: NavItem[] = [
  { href: "/seller", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: "/seller/products", icon: Package, label: "Products" },
  { href: "/seller/orders", icon: ShoppingCart, label: "Orders" },
  { href: "/seller/reviews", icon: Star, label: "Reviews" },
  { href: "/seller/returns", icon: RotateCcw, label: "Returns" },
  { href: "/seller/analytics", icon: BarChart2, label: "Analytics" },
  { href: "/seller/ads", icon: Zap, label: "Promote & Ads" },
  { href: "/seller/earnings", icon: Wallet, label: "Earnings" },
  { href: "/seller/messages", icon: MessageCircle, label: "Messages" },
  { href: "/seller/settings", icon: Settings, label: "Store Settings" },
];

export default function SellerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [storeName, setStoreName] = useState<string>("");
  const [notifications, setNotifications] = useState<Array<{ type: string; message: string; detail?: string; time: string; link?: string }>>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const isPublicPage = pathname === "/seller/register" || pathname === "/seller/login";
  const isSeller = !!(user?.seller && user.seller.status === "APPROVED");

  useEffect(() => {
    if (isPublicPage || isLoading) return;
    if (!user) {
      router.push("/seller/login");
    }
  }, [user, isLoading, isPublicPage, router]);

  useEffect(() => {
    if (!user || !isSeller) return;
    if (user.seller?.storeName) setStoreName(user.seller.storeName);
  }, [user, isSeller]);

  useEffect(() => {
    if (!user || !isSeller) return;
    apiFetch("/api/seller/notifications")
      .then((data) => setNotifications(data.notifications || []))
      .catch(() => {});
  }, [user, isSeller]);

  if (isPublicPage) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500">Loading seller panel...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!isSeller) {
    const sellerStatus = user?.seller?.status;
    const isPending = sellerStatus === "PENDING";
    const isRejected = sellerStatus === "REJECTED";

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-8">
          {isPending ? (
            <>
              <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Store className="w-8 h-8 text-yellow-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Application Under Review</h1>
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
                <p className="text-yellow-800 text-sm font-medium mb-1">Status: Pending Review</p>
                <p className="text-yellow-700 text-sm">
                  Your seller application for <span className="font-semibold">{user.seller?.storeName}</span> is being reviewed by our team.
                  This typically takes 24-48 hours. You&apos;ll receive an email once a decision is made.
                </p>
              </div>
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs text-gray-400">Applied as: {user.email}</p>
                <Link href="/" className="text-sm text-gray-500 hover:text-primary transition-colors">
                  ← Continue Shopping
                </Link>
              </div>
            </>
          ) : isRejected ? (
            <>
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Store className="w-8 h-8 text-red-500" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Application Not Approved</h1>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                <p className="text-red-700 text-sm">
                  Unfortunately, your seller application was not approved at this time. Please contact our support team for more details or to re-apply.
                </p>
              </div>
              <div className="flex flex-col items-center gap-3">
                <Link
                  href="/support"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
                >
                  Contact Support
                </Link>
                <Link href="/" className="text-sm text-gray-500 hover:text-primary transition-colors">
                  ← Back to Store
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Store className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Become a Seller</h1>
              <p className="text-gray-600 mb-6">
                You need a seller account to access this area. Apply to start selling on our marketplace.
              </p>
              <Link
                href="/seller/register"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
              >
                <UserPlus className="w-5 h-5" />
                Apply to Sell
              </Link>
              <div className="mt-4">
                <Link href="/" className="text-sm text-gray-500 hover:text-primary transition-colors">
                  ← Back to Store
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b z-[100] flex items-center justify-between px-4">
        <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-gray-100 rounded-lg">
          <Menu className="w-5 h-5" />
        </button>
        <span className="text-sm font-semibold text-gray-900">Seller Dashboard</span>
        <div className="w-9" />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-[200] animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className="fixed top-0 left-0 h-full w-64 z-[300]">
        <aside
          className={`
            h-full w-full bg-white border-r shadow-xl lg:shadow-sm
            transition-transform duration-200 ease-in-out
            lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          `}
        >
          {/* Sidebar Header */}
          <div className="h-16 flex items-center justify-between px-4 border-b">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-purple-400 rounded-lg flex items-center justify-center flex-shrink-0">
                <Store className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {storeName || "My Store"}
                </p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Seller Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Link
                href="/"
                className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-3 h-3" />
                Store
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 overflow-y-auto" style={{ height: "calc(100vh - 180px)" }}>
            <div className="space-y-1">
              {navItems.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <item.icon className={`w-5 h-5 ${isActive ? "text-primary" : "text-gray-400"}`} />
                    <span className="text-sm">{item.label}</span>
                    {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* User Section */}
          <div className="absolute bottom-0 left-0 right-0 p-3 border-t bg-white">
            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer mb-2">
              <div className="w-9 h-9 bg-gradient-to-br from-primary to-purple-400 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-sm">
                {user.name?.[0] || user.email[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user.name || "Seller"}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                href="/account"
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Account
              </Link>
              <button
                onClick={() => {
                  logout();
                  router.push("/");
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Desktop Top Bar */}
      <div className="hidden lg:flex fixed top-0 left-64 right-0 h-14 bg-white border-b z-[50] items-center justify-between px-6">
        <h1 className="text-lg font-semibold text-gray-900">
          {navItems.find((item) =>
            item.exact ? pathname === item.href : pathname.startsWith(item.href)
          )?.label || "Seller Dashboard"}
        </h1>
        <div className="flex items-center gap-4">
          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Bell className="w-5 h-5" />
              {notifications.length > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {notifications.length > 9 ? "9+" : notifications.length}
                </span>
              )}
            </button>
            {showNotifications && (
              <>
                <div className="fixed inset-0 z-[60]" onClick={() => setShowNotifications(false)} />
                <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-xl shadow-xl border border-gray-200 z-[70]">
                  <div className="p-3 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-sm text-gray-400">No new notifications</div>
                  ) : (
                    notifications.map((n, i) => {
                      const typeIcons: Record<string, string> = { order: "🛒", review: "⭐", return: "↩️", low_stock: "📦", payout: "💰" };
                      const ago = Math.round((Date.now() - new Date(n.time).getTime()) / 60000);
                      const timeStr = ago < 60 ? `${ago}m ago` : ago < 1440 ? `${Math.round(ago / 60)}h ago` : `${Math.round(ago / 1440)}d ago`;
                      return (
                        <Link
                          key={i}
                          href={n.link || "/seller"}
                          onClick={() => setShowNotifications(false)}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-50 transition-colors"
                        >
                          <span className="text-lg flex-shrink-0">{typeIcons[n.type] || "📌"}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900">{n.message}</p>
                            {n.detail && <p className="text-xs text-gray-500">{n.detail}</p>}
                            <p className="text-xs text-gray-400 mt-0.5">{timeStr}</p>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-primary transition-colors"
          >
            View Store →
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pt-14">
        <div className="p-4 lg:p-6">{children}</div>
      </main>
    </div>
  );
}
