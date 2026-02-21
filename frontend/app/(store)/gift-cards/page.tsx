"use client";

import { useState } from "react";
import Link from "next/link";
import Section from "@/components/Section";
import { Gift, Mail, CreditCard, CheckCircle, Loader2, Sparkles } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const GIFT_CARD_AMOUNTS = [
  { value: 50000, label: "UGX 50,000" },
  { value: 100000, label: "UGX 100,000" },
  { value: 200000, label: "UGX 200,000" },
  { value: 500000, label: "UGX 500,000" },
  { value: 1000000, label: "UGX 1,000,000" },
];

export default function GiftCardsPage() {
  const [step, setStep] = useState<"select" | "details" | "payment" | "success">("select");
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [giftCardCode, setGiftCardCode] = useState("");
  
  const [formData, setFormData] = useState({
    purchaserName: "",
    purchaserEmail: "",
    recipientName: "",
    recipientEmail: "",
    message: "",
    sendToRecipient: true,
  });

  const [checkCode, setCheckCode] = useState("");
  const [checkResult, setCheckResult] = useState<{
    code: string;
    balance: number;
    currency: string;
    expiresAt: string;
  } | null>(null);
  const [checkError, setCheckError] = useState("");

  const handleCheckBalance = async () => {
    if (!checkCode.trim()) return;
    
    setCheckError("");
    setCheckResult(null);
    
    try {
      const res = await fetch(`${API_URL}/api/gift-cards/check/${checkCode.trim()}`);
      const data = await res.json();
      
      if (res.ok) {
        setCheckResult(data);
      } else {
        setCheckError(data.error || "Gift card not found");
      }
    } catch (error) {
      setCheckError("Failed to check balance");
    }
  };

  const handlePurchase = async () => {
    if (!selectedAmount) return;
    
    setLoading(true);
    
    try {
      const res = await fetch(`${API_URL}/api/gift-cards/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: selectedAmount,
          currency: "UGX",
          ...formData,
        }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setGiftCardCode(data.giftCard.code);
        setStep("success");
      } else {
        alert(data.error || "Purchase failed");
      }
    } catch (error) {
      alert("Failed to purchase gift card");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Hero */}
      <Section className="bg-gradient-to-b from-purple-50 to-pink-50">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-accent to-purple-600 text-white rounded-full mb-6">
            <Gift className="w-10 h-10" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Gift Cards</h1>
          <p className="text-gray-600 text-lg">
            The perfect gift for someone special. Let them choose what they love 
            from our collection of intimate wellness products.
          </p>
        </div>
      </Section>

      <Section>
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Purchase Gift Card */}
          <div>
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-accent" />
              Buy a Gift Card
            </h2>

            {step === "select" && (
              <div className="space-y-6">
                <p className="text-gray-600">Select an amount:</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {GIFT_CARD_AMOUNTS.map((amount) => (
                    <button
                      key={amount.value}
                      onClick={() => setSelectedAmount(amount.value)}
                      className={`p-4 rounded-xl border-2 text-center transition-all ${
                        selectedAmount === amount.value
                          ? "border-accent bg-accent/5"
                          : "border-gray-200 hover:border-accent/50"
                      }`}
                    >
                      <span className="block font-bold text-lg">{amount.label}</span>
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={() => selectedAmount && setStep("details")}
                  disabled={!selectedAmount}
                  className="btn-primary w-full"
                >
                  Continue
                </button>
              </div>
            )}

            {step === "details" && (
              <div className="space-y-6">
                <div className="bg-accent/5 rounded-xl p-4 mb-4">
                  <p className="text-sm text-gray-600">Selected Amount</p>
                  <p className="text-2xl font-bold text-accent">
                    UGX {selectedAmount?.toLocaleString()}
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Your Name</label>
                    <input
                      type="text"
                      value={formData.purchaserName}
                      onChange={(e) => setFormData({ ...formData, purchaserName: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Your Email *</label>
                    <input
                      type="email"
                      value={formData.purchaserEmail}
                      onChange={(e) => setFormData({ ...formData, purchaserEmail: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent"
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-4">Recipient Details</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Recipient Name</label>
                      <input
                        type="text"
                        value={formData.recipientName}
                        onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent"
                        placeholder="Their name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Recipient Email</label>
                      <input
                        type="email"
                        value={formData.recipientEmail}
                        onChange={(e) => setFormData({ ...formData, recipientEmail: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent"
                        placeholder="their@email.com"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Personal Message (Optional)</label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent"
                    placeholder="Add a personal message..."
                  />
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.sendToRecipient}
                    onChange={(e) => setFormData({ ...formData, sendToRecipient: e.target.checked })}
                    className="rounded border-gray-300 text-accent focus:ring-accent"
                  />
                  <span className="text-sm">Send gift card to recipient's email</span>
                </label>

                <div className="flex gap-4">
                  <button onClick={() => setStep("select")} className="btn-secondary">
                    Back
                  </button>
                  <button
                    onClick={handlePurchase}
                    disabled={!formData.purchaserEmail || loading}
                    className="btn-primary flex-1"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </span>
                    ) : (
                      `Purchase Gift Card`
                    )}
                  </button>
                </div>
              </div>
            )}

            {step === "success" && (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold mb-2">Gift Card Created!</h3>
                <p className="text-gray-600 mb-6">
                  {formData.sendToRecipient && formData.recipientEmail
                    ? `The gift card has been sent to ${formData.recipientEmail}`
                    : "Your gift card is ready!"}
                </p>
                
                <div className="bg-gradient-to-r from-accent to-purple-600 text-white rounded-xl p-8 mb-6">
                  <p className="text-sm opacity-80 mb-2">Gift Card Code</p>
                  <p className="text-3xl font-mono font-bold tracking-wider">{giftCardCode}</p>
                  <p className="text-lg mt-4">
                    UGX {selectedAmount?.toLocaleString()}
                  </p>
                </div>

                <button
                  onClick={() => navigator.clipboard.writeText(giftCardCode)}
                  className="btn-secondary mb-4"
                >
                  Copy Code
                </button>
                
                <div>
                  <Link href="/products" className="btn-primary">
                    Continue Shopping
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Check Balance */}
          <div>
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-accent" />
              Check Gift Card Balance
            </h2>

            <div className="bg-gray-50 rounded-xl p-6">
              <p className="text-gray-600 mb-4">
                Enter your gift card code to check the remaining balance.
              </p>
              
              <div className="flex gap-3">
                <input
                  type="text"
                  value={checkCode}
                  onChange={(e) => setCheckCode(e.target.value.toUpperCase())}
                  placeholder="GC-XXXX-XXXX-XXXX-XXXX"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent font-mono"
                />
                <button onClick={handleCheckBalance} className="btn-primary">
                  Check
                </button>
              </div>

              {checkError && (
                <p className="text-red-600 mt-4">{checkError}</p>
              )}

              {checkResult && (
                <div className="mt-6 bg-white rounded-lg p-6 border border-gray-200">
                  <p className="text-sm text-gray-500 mb-1">Current Balance</p>
                  <p className="text-3xl font-bold text-accent">
                    {checkResult.currency} {Number(checkResult.balance).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500 mt-4">
                    Valid until {new Date(checkResult.expiresAt).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>

            {/* How It Works */}
            <div className="mt-8">
              <h3 className="font-semibold mb-4">How It Works</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-accent/10 text-accent rounded-full flex items-center justify-center font-bold">
                    1
                  </div>
                  <div>
                    <h4 className="font-medium">Choose Amount</h4>
                    <p className="text-sm text-gray-600">Select a gift card value</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-accent/10 text-accent rounded-full flex items-center justify-center font-bold">
                    2
                  </div>
                  <div>
                    <h4 className="font-medium">Personalize</h4>
                    <p className="text-sm text-gray-600">Add recipient details and a message</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-accent/10 text-accent rounded-full flex items-center justify-center font-bold">
                    3
                  </div>
                  <div>
                    <h4 className="font-medium">Send Instantly</h4>
                    <p className="text-sm text-gray-600">Gift card is delivered by email</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-accent/10 text-accent rounded-full flex items-center justify-center font-bold">
                    4
                  </div>
                  <div>
                    <h4 className="font-medium">Redeem at Checkout</h4>
                    <p className="text-sm text-gray-600">Enter code during checkout</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Benefits */}
      <Section className="bg-gray-50">
        <div className="grid md:grid-cols-3 gap-8 text-center">
          <div>
            <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Gift className="w-8 h-8 text-accent" />
            </div>
            <h3 className="font-bold mb-2">Perfect Gift</h3>
            <p className="text-gray-600 text-sm">
              Let them choose exactly what they want from our full collection
            </p>
          </div>
          <div>
            <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-accent" />
            </div>
            <h3 className="font-bold mb-2">Instant Delivery</h3>
            <p className="text-gray-600 text-sm">
              Delivered instantly via email - perfect for last-minute gifts
            </p>
          </div>
          <div>
            <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-8 h-8 text-accent" />
            </div>
            <h3 className="font-bold mb-2">Never Expires*</h3>
            <p className="text-gray-600 text-sm">
              Valid for 1 year from purchase date
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
