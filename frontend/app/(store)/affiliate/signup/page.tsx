"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  DollarSign,
  Users,
  TrendingUp,
  Share2,
  CheckCircle,
  ArrowRight,
  Globe,
  BarChart3,
} from "lucide-react";

export default function AffiliateSignupPage() {
  const [step, setStep] = useState<"info" | "form" | "success">("info");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ code: string; message: string } | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    website: "",
    socialMedia: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.affiliateSignup(form);
      setResult(res);
      setStep("success");
    } catch (e: any) {
      setError(e.message || "Signup failed. Please try again.");
    }
    setLoading(false);
  }

  const benefits = [
    {
      icon: DollarSign,
      title: "Generous Commissions",
      desc: "Earn up to 10% commission on every sale you refer to our store.",
    },
    {
      icon: BarChart3,
      title: "Real-time Tracking",
      desc: "Track your clicks, conversions, and earnings in real-time with your dashboard.",
    },
    {
      icon: Share2,
      title: "Easy Sharing",
      desc: "Get a unique referral link you can share anywhere — social media, blogs, emails.",
    },
    {
      icon: TrendingUp,
      title: "Passive Income",
      desc: "Earn while you sleep. Your referral link works 24/7 with a 30-day cookie window.",
    },
  ];

  if (step === "success" && result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Welcome Aboard!</h1>
          <p className="text-gray-500 mb-6">{result.message}</p>
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-500 mb-1">Your Affiliate Code</p>
            <p className="text-2xl font-mono font-bold text-blue-600">{result.code}</p>
            <p className="text-xs text-gray-400 mt-2">
              Your referral link: <span className="font-mono">ugsex.com?ref={result.code}</span>
            </p>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            Share your referral link with your audience. When someone makes a purchase through your link, you earn a commission!
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href={`/affiliate/dashboard?code=${result.code}`}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition inline-block"
            >
              Go to Dashboard
            </Link>
            <Link
              href="/affiliate"
              className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200 transition inline-block"
            >
              Browse Products
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-16 md:py-20 text-center">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">
            Earn Money With Us
          </h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto mb-8">
            Join our affiliate program and earn commissions by sharing products you love.
            No upfront cost, no risk — just share and earn.
          </p>
          <button
            onClick={() => setStep("form")}
            className="inline-flex items-center gap-2 bg-white text-green-700 font-bold px-8 py-4 rounded-xl text-lg hover:bg-green-50 transition shadow-lg"
          >
            Get Started Now <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Benefits */}
      <div className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-10">Why Join Our Affiliate Program?</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {benefits.map((b, i) => (
            <div key={i} className="bg-white rounded-xl border p-6 flex gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                <b.icon className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">{b.title}</h3>
                <p className="text-sm text-gray-500">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How it Works */}
      <div className="bg-white border-y">
        <div className="max-w-5xl mx-auto px-4 py-16">
          <h2 className="text-2xl font-bold text-center mb-10">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "1", title: "Sign Up", desc: "Create your free affiliate account in seconds" },
              { step: "2", title: "Share Your Link", desc: "Get your unique referral link and share it with your audience" },
              { step: "3", title: "Earn Commission", desc: "Earn money for every purchase made through your link" },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-green-100 text-green-700 text-xl font-bold flex items-center justify-center mx-auto mb-4">
                  {s.step}
                </div>
                <h3 className="font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Signup Form */}
      {step === "form" && (
        <div id="signup-form" className="max-w-lg mx-auto px-4 py-16">
          <div className="bg-white rounded-2xl border shadow-sm p-8">
            <h2 className="text-xl font-bold mb-6 text-center">Join Our Affiliate Program</h2>
            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border rounded-xl px-4 py-3 text-sm"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border rounded-xl px-4 py-3 text-sm"
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Website (optional)</label>
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  className="w-full border rounded-xl px-4 py-3 text-sm"
                  placeholder="https://yourblog.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Social Media (optional)</label>
                <input
                  type="text"
                  value={form.socialMedia}
                  onChange={(e) => setForm({ ...form, socialMedia: e.target.value })}
                  className="w-full border rounded-xl px-4 py-3 text-sm"
                  placeholder="@yourusername on Instagram, TikTok, etc."
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 text-white py-3 rounded-xl font-medium hover:bg-green-700 transition disabled:opacity-50"
              >
                {loading ? "Submitting..." : "Create Affiliate Account"}
              </button>
              <p className="text-xs text-gray-400 text-center">
                By signing up, you agree to our affiliate terms and conditions.
              </p>
            </form>
          </div>
        </div>
      )}

      {/* CTA if still on info step */}
      {step === "info" && (
        <div className="max-w-5xl mx-auto px-4 py-16 text-center">
          <button
            onClick={() => setStep("form")}
            className="inline-flex items-center gap-2 bg-green-600 text-white font-bold px-8 py-4 rounded-xl text-lg hover:bg-green-700 transition"
          >
            Sign Up Now — It&apos;s Free <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Already an affiliate? */}
      <div className="bg-gray-100 border-t">
        <div className="max-w-5xl mx-auto px-4 py-8 text-center">
          <p className="text-sm text-gray-500">
            Already an affiliate?{" "}
            <Link href="/affiliate/dashboard" className="text-blue-600 hover:underline font-medium">
              Go to your dashboard
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
