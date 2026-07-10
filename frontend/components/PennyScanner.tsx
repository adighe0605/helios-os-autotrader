"use client";

import useSWR from "swr";
import { RefreshCw, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/format";
import type { ScanCandidate } from "@/lib/types";

const verdictStyle: Record<string, { label: string; cls: string }> = {
  buy:  { label: "BUY",  cls: "bg-wb-green-dim text-wb-green border border-wb-green/25" },
  sell: { label: "SELL", cls: "bg-wb-red-dim text-wb-red border border-wb-red/25"       },
  hold: { label: "HOLD", cls: "bg-wb-orange-dim text-wb-orange border border-wb-orange/25" },
};

function SurgeBar({ surge }: { surge: number }) {
  const pct   = Math.min(100, (surge / 6) * 100);
  const color = surge >= 3 ? "#00C076" : surge >= 2 ? "#F0A400" : "#848E9C";
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-[3px] bg-wb-surface3 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[11px] num w-8 text-right" style={{ color }}>{surge.toFixed(1)}×</span>
    </div>
  );
}

function ConfBar({ value }: { value: number }) {
  const pct   = Math.round(value * 100);
  const color = pct >= 75 ? "#00C076" : pct >= 60 ? "#F0A400" : "#F6465D";
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-[3px] bg-wb-surface3 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[11px] num w-7 text-right" style={{ color }}>{pct}%</span>
    </div>
  );
}

export function PennyScanner() {
  const { data, isLoading, mutate } = useSWR(
    "penny-scan",
    () => api.pennyScanner(),
    { refreshInterval: 90_000 },
  );
  const rows = data ?? [];

  return (
    <div className="bg-wb-surface border border-wb-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-wb-border bg-wb-surface2">
        <div className="flex items-center gap-2">
          <Zap className="size-3.5 text-wb-orange" />
          <span className="text-[11px] font-semibold text-wb-text">Penny Scanner</span>
          <span className="text-[10px] bg-wb-orange-dim text-wb-orange border border-wb-orange/20 px-1.5 py-0.5">
            ≤ $5
          </span>
        </div>
        <button onClick={() => mutate()} title="Refresh"
          className="p-2.5 hover:bg-wb-surface3 transition-colors rounded-sm">
          <RefreshCw size={12} className={cn("text-wb-dim", isLoading && "animate-spin")} />
        </button>
      </div>

      {/* Column headers */}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <div className="min-w-[380px] grid gap-0 border-b border-wb-border bg-wb-surface2"
            style={{ gridTemplateColumns: "80px 68px 54px 1fr 1fr 56px" }}>
            {["Symbol", "Price", "Chg%", "Vol Surge", "AI Score", "Signal"].map((h) => (
              <div key={h} className={cn(
                "px-2 py-1.5 text-[10px] uppercase text-wb-dim tracking-wider",
                h === "Symbol" ? "text-left" : "text-right last:text-center"
              )}>{h}</div>
            ))}
          </div>
        </div>
      )}

      {isLoading && rows.length === 0 && (
        <div className="py-8 text-center text-[11px] text-wb-dim">Scanning universe…</div>
      )}
      {!isLoading && rows.length === 0 && (
        <div className="py-8 text-center text-[11px] text-wb-dim">No penny candidates meeting threshold right now.</div>
      )}

      <div className="overflow-x-auto">
        {rows.map((c: ScanCandidate) => {
          const pos = c.change_pct >= 0;
          const vs = verdictStyle[c.verdict] ?? verdictStyle.hold;
          return (
            <div key={c.symbol}
              className="min-w-[380px] grid items-center border-b border-wb-border last:border-0 hover:bg-wb-surface2 transition-colors"
              style={{ gridTemplateColumns: "80px 68px 54px 1fr 1fr 56px" }}>
              <div className="px-2 py-2.5 flex items-center gap-1.5">
                <span className="w-1 h-3 rounded-full bg-wb-orange shrink-0" />
                <span className="font-semibold text-[12px] text-wb-text">{c.symbol}</span>
              </div>
              <div className="px-2 py-2.5 text-right num text-[12px] text-wb-text">
                ${c.price.toFixed(4)}
              </div>
              <div className={cn("px-2 py-2.5 text-right num text-[12px] font-medium",
                pos ? "pos-text" : "neg-text")}>
                {pos ? "+" : ""}{c.change_pct.toFixed(2)}%
              </div>
              <div className="px-2 py-2.5">
                <SurgeBar surge={c.volume_surge} />
              </div>
              <div className="px-2 py-2.5">
                <ConfBar value={c.confidence} />
              </div>
              <div className="px-2 py-2.5 flex justify-center">
                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-sm", vs.cls)}>
                  {vs.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 border-t border-wb-border bg-wb-surface2">
        <span className="text-[10px] text-wb-dim">Sorted by volume surge · refreshes every 90s</span>
      </div>
    </div>
  );
}

