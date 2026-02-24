"use client";

import Link from "next/link";

interface LogoProps {
  variant?: "default" | "white" | "compact";
  className?: string;
  href?: string;
}

// SVG icon — PZ monogram on blue rounded square, matches favicon
function PZIcon({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="40" height="40" rx="9" fill="#0071e3" />

      {/* Letter P */}
      {/* Vertical stem */}
      <rect x="9" y="10" width="3.5" height="20" rx="1.75" fill="white" />
      {/* Bowl (filled circle top-right of stem) */}
      <circle cx="16.5" cy="15.5" r="5.5" fill="white" />
      {/* Bowl inner cutout */}
      <circle cx="16.5" cy="15.5" r="3" fill="#0071e3" />
      {/* Restore stem over cutout */}
      <rect x="9" y="10" width="3.5" height="20" rx="1.75" fill="white" />

      {/* Letter Z */}
      {/* Top bar */}
      <rect x="22" y="10" width="9" height="3.5" rx="1.75" fill="white" />
      {/* Bottom bar */}
      <rect x="22" y="26.5" width="9" height="3.5" rx="1.75" fill="white" />
      {/* Diagonal */}
      <line x1="31" y1="13.5" x2="22" y2="26.5" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

export default function Logo({ variant = "default", className = "", href = "/" }: LogoProps) {
  const isWhite = variant === "white";
  const isCompact = variant === "compact";

  const LogoContent = () => (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <PZIcon size={isCompact ? 30 : 36} />

      {!isCompact && (
        <span
          className="font-semibold text-[1.1rem] tracking-tight leading-none"
          style={{ color: isWhite ? "white" : "#1d1d1f" }}
        >
          Pleasure
          <span style={{ color: "#0071e3" }}>Zone</span>
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
