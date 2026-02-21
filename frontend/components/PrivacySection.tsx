import { Lock, Package, EyeOff, Shield } from "lucide-react";

export default function PrivacySection() {
  const features = [
    {
      icon: Package,
      title: "Plain Packaging",
      desc: "Unmarked boxes with no indication of contents or sender details.",
    },
    {
      icon: EyeOff,
      title: "Anonymous Billing",
      desc: "Neutral business name appears on your bank statements.",
    },
    {
      icon: Lock,
      title: "Secure Checkout",
      desc: "256-bit SSL encryption protects all your data.",
    },
    {
      icon: Shield,
      title: "No Data Selling",
      desc: "We never share or sell your personal information.",
    },
  ];

  return (
    <section className="bg-gradient-to-br from-gray-900 via-gray-900 to-primary-700 text-white py-16 sm:py-20">
      <div className="container">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="inline-block px-4 py-1.5 bg-white/10 rounded-full text-sm font-medium mb-4">
            100% Discreet
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Your Privacy is Our Priority
          </h2>
          <p className="text-gray-300 text-lg">
            We understand the importance of discretion. Every order is handled with
            the utmost care to protect your privacy.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {features.map((feature) => (
            <div 
              key={feature.title}
              className="text-center p-6 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-colors"
            >
              <div className="w-14 h-14 mx-auto mb-4 bg-primary/20 rounded-xl flex items-center justify-center">
                <feature.icon className="w-7 h-7 text-primary-200" />
              </div>
              <h4 className="font-semibold text-lg mb-2 text-white">{feature.title}</h4>
              <p className="text-sm text-gray-400 leading-relaxed">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
