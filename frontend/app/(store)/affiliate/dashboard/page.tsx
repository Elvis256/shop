"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  MousePointerClick,
  DollarSign,
  TrendingUp,
  Copy,
  Check,
  ExternalLink,
  Search,
  RefreshCw,
  Share2,
  ArrowRight,
} from "lucide-react";

type DashboardData = {
  affiliate: {
    name: string;
    email: string;
    code: string;
    commissionRate: number;
    status: string;
    totalEarnings: number;
    totalClicks: number;
    totalConversions: number;
    createdAt: string;
  };
  recentClicks: any[];
  recentConversions: any[];
  payouts: any[];
};

export default function AffiliateDashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><RefreshCw className="w-8 h-8 animate-spin text-gray-400" /></div>}>
      <AffiliateDashboardInner />
    </Suspense>
  );
}

function AffiliateDashboardInner() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get("code") || "");
  const [inputCode, setInputCode] = useState(searchParams.get("code") || "");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (code) loadDashboard();
  }, [code]);

  async function loadDashboard() {
    setLoading(true);
    setError("");
    try {
      const res = await api.getAffiliateDashboard(code);
      setData(res);
    } catch (e: any) {
      setError(e.message || "Affiliate not found");
      setData(null);
    }
    setLoading(false);
  }

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setCode(inputCode.trim());
  }

  function copyLink() {
    const link = `https://ugsex.com?ref=${data?.affiliate.code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!code || (!data && !loading)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border shadow-sm max-w-md w-full p-8">
          <h1 className="text-2xl font-bold mb-2 text-center">Affiliate Dashboard</h1>
          <p className="text-gray-500 text-center mb-6">Enter your affiliate code to view your dashboard</p>
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>
          )}
          <form onSubmit={handleLookup} className="space-y-4">
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="Enter your affiliate code"
              className="w-full border rounded-xl px-4 py-3 text-sm text-center font-mono text-lg"
              required
            />
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition"
            >
              View Dashboard
            </button>
          </form>
          <p className="text-xs text-gray-400 text-center mt-4">
            Don&apos;t have a code?{" "}
            <Link href="/affiliate/signup" className="text-blue-600 hover:underline">Sign up here</Link>
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data) return null;

  const { affiliate, recentClicks, recentConversions, payouts } = data;
  const conversionRate = affiliate.totalClicks > 0
    ? ((affiliate.totalConversions / affiliate.totalClicks) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold">Welcome, {affiliate.name}!</h1>
            <p className="text-sm text-gray-500 mt-1">
              Status:{" "}
              <span className={`font-medium ${affiliate.status === "APPROVED" ? "text-green-600" : affiliate.status === "PENDING" ? "text-yellow-600" : "text-red-600"}`}>
                {affiliate.status}
              </span>
              {affiliate.status === "PENDING" && " — Your application is under review"}
            </p>
          </div>
          <button
            onClick={loadDashboard}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Referral Link */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl text-white p-6 mb-8">
          <p className="text-sm text-white/70 mb-2">Your Referral Link</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-white/10 backdrop-blur rounded-lg px-4 py-2.5 font-mono text-sm truncate">
              https://ugsex.com?ref={affiliate.code}
            </div>
            <button
              onClick={copyLink}
              className="flex items-center gap-2 bg-white text-blue-600 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-50 transition flex-shrink-0"
            >
              {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Link</>}
            </button>
          </div>
          <p className="text-xs text-white/50 mt-2">
            Share this link on social media, your website, or with friends. Commission rate: {affiliate.commissionRate}%
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
              <MousePointerClick className="w-4 h-4" /> Total Clicks
            </div>
            <p className="text-2xl font-bold">{affiliate.totalClicks.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
              <TrendingUp className="w-4 h-4" /> Conversions
            </div>
            <p className="text-2xl font-bold">{affiliate.totalConversions}</p>
            <p className="text-xs text-gray-400">{conversionRate}% rate</p>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
              <DollarSign className="w-4 h-4" /> Total Earnings
            </div>
            <p className="text-2xl font-bold text-green-600">${affiliate.totalEarnings.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
              <Share2 className="w-4 h-4" /> Commission Rate
            </div>
            <p className="text-2xl font-bold">{affiliate.commissionRate}%</p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Recent Conversions */}
          <div className="bg-white rounded-xl border">
            <div className="px-5 py-4 border-b">
              <h3 className="font-semibold">Recent Conversions</h3>
            </div>
            {recentConversions && recentConversions.length > 0 ? (
              <div className="divide-y">
                {recentConversions.map((c: any) => (
                  <div key={c.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Order #{c.orderId?.slice(0, 8)}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-green-600">+${c.commissionAmount?.toFixed(2)}</p>
                      <p className="text-xs text-gray-400">${c.orderAmount?.toFixed(2)} order</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">
                No conversions yet. Share your link to start earning!
              </div>
            )}
          </div>

          {/* Payouts */}
          <div className="bg-white rounded-xl border">
            <div className="px-5 py-4 border-b">
              <h3 className="font-semibold">Payouts</h3>
            </div>
            {payouts && payouts.length > 0 ? (
              <div className="divide-y">
                {payouts.map((p: any) => (
                  <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{p.method}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">${p.amount?.toFixed(2)}</p>
                      <p className={`text-xs ${p.status === "COMPLETED" ? "text-green-500" : "text-yellow-500"}`}>
                        {p.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">
                No payouts yet
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="bg-white rounded-xl border p-6 text-center">
          <h3 className="font-semibold mb-2">Want to earn more?</h3>
          <p className="text-sm text-gray-500 mb-4">
            Share your referral link on social media, your blog, or anywhere your audience hangs out.
          </p>
          <Link
            href="/affiliate"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition"
          >
            Browse Products to Promote <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
