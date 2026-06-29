"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AlertTriangle, MessageSquare, FileText, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface Dispute {
  id: string;
  reason: string;
  description: string;
  status: string;
  resolution?: string;
  createdAt: string;
  order: {
    orderNumber: string;
    totalAmount: number;
    currency: string;
    status: string;
  };
  buyer: {
    name: string;
    email: string;
  };
  _count: {
    evidence: number;
    messages: number;
  };
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  OPEN: { label: "Open", color: "bg-red-100 text-red-700", icon: AlertTriangle },
  UNDER_REVIEW: { label: "Under Review", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  RESOLVED: { label: "Resolved", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  CLOSED: { label: "Closed", color: "bg-gray-100 text-gray-700", icon: XCircle },
  ESCALATED: { label: "Escalated", color: "bg-purple-100 text-purple-700", icon: AlertTriangle },
};

export default function SellerDisputes() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDisputes();
  }, []);

  const loadDisputes = async () => {
    try {
      setLoading(true);
      const data = await apiFetch("/api/seller/disputes");
      setDisputes(data);
    } catch (err: any) {
      setError(err.message || "Failed to load disputes");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20 text-center">
        <div>
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-red-600">{error}</p>
          <button onClick={loadDisputes} className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Disputes</h2>
        <span className="text-sm text-gray-500">{disputes.length} total</span>
      </div>

      {disputes.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No disputes</h3>
          <p className="text-sm text-gray-500">Great job! You have no open disputes.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((dispute) => {
            const config = statusConfig[dispute.status] || statusConfig.OPEN;
            const StatusIcon = config.icon;
            return (
              <div key={dispute.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">Order #{dispute.order.orderNumber}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {config.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      Filed by {dispute.buyer.name} on {new Date(dispute.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {dispute.order.currency} {Number(dispute.order.totalAmount).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 mb-3">
                  <p className="text-sm font-medium text-gray-700 mb-1">{dispute.reason}</p>
                  <p className="text-sm text-gray-600">{dispute.description}</p>
                </div>

                {dispute.resolution && (
                  <div className="bg-green-50 rounded-lg p-3 mb-3">
                    <p className="text-xs font-medium text-green-700 mb-0.5">Resolution</p>
                    <p className="text-sm text-green-700">{dispute.resolution}</p>
                  </div>
                )}

                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" />
                    {dispute._count.evidence} evidence
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5" />
                    {dispute._count.messages} messages
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
