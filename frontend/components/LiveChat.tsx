"use client";

import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Loader2, MinusCircle } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface ChatMessage {
  id: string;
  message: string;
  senderType: "CUSTOMER" | "AGENT" | "SYSTEM";
  createdAt: string;
}

export default function LiveChat() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState("");
  const [started, setStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (isOpen && chatId) {
      pollMessages();
      pollRef.current = setInterval(pollMessages, 5000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isOpen, chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const pollMessages = async () => {
    if (!chatId) return;
    try {
      const res = await fetch(`${API_URL}/api/support-chat/${chatId}/messages`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch {}
  };

  const startChat = async () => {
    try {
      const body: any = {};
      if (!user && guestEmail) body.guestEmail = guestEmail;
      const res = await fetch(`${API_URL}/api/support-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setChatId(data.id || data.chatId);
        setStarted(true);
        setMessages([{
          id: "welcome",
          message: "Hi! How can we help you today? An agent will be with you shortly.",
          senderType: "SYSTEM",
          createdAt: new Date().toISOString(),
        }]);
      }
    } catch {}
  };

  const sendMessage = async () => {
    if (!input.trim() || !chatId) return;
    const msg = input.trim();
    setInput("");
    setSending(true);

    // Optimistic update
    setMessages((prev) => [...prev, {
      id: `temp-${Date.now()}`,
      message: msg,
      senderType: "CUSTOMER",
      createdAt: new Date().toISOString(),
    }]);

    try {
      await fetch(`${API_URL}/api/support-chat/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: msg }),
      });
    } catch {}
    setSending(false);
  };

  return (
    <>
      {/* Chat Bubble */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-4 z-40 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all hover:scale-105"
          aria-label="Open live chat"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100vh-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4">
          {/* Header */}
          <div className="bg-primary text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div>
              <h3 className="font-semibold text-sm">Live Support</h3>
              <p className="text-xs text-white/70">Usually replies within 5 minutes</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                <MinusCircle className="w-4 h-4" />
              </button>
              <button onClick={() => { setIsOpen(false); setChatId(null); setStarted(false); setMessages([]); }} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          {!started ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <MessageCircle className="w-12 h-12 text-primary mb-4" />
              <h4 className="font-semibold text-gray-900 mb-2">Start a conversation</h4>
              <p className="text-sm text-gray-500 mb-4">
                Our team is here to help with any questions about products, orders, or wellness.
              </p>
              {!user && (
                <input
                  type="email"
                  placeholder="Your email (optional)"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              )}
              <button onClick={startChat} className="w-full py-2.5 bg-primary text-white rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors">
                Start Chat
              </button>
              <p className="text-xs text-gray-400 mt-3">
                Or message us on{" "}
                <a href="https://wa.me/256700000000" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
                  WhatsApp
                </a>
              </p>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.senderType === "CUSTOMER" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                      msg.senderType === "CUSTOMER"
                        ? "bg-primary text-white rounded-br-md"
                        : msg.senderType === "SYSTEM"
                        ? "bg-gray-100 text-gray-600 rounded-bl-md"
                        : "bg-gray-100 text-gray-900 rounded-bl-md"
                    }`}>
                      {msg.message}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-gray-100 flex-shrink-0">
                <form
                  onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || sending}
                    className="w-9 h-9 bg-primary text-white rounded-full flex items-center justify-center disabled:opacity-50 hover:bg-primary/90 transition-colors"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
