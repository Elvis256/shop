"use client";

import { useTheme } from "@/lib/hooks/useTheme";
import { Sun, Moon, Monitor } from "lucide-react";

interface ThemeToggleProps {
  showLabel?: boolean;
  variant?: "icon" | "dropdown";
}

export default function ThemeToggle({ showLabel = false, variant = "icon" }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  if (variant === "dropdown") {
    return (
      <div className="relative group">
        <button
          className="p-2 rounded-lg hover:bg-surface-secondary transition-colors"
          title="Theme"
        >
          {resolvedTheme === "dark" ? (
            <Moon className="w-5 h-5 text-text-muted" />
          ) : (
            <Sun className="w-5 h-5 text-text-muted" />
          )}
        </button>
        <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 py-1 min-w-[140px]">
          <button
            onClick={() => setTheme("light")}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-secondary transition-colors ${theme === "light" ? "text-primary font-medium" : "text-text-muted"}`}
          >
            <Sun className="w-4 h-4" />
            Light
          </button>
          <button
            onClick={() => setTheme("dark")}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-secondary transition-colors ${theme === "dark" ? "text-primary font-medium" : "text-text-muted"}`}
          >
            <Moon className="w-4 h-4" />
            Dark
          </button>
          <button
            onClick={() => setTheme("system")}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-secondary transition-colors ${theme === "system" ? "text-primary font-medium" : "text-text-muted"}`}
          >
            <Monitor className="w-4 h-4" />
            System
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-secondary transition-colors"
      title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      suppressHydrationWarning
    >
      {resolvedTheme === "dark" ? (
        <Sun className="w-5 h-5 text-text-muted" />
      ) : (
        <Moon className="w-5 h-5 text-text-muted" />
      )}
      {showLabel && (
        <span className="text-sm text-text-muted">
          {resolvedTheme === "dark" ? "Light" : "Dark"} Mode
        </span>
      )}
    </button>
  );
}
