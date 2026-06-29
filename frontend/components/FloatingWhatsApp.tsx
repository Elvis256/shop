"use client";

import { useState, useEffect } from "react";
import { MessageCircle, X } from "lucide-react";

const API_URL = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");

export default function FloatingWhatsApp() {
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/settings/public`)
      .then((r) => r.json())
      .then((data) => {
        const s = data?.settings || {};
        if (s.contact_whatsapp) {
          setWhatsappNumber(s.contact_whatsapp);
        }
      })
      .catch(() => {});

    // Show tooltip after 10 seconds
    const timer = setTimeout(() => setIsTooltipVisible(true), 10000);
    return () => clearTimeout(timer);
  }, []);

  if (!whatsappNumber) return null;

  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hi! I have a question about your products.")}`;

  return (
    <div className="fixed bottom-24 lg:bottom-6 left-4 z-40 flex items-end gap-2">
      {/* Tooltip */}
      {isTooltipVisible && (
        <div className="relative bg-white rounded-xl shadow-lg border border-gray-200 p-3 max-w-[200px] animate-fade-in">
          <button
            onClick={() => setIsTooltipVisible(false)}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300"
          >
            <X className="w-3 h-3 text-gray-600" />
          </button>
          <p className="text-xs text-gray-700">Need help? Chat with us on WhatsApp!</p>
        </div>
      )}

      {/* WhatsApp Button */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => setIsTooltipVisible(false)}
        className="w-14 h-14 bg-[#25D366] hover:bg-[#20BD5A] rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-105"
        aria-label="Chat on WhatsApp"
      >
        <MessageCircle className="w-7 h-7 text-white" />
      </a>
    </div>
  );
}
