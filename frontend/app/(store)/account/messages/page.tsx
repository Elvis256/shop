"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { MessageCircle, Send, ArrowLeft, Store } from "lucide-react";

interface Conversation {
  id: string;
  sellerId: string;
  productId: string | null;
  lastMessageAt: string;
  seller: { id: string; storeName: string; logo: string | null };
  product: { id: string; name: string; slug: string } | null;
  lastMessage: { message: string; createdAt: string; senderType: string } | null;
  unreadCount: number;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderType: "BUYER" | "SELLER";
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function CustomerMessagesPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
      <CustomerMessagesPage />
    </Suspense>
  );
}

function CustomerMessagesPage() {
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeConversation, setActiveConversation] = useState<any>(null);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      const data = await apiFetch("/api/chat/conversations");
      setConversations(data.conversations);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle initial load with sellerId/productId params
  useEffect(() => {
    const sellerId = searchParams.get("sellerId");
    const productId = searchParams.get("productId");
    const conversationId = searchParams.get("conversationId");

    if (sellerId) {
      (async () => {
        try {
          const data = await apiFetch("/api/chat/conversations", {
            method: "POST",
            body: JSON.stringify({ sellerId, productId: productId || undefined }),
          });
          setActiveConvId(data.conversation.id);
        } catch {}
        loadConversations();
      })();
    } else if (conversationId) {
      setActiveConvId(conversationId);
      loadConversations();
    } else {
      loadConversations();
    }
  }, [searchParams, loadConversations]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConvId) return;
    let cancelled = false;

    const loadMessages = async () => {
      try {
        const data = await apiFetch(`/api/chat/conversations/${activeConvId}/messages`);
        if (!cancelled) {
          setMessages(data.messages);
          setActiveConversation(data.conversation);
        }
      } catch {}
    };

    loadMessages();
    const interval = setInterval(loadMessages, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeConvId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !activeConvId) return;
    setSending(true);
    try {
      await apiFetch(`/api/chat/conversations/${activeConvId}/messages`, {
        method: "POST",
        body: JSON.stringify({ message: newMessage.trim() }),
      });
      setNewMessage("");
      const data = await apiFetch(`/api/chat/conversations/${activeConvId}/messages`);
      setMessages(data.messages);
    } catch {}
    setSending(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Messages</h1>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden" style={{ height: "70vh" }}>
        <div className="flex h-full">
          {/* Conversation List */}
          <div className={`w-full md:w-80 border-r flex-shrink-0 flex flex-col ${activeConvId ? "hidden md:flex" : "flex"}`}>
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">Conversations</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No conversations yet</p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConvId(conv.id)}
                    className={`w-full text-left p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                      activeConvId === conv.id ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Store className="w-5 h-5 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900 truncate">{conv.seller.storeName}</p>
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
                          <p className="text-xs text-gray-400 truncate mt-0.5">{conv.lastMessage.message}</p>
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
                  <p>Select a conversation to start messaging</p>
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
                    <p className="font-semibold text-gray-900">{activeConversation?.seller?.storeName || "Seller"}</p>
                    {activeConversation?.product && (
                      <p className="text-xs text-gray-500">Re: {activeConversation.product.name}</p>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.senderType === "BUYER" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                          msg.senderType === "BUYER"
                            ? "bg-primary text-white rounded-br-md"
                            : "bg-gray-100 text-gray-900 rounded-bl-md"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        <p className={`text-[10px] mt-1 ${msg.senderType === "BUYER" ? "text-white/70" : "text-gray-400"}`}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                      placeholder="Type a message..."
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      onClick={handleSend}
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
