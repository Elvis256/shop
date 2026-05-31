"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { TrendingUp, ShoppingCart, Eye, Target, AlertTriangle, Download, ArrowUpRight, ArrowDownRight, Award } from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  BarChart as RBarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { arrayToCSV, downloadCSV } from "@/lib/utils/csv";

interface AnalyticsData {
  summary: {
    totalRevenue: number;
    totalUnitsSold: number;
    totalViews: number;
    conversionRate: number;
  };
  comparison?: {
    totalRevenue: number;
    totalUnitsSold: number;
    totalViews: number;
    conversionRate: number;
    revenueChange: number | null;
    unitsSoldChange: number | null;
    viewsChange: number | null;
    conversionChange: number | null;
  };
  salesTrend: Array<{ date: string; revenue: number; orders: number }>;
  topProducts: Array<{ name: string; revenue: number; unitsSold: number }>;
  revenueByCategory: Array<{ name: string; revenue: number }>;
  customerGeography: Array<{ name: string; count: number }>;
}

interface Scorecard {
  fulfillmentRate: number;
  returnRate: number;
  rating: number;
  warningCount: number;
}

const periods = [
  { label: "7 Days", value: 7 },
  { label: "30 Days", value: 30 },
  { label: "90 Days", value: 90 },
];

const CHART_COLORS = [
  "#111827", "#6366f1", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4",
];

const fmtCompact = (n: any) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(1) + "K";
  return v.toString();
};

const fmtDate = (date: any) =>
  new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function SellerAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState(30);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      let url = `/api/seller/analytics?period=${period}`;
      if (useCustomRange && customFrom && customTo) {
        url = `/api/seller/analytics?from=${customFrom}&to=${customTo}`;
      }
      if (compareEnabled) {
        url += "&compareWith=previous";
      }
      const result = await apiFetch(url);
      setData(result);
    } catch (err: any) {
      setError(err.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [period, customFrom, customTo, useCustomRange, compareEnabled]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    apiFetch("/api/seller/scorecard")
      .then((d) => setScorecard(d))
      .catch(() => {});
  }, []);

  const handleExportCSV = () => {
    if (!data) return;
    const headers = ["Date", "Revenue (UGX)", "Orders"];
    const rows = data.salesTrend.map((d) => [d.date, d.revenue, d.orders]);
    const prodHeaders = ["Product", "Revenue (UGX)", "Units Sold"];
    const prodRows = data.topProducts.map((p) => [p.name, p.revenue, p.unitsSold]);
    const csv = arrayToCSV(headers, rows) + "\n\n" + arrayToCSV(prodHeaders, prodRows);
    downloadCSV(`analytics-${period}d-${new Date().toISOString().slice(0, 10)}`, csv);
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-red-600">{error}</p>
          <button onClick={fetchAnalytics} className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm">Retry</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const changeBadge = (change: number | null | undefined) => {
    if (change === null || change === undefined) return null;
    const isPositive = change >= 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}>
        {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {Math.abs(change)}%
      </span>
    );
  };

  const summaryCards = [
    { label: "Revenue", value: `UGX ${data.summary.totalRevenue.toLocaleString()}`, icon: TrendingUp, color: "text-green-600", bg: "bg-green-50", change: data.comparison?.revenueChange },
    { label: "Units Sold", value: data.summary.totalUnitsSold.toString(), icon: ShoppingCart, color: "text-blue-600", bg: "bg-blue-50", change: data.comparison?.unitsSoldChange },
    { label: "Views", value: data.summary.totalViews.toLocaleString(), icon: Eye, color: "text-purple-600", bg: "bg-purple-50", change: data.comparison?.viewsChange },
    { label: "Conversion", value: `${data.summary.conversionRate}%`, icon: Target, color: "text-orange-600", bg: "bg-orange-50", change: data.comparison?.conversionChange },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={compareEnabled}
              onChange={(e) => setCompareEnabled(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            Compare
          </label>
          <div className="flex gap-2">
            {periods.map((p) => (
              <button
                key={p.value}
                onClick={() => { setPeriod(p.value); setUseCustomRange(false); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !useCustomRange && period === p.value ? "bg-primary text-white" : "bg-white text-gray-600 border hover:bg-gray-50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Custom Date Range */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={useCustomRange}
            onChange={(e) => setUseCustomRange(e.target.checked)}
            className="rounded border-gray-300 text-primary focus:ring-primary"
          />
          Custom range
        </label>
        {useCustomRange && (
          <>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-10 h-10 ${card.bg} rounded-lg flex items-center justify-center`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              {compareEnabled && changeBadge(card.change)}
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="text-sm text-gray-600 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Seller Scorecard */}
      {scorecard && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-gray-900">Seller Scorecard</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{scorecard.fulfillmentRate}%</p>
              <p className="text-xs text-gray-500 mt-1">Fulfillment Rate</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{scorecard.returnRate}%</p>
              <p className="text-xs text-gray-500 mt-1">Return Rate</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{scorecard.rating.toFixed(1)}</p>
              <p className="text-xs text-gray-500 mt-1">Rating</p>
            </div>
            <div className="text-center">
              <p className={`text-2xl font-bold ${scorecard.warningCount > 0 ? "text-red-600" : "text-gray-900"}`}>{scorecard.warningCount}</p>
              <p className="text-xs text-gray-500 mt-1">Warnings</p>
            </div>
          </div>
        </div>
      )}

      {/* Sales Trend Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Sales Trend</h2>
        {data.salesTrend.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No sales data for this period</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={data.salesTrend}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis yAxisId="rev" tickFormatter={fmtCompact} tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis yAxisId="ord" orientation="right" tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <Tooltip
                formatter={(val: any, name: any) =>
                  name === "revenue" ? [`UGX ${Number(val).toLocaleString()}`, "Revenue"] : [val, "Orders"]
                }
                labelFormatter={fmtDate}
              />
              <Legend />
              <Area yAxisId="rev" type="monotone" dataKey="revenue" stroke="#6366f1" fill="url(#revGrad)" name="Revenue" />
              <Line yAxisId="ord" type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={2} dot={false} name="Orders" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products — Horizontal Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Products</h2>
          {data.topProducts.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No product data</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={Math.max(200, data.topProducts.length * 40)}>
                <RBarChart
                  data={data.topProducts}
                  layout="vertical"
                  margin={{ left: 10, right: 30 }}
                  onClick={(e: any) => {
                    if (e?.activeLabel) setSelectedProduct(e.activeLabel === selectedProduct ? null : e.activeLabel);
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                  <XAxis type="number" tickFormatter={fmtCompact} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 11 }}
                    stroke="#9ca3af"
                    tickFormatter={(v: any) => String(v).length > 18 ? String(v).slice(0, 16) + "..." : String(v)}
                  />
                  <Tooltip formatter={(val: any) => [`UGX ${Number(val).toLocaleString()}`, "Revenue"]} />
                  <Bar dataKey="revenue" fill="#6366f1" radius={[0, 4, 4, 0]} name="Revenue" cursor="pointer" />
                </RBarChart>
              </ResponsiveContainer>
              {selectedProduct && (
                <div className="mt-3 p-3 bg-indigo-50 rounded-lg text-sm">
                  <p className="font-medium text-gray-900">{selectedProduct}</p>
                  {(() => {
                    const prod = data.topProducts.find((p) => p.name === selectedProduct);
                    return prod ? (
                      <div className="flex gap-4 mt-1 text-xs text-gray-600">
                        <span>Revenue: UGX {prod.revenue.toLocaleString()}</span>
                        <span>Units: {prod.unitsSold}</span>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}
            </>
          )}
        </div>

        {/* Revenue by Category — Pie Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Category</h2>
          {data.revenueByCategory.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No category data</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.revenueByCategory}
                  dataKey="revenue"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  labelLine={true}
                >
                  {data.revenueByCategory.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: any) => [`UGX ${Number(val).toLocaleString()}`, "Revenue"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Customer Geography — Vertical Bar */}
      {data.customerGeography.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Geography</h2>
          <ResponsiveContainer width="100%" height={300}>
            <RBarChart data={data.customerGeography.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <Tooltip />
              <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="Orders" />
            </RBarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
