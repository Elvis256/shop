"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Section from "@/components/Section";
import Breadcrumbs from "@/components/Breadcrumbs";
import { apiFetch } from "@/lib/api";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  Shield, AlertTriangle, Upload, X, Loader2, CheckCircle,
  Camera, FileText,
} from "lucide-react";

const categories = [
  { value: "NOT_RECEIVED", label: "Item Not Received", desc: "I haven't received my order" },
  { value: "DAMAGED", label: "Item Damaged", desc: "Item arrived damaged or broken" },
  { value: "NOT_AS_DESCRIBED", label: "Not As Described", desc: "Item doesn't match the listing" },
  { value: "WRONG_ITEM", label: "Wrong Item Sent", desc: "I received a different item" },
  { value: "MISSING_ITEMS", label: "Missing Items", desc: "Some items from my order are missing" },
  { value: "DEFECTIVE", label: "Defective Product", desc: "Product doesn't work properly" },
  { value: "COUNTERFEIT", label: "Suspected Counterfeit", desc: "I believe the product is fake" },
  { value: "QUALITY_ISSUE", label: "Quality Issue", desc: "Quality is much lower than expected" },
  { value: "OTHER", label: "Other Issue", desc: "Another problem with my order" },
];

interface OrderSummary {
  id: string;
  orderNumber: string;
  totalAmount: number;
  currency: string;
  status: string;
  items: Array<{ productName: string; quantity: number; price: number; imageUrl?: string }>;
}

export default function NewDisputePageWrapper() {
  return (
    <Suspense fallback={<Section><div className="max-w-2xl mx-auto flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div></Section>}>
      <NewDisputePage />
    </Suspense>
  );
}

function NewDisputePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const { formatPrice } = useCurrency();

  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [category, setCategory] = useState("");
  const [reason, setReason] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (orderId) {
      loadOrder();
    } else {
      setLoading(false);
      setError("No order specified");
    }
  }, [orderId]);

  const loadOrder = async () => {
    try {
      const data = await apiFetch(`/api/orders/${orderId}`);
      setOrder(data);
    } catch {
      setError("Failed to load order");
    } finally {
      setLoading(false);
    }
  };

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...newFiles].slice(0, 5));
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId || !category || !reason) return;

    setSubmitting(true);
    setError(null);

    try {
      // Create dispute
      const dispute = await apiFetch("/api/disputes", {
        method: "POST",
        body: JSON.stringify({ orderId, category, reason }),
      });

      // Upload evidence if any
      if (files.length > 0) {
        const formData = new FormData();
        files.forEach((file) => formData.append("documents", file));
        formData.append("description", "Initial evidence");

        await apiFetch(`/api/disputes/${dispute.id}/evidence`, {
          method: "POST",
          body: formData,
          headers: {}, // Let browser set content-type for FormData
        });
      }

      setSuccess(true);
      setTimeout(() => router.push("/account/disputes"), 2000);
    } catch (err: any) {
      setError(err.message || "Failed to submit dispute");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Section>
        <div className="max-w-2xl mx-auto flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </Section>
    );
  }

  if (success) {
    return (
      <Section>
        <div className="max-w-2xl mx-auto text-center py-12">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Dispute Filed Successfully</h2>
          <p className="text-gray-600 mb-4">
            We&apos;ll review your dispute and get back to you within 48 hours. The seller has 3 days to respond.
          </p>
          <p className="text-sm text-gray-500">Redirecting to your disputes...</p>
        </div>
      </Section>
    );
  }

  return (
    <Section>
      <div className="max-w-2xl mx-auto">
        <Breadcrumbs items={[
          { label: "Account", href: "/account" },
          { label: "Disputes", href: "/account/disputes" },
          { label: "File Dispute" },
        ]} />

        <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-orange-500" />
          Report an Issue
        </h1>
        <p className="text-gray-500 mb-6">
          Tell us what went wrong and we&apos;ll help resolve it
        </p>

        {/* Order Info */}
        {order && (
          <div className="bg-gray-50 border rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Order #{order.orderNumber}</span>
              <span className="text-sm font-semibold">{formatPrice(order.totalAmount)}</span>
            </div>
            <div className="space-y-1">
              {order.items?.slice(0, 3).map((item, i) => (
                <p key={i} className="text-sm text-gray-600">
                  {item.quantity}x {item.productName}
                </p>
              ))}
              {order.items?.length > 3 && (
                <p className="text-sm text-gray-500">+{order.items.length - 3} more items</p>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Category Selection */}
          <div>
            <label className="block font-medium mb-3">What&apos;s the issue?</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`p-3 rounded-xl border text-left transition ${
                    category === cat.value
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="font-medium text-sm">{cat.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{cat.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block font-medium mb-2">Describe the problem</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please provide details about the issue, including what you expected vs. what you received..."
              rows={4}
              className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              required
              minLength={20}
            />
            <p className="text-xs text-gray-400 mt-1">Minimum 20 characters</p>
          </div>

          {/* Evidence Upload */}
          <div>
            <label className="block font-medium mb-2">
              Upload Evidence <span className="text-gray-400 font-normal">(optional but recommended)</span>
            </label>
            <p className="text-sm text-gray-500 mb-3">
              Photos or documents showing the issue (max 5 files)
            </p>
            <div className="flex flex-wrap gap-3">
              {files.map((file, i) => (
                <div key={i} className="relative group">
                  <div className="w-20 h-20 rounded-lg border bg-gray-50 flex items-center justify-center overflow-hidden">
                    {file.type.startsWith("image/") ? (
                      <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <FileText className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {files.length < 5 && (
                <label className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
                  <Camera className="w-5 h-5 text-gray-400" />
                  <span className="text-xs text-gray-400 mt-1">Add</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileAdd}
                    className="hidden"
                    multiple
                  />
                </label>
              )}
            </div>
          </div>

          {/* Buyer Protection Info */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-blue-900">Your payment is protected</p>
                <p className="text-blue-700 mt-1">
                  Your payment is held securely while we investigate. The seller has 3 days to respond.
                  Our team will review all evidence and make a fair decision.
                </p>
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!category || reason.length < 20 || submitting}
            className="w-full py-3 bg-orange-600 text-white rounded-xl font-semibold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5" />
                Submit Dispute
              </>
            )}
          </button>
        </form>
      </div>
    </Section>
  );
}
