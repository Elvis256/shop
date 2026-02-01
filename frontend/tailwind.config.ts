import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        head: ["Sora", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
      colors: {
        bg: "#ffffff",
        text: "#111111",
        "text-muted": "#5a5a5a",
        border: "#eaeaea",
        accent: "#2a2a2a",
        "accent-hover": "#000000",
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
      },
      borderRadius: {
        "4": "4px",
        "8": "8px",
      },
      boxShadow: {
        sm: "0 2px 8px rgba(0,0,0,0.06)",
      },
      maxWidth: {
        container: "1200px",
      },
    },
  },
  plugins: [],
};

export default config;
