import { Package, EyeOff, Shield, Truck } from "lucide-react";

const badges = [
  { icon: Package, label: "Plain Packaging" },
  { icon: EyeOff, label: "Anonymous Billing" },
  { icon: Shield, label: "Secure Checkout" },
  { icon: Truck, label: "Fast Delivery" },
];

export default function TrustStrip() {
  return (
    <section className="border-y border-border bg-gray-50">
      <div className="container py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {badges.map((badge) => (
            <div key={badge.label} className="flex items-center gap-3">
              <badge.icon className="w-6 h-6 text-accent" />
              <span className="font-medium text-small">{badge.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
