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
          // Backgrounds — deeper OLED blacks with blue-tint (21st.dev feel)
          bg:       "#09090F",
          surface:  "#111118",
          surface2: "#18181F",
          surface3: "#21212A",
          // Borders — refined
          border:   "#27273A",
          border2:  "#38384F",
          // Brand accent
          orange:      "#F0A400",
          "orange-dim": "#2A2100",
          // Status
          green:       "#00C076",
          "green-dim": "#001B10",
          red:         "#F6465D",
          "red-dim":   "#240810",
          // Typography
          text:  "#F0F0F8",
          muted: "#8888A8",
          dim:   "#44445A",
        },
        // Legacy aliases
        ink: {
          950: "#09090F",
          900: "#111118",
          800: "#18181F",
          700: "#21212A",
          600: "#27273A",
        },
        accent: { DEFAULT: "#F0A400", glow: "#F5B800", violet: "#F0A400" },
        pos:  "#00C076",
        neg:  "#F6465D",
        warn: "#F0A400",
      },
      boxShadow: {
        card:   "0 1px 3px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
        "card-hover": "0 4px 16px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.07)",
        glow:   "0 0 20px -5px rgba(240,164,0,0.4)",
        "glow-green": "0 0 16px -4px rgba(0,192,118,0.35)",
        "glow-red":   "0 0 16px -4px rgba(246,70,93,0.35)",
        glass:  "inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 3px rgba(0,0,0,0.5)",
        "inner-top": "inset 0 1px 0 rgba(255,255,255,0.08)",
      },
      backgroundImage: {
        "gradient-orange": "linear-gradient(135deg, rgba(240,164,0,0.12), transparent)",
        "gradient-green":  "linear-gradient(135deg, rgba(0,192,118,0.1), transparent)",
        "gradient-red":    "linear-gradient(135deg, rgba(246,70,93,0.1), transparent)",
        "shimmer": "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.05) 50%, transparent 60%)",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { opacity: "0.6" },
          "50%":      { opacity: "1" },
        },
        tickerScroll: {
          "0%":   { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        fadeIn: {
          "0%":   { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%":   { opacity: "0", transform: "translateX(8px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        countUp: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        pulseGlow:    "pulseGlow 2.4s ease-in-out infinite",
        tickerScroll: "tickerScroll 40s linear infinite",
        fadeIn:       "fadeIn 0.2s ease-out",
        slideInRight: "slideInRight 0.2s ease-out",
        shimmer:      "shimmer 2s ease-in-out infinite",
        countUp:      "countUp 0.4s ease-out",
      },
      borderRadius: {
        DEFAULT: "6px",
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
    },
  },
  plugins: [],
};

export default config;

