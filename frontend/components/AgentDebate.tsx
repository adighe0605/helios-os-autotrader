"use client";

import { Bot, Brain, Gauge, Newspaper, ShieldAlert, TrendingUp } from "lucide-react";
import type { TradeDecision, AgentSignal } from "@/lib/types";
import { cn } from "@/lib/format";

const ICONS: Record<string, typeof Bot> = {
  momentum:          TrendingUp,
  penny_momentum:    TrendingUp,
  "technical-analysis": Gauge,
  "market-intelligence": TrendingUp,
  "options-flow": TrendingUp,
  "news-intelligence": Newspaper,
  "social-sentiment": Newspaper,
  "pattern-recognition": Gauge,
  macro: ShieldAlert,
  quant: Brain,
  mean_reversion:    Gauge,
  sentiment:         Newspaper,
  risk:              ShieldAlert,
  portfolio_manager: Brain,
};

function verdictBadge(v: AgentSignal["verdict"]) {
  return v === "buy"  ? "badge-green" :
         v === "sell" ? "badge-red"   :
         "badge-muted";
}

export function AgentDebate({ decision }: { decision: TradeDecision }) {
  const contributionByAgent = new Map((decision.agent_contributions ?? []).map((c) => [c.agent, c]));
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Committee verdict */}
      <div className="lg:col-span-2 bg-wb-surface border border-wb-border rounded-xl overflow-hidden shadow-card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-wb-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-wb-orange/10 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-wb-orange" />
            </div>
            <span className="text-[13px] font-semibold text-wb-text">Committee Verdict</span>
          </div>
          <span className="badge badge-muted num">{decision.confidence_score ?? Math.round(decision.confidence * 100)}% confidence</span>
        </div>

        <div className="p-5">
          {/* Big verdict word */}
          <div className={cn(
            "text-[48px] font-black tracking-tighter leading-none mb-3",
            decision.verdict === "buy"  ? "pos-text" :
            decision.verdict === "sell" ? "neg-text" :
            "text-wb-muted"
          )}>
            {decision.verdict.toUpperCase()}
          </div>

          <p className="text-[14px] leading-relaxed text-wb-muted mb-3">{decision.summary}</p>
          <p className="text-[12px] leading-relaxed text-wb-dim mb-5">{decision.recommendation}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <MetricCard label="Final Score" value={`${decision.score}/100`} tone="orange" />
            <MetricCard label="Risk" value={decision.risk} tone={decision.risk === "Low" ? "pos" : decision.risk === "Extreme" ? "neg" : "orange"} />
            <MetricCard label="Position Size" value={decision.positionSize} tone="orange" />
            <MetricCard label="Agreement" value={decision.agreement} tone="orange" />
          </div>

          {decision.stop_loss && decision.take_profit && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <MetricCard label="Stop Loss"   value={`$${decision.stop_loss}`}   tone="neg" />
              <MetricCard label="Take Profit" value={`$${decision.take_profit}`} tone="pos" />
              <MetricCard label="Risk : Reward" value={decision.risk_reward ? `1 : ${decision.risk_reward}` : "—"} tone="orange" />
            </div>
          )}
          {decision.conflictingSignals?.length > 0 && (
            <div className="mt-4 rounded-lg border border-wb-red/20 bg-wb-red/5 p-3">
              <div className="text-[12px] font-semibold text-wb-text mb-2">Conflicting Signals</div>
              <ul className="space-y-1">
                {decision.conflictingSignals.slice(0, 4).map((item) => (
                  <li key={item} className="text-[12px] text-wb-muted">• {item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Agent signals */}
      <div className="bg-wb-surface border border-wb-border rounded-xl overflow-hidden shadow-card">
        <div className="px-4 py-3 border-b border-wb-border">
          <span className="text-[13px] font-semibold text-wb-text">Agent Signals</span>
        </div>
        <ul className="divide-y divide-wb-border">
          {decision.signals.map((s) => {
            const Icon = ICONS[s.agent] ?? Bot;
            const contribution = contributionByAgent.get(s.agent);
            return (
              <li key={s.agent}
                className="flex items-start gap-3 px-4 py-3.5 hover:bg-wb-surface2/50 transition-colors duration-150">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  s.verdict === "buy"  ? "bg-wb-green/10 text-wb-green"  :
                  s.verdict === "sell" ? "bg-wb-red/10 text-wb-red"      :
                  "bg-wb-surface2 text-wb-muted"
                )}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[13px] font-semibold text-wb-text capitalize flex items-center gap-1.5">
                      <span className={cn("w-2 h-2 rounded-full shrink-0", contribution?.is_real_data ? "bg-wb-green" : "bg-wb-red")} />
                      {s.agent.replace(/[_-]/g, " ")}
                    </span>
                    <span className={cn("badge text-[10px] font-bold", verdictBadge(s.verdict))}>
                      {s.verdict.toUpperCase()}
                    </span>
                    <span className="text-[11px] text-wb-dim num ml-auto">{(s.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <p className="text-[12px] text-wb-muted leading-relaxed line-clamp-2">{s.reasoning}</p>
                  {contribution?.data_source && (
                    <p className="text-[11px] text-wb-dim mt-1">Source: {contribution.data_source}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: "pos" | "neg" | "orange" }) {
  const styles =
    tone === "pos"    ? "bg-wb-green/5 border-wb-green/15 text-wb-green"  :
    tone === "neg"    ? "bg-wb-red/5 border-wb-red/15 text-wb-red"        :
                        "bg-wb-orange/5 border-wb-orange/15 text-wb-orange";
  return (
    <div className={cn("border rounded-xl px-4 py-3", styles)}>
      <div className="section-label opacity-70 mb-1">{label}</div>
      <div className="text-[16px] font-bold num">{value}</div>
    </div>
  );
}
