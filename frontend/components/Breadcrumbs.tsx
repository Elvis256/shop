"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { usePathname } from "next/navigation";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  showHome?: boolean;
}

export default function Breadcrumbs({ items, showHome = true }: BreadcrumbsProps) {
  const pathname = usePathname();

  // Auto-generate breadcrumbs from pathname if items not provided
  const breadcrumbs = items || generateBreadcrumbs(pathname);

  if (breadcrumbs.length === 0) return null;

  return (
    <nav className="flex items-center text-sm text-gray-500 mb-4" aria-label="Breadcrumb">
      {showHome && (
        <>
          <Link 
            href="/" 
            className="flex items-center hover:text-primary transition-colors"
            aria-label="Home"
          >
            <Home className="w-4 h-4" />
          </Link>
          <ChevronRight className="w-4 h-4 mx-2 text-gray-300" />
        </>
      )}
      
      {breadcrumbs.map((item, index) => (
        <span key={index} className="flex items-center">
          {item.href && index < breadcrumbs.length - 1 ? (
            <Link 
              href={item.href}
              className="hover:text-primary transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className={index === breadcrumbs.length - 1 ? "text-gray-900 font-medium" : ""}>
              {item.label}
            </span>
          )}
          {index < breadcrumbs.length - 1 && (
            <ChevronRight className="w-4 h-4 mx-2 text-gray-300" />
          )}
        </span>
      ))}
    </nav>
  );
}

function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);
  
  const breadcrumbs: BreadcrumbItem[] = [];
  let currentPath = "";

  const labelMap: Record<string, string> = {
    admin: "Admin",
    products: "Products",
    orders: "Orders",
    customers: "Customers",
    categories: "Categories",
    coupons: "Coupons",
    inventory: "Inventory",
    analytics: "Analytics",
    settings: "Settings",
    staff: "Staff",
    activity: "Activity Log",
    content: "Content",
    category: "Categories",
    account: "Account",
    wishlist: "Wishlist",
    cart: "Cart",
    checkout: "Checkout",
    auth: "Account",
    login: "Sign In",
    register: "Register",
    new: "New",
    edit: "Edit",
  };

  for (const segment of segments) {
    currentPath += `/${segment}`;
    
    // Skip dynamic segments like IDs
    if (segment.match(/^[a-f0-9-]{20,}$/) || segment.match(/^\d+$/)) {
      continue;
    }
    
    breadcrumbs.push({
      label: labelMap[segment] || formatSegment(segment),
      href: currentPath,
    });
  }

  return breadcrumbs;
}

function formatSegment(segment: string): string {
  return segment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
