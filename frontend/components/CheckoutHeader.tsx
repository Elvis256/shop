"use client";

import Link from "next/link";
import Logo from "@/components/Logo";
import { Lock, ShieldCheck } from "lucide-react";

export default function CheckoutHeader() {
  return (
    <header className="border-b border-border bg-surface sticky top-0 z-40">
      <div className="container">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex-shrink-0" aria-label="Return to store">
            <Logo variant="default" href="/" />
          </Link>

          <div className="flex items-center gap-2 text-sm text-text-muted">
            <ShieldCheck className="w-4 h-4 text-green-500" />
            <span className="hidden sm:inline font-medium">Secure Checkout</span>
            <Lock className="w-3.5 h-3.5 sm:hidden text-green-500" />
          </div>

          {/* Spacer to balance logo */}
          <div className="w-24 hidden sm:block" />
        </div>
      </div>
    </header>
  );
}
