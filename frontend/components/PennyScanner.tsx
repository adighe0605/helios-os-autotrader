"use client";

import { useState } from "react";
import useSWR from "swr";
import { RefreshCw, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/format";
import type { ScanCandidate } from "@/lib/types";

const verdictConfig: Record<string, { label: string; cls: string }> = {
  buy:  { label: "BUY",  cls: "badge-green" },
  sell: { label: "SELL", cls: "badge-red" },
  hold: { label: "HOLD", cls: "badge-orange" },
};

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-wb-surface3 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[11px] num w-8 text-right shrink-0" style={{ color }}>
        {value.toFixed(1)}×
      </span>
    </div>
  );
}

function ConfBar({ value }: { value: number }) {
  const pct   = Math.round(value * 100);
  const color = pct >= 75 ? "#22C55E" : pct >= 60 ? "#F59E0B" : "#EF4444";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-wb-surface3 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[11px] num w-7 text-right shrink-0" style={{ color }}>{pct}%</span>
    </div>
  );
}

export function PennyScanner() {
  const [refreshToken, setRefreshToken] = useState<number>(0);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const { data, isLoading, isValidating, mutate } = useSWR(
    ["penny-scan", refreshToken],
    ([, token]) => api.pennyScanner(token ? String(token) : undefined),
    { refreshInterval: 90_000 },
  );
  const rows = data ?? [];

  async function refreshNow() {
    const now = Date.now();
    setRefreshToken(now);
    setLastRefreshAt(new Date(now));
    await mutate();
  }

  return (
    <div className="bg-wb-surface border border-wb-border rounded-xl overflow-hidden shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-wb-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-wb-orange/10 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-wb-orange" />
          </div>
          <div>
            <span className="text-[13px] font-semibold text-wb-text">Penny Scanner</span>
            <span className="ml-2 badge badge-orange">≤ $5</span>
          </div>
        </div>
        <button
          onClick={refreshNow}
          disabled={isValidating}
          className="btn-icon"
          aria-label="Refresh scanner"
        >
          <RefreshCw className={cn("w-4 h-4", isValidating && "animate-spin")} />
        </button>
      </div>

      {/* Column headers */}
      <div className="hidden md:block overflow-x-auto">
        {rows.length > 0 && (
          <div className="min-w-[420px] grid border-b border-wb-border bg-wb-surface2/50"
            style={{ gridTemplateColumns: "90px 72px 58px 1fr 1fr 64px" }}>
            {["Symbol", "Price", "Chg%", "Vol Surge", "AI Score", "Signal"].map((h) => (
              <div key={h} className={cn(
                "px-3 py-2 section-label",
                h === "Symbol" ? "text-left" : "text-right last:text-center"
              )}>{h}</div>
            ))}
          </div>
        )}
      </div>

      {isLoading && rows.length === 0 && (
        <div className="py-12 text-center">
          <div className="text-wb-dim text-[13px]">Scanning universe…</div>
          <div className="text-wb-dim/60 text-[12px] mt-1">Checking 40 penny stocks</div>
        </div>
      )}
      {!isLoading && rows.length === 0 && (
        <div className="py-12 text-center">
          <div className="text-wb-dim text-[13px]">No penny candidates right now</div>
          <div className="text-wb-dim/60 text-[12px] mt-1">Refreshes every 90 seconds</div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="md:hidden divide-y divide-wb-border">
          {rows.map((c: ScanCandidate) => {
            const pos = c.change_pct >= 0;
            const vc = verdictConfig[c.verdict] ?? verdictConfig.hold;
            const surgeColor = c.volume_surge >= 3 ? "#22C55E" : c.volume_surge >= 2 ? "#F59E0B" : "#71717A";
            return (
              <div key={c.symbol} className="px-4 py-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-5 rounded-full bg-wb-orange/60 shrink-0" />
                    <span className="text-[13px] font-semibold text-wb-text">{c.symbol}</span>
                    <span className="num text-[12px] text-wb-muted">${c.price.toFixed(4)}</span>
                  </div>
                  <span className={cn("badge font-bold", vc.cls)}>{vc.label}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-wb-dim">Chg%</span>
                    <span className={cn("num font-semibold", pos ? "pos-text" : "neg-text")}>
                      {pos ? "+" : ""}{c.change_pct.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-wb-dim">AI Score</span>
                    <span className="num text-wb-text">{Math.round(c.confidence * 100)}%</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-wb-dim">Vol Surge</span>
                    <span className="num" style={{ color: surgeColor }}>{c.volume_surge.toFixed(1)}×</span>
                  </div>
                  <MiniBar value={c.volume_surge} max={6} color={surgeColor} />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-wb-dim">Confidence</span>
                    <span className="num text-wb-text">{Math.round(c.confidence * 100)}%</span>
                  </div>
                  <ConfBar value={c.confidence} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="hidden md:block overflow-x-auto">
        {rows.map((c: ScanCandidate) => {
          const pos = c.change_pct >= 0;
          const vc  = verdictConfig[c.verdict] ?? verdictConfig.hold;
          const surgeColor = c.volume_surge >= 3 ? "#22C55E" : c.volume_surge >= 2 ? "#F59E0B" : "#71717A";
          return (
            <div key={c.symbol}
              className="min-w-[420px] grid items-center border-b border-wb-border last:border-0
                         hover:bg-wb-surface2/60 transition-colors duration-150 cursor-default"
              style={{ gridTemplateColumns: "90px 72px 58px 1fr 1fr 64px" }}>

              <div className="px-3 py-3 flex items-center gap-2">
                <div className="w-1.5 h-5 rounded-full bg-wb-orange/60 shrink-0" />
                <span className="text-[13px] font-semibold text-wb-text">{c.symbol}</span>
              </div>

              <div className="px-3 py-3 text-right num text-[13px] text-wb-text">
                ${c.price.toFixed(4)}
              </div>

              <div className={cn("px-3 py-3 text-right num text-[13px] font-semibold",
                pos ? "pos-text" : "neg-text")}>
                {pos ? "+" : ""}{c.change_pct.toFixed(2)}%
              </div>

              <div className="px-3 py-3">
                <MiniBar value={c.volume_surge} max={6} color={surgeColor} />
              </div>

              <div className="px-3 py-3">
                <ConfBar value={c.confidence} />
              </div>

              <div className="px-3 py-3 flex justify-center">
                <span className={cn("badge font-bold", vc.cls)}>{vc.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2.5 border-t border-wb-border bg-wb-surface2/40 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-wb-dim">Sorted by volume surge</span>
          <span className="text-[11px] text-wb-dim">
            {lastRefreshAt ? `Last refresh ${lastRefreshAt.toLocaleTimeString()}` : "Refreshes every 90s"}
          </span>
        </div>
        <p className="text-[11px] text-wb-muted">
          Scanner checks sub-$5 symbols and ranks them using momentum, volume surge, liquidity, and stability to generate BUY/HOLD/SELL signals.
        </p>
      </div>
    </div>
  );
}
