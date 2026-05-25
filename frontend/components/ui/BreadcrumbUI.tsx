/**
 * Visual Breadcrumb Component
 * Displays breadcrumb navigation for improved UX and internal linking
 * Works with both static and dynamic breadcrumb data
 */

import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItemUI {
  name: string;
  url?: string;
}

interface BreadcrumbUIProps {
  items: BreadcrumbItemUI[];
  className?: string;
}

export default function BreadcrumbUI({ items, className = "" }: BreadcrumbUIProps) {
  return (
    <nav
      className={`flex items-center gap-2 text-sm py-3 px-4 bg-gray-50 rounded-lg border border-gray-200 ${className}`}
      aria-label="Breadcrumb"
    >
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {index > 0 && <ChevronRight className="w-4 h-4 text-gray-400" />}
          {item.url ? (
            <Link
              href={item.url}
              className="text-pink-600 hover:text-pink-700 hover:underline transition-colors"
            >
              {item.name}
            </Link>
          ) : (
            <span className="text-gray-600">{item.name}</span>
          )}
        </div>
      ))}
    </nav>
  );
}
