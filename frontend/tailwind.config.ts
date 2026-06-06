import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./contexts/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    screens: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
      "3xl": "1920px",
    },
    extend: {
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        head: ["-apple-system", "BlinkMacSystemFont", "var(--font-inter)", "SF Pro Display", "Inter", "sans-serif"],
        body: ["-apple-system", "BlinkMacSystemFont", "var(--font-inter)", "SF Pro Text", "Inter", "sans-serif"],
      },
      colors: {
        bg: "rgb(var(--bg-rgb) / <alpha-value>)",
        text: "rgb(var(--text-rgb) / <alpha-value>)",
        "text-muted": "rgb(var(--text-muted-rgb) / <alpha-value>)",
        border: "rgb(var(--border-rgb) / <alpha-value>)",
        accent: "rgb(var(--accent-rgb) / <alpha-value>)",
        "accent-hover": "rgb(var(--accent-hover-rgb) / <alpha-value>)",
        primary: {
          DEFAULT: "rgb(var(--primary-rgb) / <alpha-value>)",
          hover: "rgb(var(--primary-hover-rgb) / <alpha-value>)",
          light: "rgb(var(--primary-light-rgb) / <alpha-value>)",
          50: "rgb(var(--primary-50-rgb) / <alpha-value>)",
          100: "#e0efff",
          200: "#b8dcff",
          500: "rgb(var(--primary-rgb) / <alpha-value>)",
          600: "#0066cc",
          700: "#005bb5",
        },
        surface: {
          DEFAULT: "rgb(var(--surface-rgb) / <alpha-value>)",
          secondary: "rgb(var(--surface-secondary-rgb) / <alpha-value>)",
          tertiary: "rgb(var(--surface-tertiary-rgb) / <alpha-value>)",
        },
      },
      spacing: {
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
        sm: "0 1px 2px rgba(0,0,0,0.03), 0 1px 3px rgba(0,0,0,0.02)",
        md: "0 2px 8px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)",
        lg: "0 8px 24px rgba(0,0,0,0.06), 0 16px 48px rgba(0,0,0,0.08)",
        soft: "0 1px 4px rgba(0,0,0,0.02), 0 4px 16px rgba(0,0,0,0.04)",
        glow: "0 0 20px rgba(0,113,227,0.12)",
      },
      maxWidth: {
        container: "1400px",
      },
      letterSpacing: {
        tight: "-0.015em",
        tighter: "-0.025em",
      },
      animation: {
        "fade-up": "fadeUp 0.5s ease-out",
        "fade-in": "fadeIn 0.4s ease-out",
        "scale-in": "scaleIn 0.3s ease-out",
        "shimmer": "shimmer 2s infinite linear",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
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
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
