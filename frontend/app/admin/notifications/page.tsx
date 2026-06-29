"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import {
  Bell,
  Mail,
  MessageSquare,
  Phone,
  Smartphone,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

interface NotificationLog {
  id: string;
  event: string;
  channel: string;
  recipient: string;
  status: string;
  error?: string;
  orderId?: string;
  subject?: string;
  createdAt: string;
}

interface Stats {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  successRate: number;
  byChannel: Record<string, number>;
}

const channelIcons: Record<string, typeof Mail> = {
  EMAIL: Mail,
  SMS: Phone,
  WHATSAPP: MessageSquare,
  PUSH: Smartphone,
};

const channelColors: Record<string, string> = {
  EMAIL: "bg-blue-100 text-blue-700",
  SMS: "bg-green-100 text-green-700",
  WHATSAPP: "bg-emerald-100 text-emerald-700",
  PUSH: "bg-purple-100 text-purple-700",
};

const statusColors: Record<string, string> = {
  SUCCESS: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  SKIPPED: "bg-gray-100 text-gray-500",
};

const eventLabels: Record<string, string> = {
  ORDER_RECEIVED: "Order Received",
  ORDER_PROCESSING: "Processing",
  ORDER_SHIPPED: "Shipped",
  ORDER_DELIVERED: "Delivered",
  ORDER_CANCELLED: "Cancelled",
};

export default function NotificationLogPage() {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [filterEvent, setFilterEvent] = useState("");
  const [filterChannel, setFilterChannel] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (filterEvent) params.set("event", filterEvent);
      if (filterChannel) params.set("channel", filterChannel);
      if (filterStatus) params.set("status", filterStatus);
      if (search) params.set("search", search);

      const data = await apiFetch(`/api/admin/notifications?${params}`);
      setLogs(data.logs);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch (e) {
      console.error("Failed to fetch notification logs:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await apiFetch("/api/admin/notifications/stats");
      setStats(data);
    } catch (e) {
      console.error("Failed to fetch stats:", e);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [page, filterEvent, filterChannel, filterStatus]);

  const handleSearch = () => {
    setPage(1);
    fetchLogs();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Notification Log</h1>
        <button
          onClick={() => { fetchLogs(); fetchStats(); }}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-white border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-1">
              <Bell className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">Total Sent</span>
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-sm text-gray-500">Success Rate</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.successRate}%</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-gray-500">Failed</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-1">
              <MinusCircle className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">Skipped</span>
            </div>
            <p className="text-2xl font-bold text-gray-500">{stats.skipped}</p>
          </div>
        </div>
      )}

      {/* Channel Breakdown */}
      {stats && Object.keys(stats.byChannel).length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-3">By Channel</h3>
          <div className="flex gap-4 flex-wrap">
            {Object.entries(stats.byChannel).map(([channel, count]) => {
              const Icon = channelIcons[channel] || Bell;
              return (
                <div key={channel} className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${channelColors[channel] || "bg-gray-100 text-gray-600"}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{channel}</p>
                    <p className="text-xs text-gray-500">{count} sent</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-600">Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <select
            value={filterEvent}
            onChange={(e) => { setFilterEvent(e.target.value); setPage(1); }}
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All Events</option>
            <option value="ORDER_RECEIVED">Order Received</option>
            <option value="ORDER_PROCESSING">Processing</option>
            <option value="ORDER_SHIPPED">Shipped</option>
            <option value="ORDER_DELIVERED">Delivered</option>
            <option value="ORDER_CANCELLED">Cancelled</option>
          </select>
          <select
            value={filterChannel}
            onChange={(e) => { setFilterChannel(e.target.value); setPage(1); }}
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All Channels</option>
            <option value="EMAIL">Email</option>
            <option value="SMS">SMS</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="PUSH">Push</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All Statuses</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILED">Failed</option>
            <option value="SKIPPED">Skipped</option>
          </select>
          <div className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search recipient, order..."
              className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button onClick={handleSearch} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200">
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading notifications...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No notification logs found</p>
            <p className="text-sm text-gray-400 mt-1">Notifications will appear here once they are dispatched</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Timestamp</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Event</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Channel</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Recipient</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((log) => {
                    const Icon = channelIcons[log.channel] || Bell;
                    return (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium">{eventLabels[log.event] || log.event}</span>
                          {log.orderId && (
                            <span className="text-xs text-gray-400 ml-1">({log.orderId.slice(-6)})</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${channelColors[log.channel] || "bg-gray-100"}`}>
                            <Icon className="w-3 h-3" />
                            {log.channel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate" title={log.recipient}>
                          {log.recipient}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusColors[log.status] || "bg-gray-100"}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-red-500 text-xs max-w-[200px] truncate" title={log.error || ""}>
                          {log.error || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
