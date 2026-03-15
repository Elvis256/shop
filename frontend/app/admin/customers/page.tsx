"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { Search, Users, UserCheck, UserX, Package, ChevronLeft, ChevronRight, ArrowUpDown, Download, RefreshCw } from "lucide-react";

interface Customer {
  id: string | null;
  email: string;
  name: string | null;
  phone: string | null;
  isRegistered: boolean;
  isBlocked: boolean;
  orderCount: number;
  activeOrders: number;
  totalSpent: number;
  lastOrderDate: string | null;
  firstOrderDate: string | null;
}

interface Stats {
  total: number;
  registered: number;
  guest: number;
  withOrders: number;
}

type SortField = "lastOrder" | "name" | "orders" | "spent";
type FilterType = "all" | "registered" | "guest";

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, registered: 0, guest: 0, withOrders: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortField>("lastOrder");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const loadCustomers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await api.admin.getCustomers({
        search,
        sort,
        order: sortOrder,
        page: String(page),
        limit: "20",
        filter: filter === "all" ? undefined : filter,
      } as any);
      setCustomers(data.customers as any);
      setPagination(data.pagination);
      if (data.stats) setStats(data.stats as any);
    } catch (e) {
      console.error("Failed to load customers:", e);
    } finally {
      setLoading(false);
    }
  }, [search, sort, sortOrder, filter]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => loadCustomers(1), 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [search, sort, sortOrder, filter, loadCustomers]);

  const toggleSort = (field: SortField) => {
    if (sort === field) setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    else { setSort(field); setSortOrder("desc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <ArrowUpDown className={`w-3 h-3 inline ml-1 ${sort === field ? "text-gray-900" : "text-gray-400"}`} />
  );

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const exportCSV = () => {
    const headers = ["Name", "Email", "Phone", "Type", "Orders", "Total Spent", "Last Order"];
    const rows = customers.map((c) => [
      c.name || "", c.email, c.phone || "",
      c.isRegistered ? "Registered" : "Guest",
      c.orderCount, c.totalSpent, c.lastOrderDate || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "customers.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {stats.total} total · {stats.registered} registered · {stats.guest} guest
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => loadCustomers(pagination.page)} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Customers", value: stats.total, icon: Users },
          { label: "Registered", value: stats.registered, icon: UserCheck },
          { label: "Guest", value: stats.guest, icon: UserX },
          { label: "With Orders", value: stats.withOrders, icon: Package },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
              <s.icon className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm">
          {(["all", "registered", "guest"] as FilterType[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2 capitalize transition-colors ${filter === f ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer select-none" onClick={() => toggleSort("name")}>
                  Customer <SortIcon field="name" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer select-none" onClick={() => toggleSort("orders")}>
                  Orders <SortIcon field="orders" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer select-none" onClick={() => toggleSort("spent")}>
                  Total Spent <SortIcon field="spent" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer select-none" onClick={() => toggleSort("lastOrder")}>
                  Last Order <SortIcon field="lastOrder" />
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-4 py-4">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
                    </td>
                  </tr>
                ))
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No customers found</p>
                    <p className="text-xs text-gray-400 mt-1">Customers appear here once they place an order</p>
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.email} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-medium shrink-0">
                          {(c.name?.[0] || c.email[0]).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{c.name || "—"}</p>
                          <p className="text-xs text-gray-500 truncate">{c.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.phone || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded font-medium ${
                        c.isRegistered ? "bg-gray-100 text-gray-700" : "bg-gray-50 text-gray-500 border border-gray-200"
                      }`}>
                        {c.isRegistered ? "Registered" : "Guest"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-gray-900">{c.orderCount}</span>
                      {c.activeOrders > 0 && c.activeOrders < c.orderCount && (
                        <span className="text-xs text-gray-400 ml-1">({c.activeOrders} active)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      USh {c.totalSpent.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(c.lastOrderDate)}</td>
                    <td className="px-4 py-3 text-right">
                      {c.id ? (
                        <a href={`/admin/customers/${c.id}`}
                          className="text-xs text-gray-500 hover:text-gray-900 underline-offset-2 hover:underline">
                          View
                        </a>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => loadCustomers(pagination.page - 1)} disabled={pagination.page <= 1}
                className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                const p = pagination.totalPages <= 5 ? i + 1 :
                  Math.max(1, Math.min(pagination.page - 2, pagination.totalPages - 4)) + i;
                return (
                  <button key={p} onClick={() => loadCustomers(p)}
                    className={`w-8 h-8 text-xs rounded border transition-colors ${
                      pagination.page === p ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 hover:bg-gray-50 text-gray-600"
                    }`}>{p}</button>
                );
              })}
              <button onClick={() => loadCustomers(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages}
                className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

