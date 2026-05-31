"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { Settings, Save, AlertTriangle, CheckCircle2, Upload, Loader2, X as XIcon, ImageIcon, FileText, Shield, ShieldCheck, ChevronDown, ChevronUp, Phone, Globe, Clock } from "lucide-react";
import { useToast } from "@/lib/hooks/useToast";

interface SocialLinks {
  whatsapp?: string;
  instagram?: string;
  facebook?: string;
  twitter?: string;
  tiktok?: string;
}

interface OperatingHour {
  open: string;
  close: string;
  closed: boolean;
}

interface NotificationPrefs {
  email: boolean;
  sms: boolean;
  push: boolean;
  orderUpdates: boolean;
  messages: boolean;
}

interface SellerProfile {
  storeName: string;
  description: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  city: string;
  country: string;
  logo: string;
  banner: string;
  payoutMethod: string;
  payoutPhone: string;
  bankName: string;
  bankAccount: string;
  bankBranch: string;
  idDocument: string;
  businessLicense: string;
  socialLinks: SocialLinks;
  operatingHours: Record<string, OperatingHour>;
  shippingPolicy: string;
  returnPolicy: string;
  notificationPrefs: NotificationPrefs;
}

const COUNTRIES = [
  { code: "UG", name: "Uganda" },
  { code: "KE", name: "Kenya" },
  { code: "TZ", name: "Tanzania" },
  { code: "RW", name: "Rwanda" },
  { code: "NG", name: "Nigeria" },
  { code: "GH", name: "Ghana" },
  { code: "ZA", name: "South Africa" },
  { code: "ET", name: "Ethiopia" },
  { code: "CD", name: "DR Congo" },
  { code: "SN", name: "Senegal" },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const defaultHours: Record<string, OperatingHour> = Object.fromEntries(
  DAYS.map((d) => [d, { open: "08:00", close: "18:00", closed: d === "Sunday" }])
);

const emptyProfile: SellerProfile = {
  storeName: "",
  description: "",
  phone: "",
  email: "",
  website: "",
  address: "",
  city: "",
  country: "UG",
  logo: "",
  banner: "",
  payoutMethod: "MOBILE_MONEY",
  payoutPhone: "",
  bankName: "",
  bankAccount: "",
  bankBranch: "",
  idDocument: "",
  businessLicense: "",
  socialLinks: {},
  operatingHours: defaultHours,
  shippingPolicy: "",
  returnPolicy: "",
  notificationPrefs: { email: true, sms: false, push: true, orderUpdates: true, messages: true },
};

export default function SellerSettings() {
  const [form, setForm] = useState<SellerProfile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingIdDoc, setUploadingIdDoc] = useState(false);
  const [uploadingBizLicense, setUploadingBizLicense] = useState(false);
  const [sellerStatus, setSellerStatus] = useState<string>("");
  const { showToast } = useToast();

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch("/api/seller/profile");
      const seller = data.seller || data;
      setForm({
        storeName: seller.storeName || "",
        description: seller.description || "",
        phone: seller.phone || data.phone || "",
        email: seller.email || data.email || "",
        website: seller.website || "",
        address: seller.address || "",
        city: seller.city || "",
        country: seller.country || "UG",
        logo: seller.logo || "",
        banner: seller.banner || "",
        payoutMethod: seller.payoutMethod || "MOBILE_MONEY",
        payoutPhone: seller.payoutPhone || "",
        bankName: seller.bankName || "",
        bankAccount: seller.bankAccount || "",
        bankBranch: seller.bankBranch || "",
        idDocument: seller.idDocument || "",
        businessLicense: seller.businessLicense || "",
        socialLinks: seller.socialLinks || {},
        operatingHours: seller.operatingHours || defaultHours,
        shippingPolicy: seller.shippingPolicy || "",
        returnPolicy: seller.returnPolicy || "",
        notificationPrefs: seller.notificationPrefs || { email: true, sms: false, push: true, orderUpdates: true, messages: true },
      });
      setSellerStatus(seller.status || "");
    } catch (err: any) {
      setError(err.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await apiFetch("/api/seller/profile", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      showToast("Settings saved successfully!", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof SellerProfile, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (
    files: FileList | null,
    field: "logo" | "banner",
    setUploading: (v: boolean) => void
  ) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("images", files[0]);
      const data = await apiFetch("/api/seller/upload-images", {
        method: "POST",
        body: formData,
      });
      if (data.urls?.[0]) {
        updateField(field, data.urls[0]);
        showToast(`${field === "logo" ? "Logo" : "Banner"} uploaded!`, "success");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to upload image", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDocumentUpload = async (
    files: FileList | null,
    field: "idDocument" | "businessLicense",
    setUploading: (v: boolean) => void
  ) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("documents", files[0]);
      const data = await apiFetch("/api/seller/upload-documents", {
        method: "POST",
        body: formData,
      });
      if (data.urls?.[0]) {
        updateField(field, data.urls[0]);
        showToast(`${field === "idDocument" ? "National ID" : "Business License"} uploaded!`, "success");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to upload document", "error");
    } finally {
      setUploading(false);
    }
  };

  const isPdf = (url: string) => url.toLowerCase().endsWith(".pdf");

  const getDocStatusBadge = () => {
    if (!form.idDocument) return null;
    if (sellerStatus === "APPROVED") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
          <ShieldCheck className="w-3 h-3" /> Verified
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
        <Shield className="w-3 h-3" /> Pending Review
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-xl font-bold text-gray-900">Store Settings</h2>

      {/* Store Information */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Store Information</h3>
          <p className="text-sm text-gray-500 mt-1">
            Basic information about your store
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Store Name</label>
            <input
              type="text"
              value={form.storeName}
              onChange={(e) => updateField("storeName", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Your store name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              placeholder="Describe your store"
            />
          </div>
          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Store Logo</label>
            {form.logo ? (
              <div className="flex items-center gap-3 mb-2">
                <img
                  src={form.logo.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || ""}${form.logo}` : form.logo}
                  alt="Logo"
                  className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => updateField("logo", "")}
                  className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                >
                  <XIcon className="w-3 h-3" /> Remove
                </button>
              </div>
            ) : null}
            <label
              className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                uploadingLogo ? "border-primary/40 bg-primary/5" : "border-gray-300 hover:border-primary/60 hover:bg-gray-50"
              }`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleImageUpload(e.dataTransfer.files, "logo", setUploadingLogo); }}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={(e) => handleImageUpload(e.target.files, "logo", setUploadingLogo)}
                disabled={uploadingLogo}
              />
              {uploadingLogo ? (
                <div className="flex items-center gap-2 text-primary">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Uploading...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-gray-500">
                  <Upload className="w-5 h-5" />
                  <span className="text-xs">Click or drag logo image</span>
                </div>
              )}
            </label>
          </div>

          {/* Banner Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Store Banner</label>
            {form.banner ? (
              <div className="relative mb-2">
                <img
                  src={form.banner.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || ""}${form.banner}` : form.banner}
                  alt="Banner"
                  className="w-full h-24 object-cover rounded-lg border border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => updateField("banner", "")}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                >
                  <XIcon className="w-3 h-3" />
                </button>
              </div>
            ) : null}
            <label
              className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                uploadingBanner ? "border-primary/40 bg-primary/5" : "border-gray-300 hover:border-primary/60 hover:bg-gray-50"
              }`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleImageUpload(e.dataTransfer.files, "banner", setUploadingBanner); }}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={(e) => handleImageUpload(e.target.files, "banner", setUploadingBanner)}
                disabled={uploadingBanner}
              />
              {uploadingBanner ? (
                <div className="flex items-center gap-2 text-primary">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Uploading...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-gray-500">
                  <ImageIcon className="w-5 h-5" />
                  <span className="text-xs">Click or drag banner image</span>
                </div>
              )}
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="+256..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="store@example.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
            <input
              type="text"
              value={form.website}
              onChange={(e) => updateField("website", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="https://yourstore.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Street address"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => updateField("city", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="City"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <select
                value={form.country}
                onChange={(e) => updateField("country", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Verification Documents */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Verification Documents</h3>
              <p className="text-sm text-gray-500 mt-1">
                Upload your KYC documents for seller verification
              </p>
            </div>
            {getDocStatusBadge()}
          </div>
        </div>
        <div className="p-6 space-y-5">
          {/* National ID (Required) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              National ID <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-400 mb-2">Upload a clear photo or scan of your National ID</p>
            {form.idDocument ? (
              <div className="flex items-center gap-3 mb-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                {isPdf(form.idDocument) ? (
                  <FileText className="w-10 h-10 text-red-500 flex-shrink-0" />
                ) : (
                  <img
                    src={form.idDocument.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || ""}${form.idDocument}` : form.idDocument}
                    alt="National ID"
                    className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">
                    {isPdf(form.idDocument) ? "National ID (PDF)" : "National ID (Image)"}
                  </p>
                  <a
                    href={form.idDocument.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || ""}${form.idDocument}` : form.idDocument}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    View document
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => updateField("idDocument", "")}
                  className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 flex-shrink-0"
                >
                  <XIcon className="w-3 h-3" /> Remove
                </button>
              </div>
            ) : null}
            <label
              className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                uploadingIdDoc ? "border-primary/40 bg-primary/5" : "border-gray-300 hover:border-primary/60 hover:bg-gray-50"
              }`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleDocumentUpload(e.dataTransfer.files, "idDocument", setUploadingIdDoc); }}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => handleDocumentUpload(e.target.files, "idDocument", setUploadingIdDoc)}
                disabled={uploadingIdDoc}
              />
              {uploadingIdDoc ? (
                <div className="flex items-center gap-2 text-primary">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Uploading...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-gray-500">
                  <Upload className="w-5 h-5" />
                  <span className="text-xs">Click or drag to upload (JPEG, PNG, WebP, or PDF)</span>
                </div>
              )}
            </label>
          </div>

          {/* Business License (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Business License <span className="text-gray-400 text-xs font-normal">(Optional)</span>
            </label>
            <p className="text-xs text-gray-400 mb-2">Upload your business registration or trade license if available</p>
            {form.businessLicense ? (
              <div className="flex items-center gap-3 mb-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                {isPdf(form.businessLicense) ? (
                  <FileText className="w-10 h-10 text-red-500 flex-shrink-0" />
                ) : (
                  <img
                    src={form.businessLicense.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || ""}${form.businessLicense}` : form.businessLicense}
                    alt="Business License"
                    className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">
                    {isPdf(form.businessLicense) ? "Business License (PDF)" : "Business License (Image)"}
                  </p>
                  <a
                    href={form.businessLicense.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || ""}${form.businessLicense}` : form.businessLicense}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    View document
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => updateField("businessLicense", "")}
                  className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 flex-shrink-0"
                >
                  <XIcon className="w-3 h-3" /> Remove
                </button>
              </div>
            ) : null}
            <label
              className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                uploadingBizLicense ? "border-primary/40 bg-primary/5" : "border-gray-300 hover:border-primary/60 hover:bg-gray-50"
              }`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleDocumentUpload(e.dataTransfer.files, "businessLicense", setUploadingBizLicense); }}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => handleDocumentUpload(e.target.files, "businessLicense", setUploadingBizLicense)}
                disabled={uploadingBizLicense}
              />
              {uploadingBizLicense ? (
                <div className="flex items-center gap-2 text-primary">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Uploading...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-gray-500">
                  <Upload className="w-5 h-5" />
                  <span className="text-xs">Click or drag to upload (JPEG, PNG, WebP, or PDF)</span>
                </div>
              )}
            </label>
          </div>
        </div>
      </div>

      {/* Payout Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Payout Settings</h3>
          <p className="text-sm text-gray-500 mt-1">
            How you want to receive your earnings
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payout Method</label>
            <select
              value={form.payoutMethod}
              onChange={(e) => updateField("payoutMethod", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              <option value="MOBILE_MONEY">Mobile Money</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="FLUTTERWAVE">Flutterwave</option>
            </select>
          </div>
          {(form.payoutMethod === "MOBILE_MONEY" || form.payoutMethod === "FLUTTERWAVE") && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {form.payoutMethod === "FLUTTERWAVE" ? "Flutterwave Phone / Email" : "Mobile Money Number"}
              </label>
              <input
                type="text"
                value={form.payoutPhone}
                onChange={(e) => updateField("payoutPhone", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder={form.payoutMethod === "FLUTTERWAVE" ? "Phone or email" : "+256..."}
              />
            </div>
          )}
          {form.payoutMethod === "BANK_TRANSFER" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={form.bankName}
                    onChange={(e) => updateField("bankName", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Bank name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                  <input
                    type="text"
                    value={form.bankAccount}
                    onChange={(e) => updateField("bankAccount", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Account number"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Branch</label>
                <input
                  type="text"
                  value={form.bankBranch}
                  onChange={(e) => updateField("bankBranch", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Branch name"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Social Media */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Social Media</h3>
          <p className="text-sm text-gray-500 mt-1">Connect your social profiles</p>
        </div>
        <div className="p-6 space-y-4">
          {([
            { key: "whatsapp", label: "WhatsApp", placeholder: "+256700000000" },
            { key: "instagram", label: "Instagram", placeholder: "@yourstore" },
            { key: "facebook", label: "Facebook", placeholder: "facebook.com/yourstore" },
            { key: "twitter", label: "Twitter / X", placeholder: "@yourstore" },
            { key: "tiktok", label: "TikTok", placeholder: "@yourstore" },
          ] as const).map((s) => (
            <div key={s.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{s.label}</label>
              <input
                type="text"
                value={(form.socialLinks as any)?.[s.key] || ""}
                onChange={(e) => setForm((prev) => ({
                  ...prev,
                  socialLinks: { ...prev.socialLinks, [s.key]: e.target.value },
                }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder={s.placeholder}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Business Hours */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Business Hours</h3>
          <p className="text-sm text-gray-500 mt-1">Set your operating hours</p>
        </div>
        <div className="p-6 space-y-3">
          {DAYS.map((day) => {
            const hours = form.operatingHours?.[day] || { open: "08:00", close: "18:00", closed: false };
            return (
              <div key={day} className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 w-24">{day}</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!hours.closed}
                    onChange={(e) => setForm((prev) => ({
                      ...prev,
                      operatingHours: {
                        ...prev.operatingHours,
                        [day]: { ...hours, closed: !e.target.checked },
                      },
                    }))}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-xs text-gray-500">Open</span>
                </label>
                {!hours.closed && (
                  <>
                    <input
                      type="time"
                      value={hours.open}
                      onChange={(e) => setForm((prev) => ({
                        ...prev,
                        operatingHours: {
                          ...prev.operatingHours,
                          [day]: { ...hours, open: e.target.value },
                        },
                      }))}
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <span className="text-gray-400 text-sm">to</span>
                    <input
                      type="time"
                      value={hours.close}
                      onChange={(e) => setForm((prev) => ({
                        ...prev,
                        operatingHours: {
                          ...prev.operatingHours,
                          [day]: { ...hours, close: e.target.value },
                        },
                      }))}
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </>
                )}
                {hours.closed && <span className="text-xs text-gray-400 italic">Closed</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Store Policies */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Store Policies</h3>
          <p className="text-sm text-gray-500 mt-1">Set your shipping and return policies</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Policy</label>
            <textarea
              value={form.shippingPolicy}
              onChange={(e) => updateField("shippingPolicy", e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              placeholder="Describe your shipping policy, delivery timeframes, etc."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Return Policy</label>
            <textarea
              value={form.returnPolicy}
              onChange={(e) => updateField("returnPolicy", e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              placeholder="Describe your return and refund policy..."
            />
          </div>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Notification Preferences</h3>
          <p className="text-sm text-gray-500 mt-1">Choose how you want to be notified</p>
        </div>
        <div className="p-6 space-y-4">
          {([
            { key: "email", label: "Email Notifications" },
            { key: "sms", label: "SMS Notifications" },
            { key: "push", label: "Push Notifications" },
            { key: "orderUpdates", label: "Order Updates" },
            { key: "messages", label: "New Messages" },
          ] as const).map((pref) => (
            <label key={pref.key} className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-gray-700">{pref.label}</span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={!!(form.notificationPrefs as any)?.[pref.key]}
                  onChange={(e) => setForm((prev) => ({
                    ...prev,
                    notificationPrefs: { ...prev.notificationPrefs, [pref.key]: e.target.checked },
                  }))}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:bg-primary transition-colors" />
                <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
