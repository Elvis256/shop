import { Package, EyeOff, Shield, Truck } from "lucide-react";

const badges = [
  { icon: Package, label: "Plain Packaging", desc: "No logos or labels" },
  { icon: EyeOff, label: "Anonymous Billing", desc: "Discreet charges" },
  { icon: Shield, label: "Secure Checkout", desc: "256-bit encryption" },
  { icon: Truck, label: "Fast Delivery", desc: "1-3 days nationwide" },
];

export default function TrustStrip() {
  return (
    <section className="border-y border-gray-100 bg-gradient-to-r from-primary-50 to-violet-50">
      <div className="container py-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {badges.map((badge) => (
            <div key={badge.label} className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                <badge.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-900">{badge.label}</p>
                <p className="text-xs text-gray-500">{badge.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
