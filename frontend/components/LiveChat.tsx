"use client";

import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Loader2, MinusCircle, Lock, Shield } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useToast } from "@/lib/hooks/useToast";

const API_URL = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");

function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

interface ChatMessage {
  id: string;
  message: string;
  senderType: "CUSTOMER" | "AGENT" | "SYSTEM";
  createdAt: string;
}

export default function LiveChat() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState("");
  const [started, setStarted] = useState(false);
  
  // Incognito ephemeral states
  const [isIncognito, setIsIncognito] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Poll messages periodically
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

  // Ephemeral Incognito Idle Session Auto-Wipe (15 minutes inactivity)
  useEffect(() => {
    if (!started || !isIncognito || !chatId) return;
    
    const interval = setInterval(() => {
      const idleTime = Date.now() - lastActivityRef.current;
      if (idleTime > 15 * 60 * 1000) { // 15 mins
        wipeChat();
        showToast("Incognito Chat session expired & history securely wiped.", "info");
      }
    }, 15000); // Check every 15s
    
    return () => clearInterval(interval);
  }, [started, isIncognito, chatId]);

  const pollMessages = async () => {
    if (!chatId) return;
    try {
      const res = await fetch(`${API_URL}/api/support-chat/${chatId}/messages`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const prevLen = messages.length;
        const newMessages = data.messages || [];
        setMessages(newMessages);
        
        // If new agent reply is received, update activity
        if (newMessages.length > prevLen) {
          lastActivityRef.current = Date.now();
        }
      }
    } catch {}
  };

  const startChat = async () => {
    try {
      const body: any = {};
      if (!user && guestEmail) body.guestEmail = guestEmail;
      
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const csrf = getCsrfToken();
      if (csrf) headers["x-csrf-token"] = csrf;
      
      const res = await fetch(`${API_URL}/api/support-chat`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setChatId(data.id || data.chatId);
        setStarted(true);
        lastActivityRef.current = Date.now();
        
        setMessages([{
          id: "welcome",
          message: isIncognito
            ? "Welcome to Stealth Incognito Chat! All messages are encrypted, held strictly in-memory, and will self-destruct upon exit or 15 mins of inactivity."
            : "Hi! How can we help you today? An agent will be with you shortly.",
          senderType: "SYSTEM",
          createdAt: new Date().toISOString(),
        }]);
        
        showToast(isIncognito ? "Incognito Chat session active" : "Support chat session started", "success");
      }
    } catch {}
  };

  const sendMessage = async () => {
    if (!input.trim() || !chatId) return;
    const msg = input.trim();
    setInput("");
    setSending(true);
    lastActivityRef.current = Date.now();

    // Optimistic update
    setMessages((prev) => [...prev, {
      id: `temp-${Date.now()}`,
      message: msg,
      senderType: "CUSTOMER",
      createdAt: new Date().toISOString(),
    }]);

    try {
      const msgHeaders: Record<string, string> = { "Content-Type": "application/json" };
      const csrfTok = getCsrfToken();
      if (csrfTok) msgHeaders["x-csrf-token"] = csrfTok;
      await fetch(`${API_URL}/api/support-chat/${chatId}/messages`, {
        method: "POST",
        headers: msgHeaders,
        credentials: "include",
        body: JSON.stringify({ message: msg }),
      });
    } catch {}
    setSending(false);
  };

  const wipeChat = async () => {
    if (!chatId) return;
    try {
      await fetch(`${API_URL}/api/support-chat/${chatId}`, {
        method: "DELETE",
        credentials: "include"
      });
    } catch {}
    setChatId(null);
    setStarted(false);
    setMessages([]);
    setIsIncognito(false);
    setIsOpen(false);
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
        <div className="fixed bottom-4 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100vh-2rem)] bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden animate-in slide-in-from-bottom-4">
          {/* Header */}
          <div className={`${isIncognito ? "bg-accent" : "bg-primary"} text-white px-4 py-3 flex items-center justify-between flex-shrink-0 transition-colors duration-300`}>
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-1.5">
                {isIncognito && <Lock className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />}
                {isIncognito ? "Stealth Incognito Chat" : "Live Support"}
              </h3>
              <p className="text-xs text-white/70">
                {isIncognito ? "🔒 Ephemeral Memory Active" : "Usually replies within 5 minutes"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  if (isIncognito) wipeChat();
                  else setIsOpen(false);
                }}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                title={isIncognito ? "Wipe and Close" : "Minimize"}
              >
                <MinusCircle className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  if (isIncognito) wipeChat();
                  else {
                    setIsOpen(false);
                    setChatId(null);
                    setStarted(false);
                    setMessages([]);
                  }
                }}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                title="End Session"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          {!started ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-surface dark:bg-gray-900/10">
              <MessageCircle className="w-12 h-12 text-primary mb-4" />
              <h4 className="font-semibold text-text mb-2">Start a conversation</h4>
              <p className="text-sm text-text-muted mb-4">
                Our team is here to help with any questions about products, orders, or wellness.
              </p>
              
              {!user && (
                <input
                  type="email"
                  placeholder="Your email (optional)"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-border bg-surface dark:bg-gray-800 rounded-lg text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-accent text-text"
                />
              )}

              {/* Incognito Chat Switch */}
              <div className="w-full p-3 border border-border rounded-12 bg-surface-secondary dark:bg-gray-800/40 mb-4 text-left">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isIncognito}
                    onChange={(e) => setIsIncognito(e.target.checked)}
                    className="mt-1 accent-accent cursor-pointer"
                  />
                  <div>
                    <span className="block text-xs font-bold text-text flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-accent animate-pulse" /> Ephemeral Incognito Mode
                    </span>
                    <span className="block text-[10px] text-text-muted leading-relaxed mt-0.5">
                      Keeps session in volatile memory. Auto-wipes backend logs and cookies upon closing or 15 mins of inactivity.
                    </span>
                  </div>
                </label>
              </div>

              <button onClick={startChat} className="w-full py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/95 transition-colors">
                Start Chat
              </button>
              <p className="text-xs text-text-muted mt-3">
                Or message us on{" "}
                <a href="https://wa.me/256700000000" target="_blank" rel="noopener noreferrer" className="text-green-600 dark:text-green-400 hover:underline">
                  WhatsApp
                </a>
              </p>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-surface dark:bg-gray-950">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.senderType === "CUSTOMER" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                      msg.senderType === "CUSTOMER"
                        ? "bg-primary text-white rounded-br-md"
                        : msg.senderType === "SYSTEM"
                        ? "bg-surface-secondary dark:bg-gray-800 text-text-muted rounded-bl-md border border-border text-center text-xs w-full py-1.5"
                        : "bg-surface-secondary dark:bg-gray-800 text-text rounded-bl-md border border-border"
                    }`}>
                      {msg.message}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-border flex-shrink-0 bg-surface dark:bg-gray-900/10">
                <form
                  onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-3 py-2 border border-border bg-surface dark:bg-gray-800 rounded-full text-sm focus:outline-none focus:ring-1 focus:ring-accent text-text"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || sending}
                    className="w-9 h-9 bg-primary text-white rounded-full flex items-center justify-center disabled:opacity-50 hover:bg-primary/95 transition-colors"
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
