"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import {
  TrendingUp,
  TrendingDown,
  Download,
  RefreshCw,
  DollarSign,
  ShoppingCart,
  Users,
  UserPlus,
  Package,
  ArrowUpRight,
  Eye,
  Target,
  Percent,
  Clock,
  CreditCard,
  Repeat,
  Award,
  AlertTriangle,
  Activity,
  Globe,
  Lightbulb,
  BarChart3,
  Heart,
  Layers,
} from "lucide-react";

// ─── Pure SVG Chart Components ────────────────────────────────────────────────

function SVGLineChart({
  data,
  xKey,
  yKey,
  color = "#6366f1",
  height = 200,
  formatY,
  formatX,
  label,
}: {
  data: Record<string, any>[];
  xKey: string;
  yKey: string;
  color?: string;
  height?: number;
  formatY?: (v: number) => string;
  formatX?: (v: string) => string;
  label?: string;
}) {
  const w = 600;
  const h = height;
  const pad = { top: 10, right: 10, bottom: 30, left: 50 };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;

  if (!data.length) return <div className="flex items-center justify-center h-full text-gray-400 text-sm">No data</div>;

  const values = data.map((d) => Number(d[yKey]) || 0);
  const minVal = 0;
  const maxVal = Math.max(...values, 1);

  const xScale = (i: number) => pad.left + (i / Math.max(data.length - 1, 1)) * innerW;
  const yScale = (v: number) => pad.top + innerH - ((v - minVal) / (maxVal - minVal)) * innerH;

  const points = data.map((d, i) => `${xScale(i)},${yScale(Number(d[yKey]) || 0)}`).join(" ");
  const areaPoints = [
    `${pad.left},${pad.top + innerH}`,
    ...data.map((d, i) => `${xScale(i)},${yScale(Number(d[yKey]) || 0)}`),
    `${pad.left + innerW},${pad.top + innerH}`,
  ].join(" ");

  const xTicks = data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 6)) === 0);
  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => minVal + (i * (maxVal - minVal)) / yTickCount);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={`grad-${yKey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {yTicks.map((v) => (
        <line key={v} x1={pad.left} x2={pad.left + innerW} y1={yScale(v)} y2={yScale(v)} stroke="#f0f0f0" strokeWidth="1" />
      ))}
      {/* Area fill */}
      <polygon points={areaPoints} fill={`url(#grad-${yKey})`} />
      {/* Line */}
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {/* Y axis labels */}
      {yTicks.map((v) => (
        <text key={v} x={pad.left - 6} y={yScale(v) + 4} textAnchor="end" fontSize="10" fill="#9ca3af">
          {formatY ? formatY(v) : v.toLocaleString()}
        </text>
      ))}
      {/* X axis labels */}
      {xTicks.map((d) => {
        const i = data.indexOf(d);
        return (
          <text key={i} x={xScale(i)} y={h - 6} textAnchor="middle" fontSize="10" fill="#9ca3af">
            {formatX ? formatX(d[xKey]) : d[xKey]}
          </text>
        );
      })}
      {/* Dots on data points */}
      {data.map((d, i) => (
        <circle key={i} cx={xScale(i)} cy={yScale(Number(d[yKey]) || 0)} r="2.5" fill={color} />
      ))}
    </svg>
  );
}

function SVGBarChart({
  data,
  xKey,
  yKey,
  color = "#6366f1",
  height = 200,
  formatY,
}: {
  data: Record<string, any>[];
  xKey: string;
  yKey: string;
  color?: string;
  height?: number;
  formatY?: (v: number) => string;
}) {
  const w = 600;
  const h = height;
  const pad = { top: 10, right: 10, bottom: 30, left: 50 };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;

  if (!data.length) return <div className="flex items-center justify-center h-full text-gray-400 text-sm">No data</div>;

  const values = data.map((d) => Number(d[yKey]) || 0);
  const maxVal = Math.max(...values, 1);
  const barW = Math.max(4, (innerW / data.length) * 0.7);
  const barGap = innerW / data.length;

  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => (i * maxVal) / yTickCount);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
      {/* Grid */}
      {yTicks.map((v) => {
        const y = pad.top + innerH - (v / maxVal) * innerH;
        return <line key={v} x1={pad.left} x2={pad.left + innerW} y1={y} y2={y} stroke="#f0f0f0" strokeWidth="1" />;
      })}
      {/* Bars */}
      {data.map((d, i) => {
        const val = Number(d[yKey]) || 0;
        const barH = (val / maxVal) * innerH;
        const x = pad.left + i * barGap + (barGap - barW) / 2;
        const y = pad.top + innerH - barH;
        return (
          <rect key={i} x={x} y={y} width={barW} height={barH} fill={color} rx="3" ry="3" />
        );
      })}
      {/* Y labels */}
      {yTicks.map((v) => {
        const y = pad.top + innerH - (v / maxVal) * innerH + 4;
        return (
          <text key={v} x={pad.left - 6} y={y} textAnchor="end" fontSize="10" fill="#9ca3af">
            {formatY ? formatY(v) : v.toLocaleString()}
          </text>
        );
      })}
      {/* X labels */}
      {data.map((d, i) => (
        <text key={i} x={pad.left + i * barGap + barGap / 2} y={h - 6} textAnchor="middle" fontSize="10" fill="#9ca3af">
          {String(d[xKey]).length > 5 ? String(d[xKey]).slice(0, 5) : d[xKey]}
        </text>
      ))}
    </svg>
  );
}

function SVGDonutChart({
  data,
  height = 200,
}: {
  data: { name: string; value: number; color: string }[];
  height?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <div className="flex items-center justify-center h-full text-gray-400 text-sm">No data</div>;

  const cx = 100;
  const cy = 100;
  const outerR = 75;
  const innerR = 48;

  const slices: JSX.Element[] = [];
  let angle = -Math.PI / 2;
  data.forEach((d, idx) => {
    const sweep = (d.value / total) * 2 * Math.PI;
    const x1 = cx + outerR * Math.cos(angle);
    const y1 = cy + outerR * Math.sin(angle);
    const x2 = cx + outerR * Math.cos(angle + sweep);
    const y2 = cy + outerR * Math.sin(angle + sweep);
    const ix1 = cx + innerR * Math.cos(angle + sweep);
    const iy1 = cy + innerR * Math.sin(angle + sweep);
    const ix2 = cx + innerR * Math.cos(angle);
    const iy2 = cy + innerR * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    slices.push(
      <path
        key={idx}
        d={`M${x1},${y1} A${outerR},${outerR} 0 ${large},1 ${x2},${y2} L${ix1},${iy1} A${innerR},${innerR} 0 ${large},0 ${ix2},${iy2} Z`}
        fill={d.color}
      />
    );
    angle += sweep;
  });

  return (
    <svg viewBox="0 0 200 200" className="w-full" style={{ height }}>
      {slices}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="18" fontWeight="bold" fill="#111827">
        {total}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill="#6b7280">
        orders
      </text>
    </svg>
  );
}

interface AnalyticsData {
  revenue: {
    total: number;
    growth: number;
    daily: Array<{ date: string; amount: number }>;
    avgOrderValue: number;
    thisMonth: number;
    lastMonth: number;
    monthChange: number;
  };
  orders: {
    total: number;
    growth: number;
    daily: Array<{ date: string; count: number }>;
    byStatus: Record<string, number>;
    avgPerDay: number;
    thisMonth: number;
    lastMonth: number;
    monthChange: number;
    funnel: {
      totalOrders: number;
      pending: number;
      successful: number;
      failed: number;
      pendingValue: number;
    };
  };
  customers: {
    total: number;
    newThisMonth: number;
    returning: number;
    conversionRate: number;
  };
  products: {
    topSelling: Array<{ name: string; slug: string; sold: number; revenue: number }>;
    lowStock: number;
    outOfStock: number;
    totalActive: number;
    categoryBreakdown: Array<{ name: string; count: number; totalValue: number; totalStock: number }>;
    dropshipMargins: Array<{ name: string; slug: string; price: number; costUSD: number; costUGX: number; margin: number; source: string }>;
    mostWishlisted: Array<{ name: string; slug: string; wishlistCount: number; stock: number }>;
    neverOrdered: Array<{ name: string; slug: string; stock: number; price: number; daysListed: number }>;
    inventoryValue: number;
    healthBreakdown: { outOfStock: number; lowStock: number; healthy: number; overstocked: number };
  };
  traffic: {
    daily: Array<{ date: string; visitors: number; orders: number; revenue: number }>;
    totalVisitors: number;
    bounceRate: number;
    avgPagesPerSession: number;
    visitorsByCountry: Array<{ country: string; visitors: number }>;
    trafficSources: Array<{ source: string; count: number }>;
    topPages: Array<{ path: string; views: number }>;
  };
  projections: {
    revenue30d: number;
    visitors30d: number;
    revenueTrend: "up" | "down" | "flat";
    visitorTrend: "up" | "down" | "flat";
    weekOverWeek: {
      revenue: { current: number; previous: number; change: number };
      visitors: { current: number; previous: number; change: number };
    };
  };
  paymentMethods: Array<{ name: string; count: number; amount: number }>;
  hourlyOrders: Array<{ hour: string; count: number }>;
  insights: Array<{ type: "success" | "warning" | "info" | "danger"; title: string; message: string }>;
}

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];
const STATUS_COLORS: Record<string, string> = {
  PENDING: "#f59e0b",
  CONFIRMED: "#6366f1",
  PROCESSING: "#8b5cf6",
  SHIPPED: "#06b6d4",
  DELIVERED: "#22c55e",
  CANCELLED: "#ef4444",
  REFUNDED: "#f97316",
};

// Country code → emoji flag
function countryFlag(code: string): string {
  if (!code || code === "Unknown") return "🌍";
  const codePoints = [...code.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// Country code → display name
const COUNTRY_NAMES: Record<string, string> = {
  US: "United States", GB: "United Kingdom", UG: "Uganda", KE: "Kenya", TZ: "Tanzania",
  NG: "Nigeria", ZA: "South Africa", GH: "Ghana", RW: "Rwanda", ET: "Ethiopia",
  IN: "India", CN: "China", JP: "Japan", DE: "Germany", FR: "France",
  CA: "Canada", AU: "Australia", BR: "Brazil", RU: "Russia", IT: "Italy",
  ES: "Spain", NL: "Netherlands", SE: "Sweden", CH: "Switzerland", PL: "Poland",
  MX: "Mexico", AR: "Argentina", CO: "Colombia", CL: "Chile", PE: "Peru",
  EG: "Egypt", MA: "Morocco", SN: "Senegal", CM: "Cameroon", CI: "Ivory Coast",
  CD: "DR Congo", SD: "Sudan", AO: "Angola", MZ: "Mozambique", MG: "Madagascar",
  AE: "UAE", SA: "Saudi Arabia", PK: "Pakistan", BD: "Bangladesh", PH: "Philippines",
  ID: "Indonesia", MY: "Malaysia", TH: "Thailand", VN: "Vietnam", SG: "Singapore",
  KR: "South Korea", TW: "Taiwan", HK: "Hong Kong", NZ: "New Zealand",
  IE: "Ireland", PT: "Portugal", AT: "Austria", BE: "Belgium", DK: "Denmark",
  FI: "Finland", NO: "Norway", CZ: "Czechia", RO: "Romania", HU: "Hungary",
  UA: "Ukraine", TR: "Turkey", IL: "Israel", QA: "Qatar", KW: "Kuwait",
  Unknown: "Unknown",
};

function countryName(code: string): string {
  return COUNTRY_NAMES[code] || code;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);
  const [activeTab, setActiveTab] = useState<"overview" | "sales" | "customers" | "products">("overview");

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const result = await api.admin.getAnalytics(period);
      setData(result);
    } catch (error) {
      console.error("Failed to load analytics:", error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const exportToCSV = () => {
    if (!data) return;
    const csvRows: string[] = [];
    csvRows.push("ANALYTICS REPORT");
    csvRows.push("Period: Last " + period + " days");
    csvRows.push("Generated: " + new Date().toISOString());
    csvRows.push("");
    csvRows.push("KEY METRICS");
    csvRows.push("Total Revenue," + data.revenue.total);
    csvRows.push("Revenue Growth," + (data.revenue.growth || 0).toFixed(1) + "%");
    csvRows.push("Total Orders," + data.orders.total);
    csvRows.push("Total Customers," + data.customers.total);
    csvRows.push("Conversion Rate," + (data.customers.conversionRate || 0).toFixed(2) + "%");
    csvRows.push("Inventory Value," + data.products.inventoryValue);
    csvRows.push("Projected Revenue (30d)," + data.projections.revenue30d);
    csvRows.push("");
    csvRows.push("DAILY BREAKDOWN");
    csvRows.push("Date,Revenue,Orders,Visitors");
    data.traffic.daily.forEach((d) => csvRows.push(d.date + "," + d.revenue + "," + d.orders + "," + d.visitors));
    csvRows.push("");
    csvRows.push("CATEGORY BREAKDOWN");
    csvRows.push("Category,Products,Stock,Value");
    data.products.categoryBreakdown.forEach((c) => csvRows.push('"' + c.name + '",' + c.count + "," + c.totalStock + "," + c.totalValue));
    csvRows.push("");
    if (data.traffic.visitorsByCountry?.length) {
      csvRows.push("VISITORS BY COUNTRY");
      csvRows.push("Country,Visitors,Percentage");
      data.traffic.visitorsByCountry.forEach((c) => {
        const pct = data.traffic.totalVisitors > 0 ? ((c.visitors / data.traffic.totalVisitors) * 100).toFixed(1) : "0.0";
        csvRows.push(countryName(c.country) + "," + c.visitors + "," + pct + "%");
      });
    }
    csvRows.push("");
    csvRows.push("TRAFFIC SOURCES");
    csvRows.push("Source,Visits");
    data.traffic.trafficSources.forEach((s) => csvRows.push(s.source + "," + s.count));

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", "analytics-" + period + "days-" + new Date().toISOString().split("T")[0] + ".csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (amount: number | null | undefined) => "USh " + (amount || 0).toLocaleString();
  const formatCompact = (amount: number | null | undefined) => {
    const n = amount || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return n.toString();
  };
  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  const formatPercent = (value: number | null | undefined) => (value || 0).toFixed(1) + "%";

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-80 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
            <p className="text-gray-500 mt-1">Comprehensive insights into your store performance</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Activity className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Analytics</h2>
          <p className="text-gray-500 mb-6">There was an error fetching your analytics data.</p>
          <button onClick={loadAnalytics} className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors inline-flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
        </div>
      </div>
    );
  }

  const statusData = Object.entries(data.orders?.byStatus || {}).map(([name, value]) => ({
    name, value: value as number, color: STATUS_COLORS[name] || COLORS[0],
  }));

  const INSIGHT_STYLES = {
    success: { bg: "bg-emerald-50", border: "border-emerald-200", icon: "text-emerald-600", title: "text-emerald-800" },
    warning: { bg: "bg-amber-50", border: "border-amber-200", icon: "text-amber-600", title: "text-amber-800" },
    info: { bg: "bg-blue-50", border: "border-blue-200", icon: "text-blue-600", title: "text-blue-800" },
    danger: { bg: "bg-red-50", border: "border-red-200", icon: "text-red-600", title: "text-red-800" },
  };

  const INSIGHT_ICONS: Record<string, any> = {
    success: TrendingUp, warning: AlertTriangle, info: Lightbulb, danger: AlertTriangle,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-500 mt-1">Comprehensive insights into your store performance</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {[7, 14, 30, 90].map((p) => (
              <button key={p} onClick={() => setPeriod(p)} className={"px-3 py-1.5 text-sm font-medium rounded-md transition-colors " + (period === p ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900")}>
                {p}D
              </button>
            ))}
          </div>
          <button onClick={loadAnalytics} className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={exportToCSV} disabled={!data} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Business Insights Banner */}
      {data.insights && data.insights.length > 0 && (
        <div className="space-y-2">
          {data.insights.map((insight, i) => {
            const style = INSIGHT_STYLES[insight.type];
            const Icon = INSIGHT_ICONS[insight.type];
            return (
              <div key={i} className={style.bg + " " + style.border + " border rounded-xl p-4 flex items-start gap-3"}>
                <Icon className={"w-5 h-5 " + style.icon + " flex-shrink-0 mt-0.5"} />
                <div>
                  <p className={"font-semibold text-sm " + style.title}>{insight.title}</p>
                  <p className="text-sm text-gray-700 mt-0.5">{insight.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(["overview", "sales", "customers", "products"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={"px-4 py-2 text-sm font-medium rounded-lg capitalize transition-colors " + (activeTab === tab ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900")}>
            {tab}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-5 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
              <DollarSign className="w-8 h-8 mb-3 opacity-80" />
              <p className="text-emerald-100 text-sm mb-1">Total Revenue</p>
              <p className="text-2xl lg:text-3xl font-bold">{formatCompact(data.revenue.total)}</p>
              <div className={"flex items-center gap-1 mt-2 text-sm " + (data.revenue.growth >= 0 ? "text-emerald-200" : "text-red-200")}>
                {data.revenue.growth >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {formatPercent(Math.abs(data.revenue.growth))} vs last period
              </div>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-5 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
              <ShoppingCart className="w-8 h-8 mb-3 opacity-80" />
              <p className="text-blue-100 text-sm mb-1">Total Orders</p>
              <p className="text-2xl lg:text-3xl font-bold">{data.orders.total}</p>
              <div className={"flex items-center gap-1 mt-2 text-sm " + (data.orders.growth >= 0 ? "text-blue-200" : "text-red-200")}>
                {data.orders.growth >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {formatPercent(Math.abs(data.orders.growth))} vs last period
              </div>
            </div>
            <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl p-5 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
              <Eye className="w-8 h-8 mb-3 opacity-80" />
              <p className="text-violet-100 text-sm mb-1">Visitors</p>
              <p className="text-2xl lg:text-3xl font-bold">{data.traffic.totalVisitors.toLocaleString()}</p>
              <div className="flex items-center gap-1 mt-2 text-sm text-violet-200">
                {data.projections.visitorTrend === "up" ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {formatPercent(Math.abs(data.projections.weekOverWeek.visitors.change))} week over week
              </div>
            </div>
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-5 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
              <Target className="w-8 h-8 mb-3 opacity-80" />
              <p className="text-amber-100 text-sm mb-1">Conversion Rate</p>
              <p className="text-2xl lg:text-3xl font-bold">{formatPercent(data.customers.conversionRate)}</p>
              <div className="flex items-center gap-1 mt-2 text-sm text-amber-200">
                <Activity className="w-4 h-4" />
                {data.traffic.bounceRate.toFixed(0)}% bounce rate
              </div>
            </div>
          </div>

          {/* Projections Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg"><BarChart3 className="w-5 h-5 text-emerald-600" /></div>
                <div>
                  <p className="text-sm text-gray-500">30-Day Revenue Forecast</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(data.projections.revenue30d)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg"><Users className="w-5 h-5 text-blue-600" /></div>
                <div>
                  <p className="text-sm text-gray-500">30-Day Visitor Forecast</p>
                  <p className="text-lg font-bold text-gray-900">{data.projections.visitors30d.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-100 rounded-lg"><Package className="w-5 h-5 text-violet-600" /></div>
                <div>
                  <p className="text-sm text-gray-500">Inventory Value</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(data.products.inventoryValue)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg"><Layers className="w-5 h-5 text-amber-600" /></div>
                <div>
                  <p className="text-sm text-gray-500">Avg Pages/Session</p>
                  <p className="text-lg font-bold text-gray-900">{data.traffic.avgPagesPerSession.toFixed(1)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-6">Revenue & Visitors Overview</h3>
              <SVGLineChart data={data.traffic.daily} xKey="date" yKey="revenue" color="#6366f1" height={240} formatY={(v) => formatCompact(v)} formatX={(v) => formatDate(v)} />
            </div>
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Orders by Status</h3>
              {statusData.length > 0 ? (
                <>
                  <SVGDonutChart data={statusData} height={180} />
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {statusData.slice(0, 6).map((s) => (
                      <div key={s.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-xs text-gray-600 truncate">{s.name}</span>
                        <span className="text-xs font-medium text-gray-900 ml-auto">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                  <ShoppingCart className="w-10 h-10 mb-2 opacity-50" />
                  <p className="text-sm">No orders yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Order Funnel */}
          {data.orders.funnel && data.orders.funnel.totalOrders > 0 && (
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Order Funnel</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-3xl font-bold text-gray-900">{data.traffic.totalVisitors}</p>
                  <p className="text-sm text-gray-500 mt-1">Visitors</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-3xl font-bold text-blue-700">{data.orders.funnel.totalOrders}</p>
                  <p className="text-sm text-gray-500 mt-1">Orders Placed</p>
                </div>
                <div className="text-center p-4 bg-amber-50 rounded-lg">
                  <p className="text-3xl font-bold text-amber-700">{data.orders.funnel.pending}</p>
                  <p className="text-sm text-gray-500 mt-1">Pending Payment</p>
                  <p className="text-xs text-amber-600 mt-1">{formatCurrency(data.orders.funnel.pendingValue)}</p>
                </div>
                <div className="text-center p-4 bg-emerald-50 rounded-lg">
                  <p className="text-3xl font-bold text-emerald-700">{data.orders.funnel.successful}</p>
                  <p className="text-sm text-gray-500 mt-1">Paid</p>
                </div>
              </div>
            </div>
          )}

          {/* Traffic Sources & Top Pages */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Traffic Sources</h3>
                <Globe className="w-5 h-5 text-blue-500" />
              </div>
              {data.traffic.trafficSources.length > 0 ? (
                <div className="space-y-3">
                  {data.traffic.trafficSources.map((s, i) => {
                    const total = data.traffic.trafficSources.reduce((sum, t) => sum + t.count, 0) || 1;
                    const pct = Math.round((s.count / total) * 100);
                    return (
                      <div key={s.source}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-700 font-medium">{s.source}</span>
                          <span className="text-gray-500">{s.count} visits &middot; {pct}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: pct + "%", backgroundColor: COLORS[i % COLORS.length] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400"><p className="text-sm">No external traffic data yet</p></div>
              )}
            </div>
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Most Visited Pages</h3>
                <Eye className="w-5 h-5 text-violet-500" />
              </div>
              {data.traffic.topPages.length > 0 ? (
                <div className="space-y-2">
                  {data.traffic.topPages.slice(0, 8).map((page, i) => {
                    const maxViews = data.traffic.topPages[0]?.views || 1;
                    const pct = Math.round((page.views / maxViews) * 100);
                    return (
                      <div key={page.path} className="flex items-center gap-3">
                        <span className="text-xs font-mono text-gray-500 w-8 text-right">{i + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-700 truncate font-medium">{page.path}</span>
                            <span className="text-gray-500 flex-shrink-0 ml-2">{page.views} views</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-violet-500" style={{ width: pct + "%" }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400"><p className="text-sm">No page view data yet</p></div>
              )}
            </div>
          </div>
        </>
      )}

      {/* SALES TAB */}
      {activeTab === "sales" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-emerald-100 rounded-lg"><DollarSign className="w-5 h-5 text-emerald-600" /></div>
                <span className="text-sm text-gray-500">Total Revenue</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.revenue.total)}</p>
              <div className={"flex items-center gap-1 mt-2 text-sm " + (data.revenue.growth >= 0 ? "text-emerald-600" : "text-red-600")}>
                {data.revenue.growth >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {formatPercent(Math.abs(data.revenue.growth))} vs last period
              </div>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-100 rounded-lg"><CreditCard className="w-5 h-5 text-blue-600" /></div>
                <span className="text-sm text-gray-500">Avg Order Value</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.revenue.avgOrderValue)}</p>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-violet-100 rounded-lg"><ShoppingCart className="w-5 h-5 text-violet-600" /></div>
                <span className="text-sm text-gray-500">Total Orders</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{data.orders.total}</p>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-amber-100 rounded-lg"><BarChart3 className="w-5 h-5 text-amber-600" /></div>
                <span className="text-sm text-gray-500">30-Day Forecast</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.projections.revenue30d)}</p>
              <p className="text-xs text-gray-400 mt-1">Based on current trend</p>
            </div>
          </div>

          {/* Week over Week */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Week-over-Week Revenue</h3>
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-sm text-gray-500">This Week</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.projections.weekOverWeek.revenue.current)}</p>
                </div>
                <div className="text-gray-300 text-xl">&rarr;</div>
                <div>
                  <p className="text-sm text-gray-500">Last Week</p>
                  <p className="text-2xl font-bold text-gray-400">{formatCurrency(data.projections.weekOverWeek.revenue.previous)}</p>
                </div>
                <div className={"ml-auto px-3 py-1 rounded-full text-sm font-medium " + (data.projections.weekOverWeek.revenue.change >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
                  {data.projections.weekOverWeek.revenue.change >= 0 ? "+" : ""}{data.projections.weekOverWeek.revenue.change.toFixed(1)}%
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Week-over-Week Visitors</h3>
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-sm text-gray-500">This Week</p>
                  <p className="text-2xl font-bold text-gray-900">{data.projections.weekOverWeek.visitors.current}</p>
                </div>
                <div className="text-gray-300 text-xl">&rarr;</div>
                <div>
                  <p className="text-sm text-gray-500">Last Week</p>
                  <p className="text-2xl font-bold text-gray-400">{data.projections.weekOverWeek.visitors.previous}</p>
                </div>
                <div className={"ml-auto px-3 py-1 rounded-full text-sm font-medium " + (data.projections.weekOverWeek.visitors.change >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
                  {data.projections.weekOverWeek.visitors.change >= 0 ? "+" : ""}{data.projections.weekOverWeek.visitors.change.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Revenue Chart */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-6">Daily Revenue</h3>
            <SVGLineChart data={data.revenue.daily} xKey="date" yKey="amount" color="#22c55e" height={240} formatY={(v) => formatCompact(v)} formatX={(v) => formatDate(v)} />
          </div>

          {/* Payment & Hourly */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Payment Methods</h3>
                <CreditCard className="w-5 h-5 text-blue-500" />
              </div>
              {data.paymentMethods.length > 0 ? (
                <div className="space-y-3">
                  {data.paymentMethods.map((pm, i) => {
                    const total = data.paymentMethods.reduce((s, p) => s + p.amount, 0) || 1;
                    const pct = Math.round((pm.amount / total) * 100);
                    return (
                      <div key={pm.name}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-700 font-medium">{pm.name}</span>
                          <span className="text-gray-500">{pct}% &middot; {pm.count} orders</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: pct + "%", backgroundColor: COLORS[i % COLORS.length] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400"><CreditCard className="w-10 h-10 mx-auto mb-2 opacity-50" /><p className="text-sm">No payment data yet</p></div>
              )}
            </div>
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Orders by Hour</h3>
                <Clock className="w-5 h-5 text-violet-500" />
              </div>
              <SVGBarChart data={data.hourlyOrders} xKey="hour" yKey="count" color="#8b5cf6" height={200} />
            </div>
          </div>
        </>
      )}

      {/* CUSTOMERS TAB */}
      {activeTab === "customers" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl p-5 text-white">
              <Users className="w-8 h-8 mb-3 opacity-80" />
              <p className="text-violet-100 text-sm mb-1">Total Customers</p>
              <p className="text-3xl font-bold">{data.customers.total}</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-5 text-white">
              <UserPlus className="w-8 h-8 mb-3 opacity-80" />
              <p className="text-emerald-100 text-sm mb-1">New This Month</p>
              <p className="text-3xl font-bold">{data.customers.newThisMonth}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-5 text-white">
              <Eye className="w-8 h-8 mb-3 opacity-80" />
              <p className="text-blue-100 text-sm mb-1">Total Visitors</p>
              <p className="text-3xl font-bold">{data.traffic.totalVisitors.toLocaleString()}</p>
            </div>
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-5 text-white">
              <Activity className="w-8 h-8 mb-3 opacity-80" />
              <p className="text-amber-100 text-sm mb-1">Conversion Rate</p>
              <p className="text-3xl font-bold">{formatPercent(data.customers.conversionRate)}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-6">Visitors Trend</h3>
            <SVGLineChart data={data.traffic.daily} xKey="date" yKey="visitors" color="#8b5cf6" height={240} formatX={(v) => formatDate(v)} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border p-6 text-center">
              <Eye className="w-8 h-8 mx-auto mb-3 text-violet-500" />
              <p className="text-3xl font-bold text-gray-900">{data.traffic.totalVisitors.toLocaleString()}</p>
              <p className="text-sm text-gray-500 mt-1">Total Visitors</p>
            </div>
            <div className="bg-white rounded-xl border p-6 text-center">
              <Activity className="w-8 h-8 mx-auto mb-3 text-emerald-500" />
              <p className="text-3xl font-bold text-gray-900">{formatPercent(data.customers.conversionRate)}</p>
              <p className="text-sm text-gray-500 mt-1">Conversion Rate</p>
            </div>
            <div className="bg-white rounded-xl border p-6 text-center">
              <TrendingDown className="w-8 h-8 mx-auto mb-3 text-amber-500" />
              <p className="text-3xl font-bold text-gray-900">{formatPercent(data.traffic.bounceRate)}</p>
              <p className="text-sm text-gray-500 mt-1">Bounce Rate</p>
            </div>
            <div className="bg-white rounded-xl border p-6 text-center">
              <Layers className="w-8 h-8 mx-auto mb-3 text-blue-500" />
              <p className="text-3xl font-bold text-gray-900">{data.traffic.avgPagesPerSession.toFixed(1)}</p>
              <p className="text-sm text-gray-500 mt-1">Pages / Session</p>
            </div>
          </div>

          {/* Visitors by Country */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-gray-900">Visitors by Country / Region</h3>
              <Globe className="w-5 h-5 text-blue-500" />
            </div>
            {(data.traffic.visitorsByCountry?.length || 0) > 0 ? (
              <div className="space-y-3">
                {data.traffic.visitorsByCountry.slice(0, 15).map((item, i) => {
                  const maxVisitors = data.traffic.visitorsByCountry[0]?.visitors || 1;
                  const pct = Math.round((item.visitors / data.traffic.totalVisitors) * 100);
                  const barPct = Math.round((item.visitors / maxVisitors) * 100);
                  return (
                    <div key={item.country}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700 font-medium flex items-center gap-2">
                          <span className="text-lg">{countryFlag(item.country)}</span>
                          {countryName(item.country)}
                        </span>
                        <span className="text-gray-500">{item.visitors.toLocaleString()} visitors &middot; {pct}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: barPct + "%", backgroundColor: COLORS[i % COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Globe className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No country data yet</p>
                <p className="text-sm text-gray-400 mt-1">Country tracking starts with new visits</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* PRODUCTS TAB */}
      {activeTab === "products" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-100 rounded-lg"><Package className="w-5 h-5 text-blue-600" /></div>
                <span className="text-sm text-gray-500">Active Products</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{data.products.totalActive}</p>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-emerald-100 rounded-lg"><DollarSign className="w-5 h-5 text-emerald-600" /></div>
                <span className="text-sm text-gray-500">Inventory Value</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.products.inventoryValue)}</p>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-red-100 rounded-lg"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
                <span className="text-sm text-gray-500">Out of Stock</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{data.products.outOfStock}</p>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-amber-100 rounded-lg"><AlertTriangle className="w-5 h-5 text-amber-600" /></div>
                <span className="text-sm text-gray-500">Low Stock</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{data.products.lowStock}</p>
            </div>
          </div>

          {/* Inventory Health Bar */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Inventory Health</h3>
            <div className="flex items-center gap-1 mb-4 h-5 rounded-full overflow-hidden bg-gray-100">
              {(() => {
                const h = data.products.healthBreakdown;
                const total = h.outOfStock + h.lowStock + h.healthy + h.overstocked || 1;
                return (
                  <>
                    {h.outOfStock > 0 && <div className="h-full bg-red-500" style={{ width: (h.outOfStock / total) * 100 + "%" }} />}
                    {h.lowStock > 0 && <div className="h-full bg-amber-500" style={{ width: (h.lowStock / total) * 100 + "%" }} />}
                    {h.healthy > 0 && <div className="h-full bg-emerald-500" style={{ width: (h.healthy / total) * 100 + "%" }} />}
                    {h.overstocked > 0 && <div className="h-full bg-blue-500" style={{ width: (h.overstocked / total) * 100 + "%" }} />}
                  </>
                );
              })()}
            </div>
            <div className="grid grid-cols-4 gap-4 text-center text-sm">
              <div><div className="w-3 h-3 rounded-full bg-red-500 mx-auto mb-1" /><p className="font-semibold">{data.products.healthBreakdown.outOfStock}</p><p className="text-gray-500">Out of Stock</p></div>
              <div><div className="w-3 h-3 rounded-full bg-amber-500 mx-auto mb-1" /><p className="font-semibold">{data.products.healthBreakdown.lowStock}</p><p className="text-gray-500">Low Stock</p></div>
              <div><div className="w-3 h-3 rounded-full bg-emerald-500 mx-auto mb-1" /><p className="font-semibold">{data.products.healthBreakdown.healthy}</p><p className="text-gray-500">Healthy</p></div>
              <div><div className="w-3 h-3 rounded-full bg-blue-500 mx-auto mb-1" /><p className="font-semibold">{data.products.healthBreakdown.overstocked}</p><p className="text-gray-500">Overstocked</p></div>
            </div>
          </div>

          {/* Category Breakdown + Wishlisted */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Products by Category</h3>
                <Layers className="w-5 h-5 text-indigo-500" />
              </div>
              {data.products.categoryBreakdown.length > 0 ? (
                <div className="space-y-3">
                  {data.products.categoryBreakdown.map((cat, i) => {
                    const maxCount = data.products.categoryBreakdown[0]?.count || 1;
                    const pct = Math.round((cat.count / maxCount) * 100);
                    return (
                      <div key={cat.name}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-700 font-medium">{cat.name}</span>
                          <span className="text-gray-500">{cat.count} products &middot; {cat.totalStock} units</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: pct + "%", backgroundColor: COLORS[i % COLORS.length] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400"><p className="text-sm">No categories set up</p></div>
              )}
            </div>
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Most Wishlisted (Demand Signal)</h3>
                <Heart className="w-5 h-5 text-pink-500" />
              </div>
              {data.products.mostWishlisted.length > 0 ? (
                <div className="space-y-3">
                  {data.products.mostWishlisted.map((p) => (
                    <div key={p.slug} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.stock} in stock</p>
                      </div>
                      <div className="flex items-center gap-1 text-pink-600 font-semibold text-sm ml-3">
                        <Heart className="w-4 h-4" /> {p.wishlistCount}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Heart className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No wishlisted products yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Dropship Margins */}
          {data.products.dropshipMargins.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Dropship Profit Margins</h3>
                <Percent className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-3 font-medium">Product</th>
                      <th className="pb-3 font-medium text-right">Price (UGX)</th>
                      <th className="pb-3 font-medium text-right">Cost (USD)</th>
                      <th className="pb-3 font-medium text-right">Margin</th>
                      <th className="pb-3 font-medium text-right">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.products.dropshipMargins.map((p) => (
                      <tr key={p.slug} className="border-b last:border-0">
                        <td className="py-3 text-gray-900 font-medium max-w-[300px] truncate">{p.name}</td>
                        <td className="py-3 text-right text-gray-700">{formatCurrency(p.price)}</td>
                        <td className="py-3 text-right text-gray-700">{"$" + p.costUSD.toFixed(2)}</td>
                        <td className="py-3 text-right">
                          <span className={"inline-flex px-2 py-0.5 rounded-full text-xs font-semibold " + (p.margin >= 60 ? "bg-emerald-100 text-emerald-700" : p.margin >= 40 ? "bg-blue-100 text-blue-700" : p.margin >= 20 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>
                            {p.margin}%
                          </span>
                        </td>
                        <td className="py-3 text-right"><span className="text-xs bg-gray-100 px-2 py-1 rounded">{p.source}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                {"Avg margin: "}<strong>{(data.products.dropshipMargins.reduce((s, p) => s + p.margin, 0) / data.products.dropshipMargins.length).toFixed(0)}%</strong>{". Products below 40% margin may not be profitable after shipping & fees."}
              </div>
            </div>
          )}

          {/* Never Ordered */}
          {data.products.neverOrdered.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Products Never Ordered</h3>
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <p className="text-sm text-gray-500 mb-4">These products have been listed but never sold. Consider discounting, improving listings, or removing them.</p>
              <div className="space-y-2">
                {data.products.neverOrdered.map((p) => (
                  <div key={p.slug} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                      <p className="text-xs text-gray-500">{"Listed " + p.daysListed + " days ago · " + p.stock + " in stock"}</p>
                    </div>
                    <p className="text-sm font-medium text-gray-700 ml-3">{formatCurrency(p.price)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Selling */}
          {data.products.topSelling.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-gray-900">Top Selling Products</h3>
                <Award className="w-5 h-5 text-amber-500" />
              </div>
              <div className="space-y-4">
                {data.products.topSelling.map((product, index) => {
                  const maxSold = data.products.topSelling[0]?.sold || 1;
                  const percentage = (product.sold / maxSold) * 100;
                  return (
                    <div key={product.name} className="flex items-center gap-4">
                      <span className={"w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 " + (index === 0 ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-white" : index === 1 ? "bg-gradient-to-br from-gray-300 to-gray-400 text-white" : index === 2 ? "bg-gradient-to-br from-amber-600 to-orange-700 text-white" : "bg-gray-100 text-gray-600")}>{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-900 truncate">{product.name}</span>
                          <div className="text-right flex-shrink-0 ml-4">
                            <span className="font-semibold text-gray-900">{product.sold} sold</span>
                            <span className="text-gray-500 ml-2 text-sm">{formatCurrency(product.revenue)}</span>
                          </div>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" style={{ width: percentage + "%" }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
}
