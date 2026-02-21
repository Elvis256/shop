"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Activity,
  Search,
  Filter,
  Calendar,
  User,
  Package,
  ShoppingCart,
  Tag,
  Settings,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Edit2,
  Trash2,
  LogIn,
  LogOut,
  Eye,
  Download,
  RotateCcw,
  DollarSign,
} from "lucide-react";

interface ActivityLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  description: string;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  };
}

interface ActivityStats {
  summary: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  byAction: Array<{ action: string; count: number }>;
  byEntityType: Array<{ entityType: string; count: number }>;
  topUsers: Array<{
    userId: string;
    user: { id: string; name: string | null; email: string } | null;
    count: number;
  }>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const actionIcons: Record<string, typeof Plus> = {
  CREATE: Plus,
  UPDATE: Edit2,
  DELETE: Trash2,
  LOGIN: LogIn,
  LOGOUT: LogOut,
  VIEW: Eye,
  EXPORT: Download,
  BULK_UPDATE: RotateCcw,
  STATUS_CHANGE: RefreshCw,
  REFUND: DollarSign,
};

const actionColors: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
  LOGIN: "bg-indigo-100 text-indigo-700",
  LOGOUT: "bg-gray-100 text-gray-700",
  VIEW: "bg-purple-100 text-purple-700",
  EXPORT: "bg-cyan-100 text-cyan-700",
  BULK_UPDATE: "bg-amber-100 text-amber-700",
  STATUS_CHANGE: "bg-yellow-100 text-yellow-700",
  REFUND: "bg-orange-100 text-orange-700",
};

const entityIcons: Record<string, typeof Package> = {
  Product: Package,
  Order: ShoppingCart,
  User: User,
  Coupon: Tag,
  Category: Filter,
  Setting: Settings,
};

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    action: "",
    entityType: "",
    userId: "",
    startDate: "",
    endDate: "",
  });
  const [showFilters, setShowFilters] = useState(false);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: "30" });
      if (filters.action) params.set("action", filters.action);
      if (filters.entityType) params.set("entityType", filters.entityType);
      if (filters.userId) params.set("userId", filters.userId);
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);

      const res = await fetch(`${API_URL}/api/admin/activity?${params}`, {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error("Failed to load activity logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/activity/stats`, {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [page, filters]);

  useEffect(() => {
    loadStats();
  }, []);

  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const clearFilters = () => {
    setFilters({
      action: "",
      entityType: "",
      userId: "",
      startDate: "",
      endDate: "",
    });
    setPage(1);
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Activity Log</h1>
          <p className="text-gray-500 mt-1">Track all admin actions and changes</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showFilters || hasActiveFilters
                ? "bg-primary text-white"
                : "text-gray-600 bg-white border border-gray-200 hover:bg-gray-50"
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="w-2 h-2 bg-white rounded-full" />
            )}
          </button>
          <button
            onClick={() => {
              loadLogs();
              loadStats();
            }}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.summary.today}</p>
                <p className="text-sm text-gray-500">Actions Today</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.summary.thisWeek}</p>
                <p className="text-sm text-gray-500">This Week</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Activity className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.summary.thisMonth}</p>
                <p className="text-sm text-gray-500">This Month</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
              <select
                value={filters.action}
                onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All Actions</option>
                <option value="CREATE">Create</option>
                <option value="UPDATE">Update</option>
                <option value="DELETE">Delete</option>
                <option value="LOGIN">Login</option>
                <option value="LOGOUT">Logout</option>
                <option value="STATUS_CHANGE">Status Change</option>
                <option value="REFUND">Refund</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entity Type</label>
              <select
                value={filters.entityType}
                onChange={(e) => setFilters((f) => ({ ...f, entityType: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All Types</option>
                <option value="Product">Product</option>
                <option value="Order">Order</option>
                <option value="User">User</option>
                <option value="Coupon">Coupon</option>
                <option value="Category">Category</option>
                <option value="Setting">Setting</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="w-full px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity List */}
      <div className="bg-white rounded-xl border shadow-sm">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-500">Loading activity...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-medium text-gray-900 mb-2">No activity found</h3>
            <p className="text-gray-500 text-sm">
              {hasActiveFilters ? "Try adjusting your filters" : "Activity will appear here as actions are performed"}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {logs.map((log) => {
              const ActionIcon = actionIcons[log.action] || Activity;
              const EntityIcon = entityIcons[log.entityType] || Package;
              const actionColor = actionColors[log.action] || "bg-gray-100 text-gray-700";

              return (
                <div key={log.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${actionColor}`}>
                      <ActionIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">{log.description}</span>
                        {log.entityId && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                            <EntityIcon className="w-3 h-3" />
                            {log.entityType}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {log.user.name || log.user.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatDate(log.createdAt)}
                        </span>
                        {log.ipAddress && (
                          <span className="hidden sm:inline text-xs text-gray-400">
                            IP: {log.ipAddress}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-400">
                      {new Date(log.createdAt).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
