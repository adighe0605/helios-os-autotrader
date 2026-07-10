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
      colors: {
        // WeBull palette
        wb: {
          bg:       "#0D1117",   // page background
          surface:  "#161A20",   // card / panel
          surface2: "#1E2329",   // elevated panel
          surface3: "#252930",   // hovered row / input
          border:   "#2B2F36",   // subtle border
          border2:  "#363C45",   // visible border
          orange:   "#F0A400",   // primary accent (WeBull orange)
          "orange-dim": "#2D2600", // orange bg tint
          green:    "#00C076",   // gain / buy
          "green-dim": "#001F12", // green bg tint
          red:      "#F6465D",   // loss / sell
          "red-dim":   "#250A0D", // red bg tint
          text:     "#EAECEF",   // primary text
          muted:    "#848E9C",   // secondary text
          dim:      "#474D57",   // very muted
        },
        // Legacy aliases (keep existing components working)
        ink: {
          950: "#0D1117",
          900: "#161A20",
          800: "#1E2329",
          700: "#252930",
          600: "#2B2F36",
        },
        accent: {
          DEFAULT: "#F0A400",
          glow:    "#F5B800",
          violet:  "#F0A400",
        },
        pos:  "#00C076",
        neg:  "#F6465D",
        warn: "#F0A400",
      },
      backgroundImage: {
        "grid-fade": "none",
        "glow-radial": "none",
      },
      boxShadow: {
        glass: "0 1px 0 inset rgba(255,255,255,0.03), 0 0 0 1px rgba(255,255,255,0.05)",
        glow:  "0 0 20px -5px rgba(240,164,0,0.35)",
        card:  "0 2px 8px rgba(0,0,0,0.4)",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "Inter", "Segoe UI", "Helvetica Neue", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "JetBrains Mono", "monospace"],
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { opacity: "0.7" },
          "50%":      { opacity: "1" },
        },
        tickerScroll: {
          "0%":   { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        pulseGlow:    "pulseGlow 2.4s ease-in-out infinite",
        tickerScroll: "tickerScroll 40s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;

