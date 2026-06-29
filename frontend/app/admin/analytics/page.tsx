"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import {
  TrendingUp,
  TrendingDown,
  Download,
  RefreshCw,
  Activity,
  AlertTriangle,
  Info,
  CheckCircle,
  Briefcase,
  Percent,
  Coins,
} from "lucide-react";
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (amount: number | null | undefined) =>
  `UGX ${Number(amount || 0).toLocaleString()}`;

const fmtCompact = (n: number | null | undefined) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(1) + "K";
  return v.toString();
};

const fmtDate = (date: string) =>
  new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const fmtPct = (v: number | null | undefined) => (v || 0).toFixed(1) + "%";

const STATUS_ORDER = [
  "PENDING", "CONFIRMED", "PROCESSING", "SHIPPED",
  "DELIVERED", "CANCELLED", "REFUNDED",
];

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#eab308",
  CONFIRMED: "#3b82f6",
  PROCESSING: "#6366f1",
  SHIPPED: "#8b5cf6",
  DELIVERED: "#10b981",
  CANCELLED: "#ef4444",
  REFUNDED: "#6b7280",
};

const CHART_COLORS = [
  "#111827", "#6366f1", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4",
];

// ─── CSV Export ───────────────────────────────────────────────────────────────

function buildCSV(data: any, period: number): string {
  const rows: string[] = [];

  rows.push("ANALYTICS REPORT — " + (period === 1 ? "Today" : period + " Days") + " — " + new Date().toISOString().split("T")[0]);
  rows.push("");

  rows.push("REVENUE");
  rows.push("Total Order Value," + (data.revenue?.total || 0));
  rows.push("Collected (Paid)," + (data.revenue?.collected || 0));
  rows.push("Growth %," + (data.revenue?.growth || 0));
  rows.push("Avg Order Value," + (data.revenue?.avgOrderValue || 0));
  rows.push("");

  rows.push("ORDERS");
  rows.push("Total (Period)," + (data.orders?.total || 0));
  rows.push("All Time," + (data.orders?.allTime || 0));
  rows.push("Growth %," + (data.orders?.growth || 0));
  rows.push("Avg Per Day," + (data.orders?.avgPerDay || 0));
  rows.push("");

  if (data.orders?.byStatus) {
    rows.push("ORDERS BY STATUS");
    rows.push("Status,Count");
    Object.entries(data.orders.byStatus).forEach(([k, v]) => rows.push(k + "," + v));
    rows.push("");
  }

  rows.push("CUSTOMERS");
  rows.push("Registered," + (data.customers?.registered || data.customers?.total || 0));
  rows.push("New Registered," + (data.customers?.newRegistered || data.customers?.newThisMonth || 0));
  rows.push("Order Customers," + (data.customers?.orderCustomers || 0));
  rows.push("Returning," + (data.customers?.returning || 0));
  rows.push("Conversion Rate," + (data.customers?.conversionRate || 0) + "%");
  rows.push("");

  rows.push("TRAFFIC");
  rows.push("Total Visitors," + (data.traffic?.totalVisitors || 0));
  rows.push("Visitor Growth %," + (data.traffic?.visitorGrowth || 0));
  rows.push("Bounce Rate," + (data.traffic?.bounceRate || 0) + "%");
  rows.push("Pages/Session," + (data.traffic?.pagesPerSession || data.traffic?.avgPagesPerSession || 0));
  rows.push("");

  if (data.revenue?.daily?.length) {
    rows.push("DAILY REVENUE");
    rows.push("Date,Order Value,Collected");
    data.revenue.daily.forEach((d: any) => rows.push(d.date + "," + d.amount + "," + (d.collected || 0)));
    rows.push("");
  }

  if (data.traffic?.daily?.length) {
    rows.push("DAILY TRAFFIC");
    rows.push("Date,Visitors,Orders,Revenue");
    data.traffic.daily.forEach((d: any) =>
      rows.push(d.date + "," + d.visitors + "," + d.orders + "," + d.revenue)
    );
    rows.push("");
  }

  if (data.products?.topSelling?.length) {
    rows.push("TOP SELLING PRODUCTS");
    rows.push("Name,Sold,Revenue");
    data.products.topSelling.forEach((p: any) => rows.push(`"${p.name}",${p.sold},${p.revenue}`));
    rows.push("");
  }

  const sources = data.traffic?.sources || data.traffic?.trafficSources || [];
  if (sources.length) {
    rows.push("TRAFFIC SOURCES");
    rows.push("Source,Visits,Percentage");
    sources.forEach((s: any) => rows.push(s.source + "," + (s.visits || s.count || 0) + "," + (s.pct || 0) + "%"));
    rows.push("");
  }

  if (data.paymentMethods?.length) {
    rows.push("PAYMENT METHODS");
    rows.push("Method,Count,Amount");
    data.paymentMethods.forEach((p: any) => rows.push(`"${p.name}",${p.count},${p.amount}`));
    rows.push("");
  }

  if (data.hourlyOrders?.length) {
    rows.push("HOURLY ORDER DISTRIBUTION");
    rows.push("Hour,Orders");
    data.hourlyOrders.forEach((h: any) => rows.push(h.hour + "," + h.count));
  }

  return rows.join("\n");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GrowthBadge({ value }: { value: number | null | undefined }) {
  const v = Number(value || 0);
  if (v === 0) return <span className="text-[11px] text-gray-400">—</span>;
  const up = v > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${up ? "text-emerald-600" : "text-red-500"}`}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {up ? "+" : ""}{v.toFixed(1)}%
    </span>
  );
}

function KPICard({ label, value, sub, growth }: { label: string; value: string; sub: string; growth?: number | null }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] text-gray-400">{label}</span>
        {growth !== undefined && <GrowthBadge value={growth} />}
      </div>
      <p className="text-[22px] font-semibold text-gray-900 leading-tight truncate">{value}</p>
      <p className="text-[11px] text-gray-400 mt-1 truncate">{sub}</p>
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center py-2">
      <p className="text-[20px] font-semibold text-gray-900">{value}</p>
      <p className="text-[11px] text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function WoWCard({ label, current, previous, change }: { label: string; current: number; previous: number; change: number }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-[11px] text-gray-400 uppercase tracking-wide mb-2">{label} — Week over Week</h3>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[18px] font-semibold text-gray-900">{fmtCompact(current)}</p>
          <p className="text-[11px] text-gray-400">this week</p>
        </div>
        <div className="text-right">
          <p className="text-[14px] text-gray-500">{fmtCompact(previous)}</p>
          <p className="text-[11px] text-gray-400">last week</p>
        </div>
        <GrowthBadge value={change} />
      </div>
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-[12px]">
      <p className="text-gray-500 mb-1">{fmtDate(label)}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} style={{ color: entry.color }} className="font-medium">
          {entry.name}: {entry.dataKey === "visitors" ? Number(entry.value || 0).toLocaleString() : fmt(entry.value)}
        </p>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [period, setPeriod] = useState(30);
  const [activeTab, setActiveTab] = useState<"standard" | "investor">("standard");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [investorData, setInvestorData] = useState<any>(null);
  const [investorLoading, setInvestorLoading] = useState(false);
  const [marketingSpend, setMarketingSpend] = useState(2000000);

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.admin.getAnalytics(period) as any;
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  const loadInvestor = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setInvestorLoading(true);
    try {
      const res = await api.admin.getInvestorAnalytics(period, marketingSpend) as any;
      setInvestorData(res);
    } catch {
      setInvestorData(null);
    } finally {
      setInvestorLoading(false);
      setRefreshing(false);
    }
  }, [period, marketingSpend]);

  useEffect(() => {
    if (activeTab === "standard") {
      load();
    } else {
      loadInvestor();
    }
  }, [activeTab, load, loadInvestor]);

  const exportCSV = () => {
    if (!data) return;
    const csv = buildCSV(data, period);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `analytics-${period}d-${new Date().toISOString().split("T")[0]}.csv`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ─── Loading skeleton ──────────────────────────────────────────────────────

  if (loading || (activeTab === "investor" && investorLoading && !investorData)) {
    return (
      <div className="space-y-5">
        <div className="h-7 w-40 bg-gray-100 rounded animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-72 bg-gray-100 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-72 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-72 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  // ─── Error state ───────────────────────────────────────────────────────────

  if (activeTab === "standard" && !data) {
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-semibold text-gray-900">Analytics</h1>
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Activity className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-[13px] text-gray-900 font-medium mb-1">Unable to load analytics</p>
          <p className="text-[13px] text-gray-400 mb-5">Something went wrong fetching your data.</p>
          <button
            onClick={() => load()}
            className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Try again
          </button>
        </div>
      </div>
    );
  }

  if (activeTab === "investor" && !investorData) {
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-semibold text-gray-900">Investor Analytics</h1>
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Activity className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-[13px] text-gray-900 font-medium mb-1">Unable to load investor analytics</p>
          <p className="text-[13px] text-gray-400 mb-5">Something went wrong fetching investor data.</p>
          <button
            onClick={() => loadInvestor()}
            className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Try again
          </button>
        </div>
      </div>
    );
  }

  // ─── Derived data ──────────────────────────────────────────────────────────

  const rev = data.revenue || {};
  const ord = data.orders || {};
  const cust = data.customers || {};
  const prod = data.products || {};
  const traf = data.traffic || {};
  const proj = data.projections || {};
  const wow = proj.weekOverWeek || {};

  // Status data for bar chart
  const statusData = STATUS_ORDER
    .map((s) => ({ name: s, count: (ord.byStatus?.[s] as number) || 0, fill: STATUS_COLORS[s] || "#6b7280" }))
    .filter((e) => e.count > 0);

  // Order funnel
  const funnelEntries = STATUS_ORDER
    .map((s) => ({ name: s, ...(ord.funnel?.[s] || { count: 0, value: 0 }) }))
    .filter((e) => e.count > 0);

  // Merge revenue daily + traffic daily for the combined chart
  const chartData = (rev.daily || []).map((d: any) => {
    const tDay = (traf.daily || []).find((t: any) => t.date === d.date);
    return {
      date: d.date,
      revenue: d.amount || 0,
      visitors: tDay?.visitors || 0,
    };
  });

  // Payment pie data
  const paymentData = (data.paymentMethods || []).map((pm: any, i: number) => ({
    name: pm.name,
    value: pm.count || 0,
    amount: pm.amount || 0,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  // Traffic sources
  const trafficSources = traf.sources || traf.trafficSources || [];
  const trafficSourceData = trafficSources.map((s: any, i: number) => ({
    name: s.source,
    value: s.visits || s.count || 0,
    pct: s.pct || 0,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  // Hourly orders
  const hourlyData = (data.hourlyOrders || []).map((h: any) => ({
    hour: String(h.hour).replace(":00", "h"),
    count: h.count || 0,
  }));

  // Visitors by country
  const countryData = traf.visitorsByCountry || [];

  // Top pages
  const topPages = traf.topPages || [];

  // Category breakdown
  const categoryData = (prod.categoryBreakdown || []).map((c: any) => ({
    name: c.name,
    count: c.count || 0,
    totalValue: c.totalValue || 0,
  }));

  // Inventory health
  const health = prod.healthBreakdown || {};

  // Most wishlisted
  const wishlisted = prod.mostWishlisted || [];

  // Never ordered
  const neverOrdered = Array.isArray(prod.neverOrdered) ? prod.neverOrdered : [];

  // Dropship margins
  const dropshipMargins = prod.dropshipMargins || [];

  // Insights
  const insights = data.insights || [];

  // Trend arrow helper
  const trendArrow = (trend: string | undefined) => {
    if (trend === "up") return "↑";
    if (trend === "down") return "↓";
    return "→";
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* A) Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-gray-900">Analytics</h1>
        <div className="flex items-center gap-2">
          {activeTab === "standard" && (
            <div className="inline-flex items-center bg-gray-100 rounded-lg p-0.5">
              {[1, 7, 14, 30, 90].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={
                    "px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors " +
                    (period === p ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")
                  }
                >
                  {p === 1 ? "Today" : `${p}D`}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => activeTab === "standard" ? load(true) : loadInvestor(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {activeTab === "standard" && (
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab("standard")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium transition-colors ${
            activeTab === "standard" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Standard Performance
        </button>
        <button
          onClick={() => setActiveTab("investor")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium transition-colors ${
            activeTab === "investor" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          Investor BI & LTV
        </button>
      </div>

      {activeTab === "standard" ? (
        <>
          {/* B) KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <KPICard
          label="Revenue"
          value={fmt(rev.total)}
          sub={`${fmt(rev.collected ?? rev.thisMonth)} collected`}
          growth={rev.growth}
        />
        <KPICard
          label="Orders"
          value={String(ord.total || 0)}
          sub={`${(ord.avgPerDay || 0).toFixed(1)} avg/day`}
          growth={ord.growth}
        />
        <KPICard
          label="Avg Order Value"
          value={fmt(rev.avgOrderValue)}
          sub={`${rev.monthChange != null ? (rev.monthChange > 0 ? "+" : "") + fmtPct(rev.monthChange) + " vs last month" : "this period"}`}
          growth={rev.monthChange}
        />
        <KPICard
          label="Visitors"
          value={fmtCompact(traf.totalVisitors)}
          sub={`${fmtPct(traf.bounceRate)} bounce rate`}
          growth={traf.visitorGrowth}
        />
        <KPICard
          label="Conversion Rate"
          value={fmtPct(cust.conversionRate)}
          sub={`${cust.orderCustomers || 0} buyers of ${fmtCompact(traf.totalVisitors)} visitors`}
        />
        <KPICard
          label="Projected Revenue"
          value={fmtCompact(proj.revenue30d)}
          sub={`30d projection ${trendArrow(proj.revenueTrend)}`}
        />
      </div>

      {/* C) Revenue & Traffic Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[13px] font-semibold text-gray-900">Revenue & Traffic</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Daily order value vs visitor count · Avg order {fmt(rev.avgOrderValue)}
            </p>
          </div>
        </div>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center text-gray-400 text-[13px] h-[280px]">No data for this period</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tickFormatter={(v: number) => fmtCompact(v)} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => fmtCompact(v)} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" fill="#111827" fillOpacity={0.08} stroke="#111827" strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="visitors" name="Visitors" stroke="#6366f1" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* D) Week-over-Week */}
      {(wow.revenue || wow.visitors) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {wow.revenue && (
            <WoWCard label="Revenue" current={wow.revenue.current || 0} previous={wow.revenue.previous || 0} change={wow.revenue.change || 0} />
          )}
          {wow.visitors && (
            <WoWCard label="Visitors" current={wow.visitors.current || 0} previous={wow.visitors.previous || 0} change={wow.visitors.change || 0} />
          )}
        </div>
      )}

      {/* E) Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEFT COLUMN */}
        <div className="space-y-4">
          {/* Orders by Status — horizontal BarChart */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-[13px] font-semibold text-gray-900 mb-3">Orders by Status</h2>
            {statusData.length === 0 ? (
              <p className="text-[13px] text-gray-400">No orders in this period</p>
            ) : (
              <ResponsiveContainer width="100%" height={statusData.length * 36 + 16}>
                <RBarChart data={statusData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip formatter={(value: any) => [value, "Orders"]} contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </RBarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Order Funnel */}
          {funnelEntries.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-[13px] font-semibold text-gray-900 mb-3">Order Funnel</h2>
              <div className="space-y-2">
                {funnelEntries.map((f, i) => {
                  const maxCount = funnelEntries[0]?.count || 1;
                  const widthPct = Math.max(12, (f.count / maxCount) * 100);
                  return (
                    <div key={f.name} className="flex items-center gap-3">
                      <span className="text-[12px] text-gray-500 w-24 flex-shrink-0">{f.name}</span>
                      <div className="flex-1">
                        <div
                          className="h-7 rounded flex items-center px-2"
                          style={{
                            width: `${widthPct}%`,
                            backgroundColor: STATUS_COLORS[f.name] || CHART_COLORS[i % CHART_COLORS.length],
                            opacity: 0.8,
                          }}
                        >
                          <span className="text-[11px] text-white font-medium whitespace-nowrap">{f.count}</span>
                        </div>
                      </div>
                      <span className="text-[11px] text-gray-400 flex-shrink-0 w-20 text-right">{fmtCompact(f.value)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top Selling Products */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-[13px] font-semibold text-gray-900 mb-3">Top Selling Products</h2>
            {!prod.topSelling?.length ? (
              <p className="text-[13px] text-gray-400">No sales data available</p>
            ) : (
              <div className="space-y-2">
                {prod.topSelling.map((p: any, i: number) => {
                  const maxSold = prod.topSelling[0]?.sold || 1;
                  return (
                    <div key={p.name + i} className="flex items-center gap-3">
                      <span className="text-[12px] font-medium text-gray-400 w-5 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] text-gray-900 truncate">{p.name}</span>
                          <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                            <span className="text-[12px] text-gray-400">{p.sold} sold</span>
                            <span className="text-[12px] font-medium text-gray-700">{fmt(p.revenue)}</span>
                          </div>
                        </div>
                        <div className="h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
                          <div className="h-full bg-gray-900 rounded-full" style={{ width: `${(p.sold / maxSold) * 100}%`, opacity: 0.2 }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payment Methods — Donut PieChart */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-[13px] font-semibold text-gray-900 mb-3">Payment Methods</h2>
            {paymentData.length === 0 ? (
              <p className="text-[13px] text-gray-400">No payment data</p>
            ) : (
              <div className="flex items-center gap-6">
                <div className="w-40 h-40 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={60} paddingAngle={2}>
                        {paymentData.map((entry: any) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any, name: any) => [value + " orders", name]} contentStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1.5">
                  {paymentData.map((pm: any) => {
                    const total = paymentData.reduce((s: number, m: any) => s + m.value, 0);
                    const pct = total ? ((pm.value / total) * 100).toFixed(0) : "0";
                    return (
                      <div key={pm.name} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: pm.fill }} />
                          <span className="text-[13px] text-gray-700">{pm.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[12px] text-gray-400">{pm.value} · {pct}%</span>
                          <span className="text-[12px] font-medium text-gray-900">{fmt(pm.amount)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-4">
          {/* Traffic Sources — PieChart + table */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-[13px] font-semibold text-gray-900 mb-3">Traffic Sources</h2>
            {trafficSourceData.length === 0 ? (
              <p className="text-[13px] text-gray-400">No traffic data</p>
            ) : (
              <div className="flex items-center gap-6">
                <div className="w-36 h-36 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={trafficSourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={55} paddingAngle={1}>
                        {trafficSourceData.map((entry: any) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any, name: any) => [Number(value || 0).toLocaleString() + " visits", name]} contentStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1.5">
                  {trafficSourceData.map((s: any) => (
                    <div key={s.name} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.fill }} />
                        <span className="text-[13px] text-gray-700 truncate">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[12px] text-gray-400">{s.value.toLocaleString()}</span>
                        <span className="text-[11px] text-gray-400 w-10 text-right">{fmtPct(s.pct)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-4 text-[12px] text-gray-400">
              <span>Pages/session: {(traf.pagesPerSession || traf.avgPagesPerSession || 0).toFixed(1)}</span>
              <span>Bounce: {fmtPct(traf.bounceRate)}</span>
            </div>
          </div>

          {/* Visitor Geography */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-[13px] font-semibold text-gray-900 mb-3">Visitor Geography</h2>
            {countryData.length === 0 ? (
              <p className="text-[13px] text-gray-400">No country data</p>
            ) : (
              <div className="space-y-2">
                {countryData.slice(0, 10).map((c: any) => {
                  const maxVisitors = countryData[0]?.visitors || 1;
                  return (
                    <div key={c.country} className="flex items-center gap-3">
                      <span className="text-[13px] text-gray-700 w-28 flex-shrink-0 truncate">{c.country}</span>
                      <div className="flex-1 h-5 bg-gray-50 rounded overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded transition-all" style={{ width: `${(c.visitors / maxVisitors) * 100}%`, opacity: 0.25 }} />
                      </div>
                      <span className="text-[12px] text-gray-500 w-16 text-right">{(c.visitors || 0).toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top Pages */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-[13px] font-semibold text-gray-900 mb-3">Top Pages</h2>
            {topPages.length === 0 ? (
              <p className="text-[13px] text-gray-400">No page data</p>
            ) : (
              <div className="space-y-1.5">
                {topPages.slice(0, 8).map((pg: any) => (
                  <div key={pg.path} className="flex items-center justify-between py-1">
                    <span className="text-[12px] text-gray-600 truncate flex-1">{pg.path}</span>
                    <span className="text-[12px] text-gray-400 ml-3 flex-shrink-0">{(pg.views || 0).toLocaleString()} views</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Hourly Distribution — Recharts BarChart */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-[13px] font-semibold text-gray-900 mb-3">Hourly Order Distribution</h2>
            {hourlyData.length === 0 ? (
              <p className="text-[13px] text-gray-400">No hourly data</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <RBarChart data={hourlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(hourlyData.length / 8) - 1)} />
                    <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value: any) => [value, "Orders"]} contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="count" fill="#111827" opacity={0.75} radius={[2, 2, 0, 0]} />
                  </RBarChart>
                </ResponsiveContainer>
                <p className="text-[11px] text-gray-400 mt-2">
                  Peak hour: {(data.hourlyOrders || []).reduce((max: any, h: any) => (h.count > (max?.count || 0) ? h : max), data.hourlyOrders?.[0])?.hour || "—"}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* F) Product Analytics Section */}
      <div className="space-y-4">
        {/* Inventory Health */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-red-200 p-4">
            <p className="text-[11px] text-red-500 font-medium uppercase tracking-wide">Out of Stock</p>
            <p className="text-[24px] font-semibold text-red-600 mt-1">{health.outOfStock ?? prod.outOfStock ?? 0}</p>
          </div>
          <div className="bg-white rounded-lg border border-yellow-200 p-4">
            <p className="text-[11px] text-yellow-600 font-medium uppercase tracking-wide">Low Stock</p>
            <p className="text-[24px] font-semibold text-yellow-600 mt-1">{health.lowStock ?? prod.lowStock ?? 0}</p>
          </div>
          <div className="bg-white rounded-lg border border-green-200 p-4">
            <p className="text-[11px] text-green-600 font-medium uppercase tracking-wide">Healthy</p>
            <p className="text-[24px] font-semibold text-green-600 mt-1">{health.healthy ?? 0}</p>
          </div>
          <div className="bg-white rounded-lg border border-blue-200 p-4">
            <p className="text-[11px] text-blue-600 font-medium uppercase tracking-wide">Overstocked</p>
            <p className="text-[24px] font-semibold text-blue-600 mt-1">{health.overstocked ?? 0}</p>
          </div>
        </div>

        {/* Category Breakdown */}
        {categoryData.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-[13px] font-semibold text-gray-900 mb-3">Category Breakdown</h2>
            <ResponsiveContainer width="100%" height={Math.max(200, categoryData.length * 40)}>
              <RBarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={100} />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    name === "count" ? value + " products" : fmt(value),
                    name === "count" ? "Products" : "Value",
                  ]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="count" name="Products" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={16} />
              </RBarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Two-column: Most Wishlisted + Never Ordered */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Most Wishlisted */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-[13px] font-semibold text-gray-900 mb-3">Most Wishlisted</h2>
            {wishlisted.length === 0 ? (
              <p className="text-[13px] text-gray-400">No wishlist data</p>
            ) : (
              <div className="space-y-2">
                {wishlisted.slice(0, 8).map((w: any) => (
                  <div key={w.name} className="flex items-center justify-between py-1">
                    <span className="text-[13px] text-gray-700 truncate flex-1">{w.name}</span>
                    <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                      <span className="text-[12px] text-gray-400">♥ {w.wishlistCount || 0}</span>
                      <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${(w.stock || 0) > 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                        {(w.stock || 0) > 0 ? `${w.stock} in stock` : "Out of stock"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Never Ordered */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-[13px] font-semibold text-gray-900 mb-3">Never Ordered</h2>
            {neverOrdered.length === 0 ? (
              <p className="text-[13px] text-gray-400">All products have been ordered</p>
            ) : (
              <div className="space-y-2">
                {neverOrdered.slice(0, 8).map((p: any) => (
                  <div key={p.name} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {(p.daysListed || 0) > 30 && <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                      <span className="text-[13px] text-gray-700 truncate">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-3 ml-3 flex-shrink-0 text-[12px]">
                      <span className="text-gray-400">{p.daysListed || 0}d listed</span>
                      <span className="text-gray-400">×{p.stock || 0}</span>
                      <span className="font-medium text-gray-700">{fmt(p.price)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Dropship Margins */}
        {dropshipMargins.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-[13px] font-semibold text-gray-900 mb-3">Dropship Margins</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-[11px] text-gray-400 font-medium pb-2 pr-4">Product</th>
                    <th className="text-[11px] text-gray-400 font-medium pb-2 pr-4 text-right">Price</th>
                    <th className="text-[11px] text-gray-400 font-medium pb-2 pr-4 text-right">Cost</th>
                    <th className="text-[11px] text-gray-400 font-medium pb-2 pr-4 text-right">Margin</th>
                    <th className="text-[11px] text-gray-400 font-medium pb-2 text-right">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {dropshipMargins.map((dm: any) => (
                    <tr key={dm.name} className="border-b border-gray-50">
                      <td className="text-[13px] text-gray-700 py-2 pr-4 truncate max-w-[200px]">{dm.name}</td>
                      <td className="text-[13px] text-gray-700 py-2 pr-4 text-right">{fmt(dm.price)}</td>
                      <td className="text-[13px] text-gray-400 py-2 pr-4 text-right">{dm.cost != null ? fmt(dm.cost) : "—"}</td>
                      <td className={`text-[13px] font-medium py-2 pr-4 text-right ${(dm.margin || 0) >= 20 ? "text-green-600" : (dm.margin || 0) >= 10 ? "text-yellow-600" : "text-red-500"}`}>
                        {fmtPct(dm.margin)}
                      </td>
                      <td className="py-2 text-right">
                        <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{dm.source || "—"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-gray-400 mt-3">
              Inventory value: {fmt(prod.inventoryValue)} · Active products: {prod.totalActive || 0}
            </p>
          </div>
        )}
      </div>

      {/* G) Customer Metrics */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-[13px] font-semibold text-gray-900 mb-3">Customer Metrics</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <MetricCell label="Total registered" value={String(cust.total ?? cust.registered ?? 0)} />
          <MetricCell label="New this month" value={String(cust.newThisMonth ?? cust.newRegistered ?? 0)} />
          <MetricCell label="New last month" value={String(cust.newLastMonth ?? 0)} />
          <MetricCell label="Returning" value={String(cust.returning || 0)} />
          <MetricCell label="Conversion rate" value={fmtPct(cust.conversionRate)} />
        </div>
      </div>

      {/* H) Business Insights */}
      {insights.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-[13px] font-semibold text-gray-900">Business Insights</h2>
          {insights.map((insight: any, i: number) => {
            const typeMap: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
              warning: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800", icon: <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" /> },
              success: { bg: "bg-green-50", border: "border-green-200", text: "text-green-800", icon: <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" /> },
              info: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800", icon: <Info className="w-4 h-4 text-blue-500 flex-shrink-0" /> },
            };
            const style = typeMap[insight.type] || typeMap.info;
            return (
              <div key={i} className={`rounded-lg border ${style.border} ${style.bg} p-4 flex items-start gap-3`}>
                {style.icon}
                <div>
                  <p className={`text-[13px] font-medium ${style.text}`}>{insight.title}</p>
                  <p className={`text-[12px] mt-0.5 ${style.text} opacity-80`}>{insight.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
      ) : (
        <div className="space-y-5">
          {/* Marketing Spend Controller */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-[13px] font-semibold text-gray-900">Marketing & Acquisition Cost Input</h2>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Adjust marketing spend to calculate real-time Customer Acquisition Cost (CAC) and LTV:CAC ratio
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[12px] text-gray-400 pointer-events-none">UGX</span>
                  <input
                    type="number"
                    value={marketingSpend}
                    onChange={(e) => setMarketingSpend(Number(e.target.value))}
                    className="w-40 pl-11 pr-3 py-1.5 text-[13px] text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 font-semibold"
                  />
                </div>
                <button
                  onClick={() => loadInvestor()}
                  disabled={investorLoading}
                  className="px-3 py-1.5 text-[12px] font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  Recalculate
                </button>
              </div>
            </div>
          </div>

          {/* Investor KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <KPICard
              label="Monthly Recurring Revenue"
              value={fmt(investorData?.metrics?.mrr)}
              sub="From active subscriptions"
            />
            <KPICard
              label="Customer Acquisition Cost"
              value={fmt(investorData?.metrics?.cac)}
              sub={`For ${investorData?.metrics?.newCustomersAcquired ?? 0} new customers`}
            />
            <KPICard
              label="Lifetime Value"
              value={fmt(investorData?.metrics?.ltv)}
              sub={`Based on ${investorData?.metrics?.totalCustomersBase ?? 0} buyers`}
            />
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] text-gray-400">LTV : CAC Ratio</span>
                <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
                  (investorData?.metrics?.ltvToCacRatio || 0) >= 3
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : (investorData?.metrics?.ltvToCacRatio || 0) >= 1
                    ? "bg-yellow-50 text-yellow-700 border border-yellow-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}>
                  {(investorData?.metrics?.ltvToCacRatio || 0) >= 3 ? "Healthy" : (investorData?.metrics?.ltvToCacRatio || 0) >= 1 ? "Moderate" : "At Risk"}
                </span>
              </div>
              <p className="text-[22px] font-semibold text-gray-900 leading-tight truncate">
                {investorData?.metrics?.ltvToCacRatio ? `${investorData.metrics.ltvToCacRatio}x` : "—"}
              </p>
              <p className="text-[11px] text-gray-400 mt-1 truncate">Target: &gt; 3.0x</p>
            </div>
            <KPICard
              label="Average Order Value"
              value={fmt(investorData?.metrics?.aov)}
              sub="Successful order average"
            />
            <KPICard
              label="Subscription Churn Rate"
              value={fmtPct(investorData?.metrics?.subscriptionChurnRate)}
              sub="Monthly cancel estimate"
            />
          </div>

          {/* Business Model Payback Analysis & Info */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4 lg:col-span-1 flex flex-col justify-between">
              <div>
                <h3 className="text-[13px] font-semibold text-gray-900 mb-2">LTV : CAC Viability Analysis</h3>
                <p className="text-[12px] text-gray-500 leading-relaxed mb-4">
                  An LTV:CAC ratio of <span className="font-semibold text-gray-950">{investorData?.metrics?.ltvToCacRatio || 0}x</span> indicates that the lifetime value of a customer is {investorData?.metrics?.ltvToCacRatio || 0} times the cost to acquire them.
                </p>
                <div className="space-y-2 text-[11px] text-gray-500">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    <span>&gt; 3.0x : Excellent (High VC investment grade)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                    <span>1.0x - 3.0x : Moderate (Needs pricing or marketing optimization)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span>&lt; 1.0x : Loss making (Acquisition costs exceed customer value)</span>
                  </div>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-3 mt-3">
                <p className="text-[11px] text-gray-400">
                  Calculated against {investorData?.metrics?.newCustomersAcquired ?? 0} acquisitions and {fmt(investorData?.metrics?.totalRevenuePeriod)} total successful revenue.
                </p>
              </div>
            </div>

            {/* Heatmap Matrix */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 lg:col-span-2">
              <div className="mb-3">
                <h3 className="text-[13px] font-semibold text-gray-900">Cohort Retention Matrix</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Percentage of customers who place at least one successful order in subsequent months after registration
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-[12px] border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-400 font-medium">
                      <th className="py-2 pr-3 text-left font-normal pb-2">Cohort (Month)</th>
                      <th className="py-2 pr-3 text-right font-normal pb-2">Size</th>
                      <th className="py-2 px-2 text-center font-normal pb-2">Month 0</th>
                      <th className="py-2 px-2 text-center font-normal pb-2">Month 1</th>
                      <th className="py-2 px-2 text-center font-normal pb-2">Month 2</th>
                      <th className="py-2 px-2 text-center font-normal pb-2">Month 3</th>
                      <th className="py-2 px-2 text-center font-normal pb-2">Month 4</th>
                      <th className="py-2 px-2 text-center font-normal pb-2">Month 5</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!investorData?.cohortMatrix?.length ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-gray-400 text-[12px]">
                          No cohort cohort data available
                        </td>
                      </tr>
                    ) : (
                      investorData.cohortMatrix.map((c: any) => (
                        <tr key={c.cohort} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2.5 pr-3 font-semibold text-gray-900">{c.cohort}</td>
                          <td className="py-2.5 pr-3 text-right text-gray-500 font-medium">{c.size} users</td>
                          {[0, 1, 2, 3, 4, 5].map((idx) => {
                            const retItem = c.retention?.find((r: any) => r.monthOffset === idx);
                            const rate = retItem ? retItem.rate : 0;
                            // Color density based on rate
                            let bgClass = "bg-gray-50 text-gray-400";
                            if (rate > 50) bgClass = "bg-indigo-600 text-white font-semibold";
                            else if (rate >= 30) bgClass = "bg-indigo-400 text-white font-medium";
                            else if (rate >= 15) bgClass = "bg-indigo-200 text-indigo-900 font-medium";
                            else if (rate > 0) bgClass = "bg-indigo-50 text-indigo-700 font-medium";

                            return (
                              <td
                                key={idx}
                                className={`py-2 px-2 text-center rounded-sm text-[11px] transition-colors border border-white ${bgClass}`}
                                title={retItem ? `${retItem.activeUsers} active users` : ""}
                              >
                                {rate.toFixed(1)}%
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
