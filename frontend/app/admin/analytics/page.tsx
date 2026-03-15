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
} from "lucide-react";

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

const STATUS_DOTS: Record<string, string> = {
  PENDING: "bg-yellow-400",
  CONFIRMED: "bg-blue-400",
  PROCESSING: "bg-indigo-400",
  SHIPPED: "bg-purple-400",
  DELIVERED: "bg-emerald-400",
  CANCELLED: "bg-red-400",
  REFUNDED: "bg-gray-400",
};

// ─── SVG Charts ───────────────────────────────────────────────────────────────

function LineChart({
  data,
  lines,
  height = 220,
}: {
  data: Record<string, any>[];
  lines: { key: string; color: string; label: string }[];
  height?: number;
}) {
  const w = 700;
  const h = height;
  const pad = { top: 16, right: 16, bottom: 32, left: 56 };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;

  if (!data.length) {
    return (
      <div className="flex items-center justify-center text-gray-400 text-[13px]" style={{ height }}>
        No data for this period
      </div>
    );
  }

  const allVals = lines.flatMap((l) => data.map((d) => Number(d[l.key]) || 0));
  const maxVal = Math.max(...allVals, 1);
  const xScale = (i: number) => pad.left + (i / Math.max(data.length - 1, 1)) * innerW;
  const yScale = (v: number) => pad.top + innerH - (v / maxVal) * innerH;

  const tickStep = Math.max(1, Math.floor(data.length / 7));
  const yTicks = Array.from({ length: 5 }, (_, i) => (maxVal / 4) * i);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={pad.left} y1={yScale(v)} x2={w - pad.right} y2={yScale(v)} stroke="#f3f4f6" strokeWidth="1" />
          <text x={pad.left - 8} y={yScale(v) + 4} textAnchor="end" className="fill-gray-400" fontSize="10">
            {fmtCompact(v)}
          </text>
        </g>
      ))}
      {data.map((d, i) =>
        i % tickStep === 0 ? (
          <text key={i} x={xScale(i)} y={h - 6} textAnchor="middle" className="fill-gray-400" fontSize="10">
            {fmtDate(d.date)}
          </text>
        ) : null
      )}
      {lines.map((line) => {
        const pts = data.map((d, i) => `${xScale(i)},${yScale(Number(d[line.key]) || 0)}`);
        const areaPath = [
          `${xScale(0)},${pad.top + innerH}`,
          ...pts,
          `${xScale(data.length - 1)},${pad.top + innerH}`,
        ].join(" ");
        return (
          <g key={line.key}>
            <polygon points={areaPath} fill={line.color} opacity="0.06" />
            <polyline points={pts.join(" ")} fill="none" stroke={line.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {data.map((d, i) => (
              <circle key={i} cx={xScale(i)} cy={yScale(Number(d[line.key]) || 0)} r="2.5" fill="white" stroke={line.color} strokeWidth="1.5" opacity="0" className="hover:opacity-100 transition-opacity">
                <title>{line.label}: {fmtCompact(Number(d[line.key]) || 0)} — {fmtDate(d.date)}</title>
              </circle>
            ))}
          </g>
        );
      })}
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + innerH} stroke="#e5e7eb" strokeWidth="1" />
      <line x1={pad.left} y1={pad.top + innerH} x2={w - pad.right} y2={pad.top + innerH} stroke="#e5e7eb" strokeWidth="1" />
    </svg>
  );
}

function BarChart({
  data,
  xKey,
  yKey,
  height = 180,
}: {
  data: Record<string, any>[];
  xKey: string;
  yKey: string;
  height?: number;
}) {
  const w = 600;
  const h = height;
  const pad = { top: 12, right: 12, bottom: 28, left: 40 };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;

  if (!data.length) {
    return (
      <div className="flex items-center justify-center text-gray-400 text-[13px]" style={{ height }}>
        No data
      </div>
    );
  }

  const vals = data.map((d) => Number(d[yKey]) || 0);
  const maxVal = Math.max(...vals, 1);
  const barW = Math.max(4, (innerW / data.length) * 0.6);
  const gap = innerW / data.length;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <line x1={pad.left} y1={pad.top + innerH} x2={w - pad.right} y2={pad.top + innerH} stroke="#e5e7eb" strokeWidth="1" />
      {data.map((d, i) => {
        const val = Number(d[yKey]) || 0;
        const barH = (val / maxVal) * innerH;
        const x = pad.left + i * gap + (gap - barW) / 2;
        const y = pad.top + innerH - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx="2" fill="#1f2937" opacity="0.75">
              <title>{d[xKey]}: {val}</title>
            </rect>
            {i % Math.max(1, Math.floor(data.length / 8)) === 0 && (
              <text x={x + barW / 2} y={h - 6} textAnchor="middle" className="fill-gray-400" fontSize="9">
                {String(d[xKey]).replace(":00", "h")}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Growth Badge ─────────────────────────────────────────────────────────────

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

// ─── CSV Export ───────────────────────────────────────────────────────────────

function buildCSV(data: any, period: number): string {
  const rows: string[] = [];

  rows.push("ANALYTICS REPORT — " + period + " Days — " + new Date().toISOString().split("T")[0]);
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
  rows.push("Registered," + (data.customers?.registered || 0));
  rows.push("New Registered," + (data.customers?.newRegistered || 0));
  rows.push("Order Customers," + (data.customers?.orderCustomers || 0));
  rows.push("Returning," + (data.customers?.returning || 0));
  rows.push("Conversion Rate," + (data.customers?.conversionRate || 0) + "%");
  rows.push("");

  rows.push("TRAFFIC");
  rows.push("Total Visitors," + (data.traffic?.totalVisitors || 0));
  rows.push("Visitor Growth %," + (data.traffic?.visitorGrowth || 0));
  rows.push("Bounce Rate," + (data.traffic?.bounceRate || 0) + "%");
  rows.push("Pages/Session," + (data.traffic?.pagesPerSession || 0));
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

  if (data.traffic?.sources?.length) {
    rows.push("TRAFFIC SOURCES");
    rows.push("Source,Visits,Percentage");
    data.traffic.sources.forEach((s: any) => rows.push(s.source + "," + s.visits + "," + (s.pct || 0) + "%"));
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [period, setPeriod] = useState(30);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  useEffect(() => { load(); }, [load]);

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

  // ─── Loading skeleton ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-7 w-40 bg-gray-100 rounded animate-pulse" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-72 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-72 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  // ─── Error state ──────────────────────────────────────────────────────────────

  if (!data) {
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

  // ─── Derived data ─────────────────────────────────────────────────────────────

  const rev = data.revenue || {};
  const ord = data.orders || {};
  const cust = data.customers || {};
  const prod = data.products || {};
  const traf = data.traffic || {};

  const statusEntries = STATUS_ORDER
    .map((s) => ({ name: s, count: (ord.byStatus?.[s] as number) || 0 }))
    .filter((e) => e.count > 0);
  const maxStatusCount = Math.max(...statusEntries.map((e) => e.count), 1);

  const funnelEntries = STATUS_ORDER
    .map((s) => ({ name: s, ...(ord.funnel?.[s] || { count: 0, value: 0 }) }))
    .filter((e) => e.count > 0);

  // Merge revenue daily + traffic daily for the combined chart
  const chartData = (rev.daily || []).map((d: any) => {
    const tDay = (traf.daily || []).find((t: any) => t.date === d.date);
    return {
      date: d.date,
      revenue: d.amount || 0,
      collected: d.collected || 0,
      visitors: tDay?.visitors || 0,
    };
  });

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-gray-900">Analytics</h1>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center bg-gray-100 rounded-lg p-0.5">
            {[7, 14, 30, 90].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={
                  "px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors " +
                  (period === p
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700")
                }
              >
                {p}D
              </button>
            ))}
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          label="Revenue"
          value={fmt(rev.total)}
          sub={`${fmt(rev.collected)} collected`}
          growth={rev.growth}
        />
        <KPICard
          label="Orders"
          value={String(ord.total || 0)}
          sub={`${(ord.avgPerDay || 0).toFixed(1)}/day · ${(ord.allTime || 0).toLocaleString()} all-time`}
          growth={ord.growth}
        />
        <KPICard
          label="Visitors"
          value={fmtCompact(traf.totalVisitors)}
          sub={`${fmtPct(traf.bounceRate)} bounce rate`}
          growth={traf.visitorGrowth}
        />
        <KPICard
          label="Conversion"
          value={fmtPct(cust.conversionRate)}
          sub={`${cust.orderCustomers || 0} buyers of ${fmtCompact(traf.totalVisitors)} visitors`}
        />
      </div>

      {/* Revenue + Visitors chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[13px] font-semibold text-gray-900">Revenue & Visitors</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Daily order value vs visitor count · Avg order {fmt(rev.avgOrderValue)}
            </p>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-[2px] bg-gray-900 rounded" /> Revenue
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-[2px] bg-gray-400 rounded" /> Visitors
            </span>
          </div>
        </div>
        <LineChart
          data={chartData}
          lines={[
            { key: "revenue", color: "#111827", label: "Revenue" },
            { key: "visitors", color: "#9ca3af", label: "Visitors" },
          ]}
          height={240}
        />
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-4">
          {/* Orders by Status */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-[13px] font-semibold text-gray-900 mb-3">Orders by Status</h2>
            {statusEntries.length === 0 ? (
              <p className="text-[13px] text-gray-400">No orders in this period</p>
            ) : (
              <div className="space-y-2.5">
                {statusEntries.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOTS[entry.name] || "bg-gray-300"}`} />
                    <span className="text-[13px] text-gray-600 w-24 flex-shrink-0">{entry.name}</span>
                    <div className="flex-1 h-5 bg-gray-50 rounded overflow-hidden">
                      <div
                        className="h-full bg-gray-900 rounded transition-all"
                        style={{ width: `${(entry.count / maxStatusCount) * 100}%`, opacity: 0.15 }}
                      />
                    </div>
                    <span className="text-[13px] font-medium text-gray-900 w-8 text-right">{entry.count}</span>
                  </div>
                ))}
              </div>
            )}
            {funnelEntries.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-[11px] text-gray-400 mb-2">Order Funnel (value)</p>
                <div className="flex items-end gap-1">
                  {funnelEntries.map((f) => (
                    <div key={f.name} className="flex-1 text-center">
                      <p className="text-[11px] font-medium text-gray-700">{f.count}</p>
                      <p className="text-[9px] text-gray-400 truncate">{f.name.slice(0, 4)}</p>
                      <p className="text-[9px] text-gray-400">{fmtCompact(f.value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Top Products */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-[13px] font-semibold text-gray-900 mb-3">Top Selling Products</h2>
            {!prod.topSelling?.length ? (
              <p className="text-[13px] text-gray-400">No sales data available</p>
            ) : (
              <div className="space-y-2">
                {prod.topSelling.map((p: any, i: number) => {
                  const maxSold = prod.topSelling[0]?.sold || 1;
                  return (
                    <div key={p.name} className="flex items-center gap-3">
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
                          <div
                            className="h-full bg-gray-900 rounded-full"
                            style={{ width: `${(p.sold / maxSold) * 100}%`, opacity: 0.2 }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payment Methods */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-[13px] font-semibold text-gray-900 mb-3">Payment Methods</h2>
            {!data.paymentMethods?.length ? (
              <p className="text-[13px] text-gray-400">No payment data</p>
            ) : (
              <div className="space-y-2">
                {data.paymentMethods.map((pm: any) => {
                  const totalPayments = data.paymentMethods.reduce((s: number, m: any) => s + m.count, 0);
                  const pct = totalPayments ? ((pm.count / totalPayments) * 100).toFixed(0) : "0";
                  return (
                    <div key={pm.name} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-gray-300" />
                        <span className="text-[13px] text-gray-700">{pm.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[12px] text-gray-400">{pm.count} orders · {pct}%</span>
                        <span className="text-[12px] font-medium text-gray-900">{fmt(pm.amount)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Traffic Sources */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-[13px] font-semibold text-gray-900 mb-3">Traffic Sources</h2>
            {!traf.sources?.length ? (
              <p className="text-[13px] text-gray-400">No traffic data</p>
            ) : (
              <div className="space-y-2">
                {traf.sources.map((s: any) => (
                  <div key={s.source} className="flex items-center gap-3">
                    <span className="text-[13px] text-gray-700 w-28 flex-shrink-0 truncate">{s.source}</span>
                    <div className="flex-1 h-5 bg-gray-50 rounded overflow-hidden">
                      <div
                        className="h-full bg-gray-900 rounded transition-all"
                        style={{ width: `${s.pct || 0}%`, opacity: 0.12 }}
                      />
                    </div>
                    <span className="text-[12px] text-gray-400 w-16 text-right">{(s.visits || 0).toLocaleString()}</span>
                    <span className="text-[11px] text-gray-400 w-10 text-right">{fmtPct(s.pct)}</span>
                  </div>
                ))}
              </div>
            )}
            {traf.topPages?.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-[11px] text-gray-400 mb-2">Top Pages</p>
                <div className="space-y-1.5">
                  {traf.topPages.slice(0, 5).map((pg: any) => (
                    <div key={pg.path} className="flex items-center justify-between">
                      <span className="text-[12px] text-gray-600 truncate flex-1">{pg.path}</span>
                      <span className="text-[12px] text-gray-400 ml-3">{(pg.views || 0).toLocaleString()} views</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-4 text-[12px] text-gray-400">
              <span>Pages/session: {(traf.pagesPerSession || 0).toFixed(1)}</span>
              <span>Bounce: {fmtPct(traf.bounceRate)}</span>
            </div>
          </div>

          {/* Hourly Distribution */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-[13px] font-semibold text-gray-900 mb-3">Hourly Order Distribution</h2>
            {!data.hourlyOrders?.length ? (
              <p className="text-[13px] text-gray-400">No hourly data</p>
            ) : (
              <>
                <BarChart data={data.hourlyOrders} xKey="hour" yKey="count" height={160} />
                <p className="text-[11px] text-gray-400 mt-2">
                  Peak hour: {data.hourlyOrders.reduce((max: any, h: any) => (h.count > (max?.count || 0) ? h : max), data.hourlyOrders[0])?.hour || "—"}
                </p>
              </>
            )}
          </div>

          {/* Product Insights */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-[13px] font-semibold text-gray-900 mb-3">Product Insights</h2>
            <div className="space-y-3">
              <InsightRow
                label="Active products"
                value={String(prod.totalActive || 0)}
              />
              <InsightRow
                label="Low stock"
                value={String(prod.lowStock || 0)}
                warn={prod.lowStock > 0}
              />
              <InsightRow
                label="Out of stock"
                value={String(prod.outOfStock || 0)}
                warn={prod.outOfStock > 0}
              />
              <InsightRow
                label="Never ordered"
                value={String(prod.neverOrdered || 0)}
                warn={prod.neverOrdered > 3}
              />
              <InsightRow
                label="Inventory value"
                value={fmt(prod.inventoryValue)}
              />
              {prod.avgDropshipMargin != null && (
                <InsightRow
                  label="Avg dropship margin"
                  value={fmtPct(prod.avgDropshipMargin)}
                />
              )}
            </div>
            {prod.dropshipMargins?.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-[11px] text-gray-400 mb-2">Dropship Margins</p>
                <div className="space-y-1.5">
                  {prod.dropshipMargins.slice(0, 5).map((dm: any) => (
                    <div key={dm.name} className="flex items-center justify-between">
                      <span className="text-[12px] text-gray-600 truncate flex-1">{dm.name}</span>
                      <div className="flex items-center gap-3 ml-3 text-[12px]">
                        <span className="text-gray-400">cost {fmt(dm.cost)}</span>
                        <span className="font-medium text-gray-700">{fmtPct(dm.margin)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom: Customer Metrics */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-[13px] font-semibold text-gray-900 mb-3">Customer Metrics</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <MetricCell label="Registered" value={String(cust.registered || 0)} />
          <MetricCell label="New this period" value={String(cust.newRegistered || 0)} />
          <MetricCell label="Unique buyers" value={String(cust.orderCustomers || 0)} />
          <MetricCell label="Returning" value={String(cust.returning || 0)} />
          <MetricCell label="Conversion rate" value={fmtPct(cust.conversionRate)} />
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  sub,
  growth,
}: {
  label: string;
  value: string;
  sub: string;
  growth?: number | null;
}) {
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

function InsightRow({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-gray-600 flex items-center gap-1.5">
        {warn && <AlertTriangle className="w-3 h-3 text-red-400" />}
        {label}
      </span>
      <span className={`text-[13px] font-medium ${warn ? "text-red-500" : "text-gray-900"}`}>
        {value}
      </span>
    </div>
  );
}
