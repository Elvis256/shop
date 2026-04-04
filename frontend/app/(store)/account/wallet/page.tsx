"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Section from "@/components/Section";
import { useAuth } from "@/lib/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Wallet, ChevronLeft, ArrowUpRight, ArrowDownLeft, Clock } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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
}

export default function WalletPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { formatPrice } = useCurrency();
  const [data, setData] = useState<StoreCreditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) {
      const token = localStorage.getItem("token");
      fetch(`${API_URL}/api/store-credit`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => {
          if (!r.ok) throw new Error("Failed to load");
          return r.json();
        })
        .then((d) => setData(d))
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
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
          <Link href="/account" className="btn-icon">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1>Store Credit</h1>
        </div>

        {loading ? (
          <div className="text-center py-16 text-text-muted">Loading...</div>
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
            </div>
          </>
        )}
      </div>
    </Section>
  );
}
