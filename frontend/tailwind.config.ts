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
          // OLED-first backgrounds — near-black with very subtle blue tint (21st.dev)
          bg:       "#09090B",
          surface:  "#111113",
          surface2: "#18181B",
          surface3: "#27272A",
          // Borders — very subtle, layered
          border:   "rgba(255,255,255,0.07)",
          border2:  "rgba(255,255,255,0.12)",
          // Brand accent — warm amber
          orange:      "#F59E0B",
          "orange-dim": "#1C1400",
          // Status
          green:       "#22C55E",
          "green-dim": "#052E16",
          red:         "#EF4444",
          "red-dim":   "#1F0707",
          blue:        "#3B82F6",
          "blue-dim":  "#0C1A3B",
          // Typography scale
          text:  "#FAFAFA",
          muted: "#A1A1AA",
          dim:   "#52525B",
        },
        // Legacy aliases for backward compat
        ink: {
          950: "#09090B",
          900: "#111113",
          800: "#18181B",
          700: "#27272A",
          600: "rgba(255,255,255,0.07)",
        },
        accent: { DEFAULT: "#F59E0B", glow: "#FBB924" },
        pos:  "#22C55E",
        neg:  "#EF4444",
        warn: "#F59E0B",
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

