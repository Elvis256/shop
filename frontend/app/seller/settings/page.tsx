"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { Settings, Save, AlertTriangle, CheckCircle2, Upload, Loader2, X as XIcon, ImageIcon } from "lucide-react";
import { useToast } from "@/lib/hooks/useToast";

interface SellerProfile {
  storeName: string;
  description: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  city: string;
  logo: string;
  banner: string;
  payoutMethod: string;
  payoutPhone: string;
  bankName: string;
  bankAccount: string;
}

const emptyProfile: SellerProfile = {
  storeName: "",
  description: "",
  phone: "",
  email: "",
  website: "",
  address: "",
  city: "",
  logo: "",
  banner: "",
  payoutMethod: "MOBILE_MONEY",
  payoutPhone: "",
  bankName: "",
  bankAccount: "",
};

export default function SellerSettings() {
  const [form, setForm] = useState<SellerProfile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
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
        logo: seller.logo || "",
        banner: seller.banner || "",
        payoutMethod: seller.payoutMethod || "MOBILE_MONEY",
        payoutPhone: seller.payoutPhone || "",
        bankName: seller.bankName || "",
        bankAccount: seller.bankAccount || "",
      });
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            </select>
          </div>
          {form.payoutMethod === "MOBILE_MONEY" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mobile Money Number
              </label>
              <input
                type="text"
                value={form.payoutPhone}
                onChange={(e) => updateField("payoutPhone", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="+256..."
              />
            </div>
          )}
          {form.payoutMethod === "BANK_TRANSFER" && (
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Number
                </label>
                <input
                  type="text"
                  value={form.bankAccount}
                  onChange={(e) => updateField("bankAccount", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Account number"
                />
              </div>
            </div>
          )}
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
