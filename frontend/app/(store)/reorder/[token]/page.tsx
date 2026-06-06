"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Package, MapPin, CreditCard, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useCurrency } from "@/contexts/CurrencyContext";

interface ReorderDetails {
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    stock: number;
    imageUrl?: string;
  };
  address: string;
  customerName: string;
  currency: string;
  quantity: number;
  inStock: boolean;
}

export default function ReorderPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { formatPrice } = useCurrency();

  const [details, setDetails] = useState<ReorderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("mobile_money");
  const [mobilePhone, setMobilePhone] = useState("");
  const [mobileNetwork, setMobileNetwork] = useState("MTN");

  useEffect(() => {
    apiFetch(`/api/quick-reorder/${token}`)
      .then((data: any) => setDetails(data))
      .catch((err: any) => setError(err.message || "Reorder link expired or invalid"))
      .finally(() => setLoading(false));
  }, [token]);

  const handleConfirm = async () => {
    if (confirming) return;
    setConfirming(true);

    try {
      const result: any = await apiFetch(`/api/quick-reorder/${token}/confirm`, {
        method: "POST",
        body: JSON.stringify({
          paymentMethod,
          mobileNetwork: paymentMethod === "mobile_money" ? mobileNetwork : undefined,
          mobilePhone: paymentMethod === "mobile_money" ? mobilePhone : undefined,
        }),
      });

      if (result.paymentLink) {
        window.location.href = result.paymentLink;
      } else {
        setConfirmed(true);
      }
    } catch (err: any) {
      setError(err.message || "Failed to place order");
    } finally {
      setConfirming(false);
    }
  };

  let parsedAddress: any = {};
  try { parsedAddress = details ? JSON.parse(details.address) : {}; } catch { parsedAddress = { raw: details?.address }; }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error && !details) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link Expired</h1>
          <p className="text-gray-500 mb-6">{error}</p>
          <button onClick={() => router.push("/")} className="btn-primary">
            Browse Products
          </button>
        </div>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Placed!</h1>
          <p className="text-gray-500 mb-6">Your reorder has been confirmed. Pay on delivery.</p>
          <button onClick={() => router.push("/account/orders")} className="btn-primary">
            View Orders
          </button>
        </div>
      </div>
    );
  }

  if (!details) return null;

  const addressDisplay = parsedAddress.street
    ? `${parsedAddress.street}, ${parsedAddress.city || ""}`
    : parsedAddress.raw || details.address;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <Package className="w-10 h-10 mx-auto mb-3 text-black" />
          <h1 className="text-2xl font-bold text-gray-900">Quick Reorder</h1>
          <p className="text-gray-500">Confirm your order in one tap</p>
        </div>

        {/* Product Card */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 mb-4">
          <div className="flex gap-4 items-center">
            {details.product.imageUrl ? (
              <Image
                src={details.product.imageUrl}
                alt={details.product.name}
                width={80}
                height={80}
                className="rounded-xl object-cover"
              />
            ) : (
              <div className="w-20 h-20 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-xs">
                No image
              </div>
            )}
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900">{details.product.name}</h2>
              <p className="text-lg font-bold mt-1">{formatPrice(details.product.price)}</p>
              <p className="text-sm text-gray-500">Qty: {details.quantity}</p>
              {!details.inStock && (
                <p className="text-sm text-red-500 font-medium">Out of stock</p>
              )}
            </div>
          </div>
        </div>

        {/* Saved Address */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 mb-4">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Delivery Address</p>
              <p className="text-sm text-gray-500 mt-1">{addressDisplay}</p>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <CreditCard className="w-5 h-5 text-gray-400" />
            <p className="font-medium text-gray-900">Payment Method</p>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-gray-50">
              <input type="radio" name="payment" value="mobile_money" checked={paymentMethod === "mobile_money"} onChange={(e) => setPaymentMethod(e.target.value)} className="accent-black" />
              <span className="text-sm font-medium">Mobile Money</span>
            </label>

            {paymentMethod === "mobile_money" && (
              <div className="pl-8 space-y-3">
                <select value={mobileNetwork} onChange={(e) => setMobileNetwork(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="MTN">MTN Mobile Money</option>
                  <option value="AIRTEL">Airtel Money</option>
                </select>
                <input
                  type="tel"
                  placeholder="Phone number (e.g. 0771234567)"
                  value={mobilePhone}
                  onChange={(e) => setMobilePhone(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            )}

            <label className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-gray-50">
              <input type="radio" name="payment" value="cod" checked={paymentMethod === "cod"} onChange={(e) => setPaymentMethod(e.target.value)} className="accent-black" />
              <span className="text-sm font-medium">Pay on Delivery</span>
            </label>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl mb-4 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={confirming || !details.inStock || (paymentMethod === "mobile_money" && !mobilePhone)}
          className="w-full py-4 bg-black text-white rounded-2xl font-semibold text-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {confirming ? (
            <><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Processing...</>
          ) : (
            `Confirm & ${paymentMethod === "cod" ? "Order" : "Pay"} — ${formatPrice(details.product.price * details.quantity)}`
          )}
        </button>
      </div>
    </div>
  );
}
