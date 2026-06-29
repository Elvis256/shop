"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Section from "@/components/Section";
import { useAuth } from "@/lib/hooks/useAuth";
import { ArrowLeft, Shield, Smartphone, Key, CheckCircle, XCircle, AlertTriangle, Monitor, Trash2, Loader2, Clock } from "lucide-react";

export default function SecurityPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [twoFAStatus, setTwoFAStatus] = useState<{ enabled: boolean; hasBackupCodes: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupMode, setSetupMode] = useState(false);
  const [setupData, setSetupData] = useState<{ secret: string; qrCodeUrl: string; backupCodes: string[] } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState("");
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  const [loginHistory, setLoginHistory] = useState<Array<{ id: string; ipAddress: string; device: string; success: boolean; createdAt: string }>>([]);
  const [sessions, setSessions] = useState<Array<{ id: string; ipAddress: string; device: string; createdAt: string; isCurrent: boolean }>>([]);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [stealthPin, setStealthPin] = useState("");
  const [hasStealthPin, setHasStealthPin] = useState(false);
  const [stealthTimeout, setStealthTimeout] = useState(300000);
  const [stealthAutoWipe, setStealthAutoWipe] = useState(false);
  const [pinChangeSuccess, setPinChangeSuccess] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const pin = localStorage.getItem("discreet_pin");
      setHasStealthPin(!!pin);
      const timeout = localStorage.getItem("discreet_timeout");
      setStealthTimeout(timeout ? parseInt(timeout) : 300000);
      setStealthAutoWipe(localStorage.getItem("discreet_self_destruct") === "1");
    }
  }, []);

  const handleSaveStealthPinSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (stealthPin) {
      if (!/^\d{4}$/.test(stealthPin)) {
        alert("PIN must be exactly 4 digits");
        return;
      }
      localStorage.setItem("discreet_pin", stealthPin);
      setHasStealthPin(true);
      setStealthPin("");
    }
    localStorage.setItem("discreet_timeout", String(stealthTimeout));
    localStorage.setItem("discreet_self_destruct", stealthAutoWipe ? "1" : "0");
    setPinChangeSuccess(true);
    setTimeout(() => setPinChangeSuccess(false), 3000);
  };

  const handleRemoveStealthPin = () => {
    localStorage.removeItem("discreet_pin");
    setHasStealthPin(false);
    setStealthPin("");
    alert("Stealth screen lock PIN removed");
  };

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) {
      fetch2FAStatus();
      fetchLoginHistory();
      fetchSessions();
    }
  }, [user]);

  const fetchLoginHistory = async () => {
    try {
      const res = await fetch("/api/auth/login-history?limit=10", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setLoginHistory(data.records || []);
      }
    } catch {}
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/auth/sessions", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSessions(data || []);
      }
    } catch {}
  };

  const terminateSession = async (id: string) => {
    setTerminatingId(id);
    try {
      const res = await fetch(`/api/auth/sessions/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== id));
      }
    } catch {}
    setTerminatingId(null);
  };

  const fetch2FAStatus = async () => {
    try {
      const res = await fetch(`/api/2fa/status`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setTwoFAStatus(data);
      }
    } catch (error) {
      console.error("Failed to fetch 2FA status:", error);
    } finally {
      setLoading(false);
    }
  };

  const startSetup = async () => {
    setError("");
    try {
      const res = await fetch(`/api/2fa/setup`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setSetupData(data);
        setSetupMode(true);
      } else {
        const err = await res.json();
        setError(err.error);
      }
    } catch (error) {
      setError("Failed to start setup");
    }
  };

  const enable2FA = async () => {
    if (verifyCode.length !== 6) {
      setError("Please enter a 6-digit code");
      return;
    }
    
    setError("");
    try {
      const res = await fetch(`/api/2fa/enable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: verifyCode }),
      });
      
      if (res.ok) {
        setSetupMode(false);
        setShowBackupCodes(true);
        fetch2FAStatus();
      } else {
        const err = await res.json();
        setError(err.error);
      }
    } catch (error) {
      setError("Failed to enable 2FA");
    }
  };

  const disable2FA = async () => {
    const code = prompt("Enter your 2FA code to disable:");
    if (!code) return;
    
    try {
      const res = await fetch(`/api/2fa/disable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: code }),
      });
      
      if (res.ok) {
        fetch2FAStatus();
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (error) {
      alert("Failed to disable 2FA");
    }
  };

  if (isLoading || !user) {
    return (
      <Section>
        <div className="text-center py-16">Loading...</div>
      </Section>
    );
  }

  return (
    <Section>
      <div className="max-w-2xl mx-auto">
        <Link href="/account" className="inline-flex items-center gap-2 text-text-muted hover:text-text mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Account
        </Link>

        <h1 className="text-2xl font-semibold mb-8">Security Settings</h1>

        {loading ? (
          <div className="text-center py-16">Loading...</div>
        ) : showBackupCodes && setupData ? (
          // Backup codes display
          <div className="card">
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <h3 className="font-semibold text-lg">2FA Enabled Successfully!</h3>
                <p className="text-sm text-text-muted">Save your backup codes in a safe place</p>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-18 p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-800">Important</p>
                  <p className="text-yellow-700">
                    These codes will only be shown once. Store them securely. Each code can only be used once.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-6">
              {setupData.backupCodes.map((code, idx) => (
                <div key={idx} className="font-mono text-center py-2 bg-surface-secondary rounded-lg">
                  {code}
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(setupData.backupCodes.join("\n"));
              }}
              className="btn btn-secondary w-full mb-3"
            >
              Copy All Codes
            </button>
            <button
              onClick={() => {
                setShowBackupCodes(false);
                setSetupData(null);
              }}
              className="btn btn-primary w-full"
            >
              I&apos;ve Saved My Codes
            </button>
          </div>
        ) : setupMode && setupData ? (
          // Setup mode
          <div className="card">
            <h3 className="font-semibold text-lg mb-6">Set Up Two-Factor Authentication</h3>

            <div className="mb-6">
              <p className="text-sm text-text-muted mb-4">
                1. Download an authenticator app like Google Authenticator or Authy
              </p>
              <p className="text-sm text-text-muted mb-4">
                2. Scan this QR code with your authenticator app:
              </p>
              <div className="flex justify-center mb-4">
                <img 
                  src={setupData.qrCodeUrl} 
                  alt="2FA QR Code" 
                  className="w-48 h-48 rounded-18 border"
                />
              </div>
              <p className="text-xs text-text-muted text-center mb-4">
                Or enter this code manually: <code className="bg-surface-secondary px-2 py-1 rounded">{setupData.secret}</code>
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                3. Enter the 6-digit code from your app:
              </label>
              <input
                type="text"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="input text-center text-2xl tracking-widest"
                maxLength={6}
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm mb-4">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSetupMode(false);
                  setSetupData(null);
                  setVerifyCode("");
                }}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={enable2FA}
                className="btn btn-primary flex-1"
                disabled={verifyCode.length !== 6}
              >
                Enable 2FA
              </button>
            </div>
          </div>
        ) : (
          // Status view
          <>
            {/* 2FA Section */}
            <div className="card mb-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    twoFAStatus?.enabled ? "bg-green-100" : "bg-gray-100"
                  }`}>
                    <Smartphone className={`w-6 h-6 ${twoFAStatus?.enabled ? "text-green-600" : "text-gray-500"}`} />
                  </div>
                  <div>
                    <h3 className="font-medium">Two-Factor Authentication</h3>
                    <p className="text-sm text-text-muted mt-1">
                      Add an extra layer of security to your account using an authenticator app.
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {twoFAStatus?.enabled ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm text-green-600 font-medium">Enabled</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span className="text-sm text-red-600 font-medium">Not enabled</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {twoFAStatus?.enabled ? (
                  <button onClick={disable2FA} className="btn btn-secondary text-sm">
                    Disable
                  </button>
                ) : (
                  <button onClick={startSetup} className="btn btn-primary text-sm">
                    Enable
                  </button>
                )}
              </div>
            </div>

            {/* Password Section */}
            <div className="card mb-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <Key className="w-6 h-6 text-gray-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">Password</h3>
                  <p className="text-sm text-text-muted mt-1">
                    Change your password regularly to keep your account secure.
                  </p>
                  <Link href="/auth/forgot-password" className="text-sm text-accent hover:underline mt-2 inline-block">
                    Change password
                  </Link>
                </div>
              </div>
            </div>

            {/* Stealth Lock Screen Section */}
            <div className="card mb-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-purple-50 dark:bg-purple-950/40 rounded-full flex items-center justify-center shrink-0">
                  <Shield className="w-6 h-6 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base mb-1">Stealth Lock Screen</h3>
                  <p className="text-sm text-text-muted mb-4">
                    Protect your session with a 4-digit PIN overlay when idle.
                  </p>

                  <form onSubmit={handleSaveStealthPinSettings} className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="stealthPin" className="block text-xs font-semibold mb-1">
                          {hasStealthPin ? "Change 4-Digit Security PIN" : "Set 4-Digit Security PIN"}
                        </label>
                        <input
                          id="stealthPin"
                          type="password"
                          pattern="[0-9]*"
                          inputMode="numeric"
                          maxLength={4}
                          placeholder={hasStealthPin ? "•••• (Enter new 4 digits)" : "Enter 4 digits"}
                          className="input font-mono text-center tracking-widest text-lg"
                          value={stealthPin}
                          onChange={(e) => setStealthPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        />
                      </div>

                      <div>
                        <label htmlFor="stealthTimeout" className="block text-xs font-semibold mb-1">
                          Idle Lock Duration
                        </label>
                        <select
                          id="stealthTimeout"
                          className="input text-sm"
                          value={stealthTimeout}
                          onChange={(e) => setStealthTimeout(parseInt(e.target.value))}
                        >
                          <option value={60000}>1 minute</option>
                          <option value={300000}>5 minutes</option>
                          <option value={600000}>10 minutes</option>
                          <option value={36000000}>Disable Lock</option>
                        </select>
                      </div>
                    </div>

                    <div className="bg-surface-secondary dark:bg-gray-900/40 p-3 rounded-lg border border-border">
                      <label className="flex items-start gap-3 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={stealthAutoWipe}
                          onChange={(e) => setStealthAutoWipe(e.target.checked)}
                          className="rounded border-gray-300 text-accent focus:ring-accent accent-accent w-4 h-4 cursor-pointer mt-0.5"
                        />
                        <div>
                          <span className="block text-xs font-semibold text-text">
                            Auto-Wipe Session on Timeout
                          </span>
                          <span className="block text-[10px] text-text-muted leading-tight mt-0.5">
                            Destroys cart, session tokens, and local cache if idle threshold is met to prevent domestic exposure.
                          </span>
                        </div>
                      </label>
                    </div>

                    {pinChangeSuccess && (
                      <div className="p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700 font-medium">
                        ✓ Stealth security settings updated successfully
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button type="submit" className="btn-primary py-2 text-xs">
                        Save Security settings
                      </button>
                      {hasStealthPin && (
                        <button
                          type="button"
                          onClick={handleRemoveStealthPin}
                          className="btn-secondary py-2 text-xs text-red-600 hover:text-red-700"
                        >
                          Remove PIN
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            </div>

            {/* Active Sessions */}
            {sessions.length > 0 && (
              <div className="card mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <Monitor className="w-5 h-5 text-accent" />
                  <h3 className="font-medium">Active Sessions</h3>
                </div>
                <div className="space-y-3">
                  {sessions.map((session) => (
                    <div key={session.id} className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg">
                      <div className="flex items-center gap-3 min-w-0">
                        <Monitor className="w-4 h-4 text-text-muted shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {session.device}
                            {session.isCurrent && (
                              <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Current</span>
                            )}
                          </p>
                          <p className="text-xs text-text-muted">{session.ipAddress} &middot; {new Date(session.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      {!session.isCurrent && (
                        <button
                          onClick={() => terminateSession(session.id)}
                          disabled={terminatingId === session.id}
                          className="text-red-600 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors shrink-0"
                          title="Terminate session"
                        >
                          {terminatingId === session.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Login Activity */}
            {loginHistory.length > 0 && (
              <div className="card mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <Clock className="w-5 h-5 text-accent" />
                  <h3 className="font-medium">Recent Login Activity</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 text-xs font-medium text-text-muted">Date</th>
                        <th className="text-left py-2 text-xs font-medium text-text-muted">Device</th>
                        <th className="text-left py-2 text-xs font-medium text-text-muted">IP</th>
                        <th className="text-left py-2 text-xs font-medium text-text-muted">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {loginHistory.map((entry) => (
                        <tr key={entry.id}>
                          <td className="py-2 text-xs">{new Date(entry.createdAt).toLocaleString()}</td>
                          <td className="py-2 text-xs">{entry.device || "Unknown"}</td>
                          <td className="py-2 text-xs font-mono">{entry.ipAddress}</td>
                          <td className="py-2">
                            {entry.success ? (
                              <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Success</span>
                            ) : (
                              <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">Failed</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Security Tips */}
            <div className="p-6 bg-surface-secondary rounded-18">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <Shield className="w-5 h-5 text-accent" />
                Security Tips
              </h3>
              <ul className="text-sm text-text-muted space-y-2">
                <li>• Use a strong, unique password for your account</li>
                <li>• Enable two-factor authentication for extra protection</li>
                <li>• Never share your password or 2FA codes with anyone</li>
                <li>• Keep your backup codes in a safe place</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </Section>
  );
}
