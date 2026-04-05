"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  MessageCircle,
  Clock,
  AlertTriangle,
  Send,
  Eye,
  EyeOff,
  Headphones,
  Inbox,
  ArrowUpRight,
  Tag,
  User,
  CheckCircle,
} from "lucide-react";

interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string | null;
  senderType: string;
  senderName: string;
  message: string;
  attachments: string[];
  isInternal: boolean;
  createdAt: string;
}

interface Ticket {
  id: string;
  ticketNumber: string;
  userId: string | null;
  email: string;
  name: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  orderId: string | null;
  messages: TicketMessage[];
  assignedTo: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const PRIORITY_STYLES: Record<string, string> = {
  LOW: "bg-gray-50 text-gray-600 border-gray-200",
  MEDIUM: "bg-blue-50 text-blue-700 border-blue-200",
  HIGH: "bg-orange-50 text-orange-700 border-orange-200",
  URGENT: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-green-50 text-green-700 border-green-200",
  IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-200",
  WAITING_CUSTOMER: "bg-yellow-50 text-yellow-700 border-yellow-200",
  RESOLVED: "bg-gray-100 text-gray-600 border-gray-200",
  CLOSED: "bg-gray-50 text-gray-500 border-gray-200",
};

const CATEGORY_LABELS: Record<string, string> = {
  ORDER_ISSUE: "Order Issue",
  SHIPPING: "Shipping",
  PAYMENT: "Payment",
  PRODUCT_INQUIRY: "Product Inquiry",
  RETURN: "Return",
  ACCOUNT: "Account",
  TECHNICAL: "Technical",
  OTHER: "Other",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  WAITING_CUSTOMER: "Waiting on Customer",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

const STATUSES = ["All", "OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"];
const PRIORITIES = ["All", "LOW", "MEDIUM", "HIGH", "URGENT"];
const CATEGORIES = ["All", "ORDER_ISSUE", "SHIPPING", "PAYMENT", "PRODUCT_INQUIRY", "RETURN", "ACCOUNT", "TECHNICAL", "OTHER"];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function fmtRelative(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full font-medium border ${PRIORITY_STYLES[priority] || PRIORITY_STYLES.LOW}`}>
      {PRIORITY_LABELS[priority] || priority}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full font-medium border ${STATUS_STYLES[status] || STATUS_STYLES.CLOSED}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

const INPUT_CLS =
  "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400";

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 20;
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Conversation view
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Reply
  const [replyText, setReplyText] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);

  // Quick actions
  const [editingStatus, setEditingStatus] = useState(false);
  const [editingPriority, setEditingPriority] = useState(false);
  const [editingAssign, setEditingAssign] = useState(false);
  const [assignInput, setAssignInput] = useState("");

  // Stats
  const [stats, setStats] = useState({ open: 0, unresolved: 0, highPriority: 0, avgResponse: "—" });

  const loadTickets = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (priorityFilter !== "All") params.set("priority", priorityFilter);
      if (categoryFilter !== "All") params.set("category", categoryFilter);
      params.set("page", String(p));
      params.set("limit", String(perPage));
      const data = await apiFetch(`/api/tickets?${params}`);
      const list: Ticket[] = data.tickets || data.data || (Array.isArray(data) ? data : []);
      setTickets(list);
      setTotal(data.pagination?.total || data.total || list.length);
      setTotalPages(data.pagination?.totalPages || Math.ceil((data.total || list.length) / perPage) || 1);
      setPage(p);

      // Compute stats
      let open = 0, unresolved = 0, highP = 0;
      list.forEach((t) => {
        if (t.status === "OPEN") open++;
        if (t.status !== "RESOLVED" && t.status !== "CLOSED") unresolved++;
        if (t.priority === "HIGH" || t.priority === "URGENT") highP++;
      });
      setStats({ open, unresolved, highPriority: highP, avgResponse: "—" });
    } catch (e) {
      console.error("Failed to load tickets:", e);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter, categoryFilter]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => loadTickets(1), 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [search, statusFilter, priorityFilter, categoryFilter, loadTickets]);

  const openTicket = async (ticket: Ticket) => {
    setDetailLoading(true);
    setSelected(ticket);
    setReplyText("");
    setIsInternal(false);
    setEditingStatus(false);
    setEditingPriority(false);
    setEditingAssign(false);
    try {
      const data = await apiFetch(`/api/tickets/${ticket.id}`);
      setSelected(data.ticket || data);
    } catch {
      // Use existing data
    } finally {
      setDetailLoading(false);
    }
  };

  const sendReply = async () => {
    if (!selected || !replyText.trim()) return;
    setSending(true);
    try {
      await apiFetch(`/api/tickets/${selected.id}/messages`, {
        method: "POST",
        body: JSON.stringify({
          message: replyText.trim(),
          senderType: "admin",
          senderName: "Admin",
          isInternal,
        }),
      });
      setReplyText("");
      setIsInternal(false);
      // Refresh ticket
      const data = await apiFetch(`/api/tickets/${selected.id}`);
      setSelected(data.ticket || data);
    } catch (e) {
      console.error("Send failed:", e);
    } finally {
      setSending(false);
    }
  };

  const updateTicket = async (updates: Record<string, unknown>) => {
    if (!selected) return;
    try {
      await apiFetch(`/api/tickets/${selected.id}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      });
      const data = await apiFetch(`/api/tickets/${selected.id}`);
      setSelected(data.ticket || data);
      loadTickets(page);
    } catch (e) {
      console.error("Update failed:", e);
    }
    setEditingStatus(false);
    setEditingPriority(false);
    setEditingAssign(false);
  };

  const hasNewCustomerMessage = (t: Ticket) => {
    if (!t.messages || t.messages.length === 0) return false;
    const last = t.messages[t.messages.length - 1];
    return last.senderType === "customer";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Support Tickets</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total tickets</p>
        </div>
        <button
          onClick={() => loadTickets(page)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Open Tickets", value: stats.open, icon: Inbox },
          { label: "Avg Response", value: stats.avgResponse, icon: Clock },
          { label: "Unresolved", value: stats.unresolved, icon: AlertTriangle },
          { label: "High Priority", value: stats.highPriority, icon: ArrowUpRight },
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

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
            placeholder="Search by ticket #, subject, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-gray-300"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s === "All" ? "All Status" : STATUS_LABELS[s] || s}</option>
          ))}
        </select>
        <select
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-gray-300"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{p === "All" ? "All Priority" : PRIORITY_LABELS[p] || p}</option>
          ))}
        </select>
        <select
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-gray-300"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c === "All" ? "All Categories" : CATEGORY_LABELS[c] || c}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Ticket #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Subject</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Updated</th>
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
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Headphones className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No tickets found</p>
                    <p className="text-xs text-gray-400 mt-1">Support tickets will appear here</p>
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                    onClick={() => openTicket(t)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {hasNewCustomerMessage(t) && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" title="New customer message" />
                        )}
                        <span className="text-sm font-mono font-medium text-gray-900">{t.ticketNumber}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-900 truncate max-w-[240px]">{t.subject}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-900 truncate">{t.name}</p>
                      <p className="text-xs text-gray-500 truncate">{t.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                        {CATEGORY_LABELS[t.category] || t.category}
                      </span>
                    </td>
                    <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 text-sm text-gray-500">{fmtRelative(t.updatedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => loadTickets(page - 1)}
                disabled={page <= 1}
                className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p = totalPages <= 5 ? i + 1 : Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                return (
                  <button
                    key={p}
                    onClick={() => loadTickets(p)}
                    className={`w-8 h-8 text-xs rounded border transition-colors ${
                      page === p ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 hover:bg-gray-50 text-gray-600"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => loadTickets(page + 1)}
                disabled={page >= totalPages}
                className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Conversation Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelected(null)}>
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col m-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-mono text-gray-500">{selected.ticketNumber}</span>
                  <StatusBadge status={selected.status} />
                  <PriorityBadge priority={selected.priority} />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 truncate">{selected.subject}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selected.name} · {selected.email} · {CATEGORY_LABELS[selected.category] || selected.category}
                  {selected.assignedTo && <> · Assigned to: {selected.assignedTo}</>}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-gray-100 rounded-lg ml-2 shrink-0">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex items-center gap-2 px-6 py-2 border-b border-gray-100 bg-gray-50/50 shrink-0 flex-wrap">
              {/* Status */}
              <div className="relative">
                <button
                  onClick={() => { setEditingStatus(!editingStatus); setEditingPriority(false); setEditingAssign(false); }}
                  className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg hover:bg-white text-gray-600"
                >
                  Change Status
                </button>
                {editingStatus && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[160px]">
                    {STATUSES.filter((s) => s !== "All").map((s) => (
                      <button
                        key={s}
                        onClick={() => updateTicket({ status: s })}
                        className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 ${selected.status === s ? "font-medium text-gray-900" : "text-gray-600"}`}
                      >
                        {STATUS_LABELS[s] || s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Priority */}
              <div className="relative">
                <button
                  onClick={() => { setEditingPriority(!editingPriority); setEditingStatus(false); setEditingAssign(false); }}
                  className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg hover:bg-white text-gray-600"
                >
                  Change Priority
                </button>
                {editingPriority && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[130px]">
                    {PRIORITIES.filter((p) => p !== "All").map((p) => (
                      <button
                        key={p}
                        onClick={() => updateTicket({ priority: p })}
                        className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 ${selected.priority === p ? "font-medium text-gray-900" : "text-gray-600"}`}
                      >
                        {PRIORITY_LABELS[p] || p}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Assign */}
              <div className="relative">
                <button
                  onClick={() => { setEditingAssign(!editingAssign); setEditingStatus(false); setEditingPriority(false); setAssignInput(selected.assignedTo || ""); }}
                  className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg hover:bg-white text-gray-600"
                >
                  {selected.assignedTo ? `Assigned: ${selected.assignedTo}` : "Assign"}
                </button>
                {editingAssign && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-2 min-w-[200px]">
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-300"
                        placeholder="Staff name..."
                        value={assignInput}
                        onChange={(e) => setAssignInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && updateTicket({ assignedTo: assignInput || null })}
                      />
                      <button
                        onClick={() => updateTicket({ assignedTo: assignInput || null })}
                        className="px-2 py-1 text-xs bg-gray-900 text-white rounded hover:bg-gray-800"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick resolve */}
              {selected.status !== "RESOLVED" && selected.status !== "CLOSED" && (
                <button
                  onClick={() => updateTicket({ status: "RESOLVED" })}
                  className="text-xs px-2.5 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 ml-auto inline-flex items-center gap-1"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Resolve
                </button>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {detailLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : selected.messages && selected.messages.length > 0 ? (
                selected.messages.map((msg) => {
                  const isAdmin = msg.senderType === "admin";
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-xl px-4 py-3 ${
                          msg.isInternal
                            ? "bg-amber-50 border border-amber-200"
                            : isAdmin
                              ? "bg-gray-900 text-white"
                              : "bg-gray-100 text-gray-900"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-medium ${
                            msg.isInternal ? "text-amber-700" : isAdmin ? "text-gray-300" : "text-gray-500"
                          }`}>
                            {msg.senderName}
                            {msg.isInternal && " · Internal Note"}
                          </span>
                        </div>
                        <p className={`text-sm leading-relaxed ${
                          msg.isInternal ? "text-amber-900" : isAdmin ? "text-white" : "text-gray-900"
                        }`}>
                          {msg.message}
                        </p>
                        <p className={`text-xs mt-1.5 ${
                          msg.isInternal ? "text-amber-500" : isAdmin ? "text-gray-400" : "text-gray-400"
                        }`}>
                          {fmtDate(msg.createdAt)} {fmtTime(msg.createdAt)}
                        </p>
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {msg.attachments.map((a, i) => (
                              <a
                                key={i}
                                href={a}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`text-xs underline ${isAdmin ? "text-gray-300" : "text-blue-600"}`}
                              >
                                Attachment {i + 1}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8">
                  <MessageCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No messages yet</p>
                </div>
              )}
            </div>

            {/* Reply Box */}
            <div className="shrink-0 px-6 py-4 border-t border-gray-100">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <textarea
                    className={INPUT_CLS}
                    rows={3}
                    placeholder={isInternal ? "Write an internal note (not visible to customer)..." : "Type your reply..."}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendReply();
                    }}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <button
                      onClick={() => setIsInternal(!isInternal)}
                      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                        isInternal
                          ? "bg-amber-50 border-amber-200 text-amber-700"
                          : "border-gray-200 text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      {isInternal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {isInternal ? "Internal Note" : "Public Reply"}
                    </button>
                    <button
                      onClick={sendReply}
                      disabled={!replyText.trim() || sending}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
