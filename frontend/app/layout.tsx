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
    <html lang="en" className={`theme-lifeos-default ${inter.variable} ${firaCode.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var key='helios-theme';var saved=localStorage.getItem(key);var all=['theme-lifeos-default','theme-lifeos-paper','theme-lifeos-brutalist','theme-lifeos-synthwave','theme-lifeos-terminal','theme-lifeos-glass','theme-lifeos-kawaii','theme-lifeos-comic','theme-lifeos-midnight','theme-lifeos-frutiger','theme-lifeos-forest','theme-lifeos-newspaper','theme-lifeos-royal','theme-lifeos-sunset','theme-lifeos-cyberpunk'];var root=document.documentElement;for(var i=0;i<all.length;i++){root.classList.remove(all[i]);}if(saved&&all.indexOf(saved)>=0){root.classList.add(saved);}else{root.classList.add('theme-lifeos-default');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen text-wb-text antialiased bg-wb-bg">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
