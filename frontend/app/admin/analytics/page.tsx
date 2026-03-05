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
  };
  orders: {
    total: number;
    growth: number;
    daily: Array<{ date: string; count: number }>;
    byStatus: Record<string, number>;
    avgPerDay: number;
  };
  customers: {
    total: number;
    newThisMonth: number;
    returning: number;
    conversionRate: number;
  };
  products: {
    topSelling: Array<{ name: string; sold: number; revenue: number }>;
    lowStock: number;
    totalActive: number;
  };
  traffic: {
    daily: Array<{ date: string; visitors: number; orders: number; revenue: number }>;
    totalVisitors: number;
    bounceRate: number;
  };
  paymentMethods: Array<{ name: string; count: number; amount: number }>;
  hourlyOrders: Array<{ hour: string; count: number }>;
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
      // Show error state instead of mock data
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
    
    // Prepare CSV data
    const csvRows: string[] = [];
    
    // Summary section
    csvRows.push("ANALYTICS REPORT");
    csvRows.push(`Period: Last ${period} days`);
    csvRows.push(`Generated: ${new Date().toISOString()}`);
    csvRows.push("");
    
    // KPIs
    csvRows.push("KEY METRICS");
    csvRows.push(`Total Revenue,${data.revenue.total}`);
    csvRows.push(`Revenue Growth,${(data.revenue.growth || 0).toFixed(1)}%`);
    csvRows.push(`Total Orders,${data.orders.total}`);
    csvRows.push(`Orders Growth,${(data.orders.growth || 0).toFixed(1)}%`);
    csvRows.push(`Total Customers,${data.customers.total}`);
    csvRows.push(`New Customers,${data.customers.newThisMonth}`);
    csvRows.push(`Returning Customers,${data.customers.returning}`);
    csvRows.push(`Conversion Rate,${(data.customers.conversionRate || 0).toFixed(2)}%`);
    csvRows.push(`Avg Order Value,${data.revenue.avgOrderValue}`);
    csvRows.push("");
    
    // Daily data
    csvRows.push("DAILY BREAKDOWN");
    csvRows.push("Date,Revenue,Orders,Visitors");
    data.traffic.daily.forEach((d) => {
      csvRows.push(`${d.date},${d.revenue},${d.orders},${d.visitors}`);
    });
    csvRows.push("");
    
    // Orders by status
    csvRows.push("ORDERS BY STATUS");
    csvRows.push("Status,Count");
    Object.entries(data.orders.byStatus).forEach(([status, count]) => {
      csvRows.push(`${status},${count}`);
    });
    csvRows.push("");
    
    // Top products
    csvRows.push("TOP SELLING PRODUCTS");
    csvRows.push("Product,Sold,Revenue");
    data.products.topSelling.forEach((p) => {
      csvRows.push(`"${p.name}",${p.sold},${p.revenue}`);
    });
    csvRows.push("");
    
    // Payment methods
    csvRows.push("PAYMENT METHODS");
    csvRows.push("Method,Count,Amount");
    data.paymentMethods.forEach((p) => {
      csvRows.push(`${p.name},${p.count},${p.amount}`);
    });
    
    // Create and download file
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `analytics-${period}days-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (amount: number | null | undefined) => `USh ${(amount || 0).toLocaleString()}`;
  const formatCompact = (amount: number | null | undefined) => {
    const n = amount || 0;
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };
  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  const formatPercent = (value: number | null | undefined) => `${(value || 0).toFixed(1)}%`;

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
          <p className="text-gray-500 mb-6">There was an error fetching your analytics data. Please check that the backend server is running.</p>
          <button
            onClick={loadAnalytics}
            className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const statusData = Object.entries(data.orders?.byStatus || {}).map(([name, value]) => ({
    name,
    value: value as number,
    color: STATUS_COLORS[name] || COLORS[0],
  }));

  const totalStatusOrders = statusData.reduce((sum, s) => sum + s.value, 0);

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
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  period === p ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {p}D
              </button>
            ))}
          </div>
          <button
            onClick={loadAnalytics}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button 
            onClick={exportToCSV}
            disabled={!data}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(["overview", "sales", "customers", "products"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-lg capitalize transition-colors ${
              activeTab === tab ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <>
          {/* KPI Cards - Enhanced */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-5 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
          <DollarSign className="w-8 h-8 mb-3 opacity-80" />
          <p className="text-emerald-100 text-sm mb-1">Total Revenue</p>
          <p className="text-2xl lg:text-3xl font-bold">{formatCompact(data.revenue.total)}</p>
          <div className={`flex items-center gap-1 mt-2 text-sm ${data.revenue.growth >= 0 ? "text-emerald-200" : "text-red-200"}`}>
            {data.revenue.growth >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {formatPercent(Math.abs(data.revenue.growth))} vs last period
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-5 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
          <ShoppingCart className="w-8 h-8 mb-3 opacity-80" />
          <p className="text-blue-100 text-sm mb-1">Total Orders</p>
          <p className="text-2xl lg:text-3xl font-bold">{data.orders.total}</p>
          <div className={`flex items-center gap-1 mt-2 text-sm ${data.orders.growth >= 0 ? "text-blue-200" : "text-red-200"}`}>
            {data.orders.growth >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {formatPercent(Math.abs(data.orders.growth))} vs last period
          </div>
        </div>

        <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl p-5 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
          <Users className="w-8 h-8 mb-3 opacity-80" />
          <p className="text-violet-100 text-sm mb-1">Customers</p>
          <p className="text-2xl lg:text-3xl font-bold">{data.customers.total}</p>
          <div className="flex items-center gap-1 mt-2 text-sm text-violet-200">
            <ArrowUpRight className="w-4 h-4" />
            +{data.customers.newThisMonth} new this month
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-5 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
          <Target className="w-8 h-8 mb-3 opacity-80" />
          <p className="text-amber-100 text-sm mb-1">Conversion Rate</p>
          <p className="text-2xl lg:text-3xl font-bold">{formatPercent(data.customers.conversionRate)}</p>
          <div className="flex items-center gap-1 mt-2 text-sm text-amber-200">
            <Eye className="w-4 h-4" />
            {data.traffic.totalVisitors.toLocaleString()} visitors
          </div>
        </div>
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <CreditCard className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg Order Value</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(data.revenue.avgOrderValue)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Orders/Day</p>
              <p className="text-lg font-bold text-gray-900">{data.orders.avgPerDay}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 rounded-lg">
              <Repeat className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Returning Customers</p>
              <p className="text-lg font-bold text-gray-900">{data.customers.returning}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Low Stock Items</p>
              <p className="text-lg font-bold text-gray-900">{data.products.lowStock}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Revenue & Orders Combined Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-gray-900">Revenue & Orders Overview</h3>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-indigo-500" />
                <span className="text-gray-600">Revenue</span>
              </div>
            </div>
          </div>
          <SVGLineChart
            data={data.traffic.daily}
            xKey="date"
            yKey="revenue"
            color="#6366f1"
            height={240}
            formatY={(v) => formatCompact(v)}
            formatX={(v) => formatDate(v)}
          />
        </div>

        {/* Order Status Donut */}
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Orders by Status</h3>
          <SVGDonutChart data={statusData} height={180} />
          <div className="grid grid-cols-2 gap-2 mt-4">
            {statusData.slice(0, 6).map((status) => (
              <div key={status.name} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                <span className="text-xs text-gray-600 truncate">{status.name}</span>
                <span className="text-xs font-medium text-gray-900 ml-auto">{status.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
        </>
      )}

      {/* Sales Tab */}
      {activeTab === "sales" && (
        <>
          {/* Sales KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <span className="text-sm text-gray-500">Total Revenue</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.revenue.total)}</p>
              <div className={`flex items-center gap-1 mt-2 text-sm ${data.revenue.growth >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {data.revenue.growth >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {formatPercent(Math.abs(data.revenue.growth))} vs last period
              </div>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-sm text-gray-500">Avg Order Value</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.revenue.avgOrderValue)}</p>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-violet-100 rounded-lg">
                  <ShoppingCart className="w-5 h-5 text-violet-600" />
                </div>
                <span className="text-sm text-gray-500">Total Orders</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{data.orders.total}</p>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <span className="text-sm text-gray-500">Orders/Day</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{data.orders.avgPerDay}</p>
            </div>
          </div>

          {/* Revenue Chart */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-6">Daily Revenue</h3>
            <SVGLineChart
              data={data.revenue.daily}
              xKey="date"
              yKey="amount"
              color="#22c55e"
              height={240}
              formatY={(v) => formatCompact(v)}
              formatX={(v) => formatDate(v)}
            />
          </div>

          {/* Payment Methods & Orders by Hour */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Payment Methods</h3>
                <CreditCard className="w-5 h-5 text-blue-500" />
              </div>
              <div className="space-y-3">
                {data.paymentMethods.map((pm, i) => {
                  const total = data.paymentMethods.reduce((s, p) => s + p.amount, 0) || 1;
                  const pct = Math.round((pm.amount / total) * 100);
                  const colors = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];
                  return (
                    <div key={pm.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700 font-medium">{pm.name}</span>
                        <span className="text-gray-500">{pct}% · {pm.count} orders</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Orders by Hour</h3>
                <Clock className="w-5 h-5 text-violet-500" />
              </div>
              <SVGBarChart
                data={data.hourlyOrders}
                xKey="hour"
                yKey="count"
                color="#8b5cf6"
                height={200}
              />
            </div>
          </div>
        </>
      )}

      {/* Customers Tab */}
      {activeTab === "customers" && (
        <>
          {/* Customer KPIs */}
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
              <Repeat className="w-8 h-8 mb-3 opacity-80" />
              <p className="text-blue-100 text-sm mb-1">Returning</p>
              <p className="text-3xl font-bold">{data.customers.returning}</p>
            </div>
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-5 text-white">
              <Activity className="w-8 h-8 mb-3 opacity-80" />
              <p className="text-amber-100 text-sm mb-1">Conversion Rate</p>
              <p className="text-3xl font-bold">{formatPercent(data.customers.conversionRate)}</p>
            </div>
          </div>

          {/* Visitors & Conversion Chart */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-gray-900">Visitors & Orders Trend</h3>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-violet-500" />
                  <span className="text-gray-600">Visitors</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-gray-600">Orders</span>
                </div>
              </div>
            </div>
            <SVGLineChart
              data={data.traffic.daily}
              xKey="date"
              yKey="visitors"
              color="#8b5cf6"
              height={240}
              formatX={(v) => formatDate(v)}
            />
          </div>

          {/* Traffic Stats */}
          <div className="grid grid-cols-3 gap-4">
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
          </div>
        </>
      )}

      {/* Products Tab */}
      {activeTab === "products" && (
        <>
          {/* Products KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-sm text-gray-500">Active Products</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{data.products.totalActive}</p>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <span className="text-sm text-gray-500">Low Stock</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{data.products.lowStock}</p>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Award className="w-5 h-5 text-emerald-600" />
                </div>
                <span className="text-sm text-gray-500">Top Seller</span>
              </div>
              <p className="text-lg font-bold text-gray-900 truncate">
                {data.products.topSelling[0]?.name || "N/A"}
              </p>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-violet-100 rounded-lg">
                  <DollarSign className="w-5 h-5 text-violet-600" />
                </div>
                <span className="text-sm text-gray-500">Top Revenue</span>
              </div>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(data.products.topSelling[0]?.revenue || 0)}
              </p>
            </div>
          </div>

          {/* Top Selling Products */}
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
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      index === 0 ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-white" :
                      index === 1 ? "bg-gradient-to-br from-gray-300 to-gray-400 text-white" :
                      index === 2 ? "bg-gradient-to-br from-amber-600 to-orange-700 text-white" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900 truncate">{product.name}</span>
                        <div className="text-right flex-shrink-0 ml-4">
                          <span className="font-semibold text-gray-900">{product.sold} sold</span>
                          <span className="text-gray-500 ml-2 text-sm">{formatCurrency(product.revenue)}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {data.products.topSelling.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No sales data yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Products Revenue Chart */}
          {data.products.topSelling.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Product Revenue Breakdown</h3>
              <SVGBarChart
                data={data.products.topSelling}
                xKey="name"
                yKey="revenue"
                color="#6366f1"
                height={200}
                formatY={(v) => formatCompact(v)}
              />
            </div>
          )}
        </>
      )}

    </div>
  );
}
