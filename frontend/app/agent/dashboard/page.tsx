"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");

interface DashboardData {
  name: string;
  code: string;
  commissionRate: number;
  totalClicks: number;
  totalOrders: number;
  totalEarnings: number;
  pendingPayout: number;
  totalPaid: number;
  referralLink: string;
  recentConversions: Array<{
    id: string;
    orderAmount: number;
    commission: number;
    status: string;
    createdAt: string;
  }>;
}

export default function AgentDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("agent_token");
    const code = localStorage.getItem("agent_code");
    if (!token || !code) { router.push("/agent"); return; }

    fetch(`${API_URL}/api/affiliate/dashboard/${code}`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    })
      .then((r) => { if (!r.ok) throw new Error("Unauthorized"); return r.json(); })
      .then(setData)
      .catch(() => { localStorage.removeItem("agent_token"); router.push("/agent"); })
      .finally(() => setLoading(false));
  }, [router]);

  function copyLink() {
    if (!data) return;
    navigator.clipboard.writeText(data.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareLink() {
    if (!data) return;
    if (navigator.share) {
      navigator.share({ title: "PleasureZone", url: data.referralLink, text: "Shop discreet wellness products 🛍️" });
    } else {
      copyLink();
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;
  if (!data) return null;

  const fmt = (n: number) => `UGX ${n.toLocaleString()}`;

  return (
    <div className="px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Hey, {data.name}! 👋</h1>
        <p className="text-gray-400 text-sm mt-1">Code: <span className="font-mono text-primary">{data.code}</span> · {data.commissionRate}% commission</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Total Earned", value: fmt(data.totalEarnings), color: "text-green-400" },
          { label: "Pending Payout", value: fmt(data.pendingPayout), color: "text-yellow-400" },
          { label: "Total Orders", value: data.totalOrders.toString(), color: "text-blue-400" },
          { label: "Total Clicks", value: data.totalClicks.toString(), color: "text-purple-400" },
        ].map((s) => (
          <div key={s.label} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <p className="text-gray-500 text-xs mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Share link */}
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-3">
        <p className="text-sm font-semibold text-white">Your Referral Link</p>
        <div className="bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-300 font-mono break-all">
          {data.referralLink}
        </div>
        <div className="flex gap-2">
          <button
            onClick={copyLink}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm py-2 rounded-lg transition-colors"
          >
            {copied ? "✓ Copied!" : "Copy Link"}
          </button>
          <button
            onClick={shareLink}
            className="flex-1 bg-primary hover:bg-primary/90 text-white text-sm py-2 rounded-lg transition-colors"
          >
            Share
          </button>
        </div>
      </div>

      {/* Recent sales */}
      {data.recentConversions.length > 0 && (
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-sm font-semibold text-white mb-3">Recent Sales</p>
          <div className="space-y-2">
            {data.recentConversions.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-300">{fmt(c.orderAmount)} order</p>
                  <p className="text-[10px] text-gray-500">{new Date(c.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-green-400">+{fmt(c.commission)}</p>
                  <p className={`text-[10px] ${c.status === "PAID" ? "text-green-500" : "text-yellow-500"}`}>
                    {c.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="bg-blue-950/40 border border-blue-800/50 rounded-xl p-4 text-xs text-blue-300 space-y-1">
        <p className="font-semibold text-blue-200">💡 Tips to earn more</p>
        <p>• Share your link in WhatsApp groups</p>
        <p>• Tell friends about plain packaging</p>
        <p>• Payouts every Friday via Mobile Money</p>
      </div>
    </div>
  );
}
