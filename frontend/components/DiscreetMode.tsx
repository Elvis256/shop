"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { Eye, EyeOff } from "lucide-react";

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

  useEffect(() => {
    // Restore from sessionStorage
    const saved = sessionStorage.getItem("discreet_mode");
    if (saved === "1") setIsDiscreet(true);

    // Keyboard shortcut: Ctrl+D or Cmd+D
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        setIsDiscreet((prev) => {
          const next = !prev;
          sessionStorage.setItem("discreet_mode", next ? "1" : "0");
          return next;
        });
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const toggle = useCallback(() => {
    setIsDiscreet((prev) => {
      const next = !prev;
      sessionStorage.setItem("discreet_mode", next ? "1" : "0");
      return next;
    });
  }, []);

  return (
    <DiscreetModeContext.Provider value={{ isDiscreet, toggle }}>
      {isDiscreet && (
        <style>{`
          /* Hide all product images and replace with blurred placeholder */
          [data-product-image] { filter: blur(12px) !important; pointer-events: none; }
          /* Replace product names with generic text via CSS */
          [data-product-name] { color: transparent !important; }
          [data-product-name]::after { content: "Wellness Product"; color: #374151; position: absolute; left: 0; top: 0; }
          [data-product-name] { position: relative !important; }
          /* Hide category names that are too specific */
          [data-sensitive-category] { visibility: hidden; }
          /* Blur hero images */
          [data-hero-image] { filter: blur(8px) !important; }
          /* Change page title in tab */
        `}</style>
      )}
      {children}
    </DiscreetModeContext.Provider>
  );
}

// ─── Floating Panic Button ────────────────────────────────────────────────────

export default function DiscreetModeButton() {
  const { isDiscreet, toggle } = useDiscreetMode();
  const [showTooltip, setShowTooltip] = useState(false);

  // Show hint on first visit
  useEffect(() => {
    const seen = sessionStorage.getItem("discreet_hint_seen");
    if (!seen) {
      setTimeout(() => setShowTooltip(true), 5000);
      sessionStorage.setItem("discreet_hint_seen", "1");
    }
  }, []);

  return (
    <div className="fixed bottom-24 lg:bottom-6 right-4 z-50 flex flex-col items-end gap-2">
      {showTooltip && !isDiscreet && (
        <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 max-w-[160px] text-center shadow-lg animate-fade-in">
          Tap to hide products from view
          <div className="mt-1 text-gray-400 text-[10px]">or press Ctrl+D</div>
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
  );
}
