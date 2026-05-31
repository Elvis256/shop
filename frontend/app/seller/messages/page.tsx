"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { MessageCircle, Send, ArrowLeft, User, Paperclip, Search, X, ChevronDown, Plus, Trash2, Loader2, Image as ImageIcon, FileText } from "lucide-react";

interface Conversation {
  id: string;
  buyerId: string | null;
  adminId: string | null;
  productId: string | null;
  lastMessageAt: string;
  buyer: { id: string; name: string | null; email: string } | null;
  product: { id: string; name: string; slug: string } | null;
  lastMessage: { message: string; createdAt: string; senderType: string } | null;
  unreadCount: number;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderType: "BUYER" | "SELLER" | "ADMIN";
  message: string;
  attachment?: string;
  isRead: boolean;
  createdAt: string;
}

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function getDateLabel(dateStr: string) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
}

export default function SellerMessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeConversation, setActiveConversation] = useState<any>(null);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [newQuickReply, setNewQuickReply] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load quick replies from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("seller_quick_replies");
    if (saved) {
      try { setQuickReplies(JSON.parse(saved)); } catch { /* ignore */ }
    } else {
      setQuickReplies([
        "Thank you for your message! I'll get back to you shortly.",
        "Your order is being prepared and will be shipped soon.",
        "This item is currently in stock and ready to ship.",
      ]);
    }
  }, []);

  const saveQuickReplies = (replies: string[]) => {
    setQuickReplies(replies);
    localStorage.setItem("seller_quick_replies", JSON.stringify(replies));
  };

  const loadConversations = useCallback(async () => {
    try {
      const data = await apiFetch("/api/seller/chat/conversations");
      setConversations(data.conversations);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Visibility-based polling
  useEffect(() => {
    if (!activeConvId) return;
    let cancelled = false;

    const loadMessages = async () => {
      try {
        const data = await apiFetch(`/api/seller/chat/${activeConvId}/messages`);
        if (!cancelled) {
          setMessages(data.messages);
          setActiveConversation(data.conversation);
        }
      } catch {}
    };

    loadMessages();

    const startPolling = () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(loadMessages, 30000);
    };

    const stopPolling = () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        loadMessages();
        startPolling();
      } else {
        stopPolling();
      }
    };

    startPolling();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [activeConvId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (attachment?: string) => {
    if (!newMessage.trim() && !attachment) return;
    if (!activeConvId) return;
    setSending(true);
    try {
      await apiFetch(`/api/seller/chat/${activeConvId}/messages`, {
        method: "POST",
        body: JSON.stringify({ message: newMessage.trim(), attachment }),
      });
      setNewMessage("");
      const data = await apiFetch(`/api/seller/chat/${activeConvId}/messages`);
      setMessages(data.messages);
      loadConversations();
    } catch {}
    setSending(false);
  };

  const handleAttachmentUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !activeConvId) return;
    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append("images", files[0]);
      const data = await apiFetch("/api/seller/upload-images", {
        method: "POST",
        body: formData,
      });
      if (data.urls?.[0]) {
        await handleSend(data.urls[0]);
      }
    } catch {}
    setUploadingAttachment(false);
  };

  // Filter conversations client-side
  const filteredConversations = searchQuery
    ? conversations.filter((c) => {
        const q = searchQuery.toLowerCase();
        return (
          c.buyer?.name?.toLowerCase().includes(q) ||
          c.buyer?.email?.toLowerCase().includes(q) ||
          c.product?.name?.toLowerCase().includes(q) ||
          c.lastMessage?.message?.toLowerCase().includes(q)
        );
      })
    : conversations;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Group messages by date for date separators
  const messagesWithDates: Array<{ type: "date"; label: string } | { type: "msg"; msg: ChatMessage }> = [];
  let lastDateLabel = "";
  for (const msg of messages) {
    const label = getDateLabel(msg.createdAt);
    if (label !== lastDateLabel) {
      messagesWithDates.push({ type: "date", label });
      lastDateLabel = label;
    }
    messagesWithDates.push({ type: "msg", msg });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden" style={{ height: "calc(100vh - 200px)" }}>
        <div className="flex h-full">
          {/* Conversation List */}
          <div className={`w-full md:w-80 border-r flex-shrink-0 flex flex-col ${activeConvId ? "hidden md:flex" : "flex"}`}>
            <div className="p-4 border-b space-y-2">
              <h2 className="font-semibold text-gray-900">Customer Messages</h2>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                    <X className="w-3 h-3 text-gray-400" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{searchQuery ? "No matching conversations" : "No messages yet"}</p>
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConvId(conv.id)}
                    className={`w-full text-left p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                      activeConvId === conv.id ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {conv.adminId ? (
                              <span className="flex items-center gap-1">
                                <span className="text-[10px] font-semibold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">Admin</span>
                                Store Support
                              </span>
                            ) : (
                              conv.buyer?.name || conv.buyer?.email || "Customer"
                            )}
                          </p>
                          {conv.unreadCount > 0 && (
                            <span className="bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                        {conv.product && (
                          <p className="text-xs text-gray-500 truncate">Re: {conv.product.name}</p>
                        )}
                        {conv.lastMessage && (
                          <div className="flex items-center justify-between mt-0.5">
                            <p className="text-xs text-gray-400 truncate flex-1">{conv.lastMessage.message}</p>
                            <span className="text-[10px] text-gray-400 ml-2 flex-shrink-0">
                              {formatRelativeTime(conv.lastMessage.createdAt)}
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
          <div className={`flex-1 flex flex-col ${!activeConvId ? "hidden md:flex" : "flex"}`}>
            {!activeConvId ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Select a conversation to view messages</p>
                </div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="p-4 border-b flex items-center gap-3">
                  <button onClick={() => setActiveConvId(null)} className="md:hidden p-1">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {activeConversation?.buyer?.name || "Customer"}
                    </p>
                    {activeConversation?.product && (
                      <p className="text-xs text-gray-500">Re: {activeConversation.product.name}</p>
                    )}
                  </div>
                </div>

                {/* Messages with date separators */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messagesWithDates.map((item, i) => {
                    if (item.type === "date") {
                      return (
                        <div key={`date-${i}`} className="flex items-center gap-3 py-2">
                          <div className="flex-1 h-px bg-gray-200" />
                          <span className="text-xs text-gray-400 font-medium">{item.label}</span>
                          <div className="flex-1 h-px bg-gray-200" />
                        </div>
                      );
                    }
                    const msg = item.msg;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${msg.senderType === "SELLER" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                            msg.senderType === "SELLER"
                              ? "bg-primary text-white rounded-br-md"
                              : msg.senderType === "ADMIN"
                              ? "bg-blue-50 text-gray-900 rounded-bl-md border border-blue-200"
                              : "bg-gray-100 text-gray-900 rounded-bl-md"
                          }`}
                        >
                          {msg.senderType === "ADMIN" && (
                            <span className="inline-block text-[10px] font-semibold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded mb-1">Admin</span>
                          )}
                          {msg.attachment && (
                            <div className="mb-1">
                              {isImageUrl(msg.attachment) ? (
                                <img
                                  src={msg.attachment.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || ""}${msg.attachment}` : msg.attachment}
                                  alt="Attachment"
                                  className="max-w-[200px] rounded-lg cursor-pointer"
                                  onClick={() => window.open(msg.attachment!.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || ""}${msg.attachment}` : msg.attachment, "_blank")}
                                />
                              ) : (
                                <a
                                  href={msg.attachment.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || ""}${msg.attachment}` : msg.attachment}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-sm underline"
                                >
                                  <FileText className="w-4 h-4" />
                                  Attachment
                                </a>
                              )}
                            </div>
                          )}
                          {msg.message && <p className="text-sm whitespace-pre-wrap">{msg.message}</p>}
                          <p className={`text-[10px] mt-1 ${msg.senderType === "SELLER" ? "text-white/70" : "text-gray-400"}`}>
                            {formatRelativeTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t">
                  {/* Quick Replies dropdown */}
                  {showQuickReplies && (
                    <div className="mb-2 bg-gray-50 rounded-lg border border-gray-200 p-2 space-y-1 max-h-40 overflow-y-auto">
                      {quickReplies.map((reply, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <button
                            onClick={() => { setNewMessage(reply); setShowQuickReplies(false); }}
                            className="flex-1 text-left text-xs text-gray-700 hover:bg-white p-1.5 rounded truncate"
                          >
                            {reply}
                          </button>
                          <button
                            onClick={() => saveQuickReplies(quickReplies.filter((_, j) => j !== i))}
                            className="text-gray-400 hover:text-red-500 flex-shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-1 mt-1">
                        <input
                          type="text"
                          value={newQuickReply}
                          onChange={(e) => setNewQuickReply(e.target.value)}
                          placeholder="Add new template..."
                          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newQuickReply.trim()) {
                              saveQuickReplies([...quickReplies, newQuickReply.trim()]);
                              setNewQuickReply("");
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            if (newQuickReply.trim()) {
                              saveQuickReplies([...quickReplies, newQuickReply.trim()]);
                              setNewQuickReply("");
                            }
                          }}
                          className="px-2 py-1 text-xs bg-primary text-white rounded"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowQuickReplies(!showQuickReplies)}
                      className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                      title="Quick replies"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleAttachmentUpload(e.target.files)} />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAttachment}
                      className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
                      title="Attach file"
                    >
                      {uploadingAttachment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                    </button>
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                      placeholder="Type a reply..."
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      onClick={() => handleSend()}
                      disabled={sending || !newMessage.trim()}
                      className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
