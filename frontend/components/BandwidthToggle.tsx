"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Zap, Wifi, WifiOff } from "lucide-react";

interface LiteModeContextType {
  isLite: boolean;
  toggle: () => void;
}

const LiteModeContext = createContext<LiteModeContextType>({
  isLite: false,
  toggle: () => {},
});

export function useLiteMode() {
  return useContext(LiteModeContext);
}

export function LiteModeProvider({ children }: { children: React.ReactNode }) {
  const [isLite, setIsLite] = useState(false);
  const [autoDetected, setAutoDetected] = useState(false);

  useEffect(() => {
    // Restore from localStorage
    const saved = localStorage.getItem("lite_mode");
    if (saved === "1") {
      setIsLite(true);
      return;
    }

    // Auto-detect slow connections
    const conn = (navigator as any).connection;
    if (conn) {
      const checkSpeed = () => {
        const type = conn.effectiveType;
        if ((type === "2g" || type === "slow-2g") && !autoDetected) {
          setIsLite(true);
          setAutoDetected(true);
        }
      };
      checkSpeed();
      conn.addEventListener?.("change", checkSpeed);
      return () => conn.removeEventListener?.("change", checkSpeed);
    }
  }, [autoDetected]);

  // Apply global lite mode styles
  useEffect(() => {
    if (isLite) {
      document.documentElement.classList.add("lite-mode");
    } else {
      document.documentElement.classList.remove("lite-mode");
    }
  }, [isLite]);

  const toggle = useCallback(() => {
    setIsLite((prev) => {
      const next = !prev;
      localStorage.setItem("lite_mode", next ? "1" : "0");
      return next;
    });
  }, []);

  return (
    <LiteModeContext.Provider value={{ isLite, toggle }}>
      {isLite && (
        <style>{`
          .lite-mode img { image-rendering: pixelated; }
          .lite-mode [data-animate], .lite-mode .animate-fade-in, .lite-mode .hover-lift { animation: none !important; transition: none !important; }
          .lite-mode video, .lite-mode iframe { display: none !important; }
          .lite-mode .shadow-lg, .lite-mode .shadow-soft { box-shadow: none !important; }
          .lite-mode .backdrop-blur-sm, .lite-mode .backdrop-blur { backdrop-filter: none !important; }
          .lite-mode .bg-gradient-to-br, .lite-mode .bg-gradient-to-r { background-image: none !important; }
        `}</style>
      )}
      {children}
    </LiteModeContext.Provider>
  );
}

export default function BandwidthToggle() {
  const { isLite, toggle } = useLiteMode();
  const [showBanner, setShowBanner] = useState(false);

  // Show suggestion banner on slow connections
  useEffect(() => {
    const conn = (navigator as any).connection;
    if (conn && !localStorage.getItem("lite_mode")) {
      const type = conn.effectiveType;
      if (type === "2g" || type === "slow-2g" || type === "3g") {
        setShowBanner(true);
      }
    }
  }, []);

  return (
    <>
      {/* Slow connection banner */}
      {showBanner && !isLite && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-amber-800">
            <WifiOff className="w-4 h-4" />
            <span>Slow connection detected. Enable Lite Mode for faster loading?</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { toggle(); setShowBanner(false); }}
              className="px-3 py-1 bg-amber-600 text-white rounded-full text-xs font-medium hover:bg-amber-700"
            >
              Enable
            </button>
            <button
              onClick={() => setShowBanner(false)}
              className="px-3 py-1 text-amber-700 text-xs font-medium hover:text-amber-900"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Footer toggle */}
      <button
        onClick={toggle}
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        title={isLite ? "Switch to Full Mode" : "Switch to Lite Mode (saves data)"}
      >
        {isLite ? (
          <>
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Lite Mode On</span>
          </>
        ) : (
          <>
            <Wifi className="w-3.5 h-3.5" />
            <span>Lite Mode</span>
          </>
        )}
      </button>
    </>
  );
}
