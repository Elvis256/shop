"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  Search,
  X,
  Eye,
  EyeOff,
  AlertTriangle,
  Download,
  Upload,
  ExternalLink,
  Info,
  CheckCircle2,
  XCircle,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Setting {
  key: string;
  value: string;
  category: string;
}

interface SettingDef {
  label: string;
  type: string;
  description?: string;
  options?: string[];
  placeholder?: string;
  section?: string;
}

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

/* ------------------------------------------------------------------ */
/*  Categories                                                         */
/* ------------------------------------------------------------------ */
const settingCategories = [
  { id: "store", label: "Store Info", icon: Store, description: "Basic store details & contact" },
  { id: "appearance", label: "Appearance", icon: Palette, description: "Branding, logo & colors" },
  { id: "payment", label: "Payment", icon: CreditCard, description: "Payment methods & gateways" },
  { id: "shipping", label: "Shipping", icon: Truck, description: "Rates & delivery options" },
  { id: "email", label: "Email", icon: Mail, description: "Email templates & SMTP" },
  { id: "notifications", label: "Notifications", icon: Bell, description: "Alerts & channels" },
  { id: "security", label: "Security", icon: Shield, description: "Auth, sessions & access" },
];

/* ------------------------------------------------------------------ */
/*  Setting definitions (grouped by section within each category)      */
/* ------------------------------------------------------------------ */
const settingDefinitions: Record<string, SettingDef> = {
  // ── Store: General ──
  store_name: { label: "Store Name", type: "text", description: "Your store's display name", section: "General", placeholder: "My Store" },
  store_description: { label: "Store Description", type: "textarea", description: "Brief description shown in search engines & social shares", section: "General", placeholder: "Premium products for discerning customers" },
  store_email: { label: "Contact Email", type: "email", section: "General", placeholder: "hello@mystore.com" },
  store_phone: { label: "Contact Phone", type: "tel", section: "General", placeholder: "+256 700 000 000" },
  store_address: { label: "Store Address", type: "textarea", section: "General", placeholder: "123 Main St, Kampala, Uganda" },
  store_currency: { label: "Default Currency", type: "select", options: ["UGX", "USD", "EUR", "GBP", "KES", "TZS", "RWF"], section: "General" },
  store_timezone: { label: "Timezone", type: "select", options: ["Africa/Kampala", "Africa/Nairobi", "Africa/Dar_es_Salaam", "Africa/Kigali", "UTC", "America/New_York", "Europe/London"], section: "General" },

  // ── Store: Support ──
  contact_email: { label: "Support Email", type: "email", description: "Shown on the contact page", section: "Support & Hours", placeholder: "support@mystore.com" },
  contact_phone: { label: "Support Phone", type: "tel", description: "Customers will call this number", section: "Support & Hours", placeholder: "+256 700 000 000" },
  contact_whatsapp: { label: "WhatsApp Number", type: "text", description: "Digits only, no spaces (e.g. 256700000000)", section: "Support & Hours", placeholder: "256700000000" },
  contact_hours: { label: "Business Hours", type: "text", description: "Displayed on the contact page", section: "Support & Hours", placeholder: "Mon-Sat, 9am-6pm EAT" },

  // ── Store: Social Media ──
  store_social_facebook: { label: "Facebook", type: "url", description: "Full URL to your Facebook page", section: "Social Media", placeholder: "https://facebook.com/mystore" },
  store_social_instagram: { label: "Instagram", type: "url", description: "Full URL to your Instagram profile", section: "Social Media", placeholder: "https://instagram.com/mystore" },
  store_social_twitter: { label: "Twitter / X", type: "url", section: "Social Media", placeholder: "https://x.com/mystore" },
  store_social_tiktok: { label: "TikTok", type: "url", section: "Social Media", placeholder: "https://tiktok.com/@mystore" },

  // ── Store: SEO ──
  store_seo_title: { label: "Meta Title", type: "text", description: "Appears in browser tabs & search results (max 60 chars)", section: "SEO", placeholder: "My Store – Premium Products" },
  store_seo_description: { label: "Meta Description", type: "textarea", description: "Search engine snippet (max 160 chars)", section: "SEO", placeholder: "Shop premium products with fast delivery across Uganda." },
  store_seo_keywords: { label: "Meta Keywords", type: "text", description: "Comma-separated keywords", section: "SEO", placeholder: "shop, Uganda, premium" },

  // ── Appearance ──
  appearance_logo_url: { label: "Logo URL", type: "url", description: "URL to your store logo image (recommended: 200×60px)", section: "Branding", placeholder: "https://example.com/logo.png" },
  appearance_favicon_url: { label: "Favicon URL", type: "url", description: "URL to your favicon (recommended: 32×32px .ico or .png)", section: "Branding", placeholder: "https://example.com/favicon.ico" },
  appearance_primary_color: { label: "Primary Color", type: "color", description: "Main brand color used for buttons & accents", section: "Branding" },
  appearance_accent_color: { label: "Accent Color", type: "color", description: "Secondary color for highlights", section: "Branding" },
  appearance_banner_text: { label: "Announcement Banner", type: "text", description: "Shown at the top of the storefront (leave empty to hide)", section: "Storefront", placeholder: "🎉 Free shipping on orders over UGX 50,000!" },
  appearance_footer_text: { label: "Footer Text", type: "text", description: "Copyright or tagline shown in the footer", section: "Storefront", placeholder: "© 2026 My Store. All rights reserved." },

  // ── Payment ──
  payment_flutterwave_enabled: { label: "Enable Flutterwave", type: "toggle", description: "Accept card, mobile money & bank payments via Flutterwave", section: "Payment Methods" },
  payment_mobile_money_enabled: { label: "Enable Mobile Money", type: "toggle", description: "Direct MTN/Airtel Money payments", section: "Payment Methods" },
  payment_card_enabled: { label: "Enable Card Payments", type: "toggle", description: "Visa, Mastercard & other cards", section: "Payment Methods" },
  payment_paypal_enabled: { label: "Enable PayPal", type: "toggle", description: "Accept PayPal payments (amounts converted to USD)", section: "Payment Methods" },
  payment_cod_enabled: { label: "Cash on Delivery", type: "toggle", description: "Customers pay when they receive the order", section: "Payment Methods" },
  payment_min_order: { label: "Minimum Order Amount", type: "number", description: "Customers must spend at least this much to checkout", section: "Order Rules", placeholder: "5000" },
  payment_instructions: { label: "Payment Instructions", type: "textarea", description: "Additional instructions shown at checkout", section: "Order Rules", placeholder: "Please complete your payment within 30 minutes." },
  payment_flutterwave_public_key: { label: "Flutterwave Public Key", type: "text", description: "Your Flutterwave public API key", section: "Flutterwave API", placeholder: "FLWPUBK-xxxx" },
  payment_flutterwave_secret_key: { label: "Flutterwave Secret Key", type: "password", description: "Keep this secret — never share it", section: "Flutterwave API", placeholder: "FLWSECK-xxxx" },
  payment_paypal_api_username: { label: "PayPal API Username", type: "text", description: "NVP/SOAP API username from PayPal", section: "PayPal API", placeholder: "seller_api1.gmail.com" },
  payment_paypal_api_password: { label: "PayPal API Password", type: "password", description: "NVP/SOAP API password", section: "PayPal API", placeholder: "••••••••" },
  payment_paypal_api_signature: { label: "PayPal API Signature", type: "password", description: "NVP/SOAP API signature", section: "PayPal API", placeholder: "••••••••" },
  payment_paypal_mode: { label: "PayPal Mode", type: "select", description: "Use sandbox for testing, live for real payments", section: "PayPal API", options: ["live", "sandbox"] },

  // ── Shipping ──
  shipping_enabled: { label: "Enable Shipping", type: "toggle", description: "Toggle all shipping functionality", section: "General" },
  shipping_allow_pickup: { label: "Allow Store Pickup", type: "toggle", description: "Let customers pick up orders from your location", section: "General" },
  shipping_pickup_address: { label: "Pickup Location", type: "text", description: "Address shown to customers for store pickup", section: "General", placeholder: "Shop 12, Kampala Road, Kampala" },
  shipping_free_threshold: { label: "Free Shipping Threshold (UGX)", type: "number", description: "Local orders above this amount get free shipping (0 = always free)", section: "Local Rates", placeholder: "100000" },
  shipping_default_rate: { label: "Standard Shipping Rate (UGX)", type: "number", description: "Default cost for standard local delivery", section: "Local Rates", placeholder: "5000" },
  shipping_express_rate: { label: "Express Shipping Rate (UGX)", type: "number", description: "Cost for same-day/next-day delivery (Kampala only)", section: "Local Rates", placeholder: "15000" },
  shipping_upcountry_rate: { label: "Upcountry Rate (UGX)", type: "number", description: "Shipping to areas outside Kampala", section: "Local Rates", placeholder: "10000" },
  shipping_intl_included: { label: "International Shipping Included", type: "toggle", description: "International (dropship) items have shipping included in price", section: "International" },
  shipping_intl_rate: { label: "International Flat Rate (UGX)", type: "number", description: "Additional shipping fee for international items (if not included)", section: "International", placeholder: "0" },
  shipping_processing_days: { label: "Processing Days", type: "number", description: "Business days to prepare order before shipping", section: "Delivery Estimates", placeholder: "1" },
  shipping_standard_days: { label: "Standard Delivery", type: "text", description: "Estimated local delivery time", section: "Delivery Estimates", placeholder: "2-4 business days" },
  shipping_express_days: { label: "Express Delivery", type: "text", description: "Estimated express delivery time (Kampala)", section: "Delivery Estimates", placeholder: "Same day - 1 day" },
  shipping_upcountry_days: { label: "Upcountry Delivery", type: "text", description: "Estimated delivery outside Kampala", section: "Delivery Estimates", placeholder: "3-7 business days" },
  shipping_intl_days: { label: "International Delivery", type: "text", description: "Estimated delivery for imported/dropship items", section: "Delivery Estimates", placeholder: "7-21 business days" },
  shipping_restricted_areas: { label: "Restricted Areas", type: "textarea", description: "Areas you don't ship to (one per line)", section: "Restrictions", placeholder: "Karamoja\nKotido" },
  shipping_discreet_default: { label: "Discreet Packaging by Default", type: "toggle", description: "Always use plain packaging (recommended for adult products)", section: "Packaging" },
  shipping_discreet_note: { label: "Discreet Packaging Note", type: "text", description: "Message shown about discreet shipping", section: "Packaging", placeholder: "Plain packaging with neutral sender name" },

  // ── Email ──
  email_order_confirmation: { label: "Order Confirmations", type: "toggle", description: "Send email when order is placed", section: "Automated Emails" },
  email_shipping_updates: { label: "Shipping Updates", type: "toggle", description: "Notify customers when order ships", section: "Automated Emails" },
  email_marketing_enabled: { label: "Marketing Emails", type: "toggle", description: "Send promotional emails to opted-in customers", section: "Automated Emails" },
  email_from_name: { label: "From Name", type: "text", description: "Sender name on outgoing emails", section: "Sender Details", placeholder: "My Store" },
  email_from_address: { label: "From Address", type: "email", description: "Sender email address (must be verified)", section: "Sender Details", placeholder: "noreply@mystore.com" },
  email_reply_to: { label: "Reply-To Address", type: "email", description: "Where customer replies go", section: "Sender Details", placeholder: "support@mystore.com" },
  email_smtp_host: { label: "SMTP Host", type: "text", description: "Mail server hostname", section: "SMTP Configuration", placeholder: "smtp.gmail.com" },
  email_smtp_port: { label: "SMTP Port", type: "number", description: "Usually 587 (TLS) or 465 (SSL)", section: "SMTP Configuration", placeholder: "587" },
  email_smtp_user: { label: "SMTP Username", type: "text", section: "SMTP Configuration", placeholder: "user@gmail.com" },
  email_smtp_password: { label: "SMTP Password", type: "password", description: "App password or SMTP credential", section: "SMTP Configuration" },
  email_smtp_secure: { label: "Use TLS/SSL", type: "toggle", description: "Encrypt email connections (recommended)", section: "SMTP Configuration" },

  // ── Notifications ──
  notifications_low_stock: { label: "Low Stock Alerts", type: "toggle", description: "Get notified when products run low", section: "Admin Alerts" },
  notifications_new_order: { label: "New Order Alerts", type: "toggle", description: "Instant notification on new orders", section: "Admin Alerts" },
  notifications_new_review: { label: "New Review Alerts", type: "toggle", description: "Get notified of customer reviews", section: "Admin Alerts" },
  notifications_daily_summary: { label: "Daily Summary", type: "toggle", description: "Receive a daily sales & activity summary", section: "Admin Alerts" },
  low_stock_threshold: { label: "Low Stock Threshold", type: "number", description: "Alert when stock falls below this number", section: "Thresholds", placeholder: "10" },
  notifications_admin_email: { label: "Admin Notification Email", type: "email", description: "Where admin alerts are sent", section: "Channels", placeholder: "admin@mystore.com" },
  notifications_admin_whatsapp: { label: "Admin WhatsApp", type: "text", description: "WhatsApp number for urgent alerts (digits only)", section: "Channels", placeholder: "256700000000" },

  // ── Security ──
  security_2fa_enabled: { label: "Two-Factor Authentication", type: "toggle", description: "Require 2FA for admin accounts", section: "Authentication" },
  security_session_timeout: { label: "Session Timeout (min)", type: "number", description: "Auto-logout after inactivity", section: "Authentication", placeholder: "60" },
  security_max_login_attempts: { label: "Max Login Attempts", type: "number", description: "Lock account after this many failed tries", section: "Authentication", placeholder: "5" },
  security_password_min_length: { label: "Min Password Length", type: "number", description: "Minimum characters for passwords", section: "Authentication", placeholder: "8" },
  security_maintenance_mode: { label: "Maintenance Mode", type: "toggle", description: "Show a maintenance page to all visitors (admins can still access)", section: "Access Control" },
  security_maintenance_message: { label: "Maintenance Message", type: "textarea", description: "Displayed to visitors during maintenance", section: "Access Control", placeholder: "We're upgrading our store. Back soon!" },
  security_allowed_ips: { label: "Admin IP Whitelist", type: "text", description: "Comma-separated IPs allowed admin access (empty = all)", section: "Access Control", placeholder: "102.209.111.68, 129.205.9.99" },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Resolve which category a setting key belongs to */
function keyToCategory(key: string): string {
  if (key.startsWith("appearance_")) return "appearance";
  if (key.startsWith("store_") || key.startsWith("contact_")) return "store";
  if (key.startsWith("payment_")) return "payment";
  if (key.startsWith("shipping_")) return "shipping";
  if (key.startsWith("email_")) return "email";
  if (key.startsWith("notifications_") || key.startsWith("low_stock_")) return "notifications";
  if (key.startsWith("security_")) return "security";
  return "store";
}

/** Group settings by section within a category */
function groupBySection(entries: [string, SettingDef][]): Record<string, [string, SettingDef][]> {
  const groups: Record<string, [string, SettingDef][]> = {};
  for (const entry of entries) {
    const section = entry[1].section || "General";
    if (!groups[section]) groups[section] = [];
    groups[section].push(entry);
  }
  return groups;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState("store");
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // ── Toast helpers ──
  let toastIdRef = 0;
  const addToast = useCallback((type: "success" | "error", message: string) => {
    const id = ++toastIdRef;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Data loading ──
  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await api.admin.getSettings();
      const settingsMap: Record<string, string> = {};
      if (Array.isArray(data)) {
        data.forEach((s: Setting) => { settingsMap[s.key] = s.value; });
      } else if (typeof data === "object") {
        Object.assign(settingsMap, data);
      }
      setSettings(settingsMap);
      setOriginalSettings(settingsMap);
    } catch (error) {
      console.error("Failed to load settings:", error);
      addToast("error", "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSettings(); }, []);

  // ── Mutations ──
  const updateSetting = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.admin.updateSettings(settings);
      setOriginalSettings({ ...settings });
      setHasChanges(false);
      addToast("success", "Settings saved successfully");
    } catch (error) {
      console.error("Failed to save settings:", error);
      addToast("error", "Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings({ ...originalSettings });
    setHasChanges(false);
    setShowResetConfirm(false);
    addToast("success", "Changes discarded");
  };

  // ── Export / Import ──
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast("success", "Settings exported");
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const imported = JSON.parse(text);
        if (typeof imported === "object" && !Array.isArray(imported)) {
          setSettings((prev) => ({ ...prev, ...imported }));
          setHasChanges(true);
          addToast("success", `Imported ${Object.keys(imported).length} settings — review & save`);
        } else {
          addToast("error", "Invalid settings file format");
        }
      } catch {
        addToast("error", "Could not parse settings file");
      }
    };
    input.click();
  };

  // ── Search & filtering ──
  const isSearching = searchQuery.trim().length > 0;

  const getCategorySettings = useCallback(
    (category: string): [string, SettingDef][] => {
      return Object.entries(settingDefinitions).filter(
        ([key]) => keyToCategory(key) === category
      );
    },
    []
  );

  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const q = searchQuery.toLowerCase();
    return Object.entries(settingDefinitions).filter(
      ([key, def]) =>
        key.toLowerCase().includes(q) ||
        def.label.toLowerCase().includes(q) ||
        (def.description?.toLowerCase().includes(q)) ||
        (def.section?.toLowerCase().includes(q))
    );
  }, [searchQuery, isSearching]);

  // Count changed keys per category for badge
  const changedPerCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const key of Object.keys(settingDefinitions)) {
      const cat = keyToCategory(key);
      if ((settings[key] || "") !== (originalSettings[key] || "")) {
        counts[cat] = (counts[cat] || 0) + 1;
      }
    }
    return counts;
  }, [settings, originalSettings]);

  // ── Render helpers ──
  const togglePassword = (key: string) =>
    setShowPasswords((prev) => ({ ...prev, [key]: !prev[key] }));

  const renderSettingInput = (key: string, def: SettingDef) => {
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
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
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
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
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
          placeholder={def.placeholder}
          rows={3}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
        />
      );
    }

    if (def.type === "color") {
      return (
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={value || "#0071e3"}
            onChange={(e) => updateSetting(key, e.target.value)}
            className="h-10 w-14 rounded-lg border border-gray-200 cursor-pointer p-1"
          />
          <input
            type="text"
            value={value}
            onChange={(e) => updateSetting(key, e.target.value)}
            placeholder="#0071e3"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-sm"
          />
        </div>
      );
    }

    if (def.type === "password") {
      const visible = showPasswords[key];
      return (
        <div className="relative">
          <input
            type={visible ? "text" : "password"}
            value={value}
            onChange={(e) => updateSetting(key, e.target.value)}
            placeholder={def.placeholder}
            className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => togglePassword(key)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
          >
            {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      );
    }

    if (def.type === "url") {
      return (
        <div className="relative">
          <input
            type="url"
            value={value}
            onChange={(e) => updateSetting(key, e.target.value)}
            placeholder={def.placeholder}
            className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          {value && (
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-primary"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      );
    }

    return (
      <input
        type={def.type}
        value={value}
        onChange={(e) => updateSetting(key, e.target.value)}
        placeholder={def.placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
      />
    );
  };

  const renderSettingRow = (key: string, def: SettingDef, showCategory = false) => {
    const isChanged = (settings[key] || "") !== (originalSettings[key] || "");
    return (
      <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-8 py-4 first:pt-0 last:pb-0">
        <div className="sm:w-1/3">
          <label className="block font-medium text-gray-700 flex items-center gap-2">
            {def.label}
            {isChanged && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Modified" />}
          </label>
          {def.description && (
            <p className="text-sm text-gray-500 mt-0.5">{def.description}</p>
          )}
          {showCategory && (
            <p className="text-xs text-primary font-medium mt-1">
              {settingCategories.find((c) => c.id === keyToCategory(key))?.label}
            </p>
          )}
        </div>
        <div className="sm:w-2/3">{renderSettingInput(key, def)}</div>
      </div>
    );
  };

  const renderSection = (sectionName: string, entries: [string, SettingDef][]) => (
    <div key={sectionName}>
      <div className="flex items-center gap-2 mb-4 mt-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{sectionName}</h3>
        <div className="flex-1 h-px bg-gray-100" />
      </div>
      <div className="divide-y divide-gray-100">
        {entries.map(([key, def]) => renderSettingRow(key, def))}
      </div>
    </div>
  );

  /* ---------------------------------------------------------------- */
  /*  Loading state                                                    */
  /* ---------------------------------------------------------------- */
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="lg:col-span-3 space-y-4">
            <div className="h-14 bg-gray-200 rounded-xl animate-pulse" />
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const categorySettings = getCategorySettings(activeCategory);
  const grouped = groupBySection(categorySettings);
  const activeCat = settingCategories.find((c) => c.id === activeCategory);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */
  return (
    <div className="space-y-6">
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border animate-slide-in"
            style={{
              background: toast.type === "success" ? "#f0fdf4" : "#fef2f2",
              borderColor: toast.type === "success" ? "#bbf7d0" : "#fecaca",
            }}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span className={`text-sm font-medium ${toast.type === "success" ? "text-green-800" : "text-red-800"}`}>
              {toast.message}
            </span>
            <button onClick={() => dismissToast(toast.id)} className="ml-2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Reset confirmation dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl border p-6 max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Discard Changes?</h3>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              You have unsaved changes. This will revert all modifications since your last save.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 mt-1">Manage your store configuration</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm"
            title="Export settings"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={handleImport}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm"
            title="Import settings"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Import</span>
          </button>
          {hasChanges && (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Reset
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors bg-primary text-white hover:bg-primary/90 disabled:opacity-50 text-sm font-medium"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search all settings..."
          className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white text-sm"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search results */}
      {isSearching ? (
        <div className="bg-white rounded-xl border shadow-sm">
          <div className="px-6 py-4 border-b">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-400" />
              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for &ldquo;{searchQuery}&rdquo;
            </h2>
          </div>
          <div className="p-6">
            {searchResults.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No settings match your search</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {searchResults.map(([key, def]) => renderSettingRow(key, def, true))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <nav className="space-y-1">
              {settingCategories.map((cat) => {
                const changeCount = changedPerCategory[cat.id] || 0;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                      activeCategory === cat.id
                        ? "bg-primary text-white"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <cat.icon className={`w-5 h-5 shrink-0 ${activeCategory === cat.id ? "" : "text-gray-400"}`} />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium block">{cat.label}</span>
                      <span className={`text-xs ${activeCategory === cat.id ? "text-white/70" : "text-gray-400"}`}>
                        {cat.description}
                      </span>
                    </div>
                    {changeCount > 0 && (
                      <span className={`ml-auto shrink-0 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                        activeCategory === cat.id
                          ? "bg-white/20 text-white"
                          : "bg-amber-100 text-amber-700"
                      }`}>
                        {changeCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Unsaved changes hint */}
            {hasChanges && (
              <div className="mt-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 text-amber-700">
                  <Info className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-medium">You have unsaved changes</span>
                </div>
              </div>
            )}
          </div>

          {/* Settings Form */}
          <div className="lg:col-span-3 bg-white rounded-xl border shadow-sm">
            <div className="px-6 py-4 border-b flex items-center gap-3">
              <span className="p-2 bg-primary/10 rounded-lg">
                {(() => {
                  const Icon = activeCat?.icon || SettingsIcon;
                  return <Icon className="w-5 h-5 text-primary" />;
                })()}
              </span>
              <div>
                <h2 className="font-semibold text-gray-900">{activeCat?.label} Settings</h2>
                <p className="text-xs text-gray-500">{activeCat?.description}</p>
              </div>
            </div>
            <div className="p-6 space-y-8">
              {Object.keys(grouped).length === 0 ? (
                <p className="text-gray-500 text-center py-8">No settings available for this category</p>
              ) : (
                Object.entries(grouped).map(([sectionName, entries]) =>
                  renderSection(sectionName, entries)
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
