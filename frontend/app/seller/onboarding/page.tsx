"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/lib/hooks/useToast";
import {
  Store,
  Upload,
  FileText,
  Wallet,
  Package,
  Truck,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  ImageIcon,
  Shield,
  PartyPopper,
  Camera,
  X,
} from "lucide-react";

interface OnboardingStep {
  key: string;
  label: string;
  completed: boolean;
}

const STEP_META = [
  { key: "logo", title: "Store Branding", desc: "Upload your logo and add a description to build trust", icon: Store },
  { key: "description", title: "Store Description", desc: "Tell customers what makes your store special", icon: FileText },
  { key: "payout", title: "Payout Setup", desc: "Set up how you want to receive your earnings", icon: Wallet },
  { key: "product", title: "First Product", desc: "List your first product to start selling", icon: Package },
  { key: "kyc", title: "Verification", desc: "Upload your National ID to get verified", icon: Shield },
];

export default function SellerOnboarding() {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Step-specific state
  const [logo, setLogo] = useState("");
  const [description, setDescription] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("MOBILE_MONEY");
  const [payoutPhone, setPayoutPhone] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [idDocument, setIdDocument] = useState("");

  // Product form
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productImages, setProductImages] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const [statusData, profileData] = await Promise.all([
        apiFetch("/api/seller/onboarding-status"),
        apiFetch("/api/seller/profile"),
      ]);
      setSteps(statusData.steps || []);
      setProgress(statusData.progress || 0);
      setIsComplete(statusData.isComplete || false);

      const seller = profileData.seller || profileData;
      setLogo(seller.logo || "");
      setDescription(seller.description || "");
      setPayoutMethod(seller.payoutMethod || "MOBILE_MONEY");
      setPayoutPhone(seller.payoutPhone || "");
      setBankName(seller.bankName || "");
      setBankAccount(seller.bankAccount || "");
      setIdDocument(seller.idDocument || "");

      // Jump to first incomplete step
      const firstIncomplete = (statusData.steps || []).findIndex((s: OnboardingStep) => !s.completed);
      if (firstIncomplete >= 0) setCurrentStep(firstIncomplete);
    } catch {
      showToast("Failed to load onboarding status", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleUploadImage = async (file: File, type: "logo" | "product" | "document") => {
    setUploading(true);
    try {
      const formData = new FormData();
      const fieldName = type === "document" ? "documents" : "images";
      formData.append(fieldName, file);
      const endpoint = type === "document" ? "/api/seller/upload-documents" : "/api/seller/upload-images";
      const data = await apiFetch(endpoint, { method: "POST", body: formData });
      const urls = data.urls || data.files?.map((f: { url: string }) => f.url) || [];
      if (urls.length > 0) {
        if (type === "logo") {
          setLogo(urls[0]);
          await apiFetch("/api/seller/profile", {
            method: "PUT",
            body: JSON.stringify({ logo: urls[0] }),
          });
          showToast("Logo uploaded!", "success");
        } else if (type === "product") {
          setProductImages((prev) => [...prev, ...urls]);
        } else {
          setIdDocument(urls[0]);
          await apiFetch("/api/seller/profile", {
            method: "PUT",
            body: JSON.stringify({ idDocument: urls[0] }),
          });
          showToast("Document uploaded!", "success");
        }
        await refreshSteps();
      }
    } catch {
      showToast("Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  const refreshSteps = async () => {
    try {
      const data = await apiFetch("/api/seller/onboarding-status");
      setSteps(data.steps || []);
      setProgress(data.progress || 0);
      setIsComplete(data.isComplete || false);
    } catch {}
  };

  const saveDescription = async () => {
    if (description.length < 20) {
      showToast("Description must be at least 20 characters", "error");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/seller/profile", {
        method: "PUT",
        body: JSON.stringify({ description }),
      });
      showToast("Description saved!", "success");
      await refreshSteps();
    } catch {
      showToast("Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const savePayout = async () => {
    if (payoutMethod === "MOBILE_MONEY" && !payoutPhone) {
      showToast("Enter your mobile money number", "error");
      return;
    }
    if (payoutMethod === "BANK_TRANSFER" && (!bankName || !bankAccount)) {
      showToast("Enter bank details", "error");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/seller/profile", {
        method: "PUT",
        body: JSON.stringify({ payoutMethod, payoutPhone, bankName, bankAccount }),
      });
      showToast("Payout method saved!", "success");
      await refreshSteps();
    } catch {
      showToast("Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const createProduct = async () => {
    if (!productName || !productPrice) {
      showToast("Name and price are required", "error");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/seller/products", {
        method: "POST",
        body: JSON.stringify({
          name: productName,
          price: parseFloat(productPrice),
          description: productDescription,
          images: productImages,
          status: "DRAFT",
        }),
      });
      showToast("Product created! You can edit it later from Products.", "success");
      await refreshSteps();
    } catch (err: any) {
      showToast(err.message || "Failed to create product", "error");
    } finally {
      setSaving(false);
    }
  };

  const goNext = () => {
    if (currentStep < STEP_META.length - 1) setCurrentStep((s) => s + 1);
  };
  const goPrev = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading onboarding...</p>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <PartyPopper className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">You&apos;re All Set!</h1>
        <p className="text-gray-600 mb-8">
          Your store is fully set up. Start managing your products, orders, and earnings from the dashboard.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => router.push("/seller")}
            className="px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors"
          >
            Go to Dashboard
          </button>
          <button
            onClick={() => router.push("/seller/products")}
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
          >
            Manage Products
          </button>
        </div>
      </div>
    );
  }

  const stepMeta = STEP_META[currentStep];
  const stepStatus = steps[currentStep];
  const StepIcon = stepMeta.icon;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Set Up Your Store</h1>
        <p className="text-gray-500 text-sm">Complete these steps to start selling</p>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">{progress}% complete</span>
          <span className="text-xs text-gray-500">
            {steps.filter((s) => s.completed).length} of {steps.length} steps
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-2">
        {STEP_META.map((meta, i) => {
          const done = steps[i]?.completed;
          const active = i === currentStep;
          return (
            <button
              key={meta.key}
              onClick={() => setCurrentStep(i)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                active
                  ? "bg-primary text-white shadow-sm"
                  : done
                  ? "bg-green-50 text-green-700"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {done && !active ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <span className="w-4 h-4 rounded-full border-2 flex items-center justify-center text-[10px] font-bold border-current">
                  {i + 1}
                </span>
              )}
              {meta.title}
            </button>
          );
        })}
      </div>

      {/* Step content card */}
      <div className="bg-white rounded-2xl border shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            stepStatus?.completed ? "bg-green-50" : "bg-primary/10"
          }`}>
            {stepStatus?.completed ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <StepIcon className="w-5 h-5 text-primary" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{stepMeta.title}</h2>
            <p className="text-sm text-gray-500">{stepMeta.desc}</p>
          </div>
          {stepStatus?.completed && (
            <span className="ml-auto px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full">
              Completed
            </span>
          )}
        </div>

        {/* Step 1: Logo */}
        {currentStep === 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-6">
              <div className="relative group">
                {logo ? (
                  <Image
                    src={logo}
                    alt="Store logo"
                    width={96}
                    height={96}
                    className="rounded-xl object-cover border-2 border-gray-100"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-xl bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300">
                    <ImageIcon className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  {uploading ? (
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  ) : (
                    <Camera className="w-6 h-6 text-white" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadImage(file, "logo");
                    }}
                  />
                </label>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700 mb-1">Store Logo</p>
                <p className="text-xs text-gray-500 mb-3">
                  Upload a square image (recommended 200x200px). This appears on your storefront and product listings.
                </p>
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors cursor-pointer">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? "Uploading..." : "Choose File"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadImage(file, "logo");
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Description */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Store Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                placeholder="Describe your store, what products you sell, and what makes you unique..."
              />
              <div className="flex justify-between mt-1">
                <p className="text-xs text-gray-400">Minimum 20 characters</p>
                <p className={`text-xs ${description.length >= 20 ? "text-green-600" : "text-gray-400"}`}>
                  {description.length} characters
                </p>
              </div>
            </div>
            <button
              onClick={saveDescription}
              disabled={saving || description.length < 20}
              className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save Description"}
            </button>
          </div>
        )}

        {/* Step 3: Payout */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payout Method</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPayoutMethod("MOBILE_MONEY")}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    payoutMethod === "MOBILE_MONEY"
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900">Mobile Money</p>
                  <p className="text-xs text-gray-500 mt-1">MTN, Airtel</p>
                </button>
                <button
                  onClick={() => setPayoutMethod("BANK_TRANSFER")}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    payoutMethod === "BANK_TRANSFER"
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900">Bank Transfer</p>
                  <p className="text-xs text-gray-500 mt-1">Local bank account</p>
                </button>
              </div>
            </div>
            {payoutMethod === "MOBILE_MONEY" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Money Number</label>
                <input
                  type="text"
                  value={payoutPhone}
                  onChange={(e) => setPayoutPhone(e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="+256 7XX XXX XXX"
                />
              </div>
            )}
            {payoutMethod === "BANK_TRANSFER" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="e.g., Stanbic Bank"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                  <input
                    type="text"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Account number"
                  />
                </div>
              </div>
            )}
            <button
              onClick={savePayout}
              disabled={saving}
              className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save Payout Method"}
            </button>
          </div>
        )}

        {/* Step 4: First Product */}
        {currentStep === 3 && (
          <div className="space-y-4">
            {stepStatus?.completed ? (
              <div className="text-center py-4">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-gray-600">You already have products listed!</p>
                <button
                  onClick={() => router.push("/seller/products")}
                  className="mt-3 text-sm text-primary hover:underline"
                >
                  Manage Products
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 bg-blue-50 rounded-lg p-3">
                  Create a quick draft product. You can add more details and images later from the Products page.
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                  <input
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="e.g., Premium Massage Oil"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (UGX) *</label>
                  <input
                    type="number"
                    value={productPrice}
                    onChange={(e) => setProductPrice(e.target.value)}
                    className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="25000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={productDescription}
                    onChange={(e) => setProductDescription(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                    placeholder="Describe your product..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Images</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {productImages.map((img, i) => (
                      <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border">
                        <Image src={img} alt="" fill className="object-cover" />
                        <button
                          onClick={() => setProductImages((prev) => prev.filter((_, j) => j !== i))}
                          className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                    <label className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                      {uploading ? (
                        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                      ) : (
                        <Upload className="w-5 h-5 text-gray-400" />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadImage(file, "product");
                        }}
                      />
                    </label>
                  </div>
                </div>
                <button
                  onClick={createProduct}
                  disabled={saving || !productName || !productPrice}
                  className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Creating..." : "Create Draft Product"}
                </button>
              </>
            )}
          </div>
        )}

        {/* Step 5: KYC / Verification */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800">
                Upload a clear photo of your National ID (front side). This is required for seller verification and to process payouts.
              </p>
            </div>
            {idDocument ? (
              <div className="flex items-center gap-4 p-4 bg-green-50 rounded-xl">
                <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-800">Document uploaded</p>
                  <p className="text-xs text-green-600">Your ID is under review</p>
                </div>
                <label className="px-3 py-1.5 bg-white border rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors">
                  Replace
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadImage(file, "document");
                    }}
                  />
                </label>
              </div>
            ) : (
              <label className="block p-8 border-2 border-dashed border-gray-300 rounded-xl text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all">
                {uploading ? (
                  <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
                ) : (
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                )}
                <p className="text-sm font-medium text-gray-700">
                  {uploading ? "Uploading..." : "Click to upload National ID"}
                </p>
                <p className="text-xs text-gray-500 mt-1">JPG, PNG or PDF, max 5MB</p>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadImage(file, "document");
                  }}
                />
              </label>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={currentStep === 0}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>
        <button
          onClick={() => router.push("/seller")}
          className="text-sm text-gray-500 hover:text-primary transition-colors"
        >
          Skip for now
        </button>
        {currentStep < STEP_META.length - 1 ? (
          <button
            onClick={goNext}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => router.push("/seller")}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Finish Setup
            <CheckCircle2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
