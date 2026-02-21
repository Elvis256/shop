"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Section from "@/components/Section";
import { MailX, CheckCircle, Loader2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email");
  
  const [email, setEmail] = useState(emailParam || "");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [emailParam]);

  const handleUnsubscribe = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setStatus("error");
      setMessage("Please enter your email address");
      return;
    }

    setStatus("loading");

    try {
      const res = await fetch(`${API_URL}/api/newsletter/unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setMessage(data.message || "Successfully unsubscribed");
      } else {
        setStatus("error");
        setMessage(data.error || "Failed to unsubscribe");
      }
    } catch (error) {
      setStatus("error");
      setMessage("Connection error. Please try again.");
    }
  };

  if (status === "success") {
    return (
      <Section>
        <div className="max-w-md mx-auto text-center py-16">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold mb-4">Unsubscribed</h1>
          <p className="text-gray-600 mb-6">{message}</p>
          <p className="text-gray-500 mb-8">
            We're sorry to see you go. You won't receive any more newsletters from us.
          </p>
          <Link href="/" className="btn-primary">
            Return to Homepage
          </Link>
        </div>
      </Section>
    );
  }

  return (
    <Section>
      <div className="max-w-md mx-auto text-center py-16">
        <MailX className="w-16 h-16 text-gray-400 mx-auto mb-6" />
        <h1 className="text-2xl font-bold mb-4">Unsubscribe from Newsletter</h1>
        <p className="text-gray-600 mb-8">
          We're sad to see you go! Enter your email below to unsubscribe from our newsletter.
        </p>

        <form onSubmit={handleUnsubscribe} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
            disabled={status === "loading"}
          />
          
          {status === "error" && (
            <p className="text-red-600 text-sm">{message}</p>
          )}

          <button
            type="submit"
            disabled={status === "loading"}
            className="btn-primary w-full"
          >
            {status === "loading" ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Unsubscribing...
              </span>
            ) : (
              "Unsubscribe"
            )}
          </button>
        </form>

        <p className="text-sm text-gray-500 mt-8">
          Changed your mind?{" "}
          <Link href="/" className="text-accent hover:underline">
            Keep me subscribed
          </Link>
        </p>
      </div>
    </Section>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={
      <Section>
        <div className="max-w-md mx-auto text-center py-16">
          <Loader2 className="w-16 h-16 text-accent mx-auto animate-spin mb-6" />
          <h1 className="text-2xl font-bold mb-4">Loading...</h1>
        </div>
      </Section>
    }>
      <UnsubscribeContent />
    </Suspense>
  );
}
