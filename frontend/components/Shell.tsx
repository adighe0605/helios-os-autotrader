"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import {
  BarChart3, Bot, History, Settings, Shield, TrendingUp, Zap,
} from "lucide-react";
import { cn, fmt } from "@/lib/format";
import { api } from "@/lib/api";

const nav = [
  { href: "/dashboard", label: "Dashboard",  icon: BarChart3  },
  { href: "/trade",     label: "Trade",       icon: TrendingUp },
  { href: "/agents",    label: "AI Agents",   icon: Bot        },
  { href: "/backtest",  label: "Backtest",    icon: History    },
  { href: "/settings",  label: "Settings",    icon: Settings   },
];

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
      <span className="text-wb-muted font-medium text-[11px]">{s}</span>
      <span className="text-[11px] num text-wb-dim">{p}</span>
      <span className={cn("text-[11px] num font-semibold", pos ? "pos-text" : "neg-text")}>{c}</span>
    </span>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { data: portfolio } = useSWR("shell-portfolio", () => api.portfolio(), { refreshInterval: 15_000 });
  const { data: health }    = useSWR("shell-health",    () => api.health(),    { refreshInterval: 30_000 });

  const alpacaConnected = (health as any)?.alpaca_connected === true;
  const alpacaMode      = (health as any)?.alpaca_mode ?? "disconnected";
  const modeLabel       = alpacaMode === "paper" ? "PAPER" : alpacaMode === "live" ? "LIVE" : "MOCK";
  const dotColor        = alpacaConnected
    ? (alpacaMode === "live" ? "bg-wb-green" : "bg-wb-orange")
    : "bg-wb-dim";

  return (
    <div className="min-h-screen flex flex-col bg-wb-bg">

      {/* ── Ticker bar ──────────────────────────────────────────── */}
      <div className="h-7 bg-wb-surface/80 border-b border-wb-border overflow-hidden flex items-center backdrop-blur-sm">
        <div className="ticker-track flex items-center h-full">
          {[...TICKERS, ...TICKERS].map((t, i) => (
            <TickerItem key={i} {...t} />
          ))}
        </div>
      </div>

      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="h-14 bg-wb-bg/90 border-b border-wb-border flex items-center px-4 gap-3 shrink-0 sticky top-0 z-30 backdrop-blur-md">
        <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0 cursor-pointer">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-wb-orange to-amber-600 flex items-center justify-center shadow-glow">
            <Zap className="w-4 h-4 text-black" strokeWidth={2.5} />
          </div>
          <div className="hidden sm:block">
            <div className="text-[14px] font-bold text-wb-text tracking-tight leading-none">Helios</div>
            <div className="text-[10px] text-wb-dim tracking-widest uppercase leading-none mt-0.5">AI Trader</div>
          </div>
        </Link>

        {/* Right side info */}
        <div className="ml-auto flex items-center gap-2">
          {/* Mode + value pill */}
          <div className="hidden sm:flex items-center gap-2 px-3 h-8 bg-wb-surface border border-wb-border rounded-lg">
            <Shield className="w-3.5 h-3.5 text-wb-orange" />
            <span className="text-[11px] font-semibold text-wb-muted">{modeLabel}</span>
            <span className="text-[13px] font-bold num text-wb-text">
              {portfolio ? fmt.usd(portfolio.portfolio_value) : "—"}
            </span>
          </div>
          {/* Connection status */}
          <div className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg bg-wb-surface border border-wb-border">
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor, alpacaConnected && "animate-pulseGlow")} />
            <span className="text-[11px] text-wb-muted hidden sm:block">
              {alpacaConnected ? `Alpaca ${modeLabel}` : "Offline"}
            </span>
          </div>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <aside className="hidden md:flex w-56 shrink-0 flex-col bg-wb-bg border-r border-wb-border pt-2 pb-4">
          <nav className="flex flex-col gap-0.5 px-2">
            {nav.map((n) => {
              const active = path?.startsWith(n.href);
              const Icon = n.icon;
              return (
                <Link key={n.href} href={n.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 cursor-pointer",
                    active
                      ? "bg-wb-orange/10 text-wb-orange"
                      : "text-wb-muted hover:text-wb-text hover:bg-wb-surface2"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {n.label}
                </Link>
              );
            })}
          </nav>

          {/* Market snapshot */}
          <div className="mt-auto mx-2 p-3 bg-wb-surface border border-wb-border rounded-xl">
            <div className="section-label mb-2.5">Market</div>
            <div className="space-y-1.5">
              {[
                { label: "S&P 500", val: "+0.84%" },
                { label: "NASDAQ",  val: "+1.12%" },
                { label: "DOW",     val: "-0.22%" },
              ].map(({ label, val }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-[12px] text-wb-muted">{label}</span>
                  <span className={cn("text-[12px] font-semibold num",
                    val.startsWith("-") ? "neg-text" : "pos-text")}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-auto px-3 sm:px-5 py-4 pb-20 md:pb-6 animate-fadeIn">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom nav ───────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-wb-bg/95 border-t border-wb-border backdrop-blur-md">
        <div className="flex items-center h-16 px-2 safe-area-pb">
          {nav.map((n) => {
            const active = path?.startsWith(n.href);
            const Icon = n.icon;
            return (
              <Link key={n.href} href={n.href}
                className="flex flex-col items-center justify-center gap-1 flex-1 h-full min-h-[44px] cursor-pointer"
                aria-label={n.label}
              >
                <div className={cn(
                  "w-10 h-8 flex items-center justify-center rounded-lg transition-all duration-150",
                  active ? "bg-wb-orange/15" : ""
                )}>
                  <Icon className={cn("w-5 h-5 transition-colors duration-150",
                    active ? "text-wb-orange" : "text-wb-dim")} />
                </div>
                <span className={cn("text-[10px] font-medium transition-colors duration-150",
                  active ? "text-wb-orange" : "text-wb-dim")}>
                  {n.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

    </div>
  );
}

