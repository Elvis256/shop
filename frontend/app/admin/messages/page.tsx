"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
  MessageSquare,
  Send,
  Loader2,
  Search,
  Plus,
  X,
  Store,
  Paperclip,
  Image as ImageIcon,
  Flag,
  Star,
  Clock,
  CheckCheck,
  ChevronDown,
  Zap,
  Copy,
  Check,
} from "lucide-react";

interface Conversation {
  id: string;
  sellerId: string;
  lastMessageAt: string;
  seller?: { id: string; storeName: string; email: string; logo?: string; status?: string };
  lastMessage?: { message: string; senderType: string; createdAt: string };
  unreadCount: number;
  priority?: string;
  starred?: boolean;
}

interface Message {
  id: string;
  senderId: string;
  senderType: "ADMIN" | "SELLER" | "BUYER";
  message: string;
  createdAt: string;
  isRead: boolean;
  attachments?: string[];
}

const CANNED_RESPONSES = [
  { label: "Welcome", text: "Welcome to our marketplace! We're glad to have you as a seller. Let us know if you need any help getting started." },
  { label: "KYC Reminder", text: "Please upload your National ID document in Settings > Verification Documents to complete your account verification." },
  { label: "Product Guidelines", text: "Please ensure your product listings include clear images, accurate descriptions, and correct pricing. Products that don't meet our guidelines may be rejected." },
  { label: "Payout Info", text: "Your payout has been processed. Please allow 1-3 business days for the funds to appear in your account." },
  { label: "Policy Violation", text: "We noticed a potential policy violation in your account. Please review our seller guidelines and ensure compliance to avoid any account restrictions." },
  { label: "Account Suspended", text: "Your seller account has been temporarily suspended. Please contact us for more information about the reason and steps to reactivate." },
];

export default function AdminMessagesPage() {
  const searchParams = useSearchParams();
  const initSeller = searchParams.get("seller");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showNewConv, setShowNewConv] = useState(false);
  const [sellerSearch, setSellerSearch] = useState("");
  const [sellers, setSellers] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  // Search within conversations
  const [convSearch, setConvSearch] = useState("");
  const [msgSearch, setMsgSearch] = useState("");
  const [showMsgSearch, setShowMsgSearch] = useState(false);

  // Canned responses
  const [showCanned, setShowCanned] = useState(false);

  // Filter
  const [convFilter, setConvFilter] = useState<"all" | "unread" | "starred">("all");

  // File upload
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Copied indicator
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const data = await apiFetch("/api/admin/messages/conversations");
      setConversations(data.conversations || []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMessages = useCallback(async (convId: string) => {
    try {
      const data = await apiFetch(`/api/admin/messages/conversations/${convId}/messages`);
      setMessages(data.messages || []);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch {
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (initSeller && conversations.length > 0) {
      const existing = conversations.find((c) => c.sellerId === initSeller);
      if (existing) {
        setActiveConvId(existing.id);
      } else {
        startConversation(initSeller);
      }
    }
  }, [initSeller, conversations.length]);

  useEffect(() => {
    if (!activeConvId) return;
    fetchMessages(activeConvId);

    const handleVisibility = () => {
      if (document.hidden) {
        if (pollRef.current) clearInterval(pollRef.current);
      } else {
        pollRef.current = setInterval(() => {
          fetchMessages(activeConvId);
          fetchConversations();
        }, 15000);
      }
    };

    pollRef.current = setInterval(() => {
      fetchMessages(activeConvId);
      fetchConversations();
    }, 15000);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [activeConvId, fetchMessages, fetchConversations]);

  const startConversation = async (sellerId: string, message?: string) => {
    try {
      const data = await apiFetch("/api/admin/messages/conversations", {
        method: "POST",
        body: JSON.stringify({ sellerId, message }),
      });
      setShowNewConv(false);
      await fetchConversations();
      setActiveConvId(data.conversation.id);
    } catch {
    }
  };

  const sendMessage = async () => {
    if (!activeConvId || !newMessage.trim() || sending) return;
    setSending(true);
    try {
      await apiFetch(`/api/admin/messages/conversations/${activeConvId}/messages`, {
        method: "POST",
        body: JSON.stringify({ message: newMessage.trim() }),
      });
      setNewMessage("");
      fetchMessages(activeConvId);
      fetchConversations();
    } catch {
    } finally {
      setSending(false);
    }
  };

  const searchSellers = async (query: string) => {
    if (!query.trim()) { setSellers([]); return; }
    setSearchLoading(true);
    try {
      const data = await apiFetch(`/api/admin/sellers?search=${encodeURIComponent(query)}&limit=10`);
      setSellers(data.sellers || []);
    } catch {
    } finally {
      setSearchLoading(false);
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !activeConvId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("images", files[0]);
      const data = await apiFetch("/api/seller/upload-images", { method: "POST", body: formData });
      if (data.urls?.[0]) {
        const fileUrl = data.urls[0];
        const fileName = files[0].name;
        await apiFetch(`/api/admin/messages/conversations/${activeConvId}/messages`, {
          method: "POST",
          body: JSON.stringify({ message: `[Attachment: ${fileName}](${fileUrl})` }),
        });
        fetchMessages(activeConvId);
        fetchConversations();
      }
    } catch {
    } finally {
      setUploading(false);
    }
  };

  const copyMessage = (msg: Message) => {
    navigator.clipboard.writeText(msg.message);
    setCopiedId(msg.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const insertCannedResponse = (text: string) => {
    setNewMessage(text);
    setShowCanned(false);
  };

  const activeConv = conversations.find((c) => c.id === activeConvId);

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  const filteredConversations = conversations.filter((c) => {
    if (convSearch) {
      const name = c.seller?.storeName || "";
      if (!name.toLowerCase().includes(convSearch.toLowerCase())) return false;
    }
    if (convFilter === "unread" && c.unreadCount === 0) return false;
    if (convFilter === "starred" && !c.starred) return false;
    return true;
  });

  const filteredMessages = msgSearch
    ? messages.filter((m) => m.message.toLowerCase().includes(msgSearch.toLowerCase()))
    : messages;

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div className="flex h-[calc(100vh-120px)] bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Conversation List */}
      <div className="w-80 border-r flex flex-col bg-white">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-900">Messages</h2>
              {totalUnread > 0 && (
                <span className="bg-primary text-white text-xs rounded-full px-2 py-0.5 font-medium">{totalUnread}</span>
              )}
            </div>
            <button
              onClick={() => setShowNewConv(true)}
              className="p-2 text-primary hover:bg-primary/5 rounded-lg transition-colors"
              title="New Conversation"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={convSearch}
              onChange={(e) => setConvSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex gap-1 mt-2">
            {(["all", "unread", "starred"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setConvFilter(f)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  convFilter === f ? "bg-primary/10 text-primary" : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {f === "all" ? "All" : f === "unread" ? `Unread (${totalUnread})` : "Starred"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm px-4">
              {convSearch ? "No conversations match your search" : convFilter === "unread" ? "No unread messages" : "No conversations yet"}
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                className={`w-full text-left px-4 py-3 border-b hover:bg-gray-50 transition-colors ${
                  activeConvId === conv.id ? "bg-primary/5 border-l-2 border-l-primary" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                      {conv.seller?.logo ? (
                        <img src={conv.seller.logo.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || ""}${conv.seller.logo}` : conv.seller.logo} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <Store className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    {conv.seller?.status === "APPROVED" && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm truncate ${conv.unreadCount > 0 ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>
                        {conv.seller?.storeName || "Unknown"}
                      </p>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        {conv.unreadCount > 0 && (
                          <span className="bg-primary text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-medium">
                            {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                    {conv.lastMessage && (
                      <div className="flex items-center justify-between mt-0.5">
                        <p className={`text-xs truncate ${conv.unreadCount > 0 ? "text-gray-700 font-medium" : "text-gray-500"}`}>
                          {conv.lastMessage.senderType === "ADMIN" && (
                            <CheckCheck className="w-3 h-3 inline mr-1 text-blue-500" />
                          )}
                          {conv.lastMessage.message.length > 40 ? conv.lastMessage.message.slice(0, 40) + "..." : conv.lastMessage.message}
                        </p>
                        <span className="text-[10px] text-gray-400 flex-shrink-0 ml-1">
                          {formatTime(conv.lastMessage.createdAt)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Message Thread */}
      <div className="flex-1 flex flex-col">
        {activeConv ? (
          <>
            {/* Header */}
            <div className="px-6 py-3 border-b flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                  {activeConv.seller?.logo ? (
                    <img src={activeConv.seller.logo.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || ""}${activeConv.seller.logo}` : activeConv.seller.logo} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <Store className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{activeConv.seller?.storeName}</p>
                  <p className="text-xs text-gray-500">{activeConv.seller?.email}</p>
                </div>
                {activeConv.seller?.status && (
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    activeConv.seller.status === "APPROVED" ? "bg-green-100 text-green-700" :
                    activeConv.seller.status === "PENDING" ? "bg-yellow-100 text-yellow-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {activeConv.seller.status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowMsgSearch(!showMsgSearch)}
                  className={`p-2 rounded-lg transition-colors ${showMsgSearch ? "bg-primary/10 text-primary" : "text-gray-400 hover:bg-gray-100"}`}
                  title="Search messages"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Message Search Bar */}
            {showMsgSearch && (
              <div className="px-4 py-2 border-b bg-gray-50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={msgSearch}
                    onChange={(e) => setMsgSearch(e.target.value)}
                    placeholder="Search in this conversation..."
                    className="w-full pl-9 pr-8 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    autoFocus
                  />
                  {msgSearch && (
                    <button onClick={() => setMsgSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {msgSearch && (
                  <p className="text-xs text-gray-500 mt-1">{filteredMessages.length} message{filteredMessages.length !== 1 ? "s" : ""} found</p>
                )}
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
              {filteredMessages.length === 0 && msgSearch ? (
                <div className="text-center py-8 text-gray-400 text-sm">No messages match your search</div>
              ) : (
                filteredMessages.map((msg, idx) => {
                  const isAdmin = msg.senderType === "ADMIN";
                  const showDate = idx === 0 || new Date(msg.createdAt).toDateString() !== new Date(filteredMessages[idx - 1].createdAt).toDateString();
                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div className="flex items-center justify-center my-4">
                          <div className="bg-white border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-500">
                            {new Date(msg.createdAt).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
                          </div>
                        </div>
                      )}
                      <div className={`flex ${isAdmin ? "justify-end" : "justify-start"} group`}>
                        <div className={`relative max-w-[70%] rounded-2xl px-4 py-2.5 ${
                          isAdmin
                            ? "bg-primary text-white rounded-br-md"
                            : "bg-white border border-gray-200 text-gray-900 rounded-bl-md shadow-sm"
                        }`}>
                          {/* Attachment rendering */}
                          {msg.message.startsWith("[Attachment:") && msg.message.includes("](") ? (
                            <div>
                              <p className="text-sm mb-1">Shared a file:</p>
                              <a
                                href={msg.message.match(/\]\((.*?)\)/)?.[1] || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`inline-flex items-center gap-1 text-sm underline ${isAdmin ? "text-white/90" : "text-primary"}`}
                              >
                                <Paperclip className="w-3 h-3" />
                                {msg.message.match(/\[Attachment: (.*?)\]/)?.[1] || "File"}
                              </a>
                            </div>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                          )}
                          <div className={`flex items-center gap-1 mt-1 ${isAdmin ? "justify-end" : ""}`}>
                            <p className={`text-[10px] ${isAdmin ? "text-white/60" : "text-gray-400"}`}>
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                            {isAdmin && <CheckCheck className="w-3 h-3 text-white/60" />}
                          </div>
                          {/* Copy button */}
                          <button
                            onClick={(e) => { e.stopPropagation(); copyMessage(msg); }}
                            className={`absolute -top-2 ${isAdmin ? "-left-8" : "-right-8"} opacity-0 group-hover:opacity-100 p-1 rounded-full bg-white border shadow-sm transition-opacity`}
                            title="Copy"
                          >
                            {copiedId === msg.id ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-gray-500" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="px-4 py-3 border-t bg-white">
              {/* Canned Responses */}
              {showCanned && (
                <div className="mb-3 bg-gray-50 rounded-lg border border-gray-200 p-3 max-h-48 overflow-y-auto">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-gray-500 uppercase">Quick Responses</p>
                    <button onClick={() => setShowCanned(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    {CANNED_RESPONSES.map((cr, i) => (
                      <button
                        key={i}
                        onClick={() => insertCannedResponse(cr.text)}
                        className="w-full text-left p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all text-sm"
                      >
                        <p className="font-medium text-gray-900 text-xs">{cr.label}</p>
                        <p className="text-gray-500 text-xs mt-0.5 truncate">{cr.text}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form
                onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                className="flex items-end gap-2"
              >
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowCanned(!showCanned)}
                    className={`p-2 rounded-lg transition-colors ${showCanned ? "text-primary bg-primary/10" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"}`}
                    title="Quick responses"
                  >
                    <Zap className="w-5 h-5" />
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => handleFileUpload(e.target.files)}
                    className="hidden"
                    accept="image/*"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-lg transition-colors disabled:opacity-50"
                    title="Attach file"
                  >
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                  </button>
                </div>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                  className="flex-1 px-4 py-2.5 border rounded-xl bg-white text-sm resize-none max-h-32 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  rows={1}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="p-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors flex-shrink-0"
                >
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-200" />
              <p className="font-medium text-gray-600 text-lg">Select a conversation</p>
              <p className="text-sm mt-1">or start a new one with a seller</p>
              <button
                onClick={() => setShowNewConv(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90"
              >
                <Plus className="w-4 h-4" /> New Conversation
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Conversation Modal */}
      {showNewConv && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowNewConv(false)}>
          <div className="bg-white rounded-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">New Conversation</h3>
              <button onClick={() => setShowNewConv(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={sellerSearch}
                  onChange={(e) => { setSellerSearch(e.target.value); searchSellers(e.target.value); }}
                  placeholder="Search sellers by name or email..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  autoFocus
                />
              </div>
              <div className="mt-3 max-h-60 overflow-y-auto space-y-1">
                {searchLoading ? (
                  <div className="text-center py-4"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" /></div>
                ) : (
                  sellers.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => startConversation(s.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                        {s.storeLogo || s.logo ? (
                          <img src={(s.storeLogo || s.logo).startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || ""}${s.storeLogo || s.logo}` : (s.storeLogo || s.logo)} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <Store className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{s.storeName}</p>
                        <p className="text-xs text-gray-500">{s.email}</p>
                      </div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        s.status === "APPROVED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {s.status}
                      </span>
                    </button>
                  ))
                )}
                {!searchLoading && sellerSearch && sellers.length === 0 && (
                  <p className="text-center py-4 text-sm text-gray-500">No sellers found</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
