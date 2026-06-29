"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Section from "@/components/Section";
import { useAuth } from "@/lib/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import {
  ArrowLeft,
  Users,
  Heart,
  Shield,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Gift,
  Coins,
  Trash2,
  ExternalLink,
  Plus
} from "lucide-react";
import { useToast } from "@/lib/hooks/useToast";
import { useCurrency } from "@/contexts/CurrencyContext";

interface PartnerInfo {
  email: string;
  name: string | null;
}

interface WishlistItem {
  id: string;
  addedAt: string;
  collectionName: string;
  product: {
    id: string;
    name: string;
    slug: string;
    price: string;
    imageUrl: string | null;
    inStock: boolean;
    currency: string;
  };
}

export default function PartnerPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { showToast } = useToast();
  const { formatPrice } = useCurrency();

  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState<PartnerInfo | null>(null);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPartnerData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data: any = await apiFetch("/api/wishlist/couple");
      if (data.paired) {
        setPartner(data.partner);
        setWishlistItems(data.items || []);
      } else {
        setPartner(null);
        setWishlistItems([]);
      }
    } catch (err) {
      console.error("Failed to load partner details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) {
      loadPartnerData();
    }
  }, [user]);

  const handlePair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    setError(null);
    try {
      const res: any = await apiFetch("/api/wishlist/couple/pair", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      showToast(res.message || "Successfully paired with partner!", "success");
      setEmail("");
      loadPartnerData();
    } catch (err: any) {
      setError(err.message || "Failed to pair accounts. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnpair = async () => {
    if (!confirm("Are you sure you want to unpair from your partner? This will disconnect your shared cart and wishlist access.")) {
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/api/wishlist/couple/unpair", { method: "POST" });
      showToast("Unpaired from partner successfully.", "info");
      loadPartnerData();
    } catch (err: any) {
      showToast(err.message || "Failed to disconnect.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || !user) {
    return (
      <Section>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Section>
    );
  }

  return (
    <Section>
      <div className="max-w-3xl mx-auto">
        <Link href="/account" className="inline-flex items-center gap-2 text-text-muted hover:text-text mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Account
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white shadow-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Partner Connection</h1>
            <p className="text-sm text-text-muted">Link accounts for shared shopping & split checkout payment protection.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : partner ? (
          // Paired state
          <div className="space-y-6">
            <div className="card border-accent bg-accent/5 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-accent text-white font-bold flex items-center justify-center text-lg">
                    {partner.name?.[0] || partner.email[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-accent uppercase tracking-wider">Connected Partner</p>
                    <h3 className="font-bold text-lg">{partner.name || "Special Partner"}</h3>
                    <p className="text-sm text-text-muted">{partner.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleUnpair}
                  disabled={submitting}
                  className="btn btn-secondary border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1.5 self-start sm:self-auto py-2 text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Disconnect
                </button>
              </div>
            </div>

            {/* Shared Cart and Split Payment details */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="card p-4 flex items-start gap-3">
                <div className="p-2 bg-pink-100 dark:bg-pink-950/40 text-pink-600 rounded-lg">
                  <Heart className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Shared Wishlist Access</h4>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    You can view items saved by your partner below, buy them directly as a surprise, or add them to your collaborative cart list.
                  </p>
                </div>
              </div>

              <div className="card p-4 flex items-start gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-950/40 text-purple-600 rounded-lg">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Split Checkout Enabled</h4>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    At checkout, toggle "Split Payment" to automatically charge half the order total to your partner's mobile number.
                  </p>
                </div>
              </div>
            </div>

            {/* Partner's Wishlist Items */}
            <div className="card p-6">
              <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-500 fill-current" />
                Partner&apos;s Saved Items ({wishlistItems.length})
              </h3>

              {wishlistItems.length === 0 ? (
                <div className="text-center py-10 text-text-muted border-2 border-dashed border-border rounded-xl">
                  <Gift className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Your partner hasn&apos;t added any public wishlist items yet.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {wishlistItems.map((item) => (
                    <div key={item.id} className="p-3 border border-border rounded-xl flex gap-3 items-center hover:border-accent/40 transition-colors">
                      <div className="w-14 h-14 bg-gray-100 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                        {item.product.imageUrl ? (
                          <img
                            src={item.product.imageUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Gift className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-semibold truncate text-text">{item.product.name}</h4>
                        <p className="text-xs font-bold text-accent mt-0.5">
                          {formatPrice(Number(item.product.price))}
                        </p>
                        <span className="inline-block text-[9px] text-text-muted mt-1 bg-surface-secondary px-1.5 py-0.5 rounded">
                          {item.collectionName}
                        </span>
                      </div>
                      <Link
                        href={`/products/${item.product.slug}`}
                        className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/5 rounded-lg transition-colors shrink-0"
                        title="View Product"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          // Unpaired Form state
          <div className="space-y-6">
            <div className="card p-6">
              <h3 className="font-bold text-lg mb-2">Connect to a Partner</h3>
              <p className="text-sm text-text-muted mb-6">
                Enter your partner's registered email address below to pair accounts. Once connected, you can share wishlists and split order payments instantly.
              </p>

              <form onSubmit={handlePair} className="space-y-4">
                <div>
                  <label htmlFor="partnerEmail" className="block text-xs font-semibold mb-2">
                    Partner&apos;s Registered Email Address *
                  </label>
                  <input
                    id="partnerEmail"
                    type="email"
                    required
                    placeholder="partner@example.com"
                    className="input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !email}
                  className="btn-primary flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Linking accounts...</>
                  ) : (
                    <><Plus className="w-4 h-4" />Send Link Invitation</>
                  )}
                </button>
              </form>
            </div>

            <div className="bg-surface-secondary dark:bg-gray-800/10 border border-border p-6 rounded-24">
              <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-accent" /> Privacy & Discretion Safe-Guards
              </h4>
              <ul className="text-xs text-text-muted space-y-2.5 leading-relaxed">
                <li>
                  🔒 <strong>Surprise Mode:</strong> Wishlist items bought by your partner are hidden from your notifications to keep gift surprises intact.
                </li>
                <li>
                  🛠️ <strong>One-Click Revoke:</strong> Either partner can unpair at any time from their settings page instantly, revoking all shared access.
                </li>
                <li>
                  🛡️ <strong>Neutral Statements:</strong> Discretion settings (like receipt masking) remain private to each individual account.
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
