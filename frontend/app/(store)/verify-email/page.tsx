"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Section from "@/components/Section";
import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  
  const [status, setStatus] = useState<"loading" | "success" | "error" | "no-token">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("no-token");
      return;
    }

    verifyEmail();
  }, [token]);

  const verifyEmail = async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setMessage(data.message || "Email verified successfully!");
        // Redirect to login after 3 seconds
        setTimeout(() => router.push("/login"), 3000);
      } else {
        setStatus("error");
        setMessage(data.error || "Verification failed");
      }
    } catch (error) {
      setStatus("error");
      setMessage("Failed to verify email. Please try again.");
    }
  };

  if (status === "loading") {
    return (
      <Section>
        <div className="max-w-md mx-auto text-center py-16">
          <Loader2 className="w-16 h-16 text-accent mx-auto animate-spin mb-6" />
          <h1 className="text-2xl font-bold mb-4">Verifying Your Email</h1>
          <p className="text-gray-600">Please wait while we verify your email address...</p>
        </div>
      </Section>
    );
  }

  if (status === "no-token") {
    return (
      <Section>
        <div className="max-w-md mx-auto text-center py-16">
          <Mail className="w-16 h-16 text-gray-400 mx-auto mb-6" />
          <h1 className="text-2xl font-bold mb-4">Email Verification</h1>
          <p className="text-gray-600 mb-6">
            No verification token provided. Please check your email for the verification link.
          </p>
          <Link href="/login" className="btn-primary">
            Go to Login
          </Link>
        </div>
      </Section>
    );
  }

  if (status === "success") {
    return (
      <Section>
        <div className="max-w-md mx-auto text-center py-16">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold mb-4">Email Verified!</h1>
          <p className="text-gray-600 mb-6">{message}</p>
          <p className="text-sm text-gray-500 mb-6">Redirecting to login...</p>
          <Link href="/login" className="btn-primary">
            Continue to Login
          </Link>
        </div>
      </Section>
    );
  }

  return (
    <Section>
      <div className="max-w-md mx-auto text-center py-16">
        <XCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
        <h1 className="text-2xl font-bold mb-4">Verification Failed</h1>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="space-y-4">
          <Link href="/login" className="btn-primary block">
            Go to Login
          </Link>
          <p className="text-sm text-gray-500">
            Need a new verification link?{" "}
            <Link href="/resend-verification" className="text-accent hover:underline">
              Resend verification email
            </Link>
          </p>
        </div>
      </div>
    </Section>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <Section>
        <div className="max-w-md mx-auto text-center py-16">
          <Loader2 className="w-16 h-16 text-accent mx-auto animate-spin mb-6" />
          <h1 className="text-2xl font-bold mb-4">Loading...</h1>
        </div>
      </Section>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
