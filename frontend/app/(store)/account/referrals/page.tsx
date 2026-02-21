"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Section from "@/components/Section";
import { useAuth } from "@/lib/hooks/useAuth";
import { ArrowLeft, Users, Gift, Copy, Check, Share2 } from "lucide-react";

interface ReferralData {
  code: string;
  referrals: Array<{
    id: string;
    status: string;
    createdAt: string;
    rewardAmount?: number;
  }>;
  totalReferrals: number;
  successfulReferrals: number;
  totalEarned: number;
}

export default function ReferralsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) {
      fetchReferrals();
    }
  }, [user]);

  const fetchReferrals = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/referrals/my-code`, {
        credentials: "include",
      });
      if (res.ok) {
        const codeData = await res.json();
        setData({
          code: codeData.code,
          referrals: codeData.referrals || [],
          totalReferrals: codeData.usageCount || 0,
          successfulReferrals: codeData.successfulReferrals || 0,
          totalEarned: codeData.totalEarned || 0,
        });
      }
    } catch (error) {
      console.error("Failed to fetch referrals:", error);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (data?.code) {
      navigator.clipboard.writeText(data.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareLink = () => {
    if (data?.code) {
      const url = `${window.location.origin}?ref=${data.code}`;
      if (navigator.share) {
        navigator.share({
          title: "Join PleasureZone",
          text: "Use my referral code and get 10% off your first order!",
          url,
        });
      } else {
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  if (isLoading || !user) {
    return (
      <Section>
        <div className="text-center py-16">Loading...</div>
      </Section>
    );
  }

  return (
    <Section>
      <div className="max-w-3xl mx-auto">
        <Link href="/account" className="inline-flex items-center gap-2 text-text-muted hover:text-text mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Account
        </Link>

        <h1 className="text-2xl font-semibold mb-8">Refer a Friend</h1>

        {loading ? (
          <div className="text-center py-16">Loading...</div>
        ) : (
          <>
            {/* Referral Card */}
            <div className="bg-gradient-to-br from-accent to-blue-600 text-white rounded-24 p-8 mb-8">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold mb-2">Share & Earn</h2>
                  <p className="text-sm opacity-90">
                    Give friends 10% off their first order. Get KES 500 when they buy!
                  </p>
                </div>
                <Gift className="w-10 h-10 opacity-80" />
              </div>

              <div className="bg-white/20 rounded-18 p-4 mb-4">
                <p className="text-xs opacity-80 mb-1">Your Referral Code</p>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold tracking-wider">{data?.code || "---"}</span>
                  <button
                    onClick={copyCode}
                    className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                  >
                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                onClick={shareLink}
                className="w-full flex items-center justify-center gap-2 bg-white text-accent font-medium py-3 rounded-full hover:bg-gray-100 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Share Referral Link
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="card text-center">
                <Users className="w-6 h-6 text-accent mx-auto mb-2" />
                <p className="text-2xl font-bold">{data?.totalReferrals || 0}</p>
                <p className="text-xs text-text-muted">Total Referrals</p>
              </div>
              <div className="card text-center">
                <Check className="w-6 h-6 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold">{data?.successfulReferrals || 0}</p>
                <p className="text-xs text-text-muted">Completed</p>
              </div>
              <div className="card text-center">
                <Gift className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                <p className="text-2xl font-bold">KES {(data?.totalEarned || 0).toLocaleString()}</p>
                <p className="text-xs text-text-muted">Total Earned</p>
              </div>
            </div>

            {/* How it Works */}
            <div className="card mb-8">
              <h3 className="font-medium mb-4">How It Works</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <span className="w-8 h-8 bg-accent/10 text-accent rounded-full flex items-center justify-center font-bold text-sm shrink-0">1</span>
                  <div>
                    <p className="font-medium">Share Your Code</p>
                    <p className="text-sm text-text-muted">Send your unique referral code to friends</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="w-8 h-8 bg-accent/10 text-accent rounded-full flex items-center justify-center font-bold text-sm shrink-0">2</span>
                  <div>
                    <p className="font-medium">They Shop & Save</p>
                    <p className="text-sm text-text-muted">Friends get 10% off their first order</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="w-8 h-8 bg-accent/10 text-accent rounded-full flex items-center justify-center font-bold text-sm shrink-0">3</span>
                  <div>
                    <p className="font-medium">You Earn Rewards</p>
                    <p className="text-sm text-text-muted">Get KES 500 credit for each successful referral</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Referral History */}
            {data?.referrals && data.referrals.length > 0 && (
              <div className="card">
                <h3 className="font-medium mb-4">Referral History</h3>
                <div className="space-y-3">
                  {data.referrals.map((ref) => (
                    <div key={ref.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">Referral #{ref.id.slice(-6)}</p>
                        <p className="text-xs text-text-muted">
                          {new Date(ref.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          ref.status === "COMPLETED" 
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}>
                          {ref.status}
                        </span>
                        {ref.rewardAmount && (
                          <p className="text-sm text-green-600 mt-1">+KES {ref.rewardAmount}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Section>
  );
}
