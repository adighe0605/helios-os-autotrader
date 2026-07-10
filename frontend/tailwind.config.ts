import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-fira-code)", "Fira Code", "ui-monospace", "JetBrains Mono", "monospace"],
      },
      colors: {
        wb: {
          bg: "rgb(var(--wb-bg) / <alpha-value>)",
          surface: "rgb(var(--wb-surface) / <alpha-value>)",
          surface2: "rgb(var(--wb-surface2) / <alpha-value>)",
          surface3: "rgb(var(--wb-surface3) / <alpha-value>)",
          border: "rgb(var(--wb-border) / <alpha-value>)",
          border2: "rgb(var(--wb-border2) / <alpha-value>)",
          orange: "rgb(var(--wb-orange) / <alpha-value>)",
          "orange-dim": "rgb(var(--wb-orange-dim) / <alpha-value>)",
          green: "rgb(var(--wb-green) / <alpha-value>)",
          "green-dim": "rgb(var(--wb-green-dim) / <alpha-value>)",
          red: "rgb(var(--wb-red) / <alpha-value>)",
          "red-dim": "rgb(var(--wb-red-dim) / <alpha-value>)",
          blue: "rgb(var(--wb-blue) / <alpha-value>)",
          "blue-dim": "rgb(var(--wb-blue-dim) / <alpha-value>)",
          text: "rgb(var(--wb-text) / <alpha-value>)",
          muted: "rgb(var(--wb-muted) / <alpha-value>)",
          dim: "rgb(var(--wb-dim) / <alpha-value>)",
        },
        // Legacy aliases for backward compat
        ink: {
          950: "rgb(var(--wb-bg) / <alpha-value>)",
          900: "rgb(var(--wb-surface) / <alpha-value>)",
          800: "rgb(var(--wb-surface2) / <alpha-value>)",
          700: "rgb(var(--wb-surface3) / <alpha-value>)",
          600: "rgb(var(--wb-border) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--wb-orange) / <alpha-value>)",
          glow: "rgb(var(--wb-orange-glow) / <alpha-value>)",
        },
        pos: "rgb(var(--wb-green) / <alpha-value>)",
        neg: "rgb(var(--wb-red) / <alpha-value>)",
        warn: "rgb(var(--wb-orange) / <alpha-value>)",
      },
      boxShadow: {
        card:        "0 1px 2px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)",
        "card-hover":"0 4px 24px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.09)",
        "card-lg":   "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.07)",
        glow:        "0 0 24px -6px rgba(245,158,11,0.45)",
        "glow-green":"0 0 20px -5px rgba(34,197,94,0.4)",
        "glow-red":  "0 0 20px -5px rgba(239,68,68,0.4)",
        "inner-top": "inset 0 1px 0 rgba(255,255,255,0.06)",
        sm:          "0 1px 2px rgba(0,0,0,0.6)",
      },
      backgroundImage: {
        "gradient-orange": "linear-gradient(135deg, rgba(245,158,11,0.1), transparent)",
        "gradient-green":  "linear-gradient(135deg, rgba(34,197,94,0.08), transparent)",
        "gradient-red":    "linear-gradient(135deg, rgba(239,68,68,0.08), transparent)",
        "gradient-blue":   "linear-gradient(135deg, rgba(59,130,246,0.08), transparent)",
        "shimmer":         "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.04) 50%, transparent 60%)",
        "card-shine":      "linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 60%)",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { opacity: "0.5" },
          "50%":      { opacity: "1" },
        },
        tickerScroll: {
          "0%":   { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        fadeIn: {
          "0%":   { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%":   { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        pulseGlow:    "pulseGlow 2.4s ease-in-out infinite",
        tickerScroll: "tickerScroll 50s linear infinite",
        fadeIn:       "fadeIn 0.25s ease-out",
        slideUp:      "slideUp 0.3s ease-out",
        shimmer:      "shimmer 2s ease-in-out infinite",
      },
      borderRadius: {
        DEFAULT: "8px",
        sm:  "6px",
        md:  "10px",
        lg:  "12px",
        xl:  "16px",
        "2xl": "20px",
        "3xl": "24px",
        full: "9999px",
      },
    },
  },
  plugins: [],
};

export default config;
