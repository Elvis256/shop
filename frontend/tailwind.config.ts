import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./contexts/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        head: ["SF Pro Display", "Inter", "sans-serif"],
        body: ["SF Pro Text", "Inter", "sans-serif"],
      },
      colors: {
        bg: "#fafafa",
        text: "#1d1d1f",
        "text-muted": "#86868b",
        border: "#d2d2d7",
        accent: "#1d1d1f",
        "accent-hover": "#000000",
        primary: {
          DEFAULT: "#0071e3",
          hover: "#0077ed",
          light: "#e8f4fd",
          50: "#f0f7ff",
          100: "#e0efff",
          200: "#b8dcff",
          500: "#0071e3",
          600: "#0066cc",
          700: "#005bb5",
        },
        surface: {
          DEFAULT: "#ffffff",
          secondary: "#f5f5f7",
          tertiary: "#fbfbfd",
        },
      },
      spacing: {
        "4": "4px",
        "8": "8px",
        "12": "12px",
        "16": "16px",
        "24": "24px",
        "32": "32px",
        "48": "48px",
        "64": "64px",
        "80": "80px",
        "120": "120px",
      },
      borderRadius: {
        "4": "4px",
        "8": "8px",
        "12": "12px",
        "18": "18px",
        "24": "24px",
      },
      boxShadow: {
        sm: "0 1px 3px rgba(0,0,0,0.04)",
        md: "0 4px 12px rgba(0,0,0,0.08)",
        lg: "0 12px 40px rgba(0,0,0,0.12)",
        soft: "0 2px 8px rgba(0,0,0,0.04), 0 4px 24px rgba(0,0,0,0.06)",
      },
      maxWidth: {
        container: "1200px",
      },
      letterSpacing: {
        tight: "-0.02em",
        tighter: "-0.03em",
      },
      animation: {
        "fade-up": "fadeUp 0.5s ease-out",
        "fade-in": "fadeIn 0.4s ease-out",
        "scale-in": "scaleIn 0.3s ease-out",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
