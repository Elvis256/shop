"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Gift, MapPin, CheckCircle, Loader2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface GiftOrder {
  orderNumber: string;
  message: string | null;
  addressSet: boolean;
  status: string;
  items: Array<{ name: string; quantity: number; imageUrl: string | null }>;
}

export default function GiftRecipientPage() {
  const { token } = useParams() as { token: string };
  const [gift, setGift] = useState<GiftOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "", phone: "", street: "", city: "", county: "",
  });

  useEffect(() => {
    fetch(`${API_URL}/api/gift/view/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setGift(d);
      })
      .catch(() => setError("Could not load gift. Please try again."))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/gift/set-address/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save address");
      setSaved(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="text-center">
        <div className="text-5xl mb-4">😕</div>
        <p className="text-gray-600">{error}</p>
      </div>
    </div>
  );

  if (!gift) return null;

  if (saved || gift.addressSet) return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="text-center max-w-sm">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">You're all set!</h1>
        <p className="text-gray-600">Your gift is on its way. We'll send you a WhatsApp when it ships.</p>
        <p className="text-sm text-gray-400 mt-4">Plain packaging — no labels, fully discreet 🔒</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white px-4 py-12">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Gift className="w-10 h-10 text-pink-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">You received a gift! 🎁</h1>
          {gift.message && (
            <div className="mt-3 bg-white rounded-xl p-4 shadow-sm border border-pink-100 text-left">
              <p className="text-sm text-gray-500 mb-1">Message:</p>
              <p className="text-gray-800 italic">"{gift.message}"</p>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
          <p className="text-sm font-semibold text-gray-500 mb-3">Your gift includes:</p>
          {gift.items.map((item, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0">
              {item.imageUrl
                ? <img src={item.imageUrl} alt={item.name} className="w-12 h-12 object-cover rounded-lg" />
                : <div className="w-12 h-12 bg-pink-50 rounded-lg flex items-center justify-center text-xl">🎀</div>
              }
              <div>
                <p className="text-sm font-medium text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
              </div>
            </div>
          ))}
          <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
            🔒 Delivered in plain packaging — no logos or product names visible
          </p>
        </div>

        {/* Address form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-primary" />
            <p className="font-semibold text-gray-900">Where should we deliver?</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {[
              { key: "name", label: "Your Name", placeholder: "Full name" },
              { key: "phone", label: "Phone Number", placeholder: "07XX XXX XXX" },
              { key: "street", label: "Street / Area", placeholder: "e.g. Ntinda, near Shell" },
              { key: "city", label: "City / Town", placeholder: "e.g. Kampala" },
              { key: "county", label: "District (optional)", placeholder: "e.g. Wakiso" },
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-sm text-gray-600 mb-1">{field.label}</label>
                <input
                  type={field.key === "phone" ? "tel" : "text"}
                  required={field.key !== "county"}
                  placeholder={field.placeholder}
                  value={form[field.key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
                />
              </div>
            ))}

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-lg py-3 font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Confirm Delivery Address"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
