"use client";

import { useState } from "react";
import { Package, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function DeliveryVerifyPage() {
  const [orderId, setOrderId] = useState("");
  const [otp, setOtp] = useState("");
  const [agentId, setAgentId] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId.trim() || !otp.trim()) return;

    setStatus("loading");
    setMessage("");

    try {
      const result: any = await apiFetch("/api/delivery/verify-otp", {
        method: "POST",
        body: JSON.stringify({ orderId: orderId.trim(), otp: otp.trim(), agentId: agentId.trim() || undefined }),
      });
      setStatus("success");
      setMessage(result.message || "Delivery confirmed successfully!");
      setOtp("");
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "Verification failed. Please check the OTP and try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-black rounded-full flex items-center justify-center">
            <Package className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Delivery Verification</h1>
          <p className="text-gray-500 mt-2">Enter the customer&apos;s OTP to confirm delivery</p>
        </div>

        <form onSubmit={handleVerify} className="bg-white rounded-2xl shadow-sm border p-6 space-y-4">
          <div>
            <label htmlFor="orderId" className="block text-sm font-medium text-gray-700 mb-1">
              Order ID
            </label>
            <input
              id="orderId"
              type="text"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="Enter order ID"
              className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-black focus:border-transparent outline-none"
              required
            />
          </div>

          <div>
            <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
              Delivery OTP
            </label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="6-digit code"
              className="w-full px-4 py-3 border rounded-xl text-center text-2xl tracking-[0.5em] font-mono focus:ring-2 focus:ring-black focus:border-transparent outline-none"
              required
            />
          </div>

          <div>
            <label htmlFor="agentId" className="block text-sm font-medium text-gray-700 mb-1">
              Agent ID <span className="text-gray-400">(optional)</span>
            </label>
            <input
              id="agentId"
              type="text"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              placeholder="Your agent/rider ID"
              className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-black focus:border-transparent outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={status === "loading" || otp.length !== 6}
            className="w-full py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status === "loading" ? (
              <><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Verifying...</>
            ) : "Verify & Confirm Delivery"}
          </button>

          {status === "success" && (
            <div className="flex items-center gap-3 p-4 bg-green-50 text-green-700 rounded-xl">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{message}</p>
            </div>
          )}

          {status === "error" && (
            <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-xl">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{message}</p>
            </div>
          )}
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          PleasureZone Delivery System
        </p>
      </div>
    </div>
  );
}
