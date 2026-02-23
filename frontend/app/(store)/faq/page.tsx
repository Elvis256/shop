"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";
import Link from "next/link";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQCategory {
  title: string;
  icon: string;
  items: FAQItem[];
}

const DEFAULT_FAQ: FAQCategory[] = [
  {
    title: "Orders & Shipping",
    icon: "📦",
    items: [
      {
        question: "How long does delivery take?",
        answer: "Delivery times vary by location: Kampala (same-day to 24 hours), Major towns (1-2 days), Other areas (2-4 days). You'll receive tracking information once your order ships.",
      },
      {
        question: "Is the packaging discreet?",
        answer: "Absolutely! All orders are shipped in plain, unmarked packaging with no indication of the contents. The sender name on the package will appear as a generic business name, not an adult store.",
      },
      {
        question: "Can I track my order?",
        answer: "Yes! Once your order ships, you'll receive an SMS and email with tracking information. You can also track your order in your account dashboard.",
      },
      {
        question: "What if I'm not home during delivery?",
        answer: "Our courier will attempt delivery twice. You can also arrange for pickup at a designated pickup point, or have it delivered to an alternative address.",
      },
      {
        question: "Do you offer same-day delivery?",
        answer: "Yes! Same-day delivery is available in Kampala for orders placed before 2 PM. An additional fee of UGX 500 applies.",
      },
    ],
  },
  {
    title: "Payment & Billing",
    icon: "💳",
    items: [
      {
        question: "What payment methods do you accept?",
        answer: "We accept M-Pesa, Airtel Money, MTN Mobile Money, Visa, Mastercard, and American Express. All payments are processed securely through Flutterwave.",
      },
      {
        question: "How does the billing appear on my statement?",
        answer: "For your privacy, charges will appear as a generic business name on your bank or mobile money statement - not as an adult store.",
      },
      {
        question: "Is my payment information secure?",
        answer: "Yes! We use industry-standard SSL encryption and never store your full payment details. All transactions are processed through PCI-compliant payment providers.",
      },
      {
        question: "Can I pay on delivery?",
        answer: "Cash on delivery is currently not available. This helps us maintain competitive prices and ensures order authenticity.",
      },
    ],
  },
  {
    title: "Returns & Refunds",
    icon: "↩️",
    items: [
      {
        question: "What is your return policy?",
        answer: "We accept returns within 14 days of delivery for unopened, unused items in original packaging. Some items (lubricants, intimate wear) are non-returnable for hygiene reasons.",
      },
      {
        question: "How do I initiate a return?",
        answer: "Contact our support team via email or WhatsApp with your order number. We'll provide a return authorization and instructions.",
      },
      {
        question: "When will I receive my refund?",
        answer: "Refunds are processed within 3-5 business days after we receive and inspect the returned item. The refund will be credited to your original payment method.",
      },
      {
        question: "What if I received a defective product?",
        answer: "Contact us immediately with photos of the defect. We'll arrange a free replacement or full refund, including shipping costs.",
      },
    ],
  },
  {
    title: "Products",
    icon: "🛍️",
    items: [
      {
        question: "Are your products authentic?",
        answer: "Yes! We only source from authorized distributors and directly from brands. All products are genuine and come with manufacturer warranty where applicable.",
      },
      {
        question: "Are the products body-safe?",
        answer: "Absolutely. We only stock products made from body-safe materials like medical-grade silicone, ABS plastic, and other non-porous materials. We never sell products containing harmful phthalates.",
      },
      {
        question: "How should I clean and care for my products?",
        answer: "Most products can be cleaned with warm water and mild soap or a specialized toy cleaner. Check the product description for specific care instructions. Always dry thoroughly before storage.",
      },
      {
        question: "Do you offer product warranties?",
        answer: "Yes! Most electronic products come with a 1-year manufacturer warranty. Warranty information is included with each product.",
      },
    ],
  },
  {
    title: "Privacy & Security",
    icon: "🔒",
    items: [
      {
        question: "Is my personal information safe?",
        answer: "Yes. We use bank-level encryption to protect your data. We never share, sell, or rent your personal information to third parties.",
      },
      {
        question: "Will I receive marketing emails?",
        answer: "Only if you opt-in during checkout or account creation. You can unsubscribe at any time from our emails.",
      },
      {
        question: "Can I shop anonymously?",
        answer: "Yes! Guest checkout is available. You can place orders without creating an account.",
      },
      {
        question: "How is my order history stored?",
        answer: "Your order history is encrypted and accessible only to you through your secure account. Our staff access is limited and logged for security purposes.",
      },
    ],
  },
  {
    title: "Account",
    icon: "👤",
    items: [
      {
        question: "Do I need an account to order?",
        answer: "No, guest checkout is available. However, creating an account lets you track orders, save addresses, earn loyalty points, and access order history.",
      },
      {
        question: "How do I reset my password?",
        answer: "Click 'Forgot Password' on the login page. Enter your email, and we'll send you a secure reset link valid for 1 hour.",
      },
      {
        question: "Can I delete my account?",
        answer: "Yes. Contact our support team to request account deletion. We'll remove all your personal data within 30 days as per privacy regulations.",
      },
    ],
  },
];

export default function FAQPage() {
  const [faqData, setFaqData] = useState<FAQCategory[]>(DEFAULT_FAQ);
  const [searchQuery, setSearchQuery] = useState("");
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/settings/public")
      .then(r => r.json())
      .then(data => {
        const raw = data.settings?.faq_items;
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) setFaqData(parsed);
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  const toggleItem = (key: string) => {
    const newOpen = new Set(openItems);
    if (newOpen.has(key)) {
      newOpen.delete(key);
    } else {
      newOpen.add(key);
    }
    setOpenItems(newOpen);
  };

  const filteredData = faqData
    .map((category) => ({
      ...category,
      items: category.items.filter(
        (item) =>
          item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.answer.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((category) => category.items.length > 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-accent text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-4">Frequently Asked Questions</h1>
          <p className="text-lg text-white/80 mb-8">
            Find answers to common questions about orders, shipping, and more.
          </p>

          {/* Search */}
          <div className="max-w-xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for answers..."
              className="w-full pl-12 pr-4 py-3 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
        </div>
      </section>

      {/* FAQ Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        {filteredData.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No results found for "{searchQuery}"</p>
            <button
              onClick={() => setSearchQuery("")}
              className="text-accent hover:underline"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {filteredData.map((category) => (
              <div key={category.title} className="bg-white rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <span>{category.icon}</span>
                    {category.title}
                  </h2>
                </div>

                <div className="divide-y">
                  {category.items.map((item, index) => {
                    const key = `${category.title}-${index}`;
                    const isOpen = openItems.has(key);

                    return (
                      <div key={key}>
                        <button
                          onClick={() => toggleItem(key)}
                          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                        >
                          <span className="font-medium pr-4">{item.question}</span>
                          <ChevronDown
                            className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${
                              isOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                        {isOpen && (
                          <div className="px-6 pb-4">
                            <p className="text-gray-600 leading-relaxed">{item.answer}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Still Need Help */}
        <div className="mt-12 bg-accent/5 border border-accent/20 rounded-xl p-8 text-center">
          <h3 className="text-xl font-semibold mb-2">Still have questions?</h3>
          <p className="text-gray-600 mb-6">
            Can't find what you're looking for? Our support team is happy to help.
          </p>
          <Link href="/contact" className="btn-primary">
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}
