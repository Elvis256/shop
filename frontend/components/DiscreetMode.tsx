"use client";

import { useState, useEffect, createContext, useContext, useCallback, useRef } from "react";
import { Eye, EyeOff, LogOut, Lock } from "lucide-react";

// ─── Context ──────────────────────────────────────────────────────────────────

interface DiscreetModeContextType {
  isDiscreet: boolean;
  toggle: () => void;
}

const DiscreetModeContext = createContext<DiscreetModeContextType>({
  isDiscreet: false,
  toggle: () => {},
});

export function useDiscreetMode() {
  return useContext(DiscreetModeContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function DiscreetModeProvider({ children }: { children: React.ReactNode }) {
  const [isDiscreet, setIsDiscreet] = useState(false);
  const [isAppBlurred, setIsAppBlurred] = useState(false);
  const [showPinScreen, setShowPinScreen] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  
  const originalTitle = useRef("");
  const originalFavicon = useRef("");
  const lastEscapeTime = useRef(0);
  const lastActiveTime = useRef(Date.now());

  useEffect(() => {
    // Restore from localStorage (persist across sessions)
    const saved = localStorage.getItem("discreet_mode");
    if (saved === "1") {
      setIsDiscreet(true);
    }

    // Store original page details
    originalTitle.current = document.title;
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (link) originalFavicon.current = link.href;

    // Keyboard shortcut: Ctrl+D or double-press Escape
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        setIsDiscreet((prev) => {
          const next = !prev;
          localStorage.setItem("discreet_mode", next ? "1" : "0");
          return next;
        });
      }
      // Double-press Escape to toggle
      if (e.key === "Escape") {
        const now = Date.now();
        if (now - lastEscapeTime.current < 500) {
          setIsDiscreet((prev) => {
            const next = !prev;
            localStorage.setItem("discreet_mode", next ? "1" : "0");
            return next;
          });
          lastEscapeTime.current = 0;
        } else {
          lastEscapeTime.current = now;
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Tab title, favicon, and PWA manifest management
  useEffect(() => {
    const updateManifest = () => {
      const manifest = document.getElementById("pwa-manifest") as HTMLLinkElement;
      if (isDiscreet) {
        const skin = localStorage.getItem("stealth_manifest_skin") || "calculator";
        if (skin === "notes") {
          document.title = "Notes";
          const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
          if (link) {
            link.href = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📝</text></svg>";
          }
          if (manifest) {
            manifest.href = "/manifest-notes.json";
          }
        } else {
          document.title = "Calculator";
          const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
          if (link) {
            link.href = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🧮</text></svg>";
          }
          if (manifest) {
            manifest.href = "/manifest-calculator.json";
          }
        }
      } else {
        if (originalTitle.current) document.title = originalTitle.current;
        const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        if (link && originalFavicon.current) {
          link.href = originalFavicon.current;
        }
        if (manifest) {
          manifest.href = "/manifest.json";
        }
      }
    };

    updateManifest();

    window.addEventListener("stealthSkinChanged", updateManifest);
    return () => window.removeEventListener("stealthSkinChanged", updateManifest);
  }, [isDiscreet]);

  // Handle visibility changes (blur when backgrounded)
  useEffect(() => {
    const handleVisibility = () => {
      const shieldEnabled = localStorage.getItem("stealth_blur_shield") !== "false";
      if (document.visibilityState === "hidden" && shieldEnabled) {
        setIsAppBlurred(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Inactivity timeout & self-destruct check
  useEffect(() => {
    const checkInactivity = () => {
      if (showPinScreen) return; // Already locked
      
      const activePin = localStorage.getItem("discreet_pin");
      const selfDestruct = localStorage.getItem("discreet_self_destruct") === "1";
      const timeoutSetting = localStorage.getItem("discreet_timeout");
      const timeout = timeoutSetting ? parseInt(timeoutSetting) : 300000; // 5 minutes default
      
      const elapsed = Date.now() - lastActiveTime.current;

      if (elapsed > timeout) {
        if (selfDestruct) {
          // Self-Destruct: wipe storage completely and refresh
          localStorage.removeItem("cart");
          localStorage.removeItem("cartId");
          localStorage.removeItem("twa_token");
          localStorage.removeItem("twa_refresh_token");
          window.location.reload();
        } else if (activePin) {
          setShowPinScreen(true);
        }
      }
    };

    const interval = setInterval(checkInactivity, 10000); // Check every 10s

    const updateActivity = () => {
      lastActiveTime.current = Date.now();
    };

    window.addEventListener("mousemove", updateActivity);
    window.addEventListener("keypress", updateActivity);
    window.addEventListener("touchstart", updateActivity);
    window.addEventListener("scroll", updateActivity);

    return () => {
      clearInterval(interval);
      window.removeEventListener("mousemove", updateActivity);
      window.removeEventListener("keypress", updateActivity);
      window.removeEventListener("touchstart", updateActivity);
      window.removeEventListener("scroll", updateActivity);
    };
  }, [showPinScreen]);

  const toggle = useCallback(() => {
    setIsDiscreet((prev) => {
      const next = !prev;
      localStorage.setItem("discreet_mode", next ? "1" : "0");
      return next;
    });
  }, []);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    const savedPin = localStorage.getItem("discreet_pin");
    if (pinInput === savedPin) {
      setShowPinScreen(false);
      setIsAppBlurred(false);
      setPinInput("");
      setPinError("");
      lastActiveTime.current = Date.now();
    } else {
      setPinError("Invalid PIN code. Try again.");
      setPinInput("");
    }
  };

  return (
    <DiscreetModeContext.Provider value={{ isDiscreet, toggle }}>
      {isDiscreet && (
        <style>{`
          /* Hide all product images and replace with blurred placeholder */
          [data-product-image] { filter: blur(12px) !important; pointer-events: none; }
          img[src*="/uploads/"], img[src*="cloudinary"] { filter: blur(12px) !important; }
          /* Replace product names with generic text via CSS */
          [data-product-name] { color: transparent !important; }
          [data-product-name]::after { content: "Wellness Product"; color: var(--text-muted); position: absolute; left: 0; top: 0; }
          [data-product-name] { position: relative !important; }
          /* Hide category names that are too specific */
          [data-sensitive-category] { visibility: hidden; }
          /* Blur hero images */
          [data-hero-image] { filter: blur(8px) !important; }
          /* Generic cart item labels */
          [data-cart-item-name] { font-size: 0 !important; }
          [data-cart-item-name]::after { content: "Item"; font-size: 14px; color: var(--text-muted); }
        `}</style>
      )}
      
      {/* Blurred app screen overlay */}
      {isAppBlurred && !showPinScreen && (
        <div 
          onClick={() => {
            const pin = localStorage.getItem("discreet_pin");
            if (pin) {
              setShowPinScreen(true);
            } else {
              setIsAppBlurred(false);
            }
          }}
          className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-3xl flex flex-col items-center justify-center cursor-pointer select-none text-white text-center p-4 animate-fade-in"
        >
          <div className="bg-white/10 border border-white/20 p-6 rounded-2xl max-w-sm w-full shadow-2xl">
            <Lock className="w-12 h-12 text-yellow-400 mx-auto mb-3 animate-pulse" />
            <h2 className="text-lg font-bold">Session Hidden</h2>
            <p className="text-xs text-white/70 mt-1">Tap anywhere to resume your session.</p>
          </div>
        </div>
      )}

      {/* PIN Lock Screen Modal */}
      {showPinScreen && (
        <div className="fixed inset-0 z-[10000] bg-bg flex flex-col items-center justify-center text-text p-4">
          <form onSubmit={handleUnlock} className="bg-surface p-6 rounded-2xl max-w-sm w-full shadow-2xl border border-border flex flex-col text-center">
            <Lock className="w-10 h-10 text-primary mx-auto mb-3" />
            <h2 className="text-xl font-bold">App Locked</h2>
            <p className="text-xs text-text-muted mt-1">Enter your 4-digit PIN to continue browsing.</p>
            
            <input 
              type="password" 
              maxLength={6}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className="mt-6 text-center text-2xl font-bold tracking-[1em] py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary border-border bg-surface text-text w-full"
              autoFocus
              required
            />
            {pinError && <p className="text-xs text-red-600 mt-2">{pinError}</p>}
            
            <button 
              type="submit"
              className="mt-6 w-full py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-semibold text-sm transition-colors"
            >
              Unlock
            </button>
          </form>
        </div>
      )}

      {children}
    </DiscreetModeContext.Provider>
  );
}

// ─── Quick Exit ──────────────────────────────────────────────────────────────

function QuickExit() {
  const { isDiscreet } = useDiscreetMode();

  if (!isDiscreet) return null;

  const handleQuickExit = () => {
    window.location.replace("https://www.google.com");
  };

  return (
    <button
      onClick={handleQuickExit}
      className="fixed top-4 right-4 z-[60] px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-full shadow-lg hover:bg-red-700 transition-colors flex items-center gap-1.5 animate-pulse"
      title="Quick Exit - Go to Google"
    >
      <LogOut className="w-3.5 h-3.5" />
      EXIT
    </button>
  );
}

// ─── Floating Panic Button ────────────────────────────────────────────────────

export default function DiscreetModeButton() {
  const { isDiscreet, toggle } = useDiscreetMode();
  const [showTooltip, setShowTooltip] = useState(false);

  // Show hint on first visit
  useEffect(() => {
    const seen = localStorage.getItem("discreet_hint_seen");
    if (!seen) {
      setTimeout(() => setShowTooltip(true), 5000);
      localStorage.setItem("discreet_hint_seen", "1");
    }
  }, []);

  return (
    <>
      <QuickExit />
      <div className="fixed bottom-24 lg:bottom-6 right-4 z-50 flex flex-col items-end gap-2">
        {showTooltip && !isDiscreet && (
          <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 max-w-[180px] text-center shadow-lg animate-fade-in">
            Tap to hide products from view
            <div className="mt-1 text-gray-400 text-[10px]">Ctrl+D or double-press Esc</div>
          </div>
        )}

        <button
          onClick={() => { toggle(); setShowTooltip(false); }}
          title={isDiscreet ? "Show products (Ctrl+D)" : "Hide products (Ctrl+D)"}
          className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${
            isDiscreet
              ? "bg-gray-800 hover:bg-gray-700 ring-2 ring-yellow-400"
              : "bg-gray-700 hover:bg-gray-600"
          }`}
          aria-label={isDiscreet ? "Disable discreet mode" : "Enable discreet mode"}
        >
          {isDiscreet ? (
            <EyeOff className="w-5 h-5 text-yellow-400" />
          ) : (
            <Eye className="w-5 h-5 text-white opacity-70" />
          )}
        </button>

        {isDiscreet && (
          <div className="bg-gray-900 text-yellow-400 text-[10px] font-medium rounded px-2 py-1">
            DISCREET
          </div>
        )}
      </div>
    </>
  );
}
