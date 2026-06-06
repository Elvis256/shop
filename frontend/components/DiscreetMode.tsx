"use client";

import { useState, useEffect, createContext, useContext, useCallback, useRef } from "react";
import { Eye, EyeOff, LogOut } from "lucide-react";

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
  const originalTitle = useRef("");
  const originalFavicon = useRef("");
  const lastEscapeTime = useRef(0);

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

  // Tab title and favicon management
  useEffect(() => {
    if (isDiscreet) {
      document.title = "Online Store";
      // Set generic favicon
      const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (link) {
        link.href = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🛒</text></svg>";
      }
    } else {
      if (originalTitle.current) document.title = originalTitle.current;
      const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (link && originalFavicon.current) {
        link.href = originalFavicon.current;
      }
    }
  }, [isDiscreet]);

  const toggle = useCallback(() => {
    setIsDiscreet((prev) => {
      const next = !prev;
      localStorage.setItem("discreet_mode", next ? "1" : "0");
      return next;
    });
  }, []);

  return (
    <DiscreetModeContext.Provider value={{ isDiscreet, toggle }}>
      {isDiscreet && (
        <style>{`
          /* Hide all product images and replace with blurred placeholder */
          [data-product-image] { filter: blur(12px) !important; pointer-events: none; }
          img[src*="/uploads/"], img[src*="cloudinary"] { filter: blur(12px) !important; }
          /* Replace product names with generic text via CSS */
          [data-product-name] { color: transparent !important; }
          [data-product-name]::after { content: "Wellness Product"; color: #374151; position: absolute; left: 0; top: 0; }
          [data-product-name] { position: relative !important; }
          /* Hide category names that are too specific */
          [data-sensitive-category] { visibility: hidden; }
          /* Blur hero images */
          [data-hero-image] { filter: blur(8px) !important; }
          /* Generic cart item labels */
          [data-cart-item-name] { font-size: 0 !important; }
          [data-cart-item-name]::after { content: "Item"; font-size: 14px; color: #374151; }
        `}</style>
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
