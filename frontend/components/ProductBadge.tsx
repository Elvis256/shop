import { Flame, Sparkles, Tag, Clock, Award } from "lucide-react";

type BadgeType = "sale" | "new" | "bestseller" | "limited" | "lowStock" | "custom";

interface ProductBadgeProps {
  type: BadgeType;
  text?: string;
  discount?: number;
  stock?: number;
}

const badgeConfig: Record<BadgeType, { icon: React.ReactNode; bgColor: string; textColor: string }> = {
  sale: {
    icon: <Tag className="w-3 h-3" />,
    bgColor: "bg-red-500",
    textColor: "text-white",
  },
  new: {
    icon: <Sparkles className="w-3 h-3" />,
    bgColor: "bg-green-500",
    textColor: "text-white",
  },
  bestseller: {
    icon: <Flame className="w-3 h-3" />,
    bgColor: "bg-orange-500",
    textColor: "text-white",
  },
  limited: {
    icon: <Clock className="w-3 h-3" />,
    bgColor: "bg-purple-500",
    textColor: "text-white",
  },
  lowStock: {
    icon: <Award className="w-3 h-3" />,
    bgColor: "bg-amber-500",
    textColor: "text-white",
  },
  custom: {
    icon: null,
    bgColor: "bg-gray-800",
    textColor: "text-white",
  },
};

export default function ProductBadge({ type, text, discount, stock }: ProductBadgeProps) {
  const config = badgeConfig[type];

  let displayText = text;
  if (type === "sale" && discount) {
    displayText = `${discount}% OFF`;
  } else if (type === "new") {
    displayText = text || "New";
  } else if (type === "bestseller") {
    displayText = text || "Bestseller";
  } else if (type === "limited") {
    displayText = text || "Limited";
  } else if (type === "lowStock" && stock) {
    displayText = `Only ${stock} left!`;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded ${config.bgColor} ${config.textColor}`}
    >
      {config.icon}
      {displayText}
    </span>
  );
}

interface ProductBadgesProps {
  isNew?: boolean;
  isBestseller?: boolean;
  discount?: number;
  stock?: number;
  lowStockThreshold?: number;
  badgeText?: string;
  className?: string;
}

export function ProductBadges({
  isNew,
  isBestseller,
  discount,
  stock,
  lowStockThreshold = 5,
  badgeText,
  className = "",
}: ProductBadgesProps) {
  const badges: React.ReactNode[] = [];

  // Priority order: Sale > Bestseller > New > Low Stock > Custom
  if (discount && discount > 0) {
    badges.push(<ProductBadge key="sale" type="sale" discount={discount} />);
  }

  if (isBestseller) {
    badges.push(<ProductBadge key="bestseller" type="bestseller" />);
  }

  if (isNew) {
    badges.push(<ProductBadge key="new" type="new" />);
  }

  if (stock !== undefined && stock > 0 && stock <= lowStockThreshold) {
    badges.push(<ProductBadge key="lowStock" type="lowStock" stock={stock} />);
  }

  if (badgeText) {
    badges.push(<ProductBadge key="custom" type="custom" text={badgeText} />);
  }

  if (badges.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {badges}
    </div>
  );
}
