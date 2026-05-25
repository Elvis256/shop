"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Send, Users, MessageSquare, Phone, Radio, CheckCircle, AlertTriangle } from "lucide-react";

type Channel = "whatsapp" | "sms" | "both";

export default function AdminBroadcastPage() {
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [minOrderCount, setMinOrderCount] = useState(0);
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number; message: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/broadcast/audience", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setAudienceCount(d.total))
      .catch(() => {});
  }, []);

  const handleSend = async () => {
    if (!message.trim() || message.length < 5) {
      setError("Message must be at least 5 characters.");
      return;
    }
    const confirmed = window.confirm(
      `Send ${channel === "both" ? "WhatsApp + SMS" : channel} to ${audienceCount ?? "all opted-in"} customers?\n\nMessage: "${message.slice(0, 100)}${message.length > 100 ? "..." : ""}"`
    );
    if (!confirmed) return;

    setSending(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/broadcast/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message, channel, minOrderCount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Broadcast failed");
      setResult(data);
      setMessage("");
    } catch (err: any) {
      setError(err.message || "Failed to send broadcast");
    } finally {
      setSending(false);
    }
  };

  const charCount = message.length;
  const smsSegments = Math.ceil(charCount / 160) || 1;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Broadcast</h1>
        <p className="text-gray-500 text-sm mt-1">Send bulk WhatsApp or SMS messages to opted-in customers</p>
      </div>

      {/* Audience Card */}
      <div className="bg-white rounded-xl border p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
          <Users className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">
            {audienceCount === null ? "..." : audienceCount.toLocaleString()}
          </p>
          <p className="text-sm text-gray-500">opted-in customers with phone numbers</p>
        </div>
      </div>

      {/* Compose */}
      <div className="bg-white rounded-xl border">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-gray-400" />
            Compose Message
          </h2>
        </div>
        <div className="p-6 space-y-5">
          {/* Channel */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Channel</label>
            <div className="flex gap-3">
              {(["whatsapp", "sms", "both"] as Channel[]).map((ch) => (
                <label
                  key={ch}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer text-sm font-medium transition-colors ${
                    channel === ch
                      ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="channel"
                    value={ch}
                    checked={channel === ch}
                    onChange={() => setChannel(ch)}
                    className="sr-only"
                  />
                  {ch === "whatsapp" && <Phone className="w-4 h-4" />}
                  {ch === "sms" && <MessageSquare className="w-4 h-4" />}
                  {ch === "both" && <Radio className="w-4 h-4" />}
                  {ch === "both" ? "WhatsApp + SMS" : ch.charAt(0).toUpperCase() + ch.slice(1)}
                </label>
              ))}
            </div>
          </div>

          {/* Audience filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Audience Filter
            </label>
            <select
              value={minOrderCount}
              onChange={(e) => setMinOrderCount(Number(e.target.value))}
              className="input w-full max-w-xs text-sm"
            >
              <option value={0}>All opted-in customers</option>
              <option value={1}>Customers with 1+ orders</option>
              <option value={2}>Customers with 2+ orders</option>
              <option value={5}>Customers with 5+ orders</option>
            </select>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={1000}
              placeholder="Type your message here... Keep it friendly and include your store name."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-xs text-gray-400">
                {charCount}/1000 characters
                {channel !== "whatsapp" && ` · ${smsSegments} SMS segment${smsSegments > 1 ? "s" : ""}`}
              </p>
              <p className="text-xs text-gray-400">Min 5 characters</p>
            </div>
          </div>

          {/* Preview */}
          {message.trim() && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Preview</p>
              <div className="bg-white rounded-lg p-3 shadow-sm border max-w-sm text-sm text-gray-800 whitespace-pre-wrap">
                {message}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {result && (
            <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-800">{result.message}</p>
                <p className="text-sm text-green-700 mt-0.5">
                  {result.sent} delivered · {result.failed} failed · {result.total} targeted
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex justify-end">
          <button
            onClick={handleSend}
            disabled={sending || !message.trim() || message.length < 5}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
            {sending ? "Sending..." : "Send Broadcast"}
          </button>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-amber-800 mb-2">Tips for effective broadcasts</p>
        <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
          <li>Keep messages short and action-oriented</li>
          <li>Always include your store name (PleasureZone)</li>
          <li>Avoid sending more than once per week to prevent opt-outs</li>
          <li>WhatsApp has better open rates than SMS</li>
          <li>Messages over 160 chars will be split into multiple SMS segments (extra cost)</li>
        </ul>
      </div>
    </div>
  );
}
