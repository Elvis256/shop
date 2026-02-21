"use client";

import { 
  Package, 
  ShoppingCart, 
  Heart, 
  Search, 
  Users, 
  FileText, 
  BarChart3,
  Inbox,
  Image,
  Bell,
  Calendar,
  MessageSquare,
  LucideIcon,
} from "lucide-react";
import Link from "next/link";

type EmptyStateType = 
  | "cart" 
  | "wishlist" 
  | "orders" 
  | "products" 
  | "search" 
  | "customers" 
  | "content"
  | "analytics"
  | "notifications"
  | "messages"
  | "events"
  | "images"
  | "generic";

interface EmptyStateProps {
  type?: EmptyStateType;
  title?: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  icon?: LucideIcon;
  size?: "sm" | "md" | "lg";
}

const defaultContent: Record<EmptyStateType, { icon: LucideIcon; title: string; description: string }> = {
  cart: {
    icon: ShoppingCart,
    title: "Your cart is empty",
    description: "Looks like you haven't added anything to your cart yet.",
  },
  wishlist: {
    icon: Heart,
    title: "Your wishlist is empty",
    description: "Save items you love by clicking the heart icon.",
  },
  orders: {
    icon: Package,
    title: "No orders yet",
    description: "When you place your first order, it will appear here.",
  },
  products: {
    icon: Package,
    title: "No products found",
    description: "Try adjusting your filters or search terms.",
  },
  search: {
    icon: Search,
    title: "No results found",
    description: "Try searching with different keywords.",
  },
  customers: {
    icon: Users,
    title: "No customers yet",
    description: "Customers will appear here when they create accounts.",
  },
  content: {
    icon: FileText,
    title: "No content yet",
    description: "Create your first piece of content to get started.",
  },
  analytics: {
    icon: BarChart3,
    title: "No data available",
    description: "Analytics will appear once you have some activity.",
  },
  notifications: {
    icon: Bell,
    title: "No notifications",
    description: "You're all caught up! Check back later.",
  },
  messages: {
    icon: MessageSquare,
    title: "No messages",
    description: "Your inbox is empty.",
  },
  events: {
    icon: Calendar,
    title: "No events",
    description: "No upcoming events scheduled.",
  },
  images: {
    icon: Image,
    title: "No images",
    description: "Upload some images to see them here.",
  },
  generic: {
    icon: Inbox,
    title: "Nothing here",
    description: "There's nothing to show at the moment.",
  },
};

export default function EmptyState({ 
  type = "generic",
  title,
  description,
  action,
  icon: CustomIcon,
  size = "md",
}: EmptyStateProps) {
  const content = defaultContent[type];
  const Icon = CustomIcon || content.icon;
  const displayTitle = title || content.title;
  const displayDescription = description || content.description;

  const sizeClasses = {
    sm: {
      container: "py-8",
      icon: "w-10 h-10",
      iconBg: "w-16 h-16",
      title: "text-base",
      description: "text-sm",
    },
    md: {
      container: "py-12",
      icon: "w-12 h-12",
      iconBg: "w-20 h-20",
      title: "text-lg",
      description: "text-sm",
    },
    lg: {
      container: "py-16",
      icon: "w-16 h-16",
      iconBg: "w-24 h-24",
      title: "text-xl",
      description: "text-base",
    },
  };

  const classes = sizeClasses[size];

  return (
    <div className={`flex flex-col items-center justify-center text-center ${classes.container}`}>
      {/* Illustrated Icon */}
      <div className={`${classes.iconBg} rounded-full bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center mb-4 shadow-inner`}>
        <Icon className={`${classes.icon} text-gray-300`} />
      </div>
      
      <h3 className={`font-semibold text-gray-900 ${classes.title}`}>
        {displayTitle}
      </h3>
      
      <p className={`text-gray-500 mt-1 max-w-sm ${classes.description}`}>
        {displayDescription}
      </p>
      
      {action && (
        <div className="mt-6">
          {action.href ? (
            <Link 
              href={action.href}
              className="btn-primary"
            >
              {action.label}
            </Link>
          ) : (
            <button 
              onClick={action.onClick}
              className="btn-primary"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
