"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Section from "@/components/Section";
import { useAuth } from "@/lib/hooks/useAuth";
import { api } from "@/lib/api";
import { User, Package, Heart, MapPin, Settings, LogOut, ChevronRight } from "lucide-react";

export default function AccountPage() {
  const router = useRouter();
  const { user, isLoading, logout, isAdmin } = useAuth();
  const [stats, setStats] = useState({ orders: 0, wishlist: 0 });

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) {
      api.getProfile().then((data) => {
        setStats({
          orders: data._count?.orders || 0,
          wishlist: data._count?.wishlist || 0,
        });
      });
    }
  }, [user]);

  if (isLoading || !user) {
    return (
      <Section>
        <div className="text-center py-16">Loading...</div>
      </Section>
    );
  }

  const menuItems = [
    { href: "/account/orders", icon: Package, label: "My Orders", count: stats.orders },
    { href: "/wishlist", icon: Heart, label: "Wishlist", count: stats.wishlist },
    { href: "/account/addresses", icon: MapPin, label: "Addresses" },
    { href: "/account/settings", icon: Settings, label: "Account Settings" },
  ];

  return (
    <Section>
      <div className="max-w-2xl mx-auto">
        {/* Profile Header */}
        <div className="card mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-accent text-white rounded-full flex items-center justify-center text-2xl font-bold">
              {user.name?.[0] || user.email[0].toUpperCase()}
            </div>
            <div>
              <h2>{user.name || "Welcome!"}</h2>
              <p className="text-text-muted text-small">{user.email}</p>
            </div>
          </div>

          {isAdmin && (
            <Link
              href="/admin"
              className="mt-4 inline-flex items-center gap-2 text-accent hover:underline"
            >
              Go to Admin Panel
              <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        {/* Menu */}
        <div className="space-y-2">
          {menuItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div className="card flex items-center justify-between hover:border-accent transition-colors cursor-pointer">
                <div className="flex items-center gap-4">
                  <item.icon className="w-5 h-5 text-text-muted" />
                  <span className="font-medium">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {item.count !== undefined && (
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
