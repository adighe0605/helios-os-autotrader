"use client";

import { useState } from "react";
import useSWR from "swr";
import { Gem, RefreshCw, Info, TrendingUp, Droplets, Activity } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/format";
import type { ScanCandidate } from "@/lib/types";

// The five gates a penny stock must clear to be "high value" — mirrors the
// thresholds enforced server-side in /api/auto-trade/scan.
const CRITERIA = [
  { icon: Droplets, label: "≥ $1M dollar volume", hint: "Institutions can fill — you can exit" },
  { icon: Activity, label: "RVOL ≥ 1.5×", hint: "Real volume acceleration today" },
  { icon: TrendingUp, label: "≥ $0.50 · major exchange", hint: "Avoids sub-penny OTC traps" },
];

function compactUsd(v: number) {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function HighValuePicks() {
  const [token, setToken] = useState(0);
  const [refreshAt, setRefreshAt] = useState<Date | null>(null);

  const swr = useSWR(
    ["penny-scan", token],
    ([, t]) => api.pennyScanner(t ? String(t) : undefined),
    { refreshInterval: 90_000 },
  );

  function refresh() {
    const t = Date.now();
    setToken(t);
    setRefreshAt(new Date(t));
    swr.mutate();
  }

  const all = swr.data ?? [];
  // Only genuine high-value picks. Fall back to the top momentum names if the
  // market currently has no name clearing every gate (keeps the card useful).
  const highValue = all.filter((c) => c.high_value);
  const fallback = all
    .filter((c) => c.quality_tier === "momentum")
    .slice(0, 3);
  const picks: ScanCandidate[] = highValue.length > 0 ? highValue.slice(0, 6) : fallback;
  const showingFallback = highValue.length === 0 && fallback.length > 0;

  return (
    <div className="bg-wb-surface border border-wb-border rounded-xl overflow-hidden shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-wb-border bg-gradient-to-r from-wb-orange/10 to-transparent">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-wb-orange/15 border border-wb-orange/25 flex items-center justify-center">
            <Gem className="w-4 h-4 text-wb-orange" />
          </div>
          <div>
            <h3 className="text-[13px] font-bold text-wb-text leading-tight">High-Value Penny Picks</h3>
            <p className="text-[11px] text-wb-muted leading-tight">Only names clearing every quality gate</p>
          </div>
        </div>
        <button onClick={refresh} disabled={swr.isValidating} className="btn-icon" aria-label="Refresh high-value picks">
          <RefreshCw className={cn("w-4 h-4", swr.isValidating && "animate-spin")} />
        </button>
      </div>

      {/* Criteria explainer */}
      <div className="px-4 py-2.5 border-b border-wb-border bg-wb-surface2/30 grid grid-cols-1 sm:grid-cols-3 gap-2">
        {CRITERIA.map((c) => (
          <div key={c.label} className="flex items-start gap-2">
            <c.icon className="w-3.5 h-3.5 text-wb-orange shrink-0 mt-0.5" />
            <div>
              <div className="text-[11px] font-semibold text-wb-text leading-tight">{c.label}</div>
              <div className="text-[10px] text-wb-dim leading-tight">{c.hint}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Loading / empty */}
      {swr.isLoading && picks.length === 0 && (
        <div className="py-10 text-center">
          <div className="text-wb-dim text-[13px]">Screening penny universe…</div>
          <div className="text-wb-dim/60 text-[12px] mt-1">Applying liquidity + RVOL filters</div>
        </div>
      )}
      {!swr.isLoading && picks.length === 0 && (
        <div className="py-10 text-center px-6">
          <Info className="w-5 h-5 text-wb-dim mx-auto mb-2" />
          <div className="text-wb-dim text-[13px]">No high-value setups right now</div>
          <div className="text-wb-dim/60 text-[12px] mt-1">
            That&apos;s normal — most sessions have zero pennies clearing every gate. Discipline &gt; forcing trades.
          </div>
        </div>
      )}

      {/* Fallback notice */}
      {showingFallback && (
        <div className="px-4 py-2 bg-wb-orange/5 border-b border-wb-border text-[11px] text-wb-muted flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-wb-orange shrink-0" />
          No name cleared every gate — showing the top momentum candidates instead.
        </div>
      )}

      {/* Picks */}
      {picks.length > 0 && (
        <div className="divide-y divide-wb-border">
          {picks.map((c, i) => {
            const pos = c.change_pct >= 0;
            const dv = c.dollar_volume ?? c.price * c.volume;
            return (
              <div key={c.symbol} className="px-4 py-3 hover:bg-wb-surface2/50 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[11px] num text-wb-dim w-4 shrink-0">{i + 1}</span>
                    <span className="text-[14px] font-bold text-wb-text">{c.symbol}</span>
                    {c.high_value && (
                      <span className="badge badge-green font-bold text-[9px] flex items-center gap-1">
                        <Gem className="w-2.5 h-2.5" /> HIGH-VALUE
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="num text-[13px] text-wb-text">${c.price.toFixed(4)}</span>
                    <span className={cn("num text-[13px] font-semibold w-16 text-right", pos ? "pos-text" : "neg-text")}>
                      {pos ? "+" : ""}{c.change_pct.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Metrics row */}
                <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-2 pl-6">
                  <Metric label="RVOL" value={`${c.volume_surge.toFixed(1)}×`} good={c.volume_surge >= 1.5} />
                  <Metric label="Liquidity" value={compactUsd(dv)} good={dv >= 1_000_000} />
                  <Metric label="AI Score" value={`${c.ai_score}`} good={c.ai_score >= 68} />
                  <Metric label="Conf" value={`${Math.round(c.confidence * 100)}%`} good={c.confidence >= 0.68} />
                </div>

                {/* Factor chips */}
                {c.factors && c.factors.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 pl-6">
                    {c.factors.slice(0, 4).map((f) => (
                      <span
                        key={f}
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-full border",
                          /risk|thin|sub-/.test(f)
                            ? "bg-wb-red/10 border-wb-red/20 text-wb-red"
                            : "bg-wb-orange/10 border-wb-orange/20 text-wb-orange"
                        )}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 border-t border-wb-border bg-wb-surface2/40 flex items-center justify-between">
        <span className="text-[10px] text-wb-dim">⚠ Educational only — pennies are high-risk. Never risk more than you can lose.</span>
        <span className="text-[10px] text-wb-dim shrink-0 ml-2">
          {refreshAt ? refreshAt.toLocaleTimeString() : "auto 90s"}
        </span>
      </div>
    </div>
  );
}

function Metric({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-wb-dim uppercase tracking-wide">{label}</span>
      <span className={cn("num text-[12px] font-semibold", good ? "text-wb-green" : "text-wb-muted")}>{value}</span>
    </div>
  );
}
