"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface Conversion {
  id: string;
  orderAmount: number;
  commission: number;
  status: string;
  createdAt: string;
}

interface Payout {
  id: string;
  amount: number;
  method: string;
  createdAt: string;
}

interface Data {
  totalEarnings: number;
  pendingPayout: number;
  totalPaid: number;
  recentConversions: Conversion[];
  recentPayouts: Payout[];
}

export default function AgentEarningsPage() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("agent_token");
    const code = localStorage.getItem("agent_code");
    if (!token || !code) { router.push("/agent"); return; }

    fetch(`${API_URL}/api/affiliate/dashboard/${code}`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(() => router.push("/agent"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;
  if (!data) return null;

  const fmt = (n: number) => `UGX ${n.toLocaleString()}`;

  return (
    <div className="px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold text-white">Earnings</h1>

      {/* Summary */}
      <div className="space-y-3">
        <div className="bg-green-950/40 border border-green-800/50 rounded-xl p-4 flex justify-between items-center">
          <div>
            <p className="text-xs text-green-400">Total Earned</p>
            <p className="text-2xl font-bold text-green-300">{fmt(data.totalEarnings)}</p>
          </div>
          <span className="text-3xl">💰</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-yellow-950/30 border border-yellow-800/40 rounded-xl p-3">
            <p className="text-xs text-yellow-400">Pending</p>
            <p className="text-lg font-bold text-yellow-300">{fmt(data.pendingPayout)}</p>
            <p className="text-[10px] text-yellow-600 mt-1">Paid every Friday</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
            <p className="text-xs text-gray-400">Total Paid</p>
            <p className="text-lg font-bold text-white">{fmt(data.totalPaid)}</p>
          </div>
        </div>
      </div>

      {/* Payout info */}
      <div className="bg-blue-950/30 border border-blue-800/40 rounded-xl p-4 text-sm text-blue-300 space-y-1">
        <p className="font-semibold text-blue-200">💳 How you get paid</p>
        <p>Every Friday via MTN MoMo or Airtel Money</p>
        <p className="text-xs text-blue-400">Minimum payout: UGX 10,000</p>
      </div>

      {/* Sales history */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <p className="text-sm font-semibold text-white mb-3">Sales History</p>
        {data.recentConversions.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No sales yet. Share your link to start earning!</p>
        ) : (
          <div className="space-y-3">
            {data.recentConversions.map((c) => (
              <div key={c.id} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
                <div>
                  <p className="text-xs text-gray-300">Order: {fmt(c.orderAmount)}</p>
                  <p className="text-[10px] text-gray-600">{new Date(c.createdAt).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-400">+{fmt(c.commission)}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${c.status === "PAID" ? "bg-green-900/50 text-green-400" : "bg-yellow-900/50 text-yellow-400"}`}>
                    {c.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payout history */}
      {data.recentPayouts.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-sm font-semibold text-white mb-3">Payout History</p>
          <div className="space-y-2">
            {data.recentPayouts.map((p) => (
              <div key={p.id} className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-300">{p.method}</p>
                  <p className="text-[10px] text-gray-600">{new Date(p.createdAt).toLocaleDateString()}</p>
                </div>
                <p className="text-sm font-bold text-white">{fmt(p.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
