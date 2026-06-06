"use client";

import { Truck, MapPin, Clock, Shield, Package } from "lucide-react";
import Link from "next/link";

export default function ShippingPage() {
  return (
    <div className="container py-12 max-w-3xl">
      <h1 className="mb-4">Shipping & Delivery</h1>
      <p className="text-text-muted mb-10">All orders are shipped in 100% discreet, plain packaging with no branding or indication of contents.</p>

      <div className="space-y-8">
        {/* Delivery Options */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Delivery Options</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card">
              <Truck className="w-6 h-6 text-primary mb-3" />
              <h3 className="text-base mb-1">Home Delivery</h3>
              <p className="text-text-muted text-sm">Delivered to your door in plain packaging. No signature required unless you request it.</p>
            </div>
            <div className="card">
              <MapPin className="w-6 h-6 text-primary mb-3" />
              <h3 className="text-base mb-1">Pickup Point</h3>
              <p className="text-text-muted text-sm">Collect from one of our <Link href="/pickup-points" className="link">8 discreet pickup locations</Link> across Uganda.</p>
            </div>
          </div>
        </div>

        {/* Delivery Times */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Delivery Times</h2>
          <div className="overflow-hidden rounded-12 border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-secondary">
                  <th className="text-left px-4 py-3 font-medium">Location</th>
                  <th className="text-left px-4 py-3 font-medium">Standard</th>
                  <th className="text-left px-4 py-3 font-medium">Express</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="px-4 py-3">Kampala</td>
                  <td className="px-4 py-3 text-text-muted">1-2 days</td>
                  <td className="px-4 py-3 text-text-muted">Same day</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Entebbe, Mukono, Wakiso</td>
                  <td className="px-4 py-3 text-text-muted">1-2 days</td>
                  <td className="px-4 py-3 text-text-muted">Next day</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Jinja, Mbarara, Gulu</td>
                  <td className="px-4 py-3 text-text-muted">2-4 days</td>
                  <td className="px-4 py-3 text-text-muted">1-2 days</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Other regions</td>
                  <td className="px-4 py-3 text-text-muted">3-5 days</td>
                  <td className="px-4 py-3 text-text-muted">2-3 days</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Pickup Points</td>
                  <td className="px-4 py-3 text-text-muted">1-3 days</td>
                  <td className="px-4 py-3 text-text-muted">Same/next day</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Shipping Costs */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Shipping Costs</h2>
          <div className="overflow-hidden rounded-12 border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-secondary">
                  <th className="text-left px-4 py-3 font-medium">Method</th>
                  <th className="text-left px-4 py-3 font-medium">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="px-4 py-3">Standard (Kampala)</td>
                  <td className="px-4 py-3 text-text-muted">UGX 5,000</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Standard (Outside Kampala)</td>
                  <td className="px-4 py-3 text-text-muted">UGX 10,000 - 15,000</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Express (Kampala)</td>
                  <td className="px-4 py-3 text-text-muted">UGX 15,000</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Pickup Point</td>
                  <td className="px-4 py-3 font-medium text-emerald-600">FREE</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Orders over UGX 150,000</td>
                  <td className="px-4 py-3 font-medium text-emerald-600">FREE standard shipping</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Privacy Guarantees */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="card text-center">
            <Package className="w-6 h-6 text-primary mx-auto mb-2" />
            <h3 className="text-sm font-medium mb-1">Plain Packaging</h3>
            <p className="text-text-muted text-xs">No logos, no branding, completely unmarked</p>
          </div>
          <div className="card text-center">
            <Shield className="w-6 h-6 text-primary mx-auto mb-2" />
            <h3 className="text-sm font-medium mb-1">Discreet Billing</h3>
            <p className="text-text-muted text-xs">Generic business name on statements</p>
          </div>
          <div className="card text-center">
            <Clock className="w-6 h-6 text-primary mx-auto mb-2" />
            <h3 className="text-sm font-medium mb-1">Order Tracking</h3>
            <p className="text-text-muted text-xs">Real-time updates via WhatsApp or SMS</p>
          </div>
        </div>

        <div className="card bg-surface-secondary border-0">
          <p className="text-text-muted text-sm">Questions about shipping? Contact us via <Link href="/support" className="link">live chat</Link> or WhatsApp. You can also <Link href="/track-order" className="link">track your order</Link> anytime.</p>
        </div>
      </div>
    </div>
  );
}
