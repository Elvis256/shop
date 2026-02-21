"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Section from "@/components/Section";
import { useAuth } from "@/lib/hooks/useAuth";
import { ArrowLeft, Package, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface ReturnRequest {
  id: string;
  orderNumber: string;
  status: string;
  reason: string;
  createdAt: string;
  items: Array<{
    productName: string;
    quantity: number;
  }>;
}

const statusConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  PENDING: { icon: Clock, color: "text-yellow-600", label: "Pending Review" },
  APPROVED: { icon: CheckCircle, color: "text-green-600", label: "Approved" },
  REJECTED: { icon: XCircle, color: "text-red-600", label: "Rejected" },
  SHIPPED: { icon: Package, color: "text-blue-600", label: "Item Shipped Back" },
  RECEIVED: { icon: Package, color: "text-purple-600", label: "Item Received" },
  REFUNDED: { icon: CheckCircle, color: "text-green-600", label: "Refunded" },
  CANCELLED: { icon: XCircle, color: "text-gray-600", label: "Cancelled" },
};

export default function ReturnsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) {
      fetchReturns();
    }
  }, [user]);

  const fetchReturns = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/returns`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setReturns(data);
      }
    } catch (error) {
      console.error("Failed to fetch returns:", error);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || !user) {
    return (
      <Section>
        <div className="text-center py-16">Loading...</div>
      </Section>
    );
  }

  return (
    <Section>
      <div className="max-w-3xl mx-auto">
        <Link href="/account" className="inline-flex items-center gap-2 text-text-muted hover:text-text mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Account
        </Link>

        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold">Returns & Refunds</h1>
          <Link href="/account/orders" className="btn btn-primary">
            Request Return
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-16">Loading returns...</div>
        ) : returns.length === 0 ? (
          <div className="card text-center py-16">
            <AlertCircle className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Return Requests</h3>
            <p className="text-text-muted mb-6">
              You haven&apos;t requested any returns yet. Returns can be requested within 14 days of delivery.
            </p>
            <Link href="/account/orders" className="btn btn-primary">
              View Orders
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {returns.map((returnReq) => {
              const status = statusConfig[returnReq.status] || statusConfig.PENDING;
              const StatusIcon = status.icon;
              
              return (
                <div key={returnReq.id} className="card">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-medium">Order #{returnReq.orderNumber}</p>
                      <p className="text-sm text-text-muted">
                        Requested {new Date(returnReq.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className={`flex items-center gap-2 ${status.color}`}>
                      <StatusIcon className="w-4 h-4" />
                      <span className="text-sm font-medium">{status.label}</span>
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <p className="text-sm text-text-muted mb-2">Items:</p>
                    <ul className="space-y-1">
                      {returnReq.items.map((item, idx) => (
                        <li key={idx} className="text-sm">
                          {item.productName} × {item.quantity}
                        </li>
                      ))}
                    </ul>
                    <p className="text-sm text-text-muted mt-3">
                      <strong>Reason:</strong> {returnReq.reason.replace(/_/g, " ")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 p-6 bg-surface-secondary rounded-18">
          <h3 className="font-medium mb-3">Return Policy</h3>
          <ul className="text-sm text-text-muted space-y-2">
            <li>• Returns must be requested within 14 days of delivery</li>
            <li>• Items must be unused and in original packaging</li>
            <li>• Intimate items cannot be returned for hygiene reasons</li>
            <li>• Refunds are processed within 5-7 business days after approval</li>
          </ul>
        </div>
      </div>
    </Section>
  );
}
