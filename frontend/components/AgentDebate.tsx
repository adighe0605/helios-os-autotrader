"use client";

import { Bot, Brain, Gauge, Newspaper, ShieldAlert, TrendingUp } from "lucide-react";
import type { TradeDecision, AgentSignal } from "@/lib/types";
import { cn } from "@/lib/format";

const ICONS: Record<string, typeof Bot> = {
  momentum:         TrendingUp,
  penny_momentum:   TrendingUp,
  mean_reversion:   Gauge,
  sentiment:        Newspaper,
  risk:             ShieldAlert,
  portfolio_manager: Brain,
};

function verdictClass(v: AgentSignal["verdict"]) {
  return v === "buy" ? "pos-text" : v === "sell" ? "neg-text" : "text-wb-muted";
}

export function AgentDebate({ decision }: { decision: TradeDecision }) {
  return (
    <div className="grid lg:grid-cols-3 gap-2">
      {/* Verdict panel */}
      <div className="lg:col-span-2 bg-wb-surface border border-wb-border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-wb-border bg-wb-surface2">
          <div className="flex items-center gap-2">
            <Bot className="size-3.5 text-wb-orange" />
            <span className="text-[11px] font-semibold text-wb-text">Committee Verdict</span>
          </div>
          <span className="text-[11px] text-wb-muted num">
            Confidence: <span className="text-wb-text font-semibold">{(decision.confidence * 100).toFixed(0)}%</span>
          </span>
        </div>
        <div className="p-4">
          <div className={cn("text-4xl font-black tracking-tight mb-3", verdictClass(decision.verdict))}>
            {decision.verdict.toUpperCase()}
          </div>
          <p className="text-[12px] leading-relaxed text-wb-muted">{decision.summary}</p>
          {decision.stop_loss && decision.take_profit && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Pill label="Stop Loss"   value={`$${decision.stop_loss}`}   tone="neg" />
              <Pill label="Take Profit" value={`$${decision.take_profit}`} tone="pos" />
              <Pill label="Risk:Reward" value={decision.risk_reward ? `1 : ${decision.risk_reward}` : "—"} tone="orange" />
            </div>
          )}
        </div>
      </div>

      {/* Agent signals */}
      <div className="bg-wb-surface border border-wb-border overflow-hidden">
        <div className="px-4 py-2.5 border-b border-wb-border bg-wb-surface2">
          <span className="text-[11px] font-semibold text-wb-text">Agent Signals</span>
        </div>
        <ul className="divide-y divide-wb-border">
          {decision.signals.map((s) => {
            const Icon = ICONS[s.agent] ?? Bot;
            return (
              <li key={s.agent} className="flex items-start gap-3 px-4 py-3 hover:bg-wb-surface2 transition-colors">
                <div className={cn(
                  "size-7 flex items-center justify-center shrink-0 border",
                  s.verdict === "buy"  ? "bg-wb-green-dim border-wb-green/25 text-wb-green"  :
                  s.verdict === "sell" ? "bg-wb-red-dim border-wb-red/25 text-wb-red" :
                  "bg-wb-surface3 border-wb-border text-wb-muted"
                )}>
                  <Icon className="size-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[12px] font-semibold text-wb-text capitalize">
                      {s.agent.replace(/_/g, " ")}
                    </span>
                    <span className={cn("text-[10px] uppercase font-bold", verdictClass(s.verdict))}>
                      {s.verdict}
                    </span>
                    <span className="text-[10px] text-wb-dim num ml-auto">{(s.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <p className="text-[11px] text-wb-muted leading-snug line-clamp-2">{s.reasoning}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Pill({ label, value, tone }: { label: string; value: string; tone: "pos" | "neg" | "orange" }) {
  const styles =
    tone === "pos"    ? "bg-wb-green-dim text-wb-green border-wb-green/25"   :
    tone === "neg"    ? "bg-wb-red-dim text-wb-red border-wb-red/25"         :
                        "bg-wb-orange-dim text-wb-orange border-wb-orange/25";
  return (
    <div className={cn("border px-3 py-2", styles)}>
      <div className="text-[10px] uppercase tracking-wider opacity-70 mb-0.5">{label}</div>
      <div className="text-[13px] font-bold num">{value}</div>
    </div>
  );
}

