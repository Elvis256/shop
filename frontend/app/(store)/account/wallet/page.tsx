"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Section from "@/components/Section";
import { useAuth } from "@/lib/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { apiFetch } from "@/lib/api";
import { Wallet, ChevronLeft, ArrowUpRight, ArrowDownLeft, Clock, ChevronRight, Info } from "lucide-react";
import { useToast } from "@/lib/hooks/useToast";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  createdAt: string;
}

interface StoreCreditData {
  balance: number;
  transactions: Transaction[];
  pagination?: { page: number; limit: number; total: number };
}

export default function WalletPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { formatPrice } = useCurrency();
  const { showToast } = useToast();
  const [data, setData] = useState<StoreCreditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    document.title = "Store Credit | My Account";
  }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/login");
    }
  }, [user, isLoading, router]);

  const loadCredit = (p: number) => {
    setLoading(true);
    apiFetch(`/api/store-credit?page=${p}&limit=10`)
      .then((d) => { setData(d); setPage(p); })
      .catch((e) => { setError(e.message); showToast("Failed to load store credit", "error"); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user) loadCredit(1);
  }, [user]);

  if (isLoading || !user) {
    return (
      <Section>
        <div className="text-center py-16">Loading...</div>
      </Section>
    );
  }

  const getTypeIcon = (type: string) => {
    if (type === "CREDIT" || type === "REFUND" || type === "EARNED") {
      return <ArrowDownLeft className="w-4 h-4 text-green-500" />;
    }
    return <ArrowUpRight className="w-4 h-4 text-red-500" />;
  };

  const getTypeColor = (type: string) => {
    if (type === "CREDIT" || type === "REFUND" || type === "EARNED") {
      return "text-green-600";
    }
    return "text-red-600";
  };

  return (
    <Section>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/account" className="btn-icon" aria-label="Back to account">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1>Store Credit</h1>
        </div>

        {loading && !data ? (
          <div className="space-y-4">
            <div className="animate-pulse bg-gradient-to-br from-gray-200 to-gray-100 rounded-24 h-28" />
            <div className="card animate-pulse space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 py-4">
                  <div className="w-8 h-8 bg-gray-200 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 rounded w-1/4" />
                  </div>
                  <div className="h-4 bg-gray-200 rounded w-16" />
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="card text-center py-16">
            <Wallet className="w-16 h-16 mx-auto mb-4 text-text-muted" />
            <h3 className="mb-2">Store Credit Unavailable</h3>
            <p className="text-text-muted">
              {error === "Failed to load"
                ? "Store credit is not currently available."
                : error}
            </p>
          </div>
        ) : (
          <>
            {/* Balance Card */}
            <div className="card bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-accent/20 rounded-full flex items-center justify-center">
                  <Wallet className="w-7 h-7 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-text-muted">Available Balance</p>
                  <p className="text-3xl font-bold">
                    {formatPrice(data?.balance || 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Transaction History */}
            <div className="card">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-accent" />
                Transaction History
              </h3>

              {!data?.transactions?.length ? (
                <p className="text-text-muted text-center py-8">
                  No transactions yet.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {data.transactions.map((tx) => (
                    <div key={tx.id} className="py-4 flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        {getTypeIcon(tx.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {tx.description || tx.type}
                        </p>
                        <p className="text-xs text-text-muted">
                          {new Date(tx.createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      <span
                        className={`font-semibold text-sm ${getTypeColor(
                          tx.type
                        )}`}
                      >
                        {tx.type === "CREDIT" ||
                        tx.type === "REFUND" ||
                        tx.type === "EARNED"
                          ? "+"
                          : "−"}
                        {formatPrice(Math.abs(tx.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {data?.pagination && data.pagination.total > data.pagination.limit && (
                <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
                  <p className="text-xs text-text-muted">
                    Page {data.pagination.page} of {Math.ceil(data.pagination.total / data.pagination.limit)}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadCredit(page - 1)}
                      disabled={page <= 1 || loading}
                      className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-surface-secondary disabled:opacity-50 flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" /> Prev
                    </button>
                    <button
                      onClick={() => loadCredit(page + 1)}
                      disabled={page >= Math.ceil(data.pagination.total / data.pagination.limit) || loading}
                      className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-surface-secondary disabled:opacity-50 flex items-center gap-1"
                    >
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* How it works */}
            <div className="card bg-blue-50/50 border-blue-200/50 mt-4">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-blue-900">How Store Credit Works</h4>
                  <p className="text-xs text-blue-700 mt-1">
                    Store credit is earned through refunds, referrals, and promotions. It is automatically applied at checkout and never expires.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Section>
  );
}
