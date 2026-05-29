"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import {
  Zap,
  Wallet,
  ArrowRight,
  Pause,
  Play,
  X,
  AlertTriangle,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { useToast } from "@/lib/hooks/useToast";

interface Tier {
  tier: string;
  dailyRate: number;
  boost: number;
  label: string;
}

interface Promotion {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  productImage: string | null;
  tier: string;
  status: string;
  startDate: string;
  endDate: string;
  dailyRate: number;
  totalBudget: number;
  spent: number;
  createdAt: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  balanceAfter: number;
  createdAt: string;
}

interface SellerProduct {
  id: string;
  name: string;
  status: string;
}

const tierColors: Record<string, string> = {
  BASIC: "bg-blue-100 text-blue-700",
  PREMIUM: "bg-purple-100 text-purple-700",
  VIP: "bg-amber-100 text-amber-700",
};

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  PAUSED: "bg-yellow-100 text-yellow-700",
  EXPIRED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-100 text-red-600",
};

export default function SellerAdsPage() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [adBalance, setAdBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { showToast } = useToast();

  // Fund form
  const [fundAmount, setFundAmount] = useState("");
  const [funding, setFunding] = useState(false);

  // Promote form
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedTier, setSelectedTier] = useState("BASIC");
  const [selectedDays, setSelectedDays] = useState(7);
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [pricingRes, balanceRes, promosRes, productsRes] = await Promise.all([
        apiFetch("/api/seller/ads/pricing"),
        apiFetch("/api/seller/ads/balance"),
        apiFetch("/api/seller/ads/promotions"),
        apiFetch("/api/seller/products?status=ACTIVE&limit=100").catch(() => ({ products: [] })),
      ]);
      setTiers(pricingRes.tiers || []);
      setAdBalance(balanceRes.adBalance || 0);
      setTransactions(balanceRes.transactions || []);
      setPromotions(promosRes.promotions || []);
      setProducts((productsRes.products || []).filter((p: any) => p.status === "ACTIVE"));
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFund = async () => {
    const amt = parseFloat(fundAmount);
    if (!amt || amt <= 0) { showToast("Enter a valid amount", "error"); return; }
    try {
      setFunding(true);
      await apiFetch("/api/seller/ads/fund", { method: "POST", body: JSON.stringify({ amount: amt }) });
      showToast("Ad balance funded!", "success");
      setFundAmount("");
      fetchData();
    } catch (err: any) {
      showToast(err.message || "Failed to fund", "error");
    } finally {
      setFunding(false);
    }
  };

  const selectedTierConfig = tiers.find((t) => t.tier === selectedTier);
  const totalCost = selectedTierConfig ? selectedTierConfig.dailyRate * selectedDays : 0;

  const handleCreatePromotion = async () => {
    if (!selectedProduct) { showToast("Select a product", "error"); return; }
    try {
      setCreating(true);
      await apiFetch("/api/seller/ads/promotions", {
        method: "POST",
        body: JSON.stringify({ productId: selectedProduct, tier: selectedTier, days: selectedDays }),
      });
      showToast("Promotion created!", "success");
      setSelectedProduct("");
      fetchData();
    } catch (err: any) {
      showToast(err.message || "Failed to create promotion", "error");
    } finally {
      setCreating(false);
    }
  };

  const handlePause = async (id: string) => {
    try {
      await apiFetch(`/api/seller/ads/promotions/${id}/pause`, { method: "PUT" });
      showToast("Promotion paused", "success");
      fetchData();
    } catch (err: any) { showToast(err.message || "Failed", "error"); }
  };

  const handleResume = async (id: string) => {
    try {
      await apiFetch(`/api/seller/ads/promotions/${id}/resume`, { method: "PUT" });
      showToast("Promotion resumed", "success");
      fetchData();
    } catch (err: any) { showToast(err.message || "Failed", "error"); }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Cancel this promotion? Remaining budget will be refunded.")) return;
    try {
      await apiFetch(`/api/seller/ads/promotions/${id}`, { method: "DELETE" });
      showToast("Promotion cancelled & refunded", "success");
      fetchData();
    } catch (err: any) { showToast(err.message || "Failed", "error"); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20 text-red-600">
        <AlertTriangle className="w-5 h-5 mr-2" /> {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Promote & Ads</h2>

      {/* Ad Balance Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
            <Wallet className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Ad Balance</p>
            <p className="text-2xl font-bold text-gray-900">UGX {adBalance.toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={fundAmount}
            onChange={(e) => setFundAmount(e.target.value)}
            placeholder="Amount to transfer"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            min="0"
          />
          <button
            onClick={handleFund}
            disabled={funding}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {funding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Fund from Earnings"}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">Transfer from your earnings balance to your ad balance</p>
      </div>

      {/* Promote Product */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" /> Promote a Product
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              <option value="">Select a product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
            <div className="flex gap-2">
              {[3, 7, 14, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setSelectedDays(d)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedDays === d
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tier Selection */}
        <label className="block text-sm font-medium text-gray-700 mb-2">Ad Tier</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {tiers.map((t) => (
            <button
              key={t.tier}
              onClick={() => setSelectedTier(t.tier)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                selectedTier === t.tier
                  ? "border-primary bg-primary/5"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tierColors[t.tier]}`}>
                  {t.tier}
                </span>
                <span className="text-xs text-gray-500">{t.boost}x boost</span>
              </div>
              <p className="text-lg font-bold text-gray-900 mt-2">
                UGX {t.dailyRate.toLocaleString()}<span className="text-sm font-normal text-gray-500">/day</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">{t.label}</p>
            </button>
          ))}
        </div>

        {/* Cost Summary & Create */}
        <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
          <div>
            <p className="text-sm text-gray-600">Total Cost: <span className="font-bold text-gray-900">UGX {totalCost.toLocaleString()}</span></p>
            <p className="text-xs text-gray-500">{selectedDays} days × UGX {selectedTierConfig?.dailyRate.toLocaleString() || 0}/day</p>
          </div>
          <button
            onClick={handleCreatePromotion}
            disabled={creating || !selectedProduct || totalCost > adBalance}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4" /> Start Promotion</>}
          </button>
        </div>
        {totalCost > adBalance && (
          <p className="text-xs text-red-500 mt-2">Insufficient ad balance. Fund your account first.</p>
        )}
      </div>

      {/* Active Promotions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" /> Your Promotions
          </h3>
        </div>
        {promotions.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Zap className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No promotions yet. Create one above to boost your product visibility!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Product</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Tier</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Period</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Budget</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Spent</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {promotions.map((promo) => (
                  <tr key={promo.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{promo.productName}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tierColors[promo.tier]}`}>
                        {promo.tier}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[promo.status]}`}>
                        {promo.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(promo.startDate).toLocaleDateString()} - {new Date(promo.endDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">UGX {promo.totalBudget.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">UGX {promo.spent.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {promo.status === "ACTIVE" && (
                          <button onClick={() => handlePause(promo.id)} className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg" title="Pause">
                            <Pause className="w-4 h-4" />
                          </button>
                        )}
                        {promo.status === "PAUSED" && (
                          <button onClick={() => handleResume(promo.id)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Resume">
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                        {(promo.status === "ACTIVE" || promo.status === "PAUSED") && (
                          <button onClick={() => handleCancel(promo.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Cancel">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transaction History */}
      {transactions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Transaction History</h3>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between px-6 py-3 border-b border-gray-50">
                <div>
                  <p className="text-sm text-gray-900">{tx.description}</p>
                  <p className="text-xs text-gray-500">{new Date(tx.createdAt).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-medium ${tx.type === "FUND" || tx.type === "REFUND" ? "text-green-600" : "text-red-600"}`}>
                    {tx.type === "DEBIT" ? "-" : "+"}UGX {tx.amount.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400">Bal: UGX {tx.balanceAfter.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
