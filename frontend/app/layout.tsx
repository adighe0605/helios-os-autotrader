import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "Helios AI Trader",
  description: "Autonomous AI-powered penny stock trading platform",
  applicationName: "Helios",
};

export const viewport: Viewport = {
  themeColor: "#0D1117",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen text-wb-text antialiased bg-wb-bg">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
