"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Section from "@/components/Section";
import { useAuth } from "@/lib/hooks/useAuth";
import { ArrowLeft, Award, Gift, TrendingUp, Star } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";

interface LoyaltyAccount {
  id: string;
  points: number;
  tier: string;
  lifetimePoints: number;
  transactions: Array<{
    id: string;
    type: string;
    points: number;
    description: string;
    createdAt: string;
  }>;
}

const tierConfig: Record<string, { color: string; minPoints: number; perks: string[] }> = {
  BRONZE: { 
    color: "from-amber-600 to-amber-800", 
    minPoints: 0,
    perks: ["Earn 1 point per USh 100 spent", "Birthday bonus points"]
  },
  SILVER: { 
    color: "from-gray-400 to-gray-600", 
    minPoints: 1000,
    perks: ["1.5x points earning", "Early access to sales", "Free shipping over USh 100,000"]
  },
  GOLD: { 
    color: "from-yellow-400 to-yellow-600", 
    minPoints: 5000,
    perks: ["2x points earning", "Exclusive offers", "Free shipping on all orders", "Priority support"]
  },
  PLATINUM: { 
    color: "from-purple-400 to-purple-600", 
    minPoints: 15000,
    perks: ["3x points earning", "VIP events access", "Free express shipping", "Personal shopper"]
  },
};

export default function LoyaltyPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { formatPrice } = useCurrency();
  const [account, setAccount] = useState<LoyaltyAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) {
      fetchLoyalty();
    }
  }, [user]);

  const fetchLoyalty = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/loyalty`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setAccount({ ...data.account, transactions: data.transactions || [] });
      }
    } catch (error) {
      console.error("Failed to fetch loyalty:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async (points: number) => {
    if (!account || account.points < points) return;
    
    setRedeeming(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/loyalty/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ points }),
      });
      
      if (res.ok) {
        const data = await res.json();
        alert(`Success! Your coupon code is: ${data.couponCode}\nDiscount: ${data.discount} ${data.currency}`);
        fetchLoyalty();
      }
    } catch (error) {
      console.error("Redeem error:", error);
    } finally {
      setRedeeming(false);
    }
  };

  if (isLoading || !user) {
    return (
      <Section>
        <div className="text-center py-16">Loading...</div>
      </Section>
    );
  }

  const tier = account ? tierConfig[account.tier] || tierConfig.BRONZE : tierConfig.BRONZE;
  const nextTier = account?.tier === "PLATINUM" ? null : 
    Object.entries(tierConfig).find(([, config]) => config.minPoints > (account?.lifetimePoints || 0))?.[0];
  const pointsToNextTier = nextTier ? tierConfig[nextTier].minPoints - (account?.lifetimePoints || 0) : 0;

  return (
    <Section>
      <div className="max-w-3xl mx-auto">
        <Link href="/account" className="inline-flex items-center gap-2 text-text-muted hover:text-text mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Account
        </Link>

        <h1 className="text-2xl font-semibold mb-8">Loyalty Points</h1>

        {loading ? (
          <div className="text-center py-16">Loading...</div>
        ) : !account ? (
          <div className="card text-center py-16">
            <Award className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Join Our Loyalty Program</h3>
            <p className="text-text-muted mb-6">
              Start earning points on every purchase!
            </p>
            <button 
              onClick={fetchLoyalty}
              className="btn btn-primary"
            >
              Activate Loyalty Account
            </button>
          </div>
        ) : (
          <>
            {/* Points Card */}
            <div className={`bg-gradient-to-br ${tier.color} text-white rounded-24 p-8 mb-8`}>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-sm opacity-80 mb-1">{account.tier} Member</p>
                  <h2 className="text-4xl font-bold">{account.points.toLocaleString()}</h2>
                  <p className="text-sm opacity-80">Available Points</p>
                </div>
                <Award className="w-12 h-12 opacity-80" />
              </div>
              
              {nextTier && (
                <div className="bg-white/20 rounded-full p-1 mb-4">
                  <div 
                    className="bg-white/80 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, ((account.lifetimePoints) / tierConfig[nextTier].minPoints) * 100)}%` }}
                  />
                </div>
              )}
              
              <p className="text-sm opacity-80">
                {nextTier 
                  ? `${pointsToNextTier.toLocaleString()} points to ${nextTier}`
                  : "You've reached the highest tier! 🎉"
                }
              </p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="card text-center">
                <TrendingUp className="w-6 h-6 text-green-600 mx-auto mb-2" />
                <p className="text-xl font-bold">{(account.lifetimePoints || 0).toLocaleString()}</p>
                <p className="text-xs text-text-muted">Total Earned</p>
              </div>
              <div className="card text-center">
                <Gift className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                <p className="text-xl font-bold">{account.transactions.filter(t => t.points < 0).reduce((s, t) => s + Math.abs(t.points), 0).toLocaleString()}</p>
                <p className="text-xs text-text-muted">Redeemed</p>
              </div>
              <div className="card text-center">
                <Star className="w-6 h-6 text-yellow-600 mx-auto mb-2" />
                <p className="text-xl font-bold">{account.tier}</p>
                <p className="text-xs text-text-muted">Your Tier</p>
              </div>
            </div>

            {/* Redeem Options */}
            <div className="card mb-8">
              <h3 className="font-medium mb-4">Redeem Points</h3>
              <p className="text-sm text-text-muted mb-4">100 points = USh 100 discount</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[500, 1000, 2500, 5000].map((points) => (
                  <button
                    key={points}
                    onClick={() => handleRedeem(points)}
                    disabled={redeeming || account.points < points}
                    className={`p-4 rounded-18 border text-center transition-all ${
                      account.points >= points
                        ? "border-accent hover:bg-accent hover:text-white cursor-pointer"
                        : "border-gray-200 text-text-muted cursor-not-allowed opacity-50"
                    }`}
                  >
                    <p className="font-bold">{points.toLocaleString()}</p>
                    <p className="text-xs">= {formatPrice(points)}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Tier Benefits */}
            <div className="card mb-8">
              <h3 className="font-medium mb-4">Your {account.tier} Benefits</h3>
              <ul className="space-y-2">
                {tier.perks.map((perk, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 bg-accent rounded-full" />
                    {perk}
                  </li>
                ))}
              </ul>
            </div>

            {/* Transaction History */}
            {account.transactions.length > 0 && (
              <div className="card">
                <h3 className="font-medium mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  {account.transactions.slice(0, 10).map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">{tx.description}</p>
                        <p className="text-xs text-text-muted">
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`font-medium ${tx.points > 0 ? "text-green-600" : "text-red-600"}`}>
                        {tx.points > 0 ? "+" : ""}{tx.points}
                      </span>
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
