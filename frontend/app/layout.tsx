import type { Metadata, Viewport } from "next";
import { Inter, Fira_Code } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/Shell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fira-code",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Helios AI Trader",
  description: "Autonomous AI-powered penny stock trading platform",
  applicationName: "Helios",
};

export const viewport: Viewport = {
  themeColor: "#09090F",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`theme-amber-dark ${inter.variable} ${firaCode.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var key='helios-theme';var saved=localStorage.getItem(key);if(saved){document.documentElement.classList.remove('theme-amber-dark','theme-amber-light','theme-emerald-dark','theme-emerald-light','theme-violet-dark','theme-violet-light');document.documentElement.classList.add(saved);}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen text-wb-text antialiased bg-wb-bg">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
