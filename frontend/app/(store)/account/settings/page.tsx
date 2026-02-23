"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Section from "@/components/Section";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  ArrowLeft, User, Mail, Phone, Loader2, CheckCircle, Lock, Eye, EyeOff,
  Shield, Bell, MapPin, Star, Package, Calendar, AlertTriangle
} from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8+ characters", pass: password.length >= 8 },
    { label: "Uppercase letter", pass: /[A-Z]/.test(password) },
    { label: "Lowercase letter", pass: /[a-z]/.test(password) },
    { label: "Number", pass: /[0-9]/.test(password) },
    { label: "Special character", pass: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.pass).length;
  const strength = score <= 1 ? "Weak" : score <= 3 ? "Fair" : score === 4 ? "Good" : "Strong";
  const color = score <= 1 ? "bg-red-500" : score <= 3 ? "bg-yellow-500" : score === 4 ? "bg-blue-500" : "bg-green-500";

  if (!password) return null;
  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i <= score ? color : "bg-gray-200"}`} />
        ))}
      </div>
      <p className="text-xs text-text-muted">
        Strength: <span className={`font-medium ${score <= 1 ? "text-red-600" : score <= 3 ? "text-yellow-600" : "text-green-600"}`}>{strength}</span>
      </p>
    </div>
  );
}

export default function AccountSettingsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { formatPrice } = useCurrency();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [stats, setStats] = useState({ orders: 0, points: 0, tier: "BRONZE", memberSince: "" });
  const [activeSection, setActiveSection] = useState<"profile" | "password" | "notifications" | "privacy">("profile");
  const [notifications, setNotifications] = useState({
    orderUpdates: true,
    promotions: false,
    newArrivals: false,
    loyaltyUpdates: true,
  });
  const [notifSaved, setNotifSaved] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.push("/auth/login");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user) return;
    fetch(`${API_URL}/api/auth/me`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setName(data.name || "");
        setPhone(data.phone || "");
      })
      .catch(() => {});

    fetch(`${API_URL}/api/account/orders?limit=1`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setStats((s) => ({ ...s, orders: d.total || 0 })))
      .catch(() => {});

    fetch(`${API_URL}/api/account/loyalty`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.account) {
          setStats((s) => ({ ...s, points: d.account.points || 0, tier: d.account.tier || "BRONZE" }));
        }
      })
      .catch(() => {});

    if (user.createdAt) {
      setStats((s) => ({ ...s, memberSince: new Date(user.createdAt!).toLocaleDateString("en-UG", { month: "long", year: "numeric" }) }));
    }
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setProfileError("");
    setProfileSuccess(false);
    try {
      const csrf = getCsrfToken();
      const res = await fetch(`${API_URL}/api/auth/profile`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(csrf ? { "x-csrf-token": csrf } : {}) },
        body: JSON.stringify({ name, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile");
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 4000);
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);
    if (newPassword !== confirmPassword) { setPasswordError("Passwords do not match"); return; }
    if (newPassword.length < 8) { setPasswordError("Password must be at least 8 characters"); return; }
    setChangingPassword(true);
    try {
      const csrf = getCsrfToken();
      const res = await fetch(`${API_URL}/api/auth/change-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(csrf ? { "x-csrf-token": csrf } : {}) },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to change password");
      setPasswordSuccess(true);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 4000);
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSaveNotifications = () => {
    setNotifSaved(true);
    setTimeout(() => setNotifSaved(false), 3000);
  };

  const initials = name ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "?";
  const tierColors: Record<string, string> = {
    BRONZE: "text-orange-600 bg-orange-50",
    SILVER: "text-gray-600 bg-gray-100",
    GOLD: "text-yellow-600 bg-yellow-50",
    PLATINUM: "text-purple-600 bg-purple-50",
  };

  if (isLoading || !user) {
    return (
      <Section>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      </Section>
    );
  }

  const navItems = [
    { id: "profile", label: "Profile", icon: User },
    { id: "password", label: "Security", icon: Shield },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "privacy", label: "Privacy", icon: Lock },
  ] as const;

  return (
    <Section>
      <div className="max-w-4xl mx-auto">
        <Link href="/account" className="inline-flex items-center gap-2 text-text-muted hover:text-text mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Account
        </Link>

        {/* Account Header */}
        <div className="card mb-6 bg-gradient-to-r from-accent/5 to-accent/10 border-accent/20">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-full bg-accent text-white flex items-center justify-center text-xl font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{name || user.email}</h1>
              <p className="text-sm text-text-muted">{user.email}</p>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tierColors[stats.tier] || tierColors.BRONZE}`}>
                  <Star className="w-3 h-3 inline mr-1" />{stats.tier} Member
                </span>
                {stats.memberSince && (
                  <span className="text-xs text-text-muted flex items-center gap-1">
                    <Calendar className="w-3 h-3" />Member since {stats.memberSince}
                  </span>
                )}
              </div>
            </div>
            {/* Quick Stats */}
            <div className="flex gap-4 sm:gap-6 text-center">
              <div>
                <p className="text-lg font-bold">{stats.orders}</p>
                <p className="text-xs text-text-muted flex items-center gap-1"><Package className="w-3 h-3" />Orders</p>
              </div>
              <div>
                <p className="text-lg font-bold">{stats.points.toLocaleString()}</p>
                <p className="text-xs text-text-muted flex items-center gap-1"><Star className="w-3 h-3" />Points</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          {/* Sidebar Nav */}
          <div className="md:col-span-1">
            <nav className="card p-2 space-y-1">
              {navItems.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activeSection === id
                      ? "bg-accent text-white"
                      : "text-text-muted hover:bg-surface-secondary hover:text-text"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </nav>
          </div>

          {/* Main Content */}
          <div className="md:col-span-3">

            {/* Profile Section */}
            {activeSection === "profile" && (
              <div className="card">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold">Profile Information</h2>
                  <p className="text-sm text-text-muted">Update your personal details</p>
                </div>
                <form onSubmit={handleSaveProfile} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                      <input
                        type="text"
                        className="input pl-9"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your full name"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Email Address</label>
                    <div className="flex items-center gap-2 input bg-surface-secondary text-text-muted cursor-not-allowed">
                      <Mail className="w-4 h-4 shrink-0 text-text-muted" />
                      <span>{user.email}</span>
                    </div>
                    <p className="text-xs text-text-muted mt-1.5">Email cannot be changed. Contact support if needed.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                      <input
                        type="tel"
                        className="input pl-9"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+256 700 000 000"
                      />
                    </div>
                    <p className="text-xs text-text-muted mt-1.5">Used for order updates and delivery coordination</p>
                  </div>

                  {profileError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      {profileError}
                    </div>
                  )}
                  {profileSuccess && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                      <CheckCircle className="w-4 h-4 shrink-0" />
                      Profile updated successfully!
                    </div>
                  )}

                  <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><CheckCircle className="w-4 h-4" />Save Changes</>}
                  </button>
                </form>
              </div>
            )}

            {/* Security / Password Section */}
            {activeSection === "password" && (
              <div className="card">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold">Security Settings</h2>
                  <p className="text-sm text-text-muted">Keep your account safe with a strong password</p>
                </div>
                <form onSubmit={handleChangePassword} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Current Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                      <input
                        type={showCurrent ? "text" : "password"}
                        className="input pl-9 pr-10"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        placeholder="Enter current password"
                      />
                      <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text">
                        {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                      <input
                        type={showNew ? "text" : "password"}
                        className="input pl-9 pr-10"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                        placeholder="Create new password"
                      />
                      <button type="button" onClick={() => setShowNew(!showNew)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text">
                        {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <PasswordStrength password={newPassword} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Confirm New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                      <input
                        type={showConfirm ? "text" : "password"}
                        className={`input pl-9 pr-10 ${confirmPassword && newPassword !== confirmPassword ? "border-red-400" : confirmPassword && newPassword === confirmPassword ? "border-green-400" : ""}`}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                        placeholder="Repeat new password"
                      />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text">
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {confirmPassword && (
                      <p className={`text-xs mt-1.5 ${newPassword === confirmPassword ? "text-green-600" : "text-red-500"}`}>
                        {newPassword === confirmPassword ? "✓ Passwords match" : "✗ Passwords do not match"}
                      </p>
                    )}
                  </div>

                  {passwordError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      {passwordError}
                    </div>
                  )}
                  {passwordSuccess && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                      <CheckCircle className="w-4 h-4 shrink-0" />
                      Password updated successfully! You remain logged in.
                    </div>
                  )}

                  <button type="submit" disabled={changingPassword} className="btn-primary flex items-center gap-2">
                    {changingPassword ? <><Loader2 className="w-4 h-4 animate-spin" />Updating...</> : <><Shield className="w-4 h-4" />Change Password</>}
                  </button>
                </form>

                <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                  <p className="text-xs text-blue-700">
                    <Shield className="w-3 h-3 inline mr-1" />
                    Your password is encrypted and stored securely. We will never ask for your password via email or phone.
                  </p>
                </div>
              </div>
            )}

            {/* Notifications Section */}
            {activeSection === "notifications" && (
              <div className="card">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold">Notification Preferences</h2>
                  <p className="text-sm text-text-muted">Choose what updates you want to receive</p>
                </div>
                <div className="space-y-4">
                  {[
                    { key: "orderUpdates", label: "Order Updates", desc: "Shipping confirmations, delivery status, and receipts" },
                    { key: "loyaltyUpdates", label: "Loyalty & Rewards", desc: "Points earned, tier upgrades, and reward expiry" },
                    { key: "promotions", label: "Promotions & Deals", desc: "Discount codes, flash sales, and special offers" },
                    { key: "newArrivals", label: "New Arrivals", desc: "Latest products added to the store" },
                  ].map(({ key, label, desc }) => (
                    <label key={key} className="flex items-start justify-between gap-4 p-4 border border-border rounded-lg cursor-pointer hover:bg-surface-secondary transition-colors">
                      <div>
                        <p className="font-medium text-sm">{label}</p>
                        <p className="text-xs text-text-muted mt-0.5">{desc}</p>
                      </div>
                      <div className="relative shrink-0 mt-0.5">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={notifications[key as keyof typeof notifications]}
                          onChange={(e) => setNotifications((n) => ({ ...n, [key]: e.target.checked }))}
                        />
                        <div
                          onClick={() => setNotifications((n) => ({ ...n, [key]: !n[key as keyof typeof n] }))}
                          className={`w-10 h-5 rounded-full transition-colors cursor-pointer ${notifications[key as keyof typeof notifications] ? "bg-accent" : "bg-gray-300"}`}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${notifications[key as keyof typeof notifications] ? "translate-x-5" : "translate-x-0.5"}`} />
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                {notifSaved && (
                  <div className="flex items-center gap-2 p-3 mt-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                    <CheckCircle className="w-4 h-4" /> Preferences saved!
                  </div>
                )}
                <button onClick={handleSaveNotifications} className="btn-primary mt-6 flex items-center gap-2">
                  <Bell className="w-4 h-4" />Save Preferences
                </button>
              </div>
            )}

            {/* Privacy Section */}
            {activeSection === "privacy" && (
              <div className="space-y-4">
                <div className="card">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold">Privacy & Data</h2>
                    <p className="text-sm text-text-muted">Manage your data and privacy settings</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-4 bg-surface-secondary rounded-lg">
                      <MapPin className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Discreet Shipping by Default</p>
                        <p className="text-xs text-text-muted mt-0.5">Your orders are always shipped in plain packaging with no product details on the label.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 bg-surface-secondary rounded-lg">
                      <Lock className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Anonymous Billing</p>
                        <p className="text-xs text-text-muted mt-0.5">Your bank statement will show a neutral company name, not the store name.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 bg-surface-secondary rounded-lg">
                      <Shield className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Data Security</p>
                        <p className="text-xs text-text-muted mt-0.5">Your personal data is encrypted and never shared with third parties. We comply with Uganda's Data Protection Act.</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col sm:flex-row gap-3">
                    <Link href="/policies/privacy" className="btn-secondary text-sm text-center">
                      Read Privacy Policy
                    </Link>
                    <Link href="/policies/terms" className="btn-secondary text-sm text-center">
                      Terms of Service
                    </Link>
                  </div>
                </div>

                <div className="card border-red-200">
                  <h3 className="font-semibold text-red-600 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />Danger Zone
                  </h3>
                  <p className="text-sm text-text-muted mb-4">Permanently delete your account and all associated data. This action cannot be undone.</p>
                  <button className="text-sm text-red-600 border border-red-300 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors">
                    Request Account Deletion
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Section>
  );
}
