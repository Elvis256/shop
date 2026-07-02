"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Section from "@/components/Section";
import Breadcrumbs from "@/components/Breadcrumbs";
import { apiFetch } from "@/lib/api";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useToast } from "@/lib/hooks/useToast";
import {
  Shield, AlertTriangle, Clock, CheckCircle, MessageSquare,
  ChevronRight, FileText, Loader2, XCircle, Eye,
} from "lucide-react";

interface Dispute {
  id: string;
  disputeNumber: string;
  category: string;
  reason: string;
  status: string;
  priority: string;
  resolution?: string;
  refundAmount?: number;
  createdAt: string;
  resolvedAt?: string;
  order: {
    orderNumber: string;
    totalAmount: number;
    currency: string;
    status: string;
  };
  seller: { storeName: string; logo?: string };
  _count: { evidence: number; messages: number };
}

const statusConfig: Record<string, { color: string; icon: typeof Clock; label: string }> = {
  OPEN: { color: "bg-yellow-100 text-yellow-800", icon: Clock, label: "Open" },
  SELLER_RESPONSE: { color: "bg-blue-100 text-blue-800", icon: MessageSquare, label: "Seller Responded" },
  UNDER_REVIEW: { color: "bg-purple-100 text-purple-800", icon: Eye, label: "Under Review" },
  EVIDENCE_REQUESTED: { color: "bg-orange-100 text-orange-800", icon: FileText, label: "Evidence Needed" },
  RESOLVED: { color: "bg-green-100 text-green-800", icon: CheckCircle, label: "Resolved" },
  CLOSED: { color: "bg-gray-100 text-gray-800", icon: XCircle, label: "Closed" },
  ESCALATED: { color: "bg-red-100 text-red-800", icon: AlertTriangle, label: "Escalated" },
};

const categoryLabels: Record<string, string> = {
  NOT_RECEIVED: "Item Not Received",
  DAMAGED: "Item Damaged",
  NOT_AS_DESCRIBED: "Not As Described",
  WRONG_ITEM: "Wrong Item",
  MISSING_ITEMS: "Missing Items",
  DEFECTIVE: "Defective Product",
  COUNTERFEIT: "Suspected Counterfeit",
  QUALITY_ISSUE: "Quality Issue",
  OTHER: "Other",
};

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const { formatPrice } = useCurrency();
  const { showToast } = useToast();

  useEffect(() => {
    loadDisputes();
  }, [filter]);

  const loadDisputes = async () => {
    try {
      const params = filter !== "all" ? `?status=${filter}` : "";
      const data = await apiFetch(`/api/disputes${params}`);
      setDisputes(data.disputes || data);
    } catch {
      setDisputes([]);
      showToast("Failed to load disputes", "error");
    } finally {
      setLoading(false);
    }
  };

  const activeCount = disputes.filter((d) => !["RESOLVED", "CLOSED"].includes(d.status)).length;

  return (
    <Section>
      <div className="max-w-3xl mx-auto">
        <Breadcrumbs items={[
          { label: "Account", href: "/account" },
          { label: "Disputes" },
        ]} />

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-blue-600" />
              Dispute Center
            </h1>
            <p className="text-gray-500 mt-1">Track and manage your order disputes</p>
          </div>
          {activeCount > 0 && (
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
              {activeCount} Active
            </span>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { value: "all", label: "All" },
            { value: "OPEN", label: "Open" },
            { value: "UNDER_REVIEW", label: "Under Review" },
            { value: "RESOLVED", label: "Resolved" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                filter === f.value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : disputes.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border">
            <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">No Disputes</h3>
            <p className="text-gray-500 max-w-sm mx-auto">
              You haven&apos;t filed any disputes. If you have an issue with an order, you can file a dispute from your order details page.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {disputes.map((dispute) => {
              const sc = statusConfig[dispute.status] || statusConfig.OPEN;
              const StatusIcon = sc.icon;
              return (
                <Link
                  key={dispute.id}
                  href={`/account/disputes/${dispute.id}`}
                  className="block bg-white border rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm text-gray-500">{dispute.disputeNumber}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${sc.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {sc.label}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 truncate">
                        {categoryLabels[dispute.category] || dispute.category}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-1">{dispute.reason}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>Order #{dispute.order.orderNumber}</span>
                        <span>{dispute.seller.storeName}</span>
                        <span>{formatPrice(dispute.order.totalAmount)}</span>
                        {dispute._count.messages > 0 && (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {dispute._count.messages}
                          </span>
                        )}
                      </div>
                      {dispute.resolution && (
                        <div className="mt-2 text-xs px-2 py-1 bg-green-50 text-green-700 rounded inline-block">
                          Resolution: {dispute.resolution.replace(/_/g, " ")}
                          {dispute.refundAmount ? ` (${formatPrice(dispute.refundAmount)})` : ""}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-xs text-gray-400">
                        {new Date(dispute.createdAt).toLocaleDateString()}
                      </span>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Info card */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <h3 className="font-semibold text-blue-900 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            How Buyer Protection Works
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-600 mt-0.5">1.</span>
              Your payment is held securely when you place an order
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-600 mt-0.5">2.</span>
              The seller ships your order and you can track it
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-600 mt-0.5">3.</span>
              You confirm delivery or report an issue within 7 days
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-600 mt-0.5">4.</span>
              If there&apos;s a problem, our team mediates and ensures you get a fair resolution
            </li>
          </ul>
        </div>
      </div>
    </Section>
  );
}
