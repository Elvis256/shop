import type { Metadata } from "next";
import SalesPageClient from "./SalesPageClient";

export const metadata: Metadata = {
  title: "Sales & Deals | Pleasure Zone",
  description:
    "Shop the best deals and flash sales on premium products.",
};

export default function SalesPage() {
  return <SalesPageClient />;
}
