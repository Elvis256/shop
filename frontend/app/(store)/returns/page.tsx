"use client";

import { Package, Clock, ShieldCheck, AlertCircle, ArrowLeftRight, MessageCircle } from "lucide-react";
import Link from "next/link";

export default function ReturnsPage() {
  return (
    <div className="container py-12 max-w-3xl">
      <h1 className="mb-4">Returns & Refund Policy</h1>
      <p className="text-text-muted mb-10">We want you to be completely satisfied with your purchase. Here&apos;s everything you need to know about returns.</p>

      <div className="space-y-8">
        <div className="card">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="mb-1">7-Day Return Window</h3>
              <p className="text-text-muted text-sm">You have 7 days from the date of delivery to initiate a return for eligible items. Items must be in their original, unopened, and sealed packaging.</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="mb-1">Eligible for Return</h3>
              <ul className="text-text-muted text-sm space-y-1 list-disc ml-4">
                <li>Unopened, sealed items in original packaging</li>
                <li>Defective or damaged products (photo required)</li>
                <li>Wrong item received</li>
                <li>Lingerie with hygiene tags still attached</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h3 className="mb-1">Not Eligible for Return</h3>
              <ul className="text-text-muted text-sm space-y-1 list-disc ml-4">
                <li>Opened or used intimate products (for hygiene reasons)</li>
                <li>Lubricants, creams, or consumables that have been opened</li>
                <li>Lingerie with hygiene tags removed</li>
                <li>Gift cards</li>
                <li>Items on final sale / clearance</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
              <ArrowLeftRight className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="mb-1">How to Return</h3>
              <ol className="text-text-muted text-sm space-y-2 list-decimal ml-4">
                <li>Go to <Link href="/account/returns" className="link">My Returns</Link> in your account</li>
                <li>Select the order and item(s) you wish to return</li>
                <li>Provide a reason and upload photos if applicable</li>
                <li>We&apos;ll review within 24 hours and provide a return label or pickup arrangement</li>
                <li>Refund is processed within 3-5 business days of receiving the item</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="mb-1">Refund Methods</h3>
              <ul className="text-text-muted text-sm space-y-1 list-disc ml-4">
                <li><strong>Mobile Money:</strong> Refunded to your MTN/Airtel number (1-2 days)</li>
                <li><strong>Card payments:</strong> Refunded to original card (3-5 days)</li>
                <li><strong>Store credit:</strong> Instant, added to your wallet</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="card bg-surface-secondary border-0">
          <div className="flex items-start gap-4">
            <MessageCircle className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
            <div>
              <h3 className="mb-1">Need Help?</h3>
              <p className="text-text-muted text-sm">Contact our support team via <Link href="/support" className="link">live chat</Link>, WhatsApp, or email at <a href="mailto:returns@pleasurezone.ug" className="link">returns@pleasurezone.ug</a>.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
