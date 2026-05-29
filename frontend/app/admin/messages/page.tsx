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
} from "lucide-react";

interface Conversation {
  id: string;
  sellerId: string;
  lastMessageAt: string;
  seller?: { id: string; storeName: string; email: string; logo?: string };
  lastMessage?: { message: string; senderType: string; createdAt: string };
  unreadCount: number;
}

interface Message {
  id: string;
  senderId: string;
  senderType: "ADMIN" | "SELLER" | "BUYER";
  message: string;
  createdAt: string;
  isRead: boolean;
}

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

  const fetchConversations = useCallback(async () => {
    try {
      const data = await apiFetch("/api/admin/messages/conversations");
      setConversations(data.conversations || []);
    } catch {
      // ignore
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
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Auto-start conversation from URL param
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

  // Poll for new messages
  useEffect(() => {
    if (!activeConvId) return;
    fetchMessages(activeConvId);

    const handleVisibility = () => {
      if (document.hidden) {
        if (pollRef.current) clearInterval(pollRef.current);
      } else {
        pollRef.current = setInterval(() => fetchMessages(activeConvId), 30000);
      }
    };

    pollRef.current = setInterval(() => fetchMessages(activeConvId), 30000);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [activeConvId, fetchMessages]);

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
      alert("Failed to start conversation");
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
      alert("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const searchSellers = async (query: string) => {
    if (!query.trim()) {
      setSellers([]);
      return;
    }
    setSearchLoading(true);
    try {
      const data = await apiFetch(`/api/admin/sellers?search=${encodeURIComponent(query)}&limit=10`);
      setSellers(data.sellers || []);
    } catch {
      // ignore
    } finally {
      setSearchLoading(false);
    }
  };

  const activeConv = conversations.find((c) => c.id === activeConvId);

  return (
    <div className="flex h-[calc(100vh-120px)] bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden">
      {/* Conversation List */}
      <div className="w-80 border-r dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white">Messages</h2>
          <button
            onClick={() => setShowNewConv(true)}
            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
            title="New Conversation"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
              No conversations yet
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                className={`w-full text-left px-4 py-3 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${
                  activeConvId === conv.id ? "bg-blue-50 dark:bg-blue-900/20" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {conv.seller?.logo ? (
                      <img src={conv.seller.logo} alt="" className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <Store className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                        {conv.seller?.storeName || "Unknown"}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="ml-2 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    {conv.lastMessage && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        {conv.lastMessage.senderType === "ADMIN" ? "You: " : ""}
                        {conv.lastMessage.message}
                      </p>
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
            <div className="px-6 py-4 border-b dark:border-gray-700 flex items-center gap-3">
              <Store className="w-5 h-5 text-gray-400" />
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{activeConv.seller?.storeName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{activeConv.seller?.email}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderType === "ADMIN" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                      msg.senderType === "ADMIN"
                        ? "bg-blue-600 text-white rounded-br-md"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-md"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                    <p
                      className={`text-[10px] mt-1 ${
                        msg.senderType === "ADMIN" ? "text-blue-200" : "text-gray-400"
                      }`}
                    >
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="px-4 py-3 border-t dark:border-gray-700">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2.5 border rounded-xl bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-3" />
              <p className="font-medium">Select a conversation</p>
              <p className="text-sm mt-1">or start a new one</p>
            </div>
          </div>
        )}
      </div>

      {/* New Conversation Modal */}
      {showNewConv && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowNewConv(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">New Conversation</h3>
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
                  onChange={(e) => {
                    setSellerSearch(e.target.value);
                    searchSellers(e.target.value);
                  }}
                  placeholder="Search sellers..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                  autoFocus
                />
              </div>
              <div className="mt-3 max-h-60 overflow-y-auto space-y-1">
                {searchLoading ? (
                  <div className="text-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" />
                  </div>
                ) : (
                  sellers.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => startConversation(s.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 text-left"
                    >
                      <Store className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{s.storeName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{s.email}</p>
                      </div>
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
