"use client";

import { type ComponentType, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Gauge,
  PlayCircle,
  Settings,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/format";

type DemoStep = {
  key: string;
  title: string;
  subtitle: string;
  detail: string;
  bullets: string[];
  icon: ComponentType<{ className?: string }>;
  tone: "orange" | "green" | "blue";
};

const STEPS: DemoStep[] = [
  {
    key: "dashboard",
    title: "Live Portfolio Command Center",
    subtitle: "Dashboard",
    detail:
      "Track equity, day P&L, total P&L, current positions, and scanner opportunities in one clean view with live API refresh.",
    bullets: [
      "Real Alpaca paper account value and buying power",
      "Position-level P&L and risk visibility",
      "Top penny scanner candidates with AI score",
    ],
    icon: BarChart3,
    tone: "orange",
  },
  {
    key: "trade",
    title: "Execution Workflow",
    subtitle: "Trade",
    detail:
      "Place market, limit, or stop orders quickly with professional controls and quote/candle/news context for each ticker.",
    bullets: [
      "Order ticket with Buy/Sell side controls",
      "Quote strip + chart timeframe controls",
      "Paper order execution via Alpaca Trading API",
    ],
    icon: TrendingUp,
    tone: "green",
  },
  {
    key: "agents",
    title: "AI Committee Analysis",
    subtitle: "AI Agents",
    detail:
      "Multi-agent signals synthesize momentum, technicals, and risk context into one committee verdict with confidence.",
    bullets: [
      "Consensus verdict: BUY / HOLD / SELL",
      "Per-agent rationale and confidence",
      "Risk/reward, stop-loss, and take-profit guidance",
    ],
    icon: Bot,
    tone: "blue",
  },
  {
    key: "backtest",
    title: "Strategy Validation",
    subtitle: "Backtest",
    detail:
      "Validate a strategy over historical bars before risking capital, with clear outcome metrics and equity curve.",
    bullets: [
      "Final value, return, sharpe, max drawdown",
      "Daily equity curve visualization",
      "Capital and date-range controls",
    ],
    icon: ClipboardList,
    tone: "orange",
  },
  {
    key: "settings",
    title: "Risk & Automation Controls",
    subtitle: "Settings",
    detail:
      "Control trading mode, limits, kill switch, and bot aggressiveness with explicit safeguards for professional operation.",
    bullets: [
      "Paper/live mode control and confirmation",
      "Risk limits and kill-switch guardrails",
      "Auto-trade configuration and monitoring",
    ],
    icon: Settings,
    tone: "green",
  },
];

const toneStyles = {
  orange: "text-wb-orange bg-wb-orange/10 border-wb-orange/25",
  green: "text-wb-green bg-wb-green/10 border-wb-green/25",
  blue: "text-blue-400 bg-blue-500/10 border-blue-400/25",
};

export default function DemoPage() {
  const [idx, setIdx] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [progress, setProgress] = useState(0);
  const step = STEPS[idx];

  useEffect(() => {
    if (!autoPlay) return;
    setProgress(0);
    const totalMs = 6500;
    const tickMs = 100;
    const inc = (tickMs / totalMs) * 100;
    const t = setInterval(() => {
      setProgress((p) => {
        const next = p + inc;
        if (next >= 100) {
          setIdx((v) => (v + 1) % STEPS.length);
          return 0;
        }
        return next;
      });
    }, tickMs);
    return () => clearInterval(t);
  }, [autoPlay, idx]);

  const completion = useMemo(() => Math.round(((idx + 1) / STEPS.length) * 100), [idx]);
  const Icon = step.icon;

  function go(delta: number) {
    setAutoPlay(false);
    setProgress(0);
    setIdx((v) => (v + delta + STEPS.length) % STEPS.length);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-5">
      <header className="bg-wb-surface border border-wb-border rounded-xl p-4 sm:p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[20px] sm:text-[24px] font-bold text-wb-text tracking-tight">
              Helios Interactive Product Demo
            </h1>
            <p className="text-[13px] sm:text-[14px] text-wb-muted mt-1 max-w-3xl">
              A guided walkthrough of how the platform works end-to-end, from discovery to execution and risk control.
            </p>
          </div>
          <div className="badge badge-muted num">{completion}% complete</div>
        </div>
      </header>

      <section className="bg-wb-surface border border-wb-border rounded-xl overflow-hidden shadow-card">
        <div className="px-4 sm:px-5 py-3 border-b border-wb-border">
          <div className="flex items-center gap-3">
            <div className={cn("w-9 h-9 rounded-lg border flex items-center justify-center", toneStyles[step.tone])}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="section-label">{step.subtitle}</div>
              <h2 className="text-[18px] sm:text-[20px] font-semibold text-wb-text truncate">{step.title}</h2>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4">
            <div className="bg-wb-surface2 border border-wb-border rounded-xl p-4">
              <p className="text-[14px] leading-relaxed text-wb-muted">{step.detail}</p>
              <ul className="mt-4 space-y-2">
                {step.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-[13px] text-wb-text">
                    <CheckCircle2 className="w-4 h-4 text-wb-green shrink-0 mt-[1px]" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-wb-surface2 border border-wb-border rounded-xl p-4 space-y-3">
              <div className="section-label">Workflow Coverage</div>
              <div className="space-y-2">
                {[
                  { label: "Market Data", val: "Live" },
                  { label: "Execution", val: "Paper Alpaca" },
                  { label: "Risk Layer", val: "Active" },
                  { label: "Automation", val: "Configurable" },
                  { label: "AI Analytics", val: "Multi-Factor" },
                ].map((m) => (
                  <div key={m.label} className="flex items-center justify-between text-[13px]">
                    <span className="text-wb-muted">{m.label}</span>
                    <span className="text-wb-text font-semibold">{m.val}</span>
                  </div>
                ))}
              </div>
              <div className="divider" />
              <div className="flex items-center gap-2 text-[12px] text-wb-muted">
                <ShieldCheck className="w-4 h-4 text-wb-green" />
                Designed for disciplined, risk-aware operation.
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-3">
          <div className="h-1.5 bg-wb-surface3 rounded-full overflow-hidden">
            <div className="h-full bg-wb-orange transition-all duration-150" style={{ width: `${progress}%` }} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button onClick={() => go(-1)} className="btn btn-ghost btn-sm">
                <ChevronLeft className="w-4 h-4" />
                Prev
              </button>
              <button onClick={() => go(1)} className="btn btn-ghost btn-sm">
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => setAutoPlay((v) => !v)}
              className={cn("btn btn-sm", autoPlay ? "btn-primary" : "btn-ghost")}
            >
              <PlayCircle className="w-4 h-4" />
              {autoPlay ? "Auto-play On" : "Auto-play Off"}
            </button>
          </div>
        </div>
      </section>

      <section className="bg-wb-surface border border-wb-border rounded-xl p-4 sm:p-5 shadow-card">
        <h3 className="text-[16px] font-semibold text-wb-text">Quick Start</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          {[
            { icon: Gauge, title: "1. Review Scanner", body: "Check top-ranked penny candidates with confidence scores." },
            { icon: TrendingUp, title: "2. Validate Setup", body: "Use Trade + AI Agents to validate momentum, risk, and entry." },
            { icon: ShieldCheck, title: "3. Execute Safely", body: "Submit paper orders and keep risk controls active in Settings." },
          ].map((c) => (
            <div key={c.title} className="bg-wb-surface2 border border-wb-border rounded-xl p-4">
              <c.icon className="w-4 h-4 text-wb-orange mb-2" />
              <div className="text-[14px] font-semibold text-wb-text">{c.title}</div>
              <p className="text-[13px] text-wb-muted mt-1">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard" className="btn btn-primary">Go to Dashboard</Link>
        <Link href="/settings" className="btn btn-ghost">Back to Settings</Link>
      </div>
    </div>
  );
}
