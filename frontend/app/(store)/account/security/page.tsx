"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Section from "@/components/Section";
import { useAuth } from "@/lib/hooks/useAuth";
import { ArrowLeft, Shield, Smartphone, Key, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

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

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) {
      fetch2FAStatus();
    }
  }, [user]);

  const fetch2FAStatus = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/2fa/status`, {
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/2fa/setup`, {
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/2fa/enable`, {
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/2fa/disable`, {
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
