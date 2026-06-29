"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { Settings, Save, AlertTriangle, CheckCircle2, Upload, Loader2, X as XIcon, ImageIcon, FileText, Shield, ShieldCheck, ChevronDown, ChevronUp, Phone, Globe, Clock, Share2, Banknote, FileCheck, Truck, Bell } from "lucide-react";
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
  payoutSchedule: string;
  minPayoutAmount: string;
  nextPayoutDate: string;
  idDocument: string;
  businessLicense: string;
  socialLinks: SocialLinks;
  operatingHours: Record<string, OperatingHour>;
  shippingPolicy: string;
  returnPolicy: string;
  notificationPrefs: NotificationPrefs;
  allowsCustomerPickup: boolean;
  pickupAddress: string;
  pickupCity: string;
  pickupHours: string;
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
  payoutSchedule: "MANUAL",
  minPayoutAmount: "10000",
  nextPayoutDate: "",
  idDocument: "",
  businessLicense: "",
  socialLinks: {},
  operatingHours: defaultHours,
  shippingPolicy: "",
  returnPolicy: "",
  notificationPrefs: { email: true, sms: false, push: true, orderUpdates: true, messages: true },
  allowsCustomerPickup: false,
  pickupAddress: "",
  pickupCity: "",
  pickupHours: "",
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
  const [activeTab, setActiveTab] = useState("store_info");
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
        payoutSchedule: seller.payoutSchedule || "MANUAL",
        minPayoutAmount: seller.minPayoutAmount ? String(seller.minPayoutAmount) : "10000",
        nextPayoutDate: seller.nextPayoutDate || "",
        idDocument: seller.idDocument || "",
        businessLicense: seller.businessLicense || "",
        socialLinks: seller.socialLinks || {},
        operatingHours: seller.operatingHours || defaultHours,
        shippingPolicy: seller.shippingPolicy || "",
        returnPolicy: seller.returnPolicy || "",
        notificationPrefs: seller.notificationPrefs || { email: true, sms: false, push: true, orderUpdates: true, messages: true },
        allowsCustomerPickup: seller.allowsCustomerPickup || false,
        pickupAddress: seller.pickupAddress || "",
        pickupCity: seller.pickupCity || "",
        pickupHours: seller.pickupHours || "",
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
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Store Settings</h2>
          <p className="text-sm text-gray-500 mt-1">Configure your profile, policies, payouts, and notifications.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/95 disabled:opacity-50 transition-all shadow-sm shadow-primary/15"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col md:flex-row min-h-[65vh]">
        {/* Left Sidebar */}
        <div className="w-full md:w-1/4 bg-gray-50/50 border-r border-gray-100 p-4 space-y-1 select-none flex-shrink-0">
          {[
            { id: "store_info", label: "Store Info", icon: Settings },
            { id: "verification", label: "Verification & KYC", icon: ShieldCheck },
            { id: "payout", label: "Payout Settings", icon: Banknote },
            { id: "social", label: "Social Media", icon: Share2 },
            { id: "hours", label: "Business Hours", icon: Clock },
            { id: "policies", label: "Store Policies", icon: FileCheck },
            { id: "pickup", label: "Customer Pickup", icon: Truck },
            { id: "notifications", label: "Notifications", icon: Bell },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold rounded-xl transition-all text-left ${
                  isActive
                    ? "bg-primary text-white shadow-sm shadow-primary/20"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/70"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-gray-450"}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right Content Area */}
        <div className="flex-1 p-6 space-y-6">
          {activeTab === "store_info" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Store Information</h3>
                <p className="text-xs text-gray-500 mt-0.5">Basic information about your public store profile</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Store Name</label>
                  <input
                    type="text"
                    value={form.storeName}
                    onChange={(e) => updateField("storeName", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Your store name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => updateField("description", e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                    placeholder="Describe your store's focus, offerings, and discrete handling details..."
                  />
                </div>

                {/* Logo Upload */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Store Logo</label>
                    {form.logo && (
                      <div className="flex items-center gap-3 mb-2">
                        <img
                          src={form.logo.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || ""}${form.logo}` : form.logo}
                          alt="Logo"
                          className="w-16 h-16 object-cover rounded-lg border border-gray-200 shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() => updateField("logo", "")}
                          className="text-xs text-red-500 hover:text-red-750 flex items-center gap-1 font-semibold"
                        >
                          <XIcon className="w-3.5 h-3.5" /> Remove
                        </button>
                      </div>
                    )}
                    <label
                      className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
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
                          <span className="text-xs font-semibold">Uploading...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-gray-500">
                          <Upload className="w-5 h-5" />
                          <span className="text-xs font-semibold">Click or drag logo image</span>
                        </div>
                      )}
                    </label>
                  </div>

                  {/* Banner Upload */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Store Banner</label>
                    {form.banner && (
                      <div className="relative mb-2 w-full h-16 rounded-lg overflow-hidden border border-gray-200">
                        <img
                          src={form.banner.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || ""}${form.banner}` : form.banner}
                          alt="Banner"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => updateField("banner", "")}
                          className="absolute top-1.5 right-1.5 w-5 h-5 bg-red-650 text-white rounded-full flex items-center justify-center hover:bg-red-700 shadow transition-colors"
                        >
                          <XIcon className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <label
                      className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
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
                          <span className="text-xs font-semibold">Uploading...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-gray-500">
                          <ImageIcon className="w-5 h-5" />
                          <span className="text-xs font-semibold">Click or drag banner image</span>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                    <input
                      type="text"
                      value={form.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      placeholder="+256..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
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
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Website</label>
                  <input
                    type="text"
                    value={form.website}
                    onChange={(e) => updateField("website", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="https://yourstore.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Address</label>
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
                    <label className="block text-sm font-semibold text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => updateField("city", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Country</label>
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
          )}

          {activeTab === "verification" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Verification Documents</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Upload KYC documentation to verify your business identity.</p>
                </div>
                {getDocStatusBadge()}
              </div>

              <div className="space-y-5">
                {/* National ID */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    National ID <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-gray-400 mb-2.5">Upload a clear photo or scan of your National Identity Document.</p>
                  {form.idDocument && (
                    <div className="flex items-center gap-3 mb-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                      {isPdf(form.idDocument) ? (
                        <FileText className="w-10 h-10 text-red-500 flex-shrink-0" />
                      ) : (
                        <img
                          src={form.idDocument.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || ""}${form.idDocument}` : form.idDocument}
                          alt="National ID"
                          className="w-16 h-16 object-cover rounded-lg border border-gray-200 shadow-sm"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-700 truncate">
                          {isPdf(form.idDocument) ? "National ID (PDF)" : "National ID (Image)"}
                        </p>
                        <a
                          href={form.idDocument.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || ""}${form.idDocument}` : form.idDocument}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline font-semibold"
                        >
                          View Document
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateField("idDocument", "")}
                        className="text-xs text-red-500 hover:text-red-755 flex items-center gap-1 font-semibold flex-shrink-0"
                      >
                        <XIcon className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  )}
                  <label
                    className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
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
                        <span className="text-xs font-semibold">Uploading ID...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-gray-500">
                        <Upload className="w-5 h-5 mb-1" />
                        <span className="text-xs font-semibold">Click or drag to upload (JPEG, PNG, WebP, or PDF)</span>
                      </div>
                    )}
                  </label>
                </div>

                {/* Business License */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Business License <span className="text-gray-400 text-xs font-normal">(Optional)</span>
                  </label>
                  <p className="text-xs text-gray-400 mb-2.5">Upload business registration documentation if available.</p>
                  {form.businessLicense && (
                    <div className="flex items-center gap-3 mb-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                      {isPdf(form.businessLicense) ? (
                        <FileText className="w-10 h-10 text-red-500 flex-shrink-0" />
                      ) : (
                        <img
                          src={form.businessLicense.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || ""}${form.businessLicense}` : form.businessLicense}
                          alt="Business License"
                          className="w-16 h-16 object-cover rounded-lg border border-gray-200 shadow-sm"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-700 truncate">
                          {isPdf(form.businessLicense) ? "Business License (PDF)" : "Business License (Image)"}
                        </p>
                        <a
                          href={form.businessLicense.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || ""}${form.businessLicense}` : form.businessLicense}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline font-semibold"
                        >
                          View Document
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateField("businessLicense", "")}
                        className="text-xs text-red-500 hover:text-red-755 flex items-center gap-1 font-semibold flex-shrink-0"
                      >
                        <XIcon className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  )}
                  <label
                    className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
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
                        <span className="text-xs font-semibold">Uploading license...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-gray-500">
                        <Upload className="w-5 h-5 mb-1" />
                        <span className="text-xs font-semibold">Click or drag to upload (JPEG, PNG, WebP, or PDF)</span>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === "payout" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Payout Settings</h3>
                <p className="text-xs text-gray-500 mt-0.5">Configure how and when you receive your store earnings.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Payout Method</label>
                  <select
                    value={form.payoutMethod}
                    onChange={(e) => updateField("payoutMethod", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white font-medium text-gray-800"
                  >
                    <option value="MOBILE_MONEY">Mobile Money</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="FLUTTERWAVE">Flutterwave</option>
                  </select>
                </div>

                {(form.payoutMethod === "MOBILE_MONEY" || form.payoutMethod === "FLUTTERWAVE") && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
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
                  <div className="space-y-4 p-4 bg-gray-50 border border-gray-150 rounded-xl">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Bank Name</label>
                        <input
                          type="text"
                          value={form.bankName}
                          onChange={(e) => updateField("bankName", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          placeholder="e.g. Stanbic Bank"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Account Number</label>
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
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Bank Branch</label>
                      <input
                        type="text"
                        value={form.bankBranch}
                        onChange={(e) => updateField("bankBranch", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="Branch location"
                      />
                    </div>
                  </div>
                )}

                <div className="border-t border-gray-100 pt-4">
                  <h4 className="text-sm font-bold text-gray-800 mb-3">Auto-Payout Schedule</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Schedule</label>
                      <select
                        value={form.payoutSchedule}
                        onChange={(e) => updateField("payoutSchedule", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white font-medium text-gray-800"
                      >
                        <option value="MANUAL">Manual (request payouts yourself)</option>
                        <option value="DAILY">Daily</option>
                        <option value="WEEKLY">Weekly</option>
                        <option value="BIWEEKLY">Every 2 Weeks</option>
                        <option value="MONTHLY">Monthly</option>
                      </select>
                    </div>
                    {form.payoutSchedule !== "MANUAL" && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Minimum Amount (UGX)</label>
                        <input
                          type="number"
                          value={form.minPayoutAmount}
                          onChange={(e) => updateField("minPayoutAmount", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          placeholder="10000"
                          min="5000"
                        />
                      </div>
                    )}
                  </div>
                  {form.payoutSchedule !== "MANUAL" && (
                    <p className="text-xs text-gray-500 mt-2.5">
                      Payouts will be automatically processed when your balance reaches the minimum threshold.
                      {form.nextPayoutDate && ` Next payout date: ${new Date(form.nextPayoutDate).toLocaleDateString()}`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "social" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Social Media</h3>
                <p className="text-xs text-gray-500 mt-0.5">Link your social media profiles to display them on your store page.</p>
              </div>

              <div className="space-y-4">
                {([
                  { key: "whatsapp", label: "WhatsApp", placeholder: "+256700000000" },
                  { key: "instagram", label: "Instagram", placeholder: "@yourstore" },
                  { key: "facebook", label: "Facebook", placeholder: "facebook.com/yourstore" },
                  { key: "twitter", label: "Twitter / X", placeholder: "@yourstore" },
                  { key: "tiktok", label: "TikTok", placeholder: "@yourstore" },
                ] as const).map((s) => (
                  <div key={s.key}>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">{s.label}</label>
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
          )}

          {activeTab === "hours" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Business Hours</h3>
                <p className="text-xs text-gray-500 mt-0.5">Specify operating hours when your support and store are active.</p>
              </div>

              <div className="space-y-3.5">
                {DAYS.map((day) => {
                  const hours = form.operatingHours?.[day] || { open: "08:00", close: "18:00", closed: false };
                  return (
                    <div key={day} className="flex items-center gap-4 py-2 border-b border-gray-55 last:border-b-0">
                      <span className="text-sm font-semibold text-gray-700 w-24">{day}</span>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
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
                        <span className="text-xs font-bold text-gray-650">Open</span>
                      </label>
                      {!hours.closed ? (
                        <div className="flex items-center gap-2">
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
                            className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                          <span className="text-gray-400 text-xs">to</span>
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
                            className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-red-500 font-bold italic pl-4">Closed</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "policies" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Store Policies</h3>
                <p className="text-xs text-gray-500 mt-0.5">Specify policies about shipping times, returns, and discrete fulfillment guarantees.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Shipping Policy</label>
                  <textarea
                    value={form.shippingPolicy}
                    onChange={(e) => updateField("shippingPolicy", e.target.value)}
                    rows={5}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                    placeholder="Provide details about vacuum-locked packing, courier dispatch schedules, and Kampala drop-off guidelines..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Return Policy</label>
                  <textarea
                    value={form.returnPolicy}
                    onChange={(e) => updateField("returnPolicy", e.target.value)}
                    rows={5}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                    placeholder="Detail returns, exchanges, and hygiene guidelines for underwear/wellness products..."
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "pickup" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Customer Pickup</h3>
                <p className="text-xs text-gray-500 mt-0.5">Enable and configure in-person pickups from your own physical shop/storage.</p>
              </div>

              <div className="space-y-4">
                <label className="flex items-center justify-between cursor-pointer p-4 bg-gray-50/50 rounded-xl border border-gray-150 select-none">
                  <div>
                    <span className="text-sm font-semibold text-gray-800 block">Enable In-Store Pickup</span>
                    <span className="text-[11px] text-gray-500">Allow customers to choose self-collection at checkout.</span>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={form.allowsCustomerPickup}
                      onChange={(e) => setForm((prev) => ({ ...prev, allowsCustomerPickup: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:bg-primary transition-colors" />
                    <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
                  </div>
                </label>

                {form.allowsCustomerPickup && (
                  <div className="space-y-4 p-4 border border-gray-150 rounded-xl space-y-4 animate-in slide-in-from-top-2 duration-200">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Pickup Address</label>
                      <input
                        type="text"
                        value={form.pickupAddress}
                        onChange={(e) => setForm((prev) => ({ ...prev, pickupAddress: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="e.g. Shop 12, Garden City Mall"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Pickup City</label>
                      <input
                        type="text"
                        value={form.pickupCity}
                        onChange={(e) => setForm((prev) => ({ ...prev, pickupCity: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="e.g. Kampala"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Pickup Hours</label>
                      <input
                        type="text"
                        value={form.pickupHours}
                        onChange={(e) => setForm((prev) => ({ ...prev, pickupHours: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="e.g. Mon-Sat 9am-6pm"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Notification Preferences</h3>
                <p className="text-xs text-gray-500 mt-0.5">Select how and when you receive order or account updates.</p>
              </div>

              <div className="space-y-4">
                {([
                  { key: "email", label: "Email Notifications", desc: "Receive updates to your profile email" },
                  { key: "sms", label: "SMS Notifications", desc: "Receive immediate texts for order alerts" },
                  { key: "push", label: "Push Notifications", desc: "Enable browser push alerts" },
                  { key: "orderUpdates", label: "Order Status Updates", desc: "Notifications when orders are shipped/delivered" },
                  { key: "messages", label: "New Message Alerts", desc: "Alerts when customers send a message in chat" },
                ] as const).map((pref) => (
                  <label key={pref.key} className="flex items-center justify-between cursor-pointer p-3 bg-gray-50/40 border border-gray-100 rounded-xl hover:bg-gray-50/70 select-none">
                    <div>
                      <span className="text-sm font-semibold text-gray-800 block">{pref.label}</span>
                      <span className="text-[10px] text-gray-500">{pref.desc}</span>
                    </div>
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
          )}
        </div>
      </div>
    </div>
  );
}
