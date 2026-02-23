"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import {
  Settings as SettingsIcon,
  Store,
  CreditCard,
  Truck,
  Mail,
  Bell,
  Shield,
  Save,
  RefreshCw,
  Check,
  Globe,
  Palette,
} from "lucide-react";

interface Setting {
  key: string;
  value: string;
  category: string;
}

const settingCategories = [
  { id: "store", label: "Store Info", icon: Store },
  { id: "payment", label: "Payment", icon: CreditCard },
  { id: "shipping", label: "Shipping", icon: Truck },
  { id: "email", label: "Email", icon: Mail },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
];

const settingDefinitions: Record<string, { label: string; type: string; description?: string; options?: string[] }> = {
  // Store
  store_name: { label: "Store Name", type: "text", description: "Your store's display name" },
  store_description: { label: "Store Description", type: "textarea", description: "Brief description of your store" },
  store_email: { label: "Contact Email", type: "email" },
  store_phone: { label: "Contact Phone", type: "tel" },
  store_address: { label: "Store Address", type: "textarea" },
  store_currency: { label: "Default Currency", type: "select", options: ["UGX", "USD", "EUR", "GBP", "KES"] },
  store_timezone: { label: "Timezone", type: "select", options: ["Africa/Kampala", "Africa/Nairobi", "UTC", "America/New_York", "Europe/London"] },

  // Contact Info (used on store contact page)
  contact_email: { label: "Support Email", type: "email", description: "Shown on the contact page" },
  contact_phone: { label: "Support Phone", type: "tel", description: "e.g. +256 700 000 000" },
  contact_whatsapp: { label: "WhatsApp Number", type: "text", description: "Digits only, no spaces (e.g. 256700000000)" },
  contact_hours: { label: "Business Hours", type: "text", description: "e.g. Mon-Sat, 9am-6pm EAT" },
  
  // Payment
  payment_flutterwave_enabled: { label: "Enable Flutterwave", type: "toggle" },
  payment_mobile_money_enabled: { label: "Enable Mobile Money", type: "toggle" },
  payment_card_enabled: { label: "Enable Card Payments", type: "toggle" },
  payment_cod_enabled: { label: "Enable Cash on Delivery", type: "toggle" },
  payment_min_order: { label: "Minimum Order Amount", type: "number" },
  
  // Shipping
  shipping_enabled: { label: "Enable Shipping", type: "toggle" },
  shipping_free_threshold: { label: "Free Shipping Threshold", type: "number", description: "Orders above this amount get free shipping" },
  shipping_default_rate: { label: "Default Shipping Rate", type: "number" },
  shipping_express_rate: { label: "Express Shipping Rate", type: "number" },
  shipping_processing_days: { label: "Processing Days", type: "number", description: "Days to process before shipping" },
  
  // Email
  email_order_confirmation: { label: "Send Order Confirmations", type: "toggle" },
  email_shipping_updates: { label: "Send Shipping Updates", type: "toggle" },
  email_marketing_enabled: { label: "Marketing Emails", type: "toggle" },
  email_from_name: { label: "From Name", type: "text" },
  email_from_address: { label: "From Address", type: "email" },
  
  // Notifications
  notifications_low_stock: { label: "Low Stock Alerts", type: "toggle" },
  notifications_new_order: { label: "New Order Notifications", type: "toggle" },
  notifications_new_review: { label: "New Review Notifications", type: "toggle" },
  low_stock_threshold: { label: "Low Stock Threshold", type: "number" },
  
  // Security
  security_2fa_enabled: { label: "Two-Factor Authentication", type: "toggle" },
  security_session_timeout: { label: "Session Timeout (minutes)", type: "number" },
  security_max_login_attempts: { label: "Max Login Attempts", type: "number" },
  security_password_min_length: { label: "Min Password Length", type: "number" },
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeCategory, setActiveCategory] = useState("store");
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<Record<string, string>>({});

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await api.admin.getSettings();
      const settingsMap: Record<string, string> = {};
      if (Array.isArray(data)) {
        data.forEach((s: Setting) => {
          settingsMap[s.key] = s.value;
        });
      } else if (typeof data === "object") {
        Object.assign(settingsMap, data);
      }
      setSettings(settingsMap);
      setOriginalSettings(settingsMap);
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const updateSetting = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.admin.updateSettings(settings);
      setOriginalSettings(settings);
      setHasChanges(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Failed to save settings:", error);
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(originalSettings);
    setHasChanges(false);
  };

  const getCategorySettings = (category: string) => {
    return Object.entries(settingDefinitions).filter(([key]) =>
      key.startsWith(category + "_") ||
      key.startsWith(category.replace("notifications", "low_stock")) ||
      (category === "store" && key.startsWith("contact_"))
    );
  };

  const renderSettingInput = (key: string, def: typeof settingDefinitions[string]) => {
    const value = settings[key] || "";

    if (def.type === "toggle") {
      const isOn = value === "true" || value === "1";
      return (
        <button
          type="button"
          onClick={() => updateSetting(key, isOn ? "false" : "true")}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            isOn ? "bg-primary" : "bg-gray-200"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isOn ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      );
    }

    if (def.type === "select" && def.options) {
      return (
        <select
          value={value}
          onChange={(e) => updateSetting(key, e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        >
          <option value="">Select...</option>
          {def.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    if (def.type === "textarea") {
      return (
        <textarea
          value={value}
          onChange={(e) => updateSetting(key, e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
        />
      );
    }

    return (
      <input
        type={def.type}
        value={value}
        onChange={(e) => updateSetting(key, e.target.value)}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
      />
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid lg:grid-cols-4 gap-6">
          <div className="h-64 bg-gray-200 rounded-xl animate-pulse" />
          <div className="lg:col-span-3 h-96 bg-gray-200 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  const categorySettings = getCategorySettings(activeCategory);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 mt-1">Manage your store configuration</p>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reset
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              saved
                ? "bg-green-500 text-white"
                : "bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
            }`}
          >
            {saved ? (
              <>
                <Check className="w-4 h-4" />
                Saved
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : "Save Changes"}
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <nav className="space-y-1">
            {settingCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                  activeCategory === cat.id
                    ? "bg-primary text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <cat.icon className={`w-5 h-5 ${activeCategory === cat.id ? "" : "text-gray-400"}`} />
                <span className="font-medium">{cat.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Settings Form */}
        <div className="lg:col-span-3 bg-white rounded-xl border shadow-sm">
          <div className="px-6 py-4 border-b">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              {settingCategories.find((c) => c.id === activeCategory)?.icon && (
                <span className="p-2 bg-primary/10 rounded-lg">
                  {(() => {
                    const Icon = settingCategories.find((c) => c.id === activeCategory)?.icon || SettingsIcon;
                    return <Icon className="w-5 h-5 text-primary" />;
                  })()}
                </span>
              )}
              {settingCategories.find((c) => c.id === activeCategory)?.label} Settings
            </h2>
          </div>
          <div className="p-6 space-y-6">
            {categorySettings.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No settings available for this category</p>
            ) : (
              categorySettings.map(([key, def]) => (
                <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-8">
                  <div className="sm:w-1/3">
                    <label className="block font-medium text-gray-700">{def.label}</label>
                    {def.description && (
                      <p className="text-sm text-gray-500">{def.description}</p>
                    )}
                  </div>
                  <div className="sm:w-2/3">
                    {renderSettingInput(key, def)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
