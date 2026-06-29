"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Section from "@/components/Section";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  Package,
  Heart,
  MapPin,
  Settings,
  LogOut,
  ChevronRight,
  RotateCcw,
  Award,
  Users,
  Shield,
  Store,
  MessageCircle,
  Gift,
  TrendingUp,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  Loader2,
  Wallet,
  Copy,
  Check,
  Headphones,
  RefreshCw,
} from "lucide-react";

const API_URL = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");

interface DashboardOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: string;
  currency: string;
  createdAt: string;
  items: Array<{
    name: string;
    quantity: number;
    price: string;
    productId: string;
    product?: { images?: Array<{ url: string }> };
  }>;
}

interface DashboardData {
  recentOrders: DashboardOrder[];
  stats: {
    totalOrders: number;
    totalSpent: number;
    wishlistCount: number;
    unreadMessages: number;
    ordersByStatus: Record<string, number>;
  };
  loyalty: { points: number; tier: string; lifetimePoints: number };
  referralCode: string | null;
  storeCredit: number;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  PENDING: { label: "Pending", color: "text-yellow-600 bg-yellow-50", icon: Clock },
  CONFIRMED: { label: "Confirmed", color: "text-blue-600 bg-blue-50", icon: CheckCircle2 },
  PROCESSING: { label: "Processing", color: "text-indigo-600 bg-indigo-50", icon: TrendingUp },
  SHIPPED: { label: "Shipped", color: "text-purple-600 bg-purple-50", icon: Truck },
  DELIVERED: { label: "Delivered", color: "text-green-600 bg-green-50", icon: CheckCircle2 },
  CANCELLED: { label: "Cancelled", color: "text-red-600 bg-red-50", icon: XCircle },
};

const tierColors: Record<string, string> = {
  BRONZE: "from-amber-600 to-amber-400",
  SILVER: "from-gray-400 to-gray-300",
  GOLD: "from-yellow-500 to-yellow-300",
  PLATINUM: "from-indigo-500 to-indigo-300",
};

function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

export default function AccountPage() {
  const router = useRouter();
  const { user, isLoading, logout, isAdmin, isSeller } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [receiptMasked, setReceiptMasked] = useState(false);
  const [savingMasked, setSavingMasked] = useState(false);
  const [localShield, setLocalShield] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user) return;
    fetch(`${API_URL}/api/auth/dashboard`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setDashboard(data))
      .catch(() => {})
      .finally(() => setLoading(false));

    fetch(`${API_URL}/api/auth/me`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data) setReceiptMasked(data.receiptMasked || false);
      })
      .catch(() => {});

    const shield = localStorage.getItem("stealth_blur_shield") !== "false";
    setLocalShield(shield);
  }, [user]);

  const handleToggleReceiptMasked = async (checked: boolean) => {
    setSavingMasked(true);
    try {
      const csrf = getCsrfToken();
      const res = await fetch(`${API_URL}/api/auth/me`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(csrf ? { "x-csrf-token": csrf } : {}) },
        body: JSON.stringify({ receiptMasked: checked }),
      });
      if (res.ok) {
        setReceiptMasked(checked);
        // Refresh dashboard data so recent orders mask dynamically
        fetch(`${API_URL}/api/auth/dashboard`, { credentials: "include" })
          .then((r) => r.json())
          .then((data) => setDashboard(data))
          .catch(() => {});
      }
    } catch {}
    setSavingMasked(false);
  };

  const handleToggleLocalShield = (checked: boolean) => {
    localStorage.setItem("stealth_blur_shield", String(checked));
    setLocalShield(checked);
  };

  const copyReferral = () => {
    if (dashboard?.referralCode) {
      navigator.clipboard.writeText(dashboard.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading || !user) {
    return (
      <Section>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Section>
    );
  }

  const fmt = (n: number) =>
    `UGX ${n.toLocaleString()}`;

  const logisticsGroup = [
    { href: "/account/orders", icon: Package, label: "My Orders", count: dashboard?.stats.totalOrders },
    { href: "/account/addresses", icon: MapPin, label: "Addresses" },
    { href: "/account/returns", icon: RotateCcw, label: "Returns & Refunds" },
  ];

  const financialsGroup = [
    { href: "/account/wallet", icon: Wallet, label: "Store Credit", text: dashboard ? fmt(dashboard.storeCredit) : undefined },
    { href: "/account/layaway", icon: Clock, label: "Layaway Plans" },
    { href: "/account/subscriptions", icon: RefreshCw, label: "Subscriptions" },
  ];

  const loyaltyGroup = [
    { href: "/account/loyalty", icon: Award, label: "Loyalty Points", text: dashboard ? dashboard.loyalty.points.toLocaleString() : undefined },
    { href: "/account/partner", icon: Users, label: "Partner Connection" },
    { href: "/account/referrals", icon: Gift, label: "Refer & Earn" },
    { href: "/wishlist", icon: Heart, label: "Wishlist", count: dashboard?.stats.wishlistCount },
    { href: "/account/messages", icon: MessageCircle, label: "Messages", count: dashboard?.stats.unreadMessages || undefined },
  ];

  const discretionGroup = [
    { href: "/account/security", icon: Shield, label: "Security & 2FA" },
    { href: "/account/settings", icon: Settings, label: "Account Settings" },
    { href: "/account/audio-guides", icon: Headphones, label: "Audio Guides" },
  ];

  interface MenuItem {
    href: string;
    icon: any;
    label: string;
    count?: number;
    text?: string;
  }

  const renderGroup = (title: string, items: MenuItem[]) => (
    <div className="card p-4 space-y-3">
      <h4 className="font-bold text-xs text-text-muted uppercase tracking-wider mb-2">{title}</h4>
      <div className="space-y-2">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-secondary transition-colors group">
            <div className="flex items-center gap-3">
              <item.icon className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors" />
              <span className="text-xs font-semibold text-text">{item.label}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {item.count !== undefined && item.count > 0 && (
                <span className="badge text-[10px] py-0.5 px-1.5">{item.count}</span>
              )}
              {"text" in item && item.text && (
                <span className="text-[10px] font-mono font-bold text-accent bg-accent/5 px-1.5 py-0.5 rounded">{item.text}</span>
              )}
              <ChevronRight className="w-3.5 h-3.5 text-text-muted group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );

  return (
    <Section>
      <div className="max-w-4xl mx-auto">
        {/* Profile Header */}
        <div className="card mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-purple-400 text-white rounded-full flex items-center justify-center text-2xl font-bold shadow-lg flex-shrink-0">
              {user.name?.[0] || user.email[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold">{user.name || "Welcome!"}</h2>
              <p className="text-text-muted text-sm">{user.email}</p>
              {user.createdAt && (
                <p className="text-text-muted text-xs mt-1">
                  Member since {new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {isAdmin && (
                <Link href="/admin" className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
                  Admin Panel <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              )}
              {isSeller && (
                <Link href="/seller" className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                  <Store className="w-3.5 h-3.5" /> Seller Dashboard
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* 2-Column Restructured Layout */}
        <div className="grid md:grid-cols-3 gap-6 items-start">
          
          {/* Left Column: Discretion Quick Settings, Order Pipeline, Recent Orders */}
          <div className="md:col-span-1 space-y-6">
            {/* Stealth & Discretion Dashboard Controls */}
            <div className="card bg-surface-secondary dark:bg-gray-800/20 border-accent/20">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-accent animate-pulse" />
                <h3 className="font-bold text-sm text-text">Discretion & Privacy</h3>
              </div>
              <div className="space-y-3">
                {/* Toggle 1: Receipt Masking */}
                <div className="flex items-center justify-between p-3 bg-surface dark:bg-gray-900/40 rounded-lg border border-border">
                  <div className="min-w-0 pr-2">
                    <span className="block text-xs font-semibold text-text">Digital Receipt Masking</span>
                    <span className="block text-[10px] text-text-muted leading-tight mt-0.5">
                      Mask product names on billing & delivery passes.
                    </span>
                  </div>
                  <label className="relative shrink-0 cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={receiptMasked}
                      disabled={savingMasked}
                      onChange={(e) => handleToggleReceiptMasked(e.target.checked)}
                    />
                    <div className={`w-10 h-5 rounded-full transition-colors ${receiptMasked ? "bg-accent" : "bg-gray-300"}`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${receiptMasked ? "translate-x-5" : "translate-x-0.5"}`} />
                    </div>
                  </label>
                </div>

                {/* Toggle 2: Local Session Auto-Lock/Blur */}
                <div className="flex items-center justify-between p-3 bg-surface dark:bg-gray-900/40 rounded-lg border border-border">
                  <div className="min-w-0 pr-2">
                    <span className="block text-xs font-semibold text-text">Incognito Screen Shield</span>
                    <span className="block text-[10px] text-text-muted leading-tight mt-0.5">
                      Blur viewport if app is backgrounded or minimized.
                    </span>
                  </div>
                  <label className="relative shrink-0 cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={localShield}
                      onChange={(e) => handleToggleLocalShield(e.target.checked)}
                    />
                    <div className={`w-10 h-5 rounded-full transition-colors ${localShield ? "bg-accent" : "bg-gray-300"}`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${localShield ? "translate-x-5" : "translate-x-0.5"}`} />
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Order Pipeline */}
            {dashboard && dashboard.stats.totalOrders > 0 && (
              <div className="card p-4">
                <h3 className="font-semibold text-sm mb-3">Order Activity</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(dashboard.stats.ordersByStatus)
                    .filter(([, count]) => count > 0)
                    .map(([status, count]) => {
                      const config = statusConfig[status] || { label: status, color: "text-gray-600 bg-gray-50", icon: Clock };
                      const Icon = config.icon;
                      return (
                        <Link
                          key={status}
                          href={`/account/orders?status=${status.toLowerCase()}`}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${config.color} hover:opacity-80 transition-opacity`}
                        >
                          <Icon className="w-3 h-3" />
                          {count} {config.label}
                        </Link>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Recent Orders */}
            {dashboard && dashboard.recentOrders.length > 0 && (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-sm">Recent Orders</h3>
                  <Link href="/account/orders" className="text-xs text-primary hover:underline">
                    View all <ChevronRight className="w-3 h-3 inline" />
                  </Link>
                </div>
                <div className="space-y-3">
                  {dashboard.recentOrders.map((order) => {
                    const config = statusConfig[order.status] || statusConfig.PENDING;
                    return (
                      <Link key={order.id} href={`/orders/${order.id}`} className="block">
                        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-secondary transition-colors -mx-1">
                          <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {order.items[0]?.product?.images?.[0]?.url ? (
                              <img
                                src={order.items[0].product.images[0].url}
                                alt=""
                                className="w-full h-full object-cover rounded-lg"
                              />
                            ) : (
                              <Package className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate text-text">
                              {order.items.map((i) => i.name).join(", ")}
                            </p>
                            <p className="text-[10px] text-text-muted mt-0.5">
                              {order.orderNumber}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs font-bold text-text">{fmt(Number(order.totalAmount))}</p>
                            <span className={`inline-flex items-center text-[9px] px-1.5 py-0.5 rounded-full ${config.color}`}>
                              {config.label}
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Circular Loyalty SVG Progress, Referral and grouped concerns grid */}
          <div className="md:col-span-2 space-y-6">
            
            {dashboard && (
              <div className="card p-5 bg-gradient-to-r from-accent/5 to-purple-500/5 border-accent/10">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  {/* Glowing circular loyalty progress ring SVG */}
                  <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16 shrink-0">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
                        {/* Background track */}
                        <circle
                          cx="40"
                          cy="40"
                          r="30"
                          className="stroke-gray-100 dark:stroke-gray-800"
                          strokeWidth="6"
                          fill="transparent"
                        />
                        {/* Glowing progress ring */}
                        <circle
                          cx="40"
                          cy="40"
                          r="30"
                          className="stroke-accent transition-all duration-1000 ease-out"
                          strokeWidth="6"
                          strokeDasharray={2 * Math.PI * 30}
                          strokeDashoffset={2 * Math.PI * 30 - (Math.min(100, (dashboard.loyalty.lifetimePoints / (dashboard.loyalty.tier === "BRONZE" ? 5000 : dashboard.loyalty.tier === "SILVER" ? 15000 : 50000)) * 100) / 100) * 2 * Math.PI * 30}
                          strokeLinecap="round"
                          fill="transparent"
                          style={{ filter: "drop-shadow(0 0 4px rgba(236, 72, 153, 0.4))" }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center flex-col">
                        <span className="text-[9px] font-bold text-accent uppercase tracking-wider leading-none">{dashboard.loyalty.tier}</span>
                        <span className="text-[9px] text-text-muted mt-0.5 leading-none">{Math.round(Math.min(100, (dashboard.loyalty.lifetimePoints / (dashboard.loyalty.tier === "BRONZE" ? 5000 : dashboard.loyalty.tier === "SILVER" ? 15000 : 50000)) * 100))}%</span>
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-text">{dashboard.loyalty.tier} Member</p>
                      <p className="text-xs text-text-muted">{dashboard.loyalty.lifetimePoints.toLocaleString()} lifetime points</p>
                      <p className="text-[10px] text-accent mt-0.5 font-medium">
                        {dashboard.loyalty.tier === "PLATINUM" ? "Max tier achieved" : `${((dashboard.loyalty.tier === "BRONZE" ? 5000 : dashboard.loyalty.tier === "SILVER" ? 15000 : 50000) - dashboard.loyalty.lifetimePoints).toLocaleString()} points to next tier`}
                      </p>
                    </div>
                  </div>

                  {/* Referral Code Summary */}
                  {dashboard.referralCode && (
                    <div className="flex-1 min-w-[200px] border-t sm:border-t-0 sm:border-l border-border pt-4 sm:pt-0 sm:pl-6">
                      <p className="font-bold text-xs text-text flex items-center gap-1.5">
                        <Gift className="w-4 h-4 text-accent" /> Share referral and earn credits
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <code className="flex-1 bg-surface border border-dashed border-border rounded-lg px-3 py-1.5 text-xs font-mono text-center tracking-wider text-text">
                          {dashboard.referralCode}
                        </code>
                        <button
                          onClick={copyReferral}
                          className="p-1.5 rounded-lg border border-border hover:bg-surface-secondary transition-colors"
                          title="Copy code"
                        >
                          {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-text-muted" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2x2 Masonry Grid grouping concerns */}
            <div className="grid sm:grid-cols-2 gap-4">
              {renderGroup("Logistics & Orders", logisticsGroup)}
              {renderGroup("Financials", financialsGroup)}
              {renderGroup("Loyalty & Social", loyaltyGroup)}
              {renderGroup("Discretion Center", discretionGroup)}
            </div>

            {/* Sign Out Action Card */}
            <button
              onClick={() => {
                logout();
                router.push("/");
              }}
              className="card w-full flex items-center justify-between p-4 text-red-600 hover:border-red-300 hover:bg-red-50/5 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <LogOut className="w-5 h-5" />
                <span className="font-semibold text-xs uppercase tracking-wider">Sign Out from Account</span>
              </div>
              <ChevronRight className="w-5 h-5 text-red-400" />
            </button>

          </div>
        </div>
      </div>
    </Section>
  );
}
