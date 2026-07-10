"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, Bot, History, Settings, Shield, TrendingUp, Zap,
} from "lucide-react";
import { cn } from "@/lib/format";

const nav = [
  { href: "/dashboard", label: "Dashboard",  icon: BarChart3  },
  { href: "/trade",     label: "Trade",       icon: TrendingUp },
  { href: "/agents",    label: "AI Agents",   icon: Bot        },
  { href: "/backtest",  label: "Backtest",    icon: History    },
  { href: "/settings",  label: "Settings",    icon: Settings   },
];

// Static ticker data — in production wire to your /market/movers endpoint
const TICKERS = [
  { s: "AAPL", p: "212.49", c: "+1.24%" },
  { s: "NVDA", p: "137.82", c: "+2.87%" },
  { s: "TSLA", p: "248.10", c: "-0.53%" },
  { s: "AMD",  p: "162.34", c: "+1.92%" },
  { s: "META", p: "517.20", c: "+0.74%" },
  { s: "AMZN", p: "190.55", c: "+0.31%" },
  { s: "MSFT", p: "441.00", c: "+0.88%" },
  { s: "SNDL", p: "1.24",   c: "+8.45%" },
  { s: "MMAT", p: "0.93",   c: "+15.2%" },
  { s: "CLOV", p: "1.87",   c: "+4.10%" },
  { s: "NAKD", p: "0.72",   c: "+11.8%" },
  { s: "SPY",  p: "554.20", c: "+0.84%" },
  { s: "QQQ",  p: "472.60", c: "+1.12%" },
];

function TickerItem({ s, p, c }: { s: string; p: string; c: string }) {
  const pos = !c.startsWith("-");
  return (
    <span className="inline-flex items-center gap-1.5 px-4 border-r border-wb-border shrink-0">
      <span className="text-wb-text font-medium text-[11px]">{s}</span>
      <span className="text-[11px] num text-wb-muted">{p}</span>
      <span className={cn("text-[11px] num font-medium", pos ? "pos-text" : "neg-text")}>{c}</span>
    </span>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="min-h-screen flex flex-col bg-wb-bg">
      {/* ── Top ticker bar ─────────────────────────────────────────── */}
      <div className="h-8 bg-wb-surface border-b border-wb-border overflow-hidden flex items-center">
        <div className="ticker-track flex items-center h-full">
          {[...TICKERS, ...TICKERS].map((t, i) => (
            <TickerItem key={i} {...t} />
          ))}
        </div>
      </div>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="h-12 bg-wb-surface border-b border-wb-border flex items-center px-4 gap-4 shrink-0">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
          <div className="size-7 rounded-sm bg-wb-orange flex items-center justify-center">
            <Zap className="size-4 text-black" />
          </div>
          <span className="font-bold text-wb-text tracking-tight text-[13px] hidden sm:block">Helios</span>
          <span className="text-[10px] uppercase tracking-widest text-wb-muted hidden sm:block">AI Trader</span>
        </Link>

        {/* Account pill */}
        <div className="ml-auto flex items-center gap-3 text-xs">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-wb-surface2 border border-wb-border rounded-sm">
            <Shield className="size-3 text-wb-orange" />
            <span className="text-wb-muted">Paper</span>
            <span className="text-wb-text font-semibold num">$100,000.00</span>
          </div>
          <span className="hidden md:flex items-center gap-1.5 text-wb-muted">
            <span className="size-1.5 rounded-full bg-wb-green animate-pulseGlow" />
            Markets Open
          </span>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden md:flex w-52 shrink-0 flex-col bg-wb-surface border-r border-wb-border">
          <nav className="flex flex-col pt-2">
            {nav.map((n) => {
              const active = path?.startsWith(n.href);
              const Icon = n.icon;
              return (
                <Link key={n.href} href={n.href}
                  className={cn(
                    "relative flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium transition-colors",
                    active
                      ? "text-wb-orange bg-wb-orange-dim border-l-2 border-wb-orange"
                      : "text-wb-muted hover:text-wb-text hover:bg-wb-surface2 border-l-2 border-transparent"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {n.label}
                </Link>
              );
            })}
          </nav>

          {/* Bottom market status */}
          <div className="mt-auto p-3 border-t border-wb-border">
            <div className="text-[10px] text-wb-dim uppercase tracking-wider mb-2">Market Status</div>
            <div className="flex flex-col gap-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-wb-muted">S&amp;P 500</span>
                <span className="pos-text num">+0.84%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-wb-muted">NASDAQ</span>
                <span className="pos-text num">+1.12%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-wb-muted">DOW</span>
                <span className="neg-text num">-0.22%</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto px-4 sm:px-5 py-4">{children}</main>
      </div>

      {/* ── Mobile bottom nav ───────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-wb-surface border-t border-wb-border flex items-center justify-around z-40">
        {nav.map((n) => {
          const active = path?.startsWith(n.href);
          const Icon = n.icon;
          return (
            <Link key={n.href} href={n.href}
              className={cn("flex flex-col items-center gap-0.5 text-[10px]",
                active ? "text-wb-orange" : "text-wb-dim")}
            >
              <Icon className="size-5" />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

