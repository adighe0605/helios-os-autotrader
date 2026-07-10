"use client";

import { useState } from "react";
import {
  Clock,
  RefreshCw,
  TrendingUp,
  Shield,
  ChevronDown,
  ChevronUp,
  Zap,
  BarChart2,
  Target,
  ArrowDownCircle,
} from "lucide-react";
import { cn } from "@/lib/format";

interface Step {
  id: number;
  icon: React.ElementType;
  title: string;
  time: string;
  color: string;
  bg: string;
  badge: string;
  summary: string;
  details: React.ReactNode;
}

const steps: Step[] = [
  {
    id: 1,
    icon: Clock,
    title: "End-of-Day Flatten",
    time: "3:40 PM ET",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/25",
    badge: "SAFETY",
    summary: "Close all open positions before market close to avoid overnight risk.",
    details: (
      <ul className="space-y-1.5 text-[12px] text-wb-muted">
        <li className="flex items-start gap-2">
          <span className="text-red-400 mt-0.5">→</span>
          <span>At <span className="text-wb-text font-semibold">3:40 PM ET</span>, the bot checks for any open positions.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-red-400 mt-0.5">→</span>
          <span>If positions exist, it submits market sell orders to flatten the portfolio.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-red-400 mt-0.5">→</span>
          <span>This prevents overnight gaps, halts, or news events from causing uncontrolled losses.</span>
        </li>
      </ul>
    ),
  },
  {
    id: 2,
    icon: RefreshCw,
    title: "Re-Evaluate Open Positions",
    time: "Every 5 min",
    color: "text-wb-orange",
    bg: "bg-amber-500/10 border-amber-500/25",
    badge: "ACTIVE MGMT",
    summary: "Continuously manage existing trades: tighten stops on winners, exit early on reversals.",
    details: (
      <div className="space-y-3">
        {/* Trailing Stop Ratchet */}
        <div className="rounded-lg bg-wb-surface2/60 border border-wb-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-wb-green" />
            <span className="text-[12px] font-semibold text-wb-text">Trailing Stop Ratchet</span>
          </div>
          <div className="space-y-1.5 text-[12px]">
            <div className="flex items-center gap-2">
              <span className="w-16 text-wb-muted shrink-0">Gain ≥ 3%</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-wb-green/15 text-wb-green font-mono">→ Move stop to breakeven</span>
              <span className="text-wb-dim text-[11px]">No-loss guarantee</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-16 text-wb-muted shrink-0">Gain ≥ 5%</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-wb-green/15 text-wb-green font-mono">→ Trail at 50% of max gain</span>
              <span className="text-wb-dim text-[11px]">Lock in profit</span>
            </div>
          </div>
        </div>

        {/* Intraday Re-score */}
        <div className="rounded-lg bg-wb-surface2/60 border border-wb-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <BarChart2 className="w-3.5 h-3.5 text-wb-orange" />
            <span className="text-[12px] font-semibold text-wb-text">5-Minute Intraday Re-Score</span>
          </div>
          <p className="text-[12px] text-wb-muted">
            Every 5 minutes, the <span className="text-wb-text font-medium">IntradayAgent</span> re-scores open positions on 5m candles.
            If a position turns <span className="text-red-400 font-medium">bearish</span> while still profitable → exit early and lock in gains.
          </p>
        </div>

        {/* Hard stop */}
        <div className="rounded-lg bg-wb-surface2/60 border border-wb-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-3.5 h-3.5 text-red-400" />
            <span className="text-[12px] font-semibold text-wb-text">Hard Stop & Profit Target</span>
          </div>
          <p className="text-[12px] text-wb-muted">
            A fixed <span className="text-red-400 font-medium">hard stop</span> and <span className="text-wb-green font-medium">profit target</span> act as the safety floor — they trigger regardless of any trailing stop logic.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 3,
    icon: Zap,
    title: "New Entry Signals",
    time: "When slots open",
    color: "text-wb-green",
    bg: "bg-wb-green/10 border-wb-green/25",
    badge: "ENTRY",
    summary: "Bot enters new trades using two AI agents. Penny stocks get 70% allocation, blue chips 30%.",
    details: (
      <div className="space-y-3">
        {/* Penny */}
        <div className="rounded-lg bg-wb-surface2/60 border border-wb-border p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">70%</span>
              <span className="text-[12px] font-semibold text-wb-text">Penny Stocks</span>
            </div>
            <span className="text-[10px] text-wb-dim">High volatility / high upside</span>
          </div>
          <div className="space-y-1.5 text-[12px] text-wb-muted">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-mono text-[11px]">Step 1</span>
              <span><span className="text-wb-text font-medium">PennyMomentumAgent</span> scans daily candles for breakout signals</span>
            </div>
            <div className="flex items-center gap-2 pl-4">
              <ArrowDownCircle className="w-3 h-3 text-wb-dim shrink-0" />
              <span>Only proceeds if daily score is bullish</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-mono text-[11px]">Step 2</span>
              <span><span className="text-wb-text font-medium">IntradayAgent</span> confirms on 5-minute candles</span>
            </div>
            <div className="flex items-center gap-2 pl-4">
              <ArrowDownCircle className="w-3 h-3 text-wb-dim shrink-0" />
              <span>Enters only if <span className="text-wb-green font-medium">BOTH agents agree</span> (blended confidence score)</span>
            </div>
          </div>
        </div>

        {/* Blue Chip */}
        <div className="rounded-lg bg-wb-surface2/60 border border-wb-border p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">30%</span>
              <span className="text-[12px] font-semibold text-wb-text">Blue Chip Stocks</span>
            </div>
            <span className="text-[10px] text-wb-dim">Stable / lower risk</span>
          </div>
          <div className="space-y-1.5 text-[12px] text-wb-muted">
            <div className="flex items-center gap-2">
              <span className="text-blue-400 font-mono text-[11px]">Step 1</span>
              <span><span className="text-wb-text font-medium">MomentumAgent</span> scans daily candles for trend strength</span>
            </div>
            <div className="flex items-center gap-2 pl-4">
              <ArrowDownCircle className="w-3 h-3 text-wb-dim shrink-0" />
              <span>Filters by relative strength + volume confirmation</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-400 font-mono text-[11px]">Step 2</span>
              <span><span className="text-wb-text font-medium">IntradayAgent</span> confirms on 5-minute candles</span>
            </div>
            <div className="flex items-center gap-2 pl-4">
              <ArrowDownCircle className="w-3 h-3 text-wb-dim shrink-0" />
              <span>Enters only if <span className="text-wb-green font-medium">BOTH agents agree</span> (blended confidence score)</span>
            </div>
          </div>
        </div>
      </div>
    ),
  },
];

export function TradingStrategyCard() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-wb-surface border border-wb-border rounded-xl overflow-hidden">
      {/* Header */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 border-b border-wb-border hover:bg-wb-surface2/40 transition-colors cursor-pointer"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-wb-orange" />
          <span className="text-[13px] font-bold text-wb-text">Bot Strategy — How It Works</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-wb-green/15 text-wb-green border border-wb-green/25 font-semibold">AUTO</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-wb-dim" /> : <ChevronDown className="w-4 h-4 text-wb-dim" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {/* Timeline */}
          <div className="space-y-2">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isExpanded = expanded === step.id;
              return (
                <div key={step.id} className="relative">
                  {/* Connector line */}
                  {idx < steps.length - 1 && (
                    <div className="absolute left-[19px] top-[38px] w-px h-[calc(100%-12px)] bg-wb-border/50 z-0" />
                  )}

                  <div className={cn("relative z-10 rounded-xl border transition-all", step.bg)}>
                    {/* Step header */}
                    <button
                      type="button"
                      className="w-full flex items-start gap-3 p-3 cursor-pointer"
                      onClick={() => setExpanded(isExpanded ? null : step.id)}
                    >
                      {/* Step number + icon */}
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center border", step.bg)}>
                          <Icon className={cn("w-4 h-4", step.color)} />
                        </div>
                        <span className="text-[10px] font-bold text-wb-dim">{step.id}</span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-bold text-wb-text">{step.title}</span>
                          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", step.color,
                            step.id === 1 ? "bg-red-500/10 border-red-500/25" :
                            step.id === 2 ? "bg-amber-500/10 border-amber-500/25" :
                            "bg-wb-green/10 border-wb-green/25"
                          )}>
                            {step.badge}
                          </span>
                          <span className="text-[11px] text-wb-dim ml-auto shrink-0">{step.time}</span>
                        </div>
                        <p className="text-[12px] text-wb-muted mt-0.5 leading-relaxed">{step.summary}</p>
                      </div>

                      {/* Expand toggle */}
                      <div className="shrink-0 pt-1">
                        {isExpanded
                          ? <ChevronUp className="w-3.5 h-3.5 text-wb-dim" />
                          : <ChevronDown className="w-3.5 h-3.5 text-wb-dim" />
                        }
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-wb-border/40 pt-3">
                        {step.details}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Allocation summary bar */}
          <div className="rounded-xl border border-wb-border bg-wb-surface2/40 p-3">
            <span className="section-label mb-2 block">Capital Allocation</span>
            <div className="flex rounded-full overflow-hidden h-4 mb-2">
              <div className="bg-amber-500/70 flex items-center justify-center text-[10px] font-bold text-black" style={{ width: "70%" }}>
                70% Penny
              </div>
              <div className="bg-blue-500/70 flex items-center justify-center text-[10px] font-bold text-white" style={{ width: "30%" }}>
                30% Blue
              </div>
            </div>
            <div className="flex justify-between text-[11px] text-wb-muted">
              <span><span className="text-amber-400 font-semibold">SNDL, CLOV, HIMS</span> + others (penny universe)</span>
              <span><span className="text-blue-400 font-semibold">AAPL, NVDA, MSFT</span> + others</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
