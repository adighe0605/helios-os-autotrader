"use client";

import { Bot, Brain, Gauge, Newspaper, ShieldAlert, TrendingUp } from "lucide-react";

import { cn } from "@/lib/format";
import type { AgentSignal, TradeDecision } from "@/lib/types";

const ICONS: Record<string, typeof Bot> = {
  momentum: TrendingUp,
  penny_momentum: TrendingUp,
  "technical-analysis": Gauge,
  "market-intelligence": TrendingUp,
  "options-flow": TrendingUp,
  "news-intelligence": Newspaper,
  "social-sentiment": Newspaper,
  "pattern-recognition": Gauge,
  macro: ShieldAlert,
  quant: Brain,
  mean_reversion: Gauge,
  sentiment: Newspaper,
  risk: ShieldAlert,
  portfolio_manager: Brain,
};

function verdictBadge(v: AgentSignal["verdict"]) {
  return v === "buy" ? "badge-green" : v === "sell" ? "badge-red" : "badge-muted";
}

function fmtMetricValue(value: unknown) {
  if (typeof value === "number") {
    if (Math.abs(value) >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value;
  return "—";
}

export function LegacyAgentDebate({ decision }: { decision: TradeDecision }) {
  const realAgentSet = new Set(
    (decision.agent_contributions ?? [])
      .filter((c) => c.is_real_data)
      .map((c) => c.agent)
  );
  const realSignals = decision.signals.filter((signal) => realAgentSet.has(signal.agent));

  const signalWeight = realSignals.reduce((sum, signal) => sum + Math.max(0, signal.confidence), 0);
  const directionalScore = realSignals.reduce((sum, signal) => {
    const dir = signal.verdict === "buy" ? 1 : signal.verdict === "sell" ? -1 : 0;
    return sum + dir * Math.max(0, signal.confidence);
  }, 0);
  const normalizedDirection = signalWeight > 0 ? directionalScore / signalWeight : 0;
  const legacyVerdict: AgentSignal["verdict"] = normalizedDirection > 0.15 ? "buy" : normalizedDirection < -0.15 ? "sell" : "hold";
  const baseConfidence = realSignals.length > 0 ? realSignals.reduce((sum, signal) => sum + signal.confidence, 0) / realSignals.length : 0;
  const agreementFactor = 0.6 + Math.min(0.4, Math.abs(normalizedDirection));
  const legacyConfidence = Math.max(0, Math.min(0.99, baseConfidence * agreementFactor));
  const legacySummary = realSignals.length > 0
    ? `${legacyVerdict.toUpperCase()} based on ${realSignals.length} real-data agent signal${realSignals.length === 1 ? "" : "s"}.`
    : "No real-data agent signals available yet for this symbol.";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 bg-wb-surface border border-wb-border rounded-xl overflow-hidden shadow-card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-wb-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-wb-orange/10 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-wb-orange" />
            </div>
            <span className="text-[13px] font-semibold text-wb-text">Stock Analysis</span>
          </div>
          <span className="badge badge-muted num">
            {(legacyConfidence * 100).toFixed(0)}% confidence
          </span>
        </div>

        <div className="p-5">
          <div
            className={cn(
              "text-[48px] font-black tracking-tighter leading-none mb-3",
              legacyVerdict === "buy" ? "pos-text" : legacyVerdict === "sell" ? "neg-text" : "text-wb-muted"
            )}
          >
            {legacyVerdict.toUpperCase()}
          </div>

          <p className="text-[14px] leading-relaxed text-wb-muted mb-5">{legacySummary}</p>

          {decision.stop_loss && decision.take_profit && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <MetricCard label="Stop Loss" value={`$${decision.stop_loss}`} tone="neg" />
              <MetricCard label="Take Profit" value={`$${decision.take_profit}`} tone="pos" />
              <MetricCard
                label="Risk : Reward"
                value={decision.risk_reward ? `1 : ${decision.risk_reward}` : "—"}
                tone="orange"
              />
            </div>
          )}
        </div>
      </div>

      <div className="bg-wb-surface border border-wb-border rounded-xl overflow-hidden shadow-card">
        <div className="px-4 py-3 border-b border-wb-border">
          <span className="text-[13px] font-semibold text-wb-text">Agent Signals</span>
        </div>
        {realSignals.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px] text-wb-dim">
            No real-data signals available. Configure missing data providers to populate legacy analysis.
          </div>
        ) : (
          <ul className="divide-y divide-wb-border">
          {realSignals.map((s) => {
            const Icon = ICONS[s.agent] ?? Bot;
            return (
              <li
                key={s.agent}
                className="flex items-start gap-3 px-4 py-3.5 hover:bg-wb-surface2/50 transition-colors duration-150"
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    s.verdict === "buy"
                      ? "bg-wb-green/10 text-wb-green"
                      : s.verdict === "sell"
                        ? "bg-wb-red/10 text-wb-red"
                        : "bg-wb-surface2 text-wb-muted"
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[13px] font-semibold text-wb-text capitalize">
                      {s.agent.replace(/[_-]/g, " ")}
                    </span>
                    <span className={cn("badge text-[10px] font-bold", verdictBadge(s.verdict))}>
                      {s.verdict.toUpperCase()}
                    </span>
                    <span className="text-[11px] text-wb-dim num ml-auto">{(s.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <p className="text-[12px] text-wb-muted leading-relaxed line-clamp-2">{s.reasoning}</p>
                  {Object.keys(s.indicators ?? {}).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {Object.entries(s.indicators)
                        .slice(0, 4)
                        .map(([key, value]) => (
                          <span key={key} className="badge badge-muted text-[10px]">
                            {key.replace(/_/g, " ")}: {fmtMetricValue(value)}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
          </ul>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: "pos" | "neg" | "orange" }) {
  const styles =
    tone === "pos"
      ? "bg-wb-green/5 border-wb-green/15 text-wb-green"
      : tone === "neg"
        ? "bg-wb-red/5 border-wb-red/15 text-wb-red"
        : "bg-wb-orange/5 border-wb-orange/15 text-wb-orange";
  return (
    <div className={cn("border rounded-xl px-4 py-3", styles)}>
      <div className="section-label opacity-70 mb-1">{label}</div>
      <div className="text-[16px] font-bold num">{value}</div>
    </div>
  );
}
