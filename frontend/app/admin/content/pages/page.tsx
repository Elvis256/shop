"use client";

import Link from "next/link";
import { FileText, Edit2, ExternalLink } from "lucide-react";

const PAGES = [
  { slug: "faq", title: "FAQ", description: "Frequently asked questions and answers", path: "/faq" },
  { slug: "about", title: "About Us", description: "Your store story and mission", path: "/about" },
  { slug: "contact", title: "Contact Info", description: "Phone, email, WhatsApp, and business hours", path: "/contact" },
  { slug: "shipping", title: "Shipping Policy", description: "Delivery options, costs, and timelines", path: "/policies/shipping" },
  { slug: "privacy", title: "Privacy Policy", description: "How you handle customer data", path: "/policies/privacy" },
  { slug: "terms", title: "Terms of Service", description: "Store terms and conditions", path: "/policies/terms" },
];

export default function AdminPagesPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Pages</h1>
        <p className="text-gray-500 text-sm mt-1">Edit static pages and store content</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-700">
        <strong>Tip:</strong> Changes to FAQ, Contact Info, and Shipping are reflected live on the store immediately after saving.
      </div>

      <div className="grid gap-3">
        {PAGES.map(page => (
          <div key={page.slug} className="bg-white rounded-xl border p-5 flex items-center justify-between hover:border-accent/50 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="font-semibold">{page.title}</p>
                <p className="text-sm text-gray-500">{page.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={page.path}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50"
                title="View page"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              <Link
                href={`/admin/content/pages/${page.slug}`}
                className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm hover:bg-accent/90 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
