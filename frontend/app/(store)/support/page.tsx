"use client";

import { useState } from "react";
import Section from "@/components/Section";
import { MessageCircle, Send, AlertCircle, CheckCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";

interface TicketMessage {
  id: string;
  message: string;
  isStaff: boolean;
  createdAt: string;
}

interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
  messages: TicketMessage[];
}

const categoryOptions = [
  { value: "ORDER", label: "Order Issue" },
  { value: "SHIPPING", label: "Shipping & Delivery" },
  { value: "PAYMENT", label: "Payment Problem" },
  { value: "PRODUCT", label: "Product Question" },
  { value: "RETURNS", label: "Returns & Refunds" },
  { value: "ACCOUNT", label: "Account Issue" },
  { value: "OTHER", label: "Other" },
];

const statusConfig: Record<string, { color: string; icon: React.ElementType }> = {
  OPEN: { color: "text-blue-600 bg-blue-100", icon: AlertCircle },
  IN_PROGRESS: { color: "text-yellow-600 bg-yellow-100", icon: Clock },
  RESOLVED: { color: "text-green-600 bg-green-100", icon: CheckCircle },
  CLOSED: { color: "text-gray-600 bg-gray-100", icon: CheckCircle },
};

export default function SupportPage() {
  const [mode, setMode] = useState<"new" | "lookup">("new");
  const [category, setCategory] = useState("ORDER");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ ticketNumber: string } | null>(null);
  
  const [lookupNumber, setLookupNumber] = useState("");
  const [lookupEmail, setLookupEmail] = useState("");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [expandedMessages, setExpandedMessages] = useState(true);
  const [replyMessage, setReplyMessage] = useState("");
  const [replying, setReplying] = useState(false);

  const submitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !message || !email) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          category,
          subject,
          message,
          email,
          name,
          orderNumber: orderNumber || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSubmitted({ ticketNumber: data.ticketNumber });
      }
    } catch (error) {
      console.error("Submit ticket error:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const lookupTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupNumber || !lookupEmail) return;

    setLookupError("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/lookup/${lookupNumber}?email=${encodeURIComponent(lookupEmail)}`,
        { credentials: "include" }
      );

      if (res.ok) {
        const data = await res.json();
        setTicket(data);
      } else {
        setLookupError("Ticket not found. Please check your ticket number and email.");
      }
    } catch (error) {
      setLookupError("Failed to look up ticket");
    }
  };

  const sendReply = async () => {
    if (!replyMessage.trim() || !ticket) return;

    setReplying(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/${ticket.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ message: replyMessage }),
        }
      );

      if (res.ok) {
        setReplyMessage("");
        // Refresh ticket
        lookupTicket(new Event("submit") as unknown as React.FormEvent);
      }
    } catch (error) {
      console.error("Reply error:", error);
    } finally {
      setReplying(false);
    }
  };

  if (submitted) {
    return (
      <Section>
        <div className="max-w-xl mx-auto text-center py-16">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-semibold mb-4">Ticket Submitted!</h1>
          <p className="text-text-muted mb-2">Your ticket number is:</p>
          <p className="text-3xl font-bold text-accent mb-6">{submitted.ticketNumber}</p>
          <p className="text-sm text-text-muted mb-8">
            Save this number to track your ticket. We&apos;ll respond within 24 hours.
          </p>
          <button
            onClick={() => {
              setSubmitted(null);
              setSubject("");
              setMessage("");
            }}
            className="btn btn-primary"
          >
            Submit Another Ticket
          </button>
        </div>
      </Section>
    );
  }

  return (
    <Section>
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold mb-2">Customer Support</h1>
          <p className="text-text-muted">
            We&apos;re here to help. Submit a ticket or check your existing one.
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setMode("new")}
            className={`flex-1 py-3 rounded-18 font-medium transition-all ${
              mode === "new"
                ? "bg-accent text-white"
                : "bg-surface-secondary text-text-muted hover:bg-gray-200"
            }`}
          >
            New Ticket
          </button>
          <button
            onClick={() => setMode("lookup")}
            className={`flex-1 py-3 rounded-18 font-medium transition-all ${
              mode === "lookup"
                ? "bg-accent text-white"
                : "bg-surface-secondary text-text-muted hover:bg-gray-200"
            }`}
          >
            Check Status
          </button>
        </div>

        {mode === "new" ? (
          <form onSubmit={submitTicket} className="card">
            <div className="grid gap-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Your Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Email *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="input"
                  >
                    {categoryOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Order Number (if applicable)</label>
                  <input
                    type="text"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    className="input"
                    placeholder="ORD-12345"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Subject *</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="input"
                  placeholder="Brief description of your issue"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Message *</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="input min-h-[150px]"
                  placeholder="Please describe your issue in detail..."
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !subject || !message || !email}
                className="btn btn-primary flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                {submitting ? "Submitting..." : "Submit Ticket"}
              </button>
            </div>
          </form>
        ) : ticket ? (
          // Ticket Detail View
          <div className="card">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-sm text-text-muted">Ticket #{ticket.ticketNumber}</p>
                <h2 className="text-xl font-semibold">{ticket.subject}</h2>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig[ticket.status]?.color || "bg-gray-100"}`}>
                {ticket.status.replace("_", " ")}
              </span>
            </div>

            <div className="flex gap-4 text-sm text-text-muted mb-6">
              <span>Category: {ticket.category}</span>
              <span>•</span>
              <span>Created: {new Date(ticket.createdAt).toLocaleDateString()}</span>
            </div>

            {/* Messages */}
            <div className="border-t pt-4">
              <button
                onClick={() => setExpandedMessages(!expandedMessages)}
                className="flex items-center gap-2 text-sm font-medium mb-4"
              >
                <MessageCircle className="w-4 h-4" />
                Messages ({ticket.messages?.length || 0})
                {expandedMessages ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {expandedMessages && (
                <div className="space-y-4 mb-6">
                  {ticket.messages?.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-4 rounded-18 ${
                        msg.isStaff ? "bg-accent/5 border-l-4 border-accent" : "bg-surface-secondary"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">
                          {msg.isStaff ? "Support Team" : "You"}
                        </span>
                        <span className="text-xs text-text-muted">
                          {new Date(msg.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                    </div>
                  ))}
                </div>
              )}

              {ticket.status !== "CLOSED" && ticket.status !== "RESOLVED" && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Type your reply..."
                    className="input flex-1"
                  />
                  <button
                    onClick={sendReply}
                    disabled={replying || !replyMessage.trim()}
                    className="btn btn-primary"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setTicket(null)}
              className="btn btn-secondary w-full mt-6"
            >
              Look Up Another Ticket
            </button>
          </div>
        ) : (
          // Lookup Form
          <form onSubmit={lookupTicket} className="card">
            <div className="grid gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">Ticket Number</label>
                <input
                  type="text"
                  value={lookupNumber}
                  onChange={(e) => setLookupNumber(e.target.value)}
                  className="input"
                  placeholder="TKT-XXXXXXXX"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Email Used for Ticket</label>
                <input
                  type="email"
                  value={lookupEmail}
                  onChange={(e) => setLookupEmail(e.target.value)}
                  className="input"
                  placeholder="you@example.com"
                  required
                />
              </div>

              {lookupError && (
                <p className="text-red-600 text-sm">{lookupError}</p>
              )}

              <button
                type="submit"
                disabled={!lookupNumber || !lookupEmail}
                className="btn btn-primary"
              >
                Look Up Ticket
              </button>
            </div>
          </form>
        )}

        {/* Contact Info */}
        <div className="mt-8 p-6 bg-surface-secondary rounded-18 text-center">
          <h3 className="font-medium mb-2">Need Immediate Help?</h3>
          <p className="text-sm text-text-muted mb-4">
            Our support team typically responds within 24 hours.
          </p>
          <p className="text-sm">
            Email: <a href="mailto:support@pleasurezone.ug" className="text-accent">support@pleasurezone.ug</a>
          </p>
        </div>
      </div>
    </Section>
  );
}
