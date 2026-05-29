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
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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

export default function AccountPage() {
  const router = useRouter();
  const { user, isLoading, logout, isAdmin, isSeller } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

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
  }, [user]);

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

  const menuItems = [
    { href: "/account/orders", icon: Package, label: "My Orders", count: dashboard?.stats.totalOrders },
    { href: "/wishlist", icon: Heart, label: "Wishlist", count: dashboard?.stats.wishlistCount },
    { href: "/account/messages", icon: MessageCircle, label: "Messages", count: dashboard?.stats.unreadMessages || undefined },
    { href: "/account/returns", icon: RotateCcw, label: "Returns & Refunds" },
    { href: "/account/addresses", icon: MapPin, label: "Addresses" },
    { href: "/account/wallet", icon: Wallet, label: "Store Credit" },
    { href: "/account/loyalty", icon: Award, label: "Loyalty Points" },
    { href: "/account/referrals", icon: Users, label: "Refer a Friend" },
    { href: "/account/security", icon: Shield, label: "Security & 2FA" },
    { href: "/account/settings", icon: Settings, label: "Account Settings" },
  ];

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

        {/* Stats Cards */}
        {dashboard && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Link href="/account/orders" className="card hover:border-primary/30 transition-colors text-center p-4">
              <Package className="w-6 h-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{dashboard.stats.totalOrders}</p>
              <p className="text-xs text-text-muted">Total Orders</p>
            </Link>

            <div className="card text-center p-4">
              <TrendingUp className="w-6 h-6 mx-auto mb-2 text-green-600" />
              <p className="text-2xl font-bold">{fmt(dashboard.stats.totalSpent)}</p>
              <p className="text-xs text-text-muted">Total Spent</p>
            </div>

            <Link href="/account/loyalty" className="card hover:border-primary/30 transition-colors text-center p-4">
              <Award className="w-6 h-6 mx-auto mb-2 text-yellow-500" />
              <p className="text-2xl font-bold">{dashboard.loyalty.points.toLocaleString()}</p>
              <p className="text-xs text-text-muted">Loyalty Points</p>
            </Link>

            <Link href="/account/wallet" className="card hover:border-primary/30 transition-colors text-center p-4">
              <Wallet className="w-6 h-6 mx-auto mb-2 text-blue-600" />
              <p className="text-2xl font-bold">{fmt(dashboard.storeCredit)}</p>
              <p className="text-xs text-text-muted">Store Credit</p>
            </Link>
          </div>
        )}

        {/* Loyalty Tier + Referral Row */}
        {dashboard && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {/* Loyalty Tier */}
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${tierColors[dashboard.loyalty.tier] || tierColors.BRONZE} flex items-center justify-center`}>
                  <Award className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold">{dashboard.loyalty.tier} Member</p>
                  <p className="text-xs text-text-muted">{dashboard.loyalty.lifetimePoints.toLocaleString()} lifetime points</p>
                </div>
              </div>
              {dashboard.loyalty.tier !== "PLATINUM" && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-text-muted mb-1">
                    <span>{dashboard.loyalty.tier}</span>
                    <span>{dashboard.loyalty.tier === "BRONZE" ? "SILVER" : dashboard.loyalty.tier === "SILVER" ? "GOLD" : "PLATINUM"}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full bg-gradient-to-r ${tierColors[dashboard.loyalty.tier] || tierColors.BRONZE}`}
                      style={{
                        width: `${Math.min(100, (dashboard.loyalty.lifetimePoints / (dashboard.loyalty.tier === "BRONZE" ? 5000 : dashboard.loyalty.tier === "SILVER" ? 15000 : 50000)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Referral Code */}
            {dashboard.referralCode && (
              <div className="card p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-400 flex items-center justify-center">
                    <Gift className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">Refer & Earn</p>
                    <p className="text-xs text-text-muted">Share your code with friends</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 bg-gray-50 border border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm font-mono text-center tracking-wider">
                    {dashboard.referralCode}
                  </code>
                  <button
                    onClick={copyReferral}
                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    title="Copy code"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-500" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Order Pipeline */}
        {dashboard && dashboard.stats.totalOrders > 0 && (
          <div className="card mb-6 p-4">
            <h3 className="font-semibold mb-3">Order Activity</h3>
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
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${config.color} hover:opacity-80 transition-opacity`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {count} {config.label}
                    </Link>
                  );
                })}
            </div>
          </div>
        )}

        {/* Recent Orders */}
        {dashboard && dashboard.recentOrders.length > 0 && (
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Recent Orders</h3>
              <Link href="/account/orders" className="text-sm text-primary hover:underline">
                View all <ChevronRight className="w-3 h-3 inline" />
              </Link>
            </div>
            <div className="space-y-3">
              {dashboard.recentOrders.map((order) => {
                const config = statusConfig[order.status] || statusConfig.PENDING;
                return (
                  <Link key={order.id} href={`/orders/${order.id}`} className="block">
                    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors -mx-1">
                      {/* Product thumbnail */}
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
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
                        <p className="text-sm font-medium truncate">
                          {order.items.map((i) => i.name).join(", ")}
                        </p>
                        <p className="text-xs text-text-muted">
                          {order.orderNumber} &middot; {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold">{fmt(Number(order.totalAmount))}</p>
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${config.color}`}>
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

        {/* Quick Links Menu */}
        <div className="space-y-2">
          <h3 className="font-semibold mb-2 text-sm text-text-muted uppercase tracking-wide">Account</h3>
          {menuItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div className="card flex items-center justify-between hover:border-primary/30 transition-colors cursor-pointer">
                <div className="flex items-center gap-4">
                  <item.icon className="w-5 h-5 text-text-muted" />
                  <span className="font-medium">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {item.count !== undefined && item.count > 0 && (
                    <span className="badge">{item.count}</span>
                  )}
                  <ChevronRight className="w-5 h-5 text-text-muted" />
                </div>
              </div>
            </Link>
          ))}

          <button
            onClick={() => {
              logout();
              router.push("/");
            }}
            className="card w-full flex items-center gap-4 text-red-600 hover:border-red-300 transition-colors cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </div>
    </Section>
  );
}
