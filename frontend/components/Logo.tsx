"use client";

import Link from "next/link";

interface LogoProps {
  variant?: "default" | "white" | "compact";
  className?: string;
  href?: string;
}

export default function Logo({ variant = "default", className = "", href = "/" }: LogoProps) {
  const colors = {
    default: {
      primary: "text-primary",
      secondary: "text-text",
    },
    white: {
      primary: "text-white",
      secondary: "text-white",
    },
    compact: {
      primary: "text-primary",
      secondary: "text-text",
    },
  };

  const LogoContent = () => (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Logo Icon */}
      <div className={`relative ${variant === "compact" ? "w-8 h-8" : "w-9 h-9"}`}>
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0071e3" />
              <stop offset="100%" stopColor="#40a9ff" />
            </linearGradient>
          </defs>
          <circle cx="20" cy="20" r="20" fill="url(#logoGradient)" />
          <path
            d="M14 10h8c4.418 0 8 3.582 8 8s-3.582 8-8 8h-4v6h-4V10zm4 12h4c2.209 0 4-1.791 4-4s-1.791-4-4-4h-4v8z"
            fill="white"
          />
        </svg>
      </div>
      
      {/* Text - single line */}
      {variant !== "compact" && (
        <span className={`font-semibold text-lg tracking-tight ${colors[variant].secondary}`}>
          PleasureZone
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="flex items-center shrink-0 hover:opacity-80 transition-opacity duration-200">
        <LogoContent />
      </Link>
    );
  }

  return <LogoContent />;
}
