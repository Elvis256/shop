"use client";

import { useState } from "react";

const tabs = [
  { id: "details", label: "Details" },
  { id: "shipping", label: "Shipping" },
  { id: "reviews", label: "Reviews" },
];

export default function ProductTabs() {
  const [activeTab, setActiveTab] = useState("details");

  return (
    <div>
      {/* Tab Headers */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-4 font-medium transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-accent text-accent"
                : "text-text-muted hover:text-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="py-8">
        {activeTab === "details" && (
          <div className="prose max-w-none">
            <h3>Product Description</h3>
            <p className="text-text-muted">
              Experience premium quality with this carefully designed product. Made from
              body-safe materials, this item offers exceptional comfort and durability.
            </p>
            <h4>Features</h4>
            <ul className="text-text-muted space-y-2">
              <li>Premium body-safe silicone</li>
              <li>Waterproof design (IPX7)</li>
              <li>Rechargeable battery - 2 hour runtime</li>
              <li>10 vibration patterns</li>
              <li>Whisper quiet motor</li>
            </ul>
            <h4>Specifications</h4>
            <ul className="text-text-muted space-y-2">
              <li>Material: Medical-grade silicone</li>
              <li>Size: 7.5" x 1.4"</li>
              <li>Weight: 180g</li>
              <li>Charging: USB magnetic</li>
            </ul>
          </div>
        )}

        {activeTab === "shipping" && (
          <div className="prose max-w-none">
            <h3>Shipping Information</h3>
            <p className="text-text-muted">
              We ship all orders in plain, unmarked packaging to protect your privacy.
              The sender name on the package will be a neutral company name.
            </p>
            <h4>Delivery Options</h4>
            <ul className="text-text-muted space-y-2">
              <li><strong>Standard:</strong> 3-5 business days - Free over KES 5,000</li>
              <li><strong>Express:</strong> 1-2 business days - KES 500</li>
              <li><strong>Same Day (Nairobi):</strong> KES 800</li>
            </ul>
            <h4>Returns</h4>
            <p className="text-text-muted">
              Unopened items can be returned within 30 days for a full refund.
              For hygiene reasons, opened items cannot be returned.
            </p>
          </div>
        )}

        {activeTab === "reviews" && (
          <div>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3>Customer Reviews</h3>
                <p className="text-text-muted">Based on 128 reviews</p>
              </div>
              <button className="btn-primary">Write a Review</button>
            </div>

            {/* Sample Reviews */}
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border-b border-border pb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span key={star} className="text-yellow-400">★</span>
                      ))}
                    </div>
                    <span className="font-medium">Verified Buyer</span>
                  </div>
                  <p className="text-text-muted mb-2">
                    Excellent quality and super discreet shipping. Arrived in plain
                    packaging exactly as promised. Very happy with my purchase!
                  </p>
                  <p className="text-small text-text-muted">Posted 2 weeks ago</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
