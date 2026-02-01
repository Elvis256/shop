"use client";

import { ReactNode, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Tag,
  FolderTree,
  Settings,
  ChevronLeft,
  LogOut,
} from "lucide-react";

const navItems = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/products", icon: Package, label: "Products" },
  { href: "/admin/orders", icon: ShoppingCart, label: "Orders" },
  { href: "/admin/customers", icon: Users, label: "Customers" },
  { href: "/admin/coupons", icon: Tag, label: "Coupons" },
  { href: "/admin/categories", icon: FolderTree, label: "Categories" },
  { href: "/admin/settings", icon: Settings, label: "Settings" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, isAdmin, logout } = useAuth();

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      router.push("/auth/login");
    }
  }, [user, isLoading, isAdmin, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-border flex flex-col">
        <div className="p-6 border-b border-border">
          <Link href="/" className="flex items-center gap-2 text-text-muted hover:text-accent">
            <ChevronLeft className="w-5 h-5" />
            <span className="text-small">Back to Store</span>
          </Link>
          <h1 className="mt-4 text-xl font-bold">Admin Panel</h1>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-8 transition-colors ${
                  isActive
                    ? "bg-accent text-white"
                    : "text-text-muted hover:bg-gray-100 hover:text-text"
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-accent text-white rounded-full flex items-center justify-center font-bold">
              {user.name?.[0] || user.email[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{user.name || "Admin"}</p>
              <p className="text-xs text-text-muted truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={() => {
              logout();
              router.push("/");
            }}
            className="w-full btn-secondary text-small gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
