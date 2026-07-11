"use client";

import { useState } from "react";
import useSWR from "swr";
import { RefreshCw, Zap, TrendingUp } from "lucide-react";
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

function ScanTable({
  rows,
  isLoading,
  isValidating,
  onRefresh,
  lastRefreshAt,
  priceFormat,
  surgeMax,
  emptyMsg,
}: {
  rows: ScanCandidate[];
  isLoading: boolean;
  isValidating: boolean;
  onRefresh: () => void;
  lastRefreshAt: Date | null;
  priceFormat: (p: number) => string;
  surgeMax: number;
  emptyMsg: string;
}) {
  return (
    <>
      <div className="flex items-center justify-end px-4 py-2 border-b border-wb-border">
        <button
          onClick={onRefresh}
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
            style={{ gridTemplateColumns: "90px 80px 58px 1fr 1fr 64px" }}>
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
          <div className="text-wb-dim/60 text-[12px] mt-1">{emptyMsg}</div>
        </div>
      )}
      {!isLoading && rows.length === 0 && (
        <div className="py-12 text-center">
          <div className="text-wb-dim text-[13px]">No candidates right now</div>
          <div className="text-wb-dim/60 text-[12px] mt-1">Refreshes every 90 seconds</div>
        </div>
      )}

      {/* Mobile cards */}
      {rows.length > 0 && (
        <div className="md:hidden divide-y divide-wb-border">
          {rows.map((c: ScanCandidate) => {
            const pos = c.change_pct >= 0;
            const vc = verdictConfig[c.verdict] ?? verdictConfig.hold;
            const surgeColor = c.volume_surge >= 2 ? "#22C55E" : c.volume_surge >= 1.2 ? "#F59E0B" : "#71717A";
            return (
              <div key={c.symbol} className="px-4 py-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-5 rounded-full bg-wb-orange/60 shrink-0" />
                    <span className="text-[13px] font-semibold text-wb-text">{c.symbol}</span>
                    <span className="num text-[12px] text-wb-muted">{priceFormat(c.price)}</span>
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
                <MiniBar value={c.volume_surge} max={surgeMax} color={surgeColor} />
                <ConfBar value={c.confidence} />
              </div>
            );
          })}
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        {rows.map((c: ScanCandidate) => {
          const pos = c.change_pct >= 0;
          const vc  = verdictConfig[c.verdict] ?? verdictConfig.hold;
          const surgeColor = c.volume_surge >= 2 ? "#22C55E" : c.volume_surge >= 1.2 ? "#F59E0B" : "#71717A";
          return (
            <div key={c.symbol}
              className="min-w-[420px] grid items-center border-b border-wb-border last:border-0
                         hover:bg-wb-surface2/60 transition-colors duration-150 cursor-default"
              style={{ gridTemplateColumns: "90px 80px 58px 1fr 1fr 64px" }}>
              <div className="px-3 py-3 flex items-center gap-2">
                <div className="w-1.5 h-5 rounded-full bg-wb-orange/60 shrink-0" />
                <span className="text-[13px] font-semibold text-wb-text">{c.symbol}</span>
              </div>
              <div className="px-3 py-3 text-right num text-[13px] text-wb-text">
                {priceFormat(c.price)}
              </div>
              <div className={cn("px-3 py-3 text-right num text-[13px] font-semibold",
                pos ? "pos-text" : "neg-text")}>
                {pos ? "+" : ""}{c.change_pct.toFixed(2)}%
              </div>
              <div className="px-3 py-3">
                <MiniBar value={c.volume_surge} max={surgeMax} color={surgeColor} />
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
          <span className="text-[11px] text-wb-dim">Sorted by AI confidence</span>
          <span className="text-[11px] text-wb-dim">
            {lastRefreshAt ? `Last refresh ${lastRefreshAt.toLocaleTimeString()}` : "Refreshes every 90s"}
          </span>
        </div>
      </div>
    </>
  );
}

export function PennyScanner() {
  const [tab, setTab] = useState<"penny" | "bluechip">("penny");
  const [pennyToken, setPennyToken]   = useState<number>(0);
  const [bcToken, setBcToken]         = useState<number>(0);
  const [pennyRefreshAt, setPennyRefreshAt] = useState<Date | null>(null);
  const [bcRefreshAt, setBcRefreshAt]       = useState<Date | null>(null);

  const pennySwR = useSWR(
    ["penny-scan", pennyToken],
    ([, token]) => api.pennyScanner(token ? String(token) : undefined),
    { refreshInterval: 90_000 },
  );
  const bcSwR = useSWR(
    ["bluechip-scan", bcToken],
    ([, token]) => api.blueChipScanner(token ? String(token) : undefined),
    { refreshInterval: 90_000 },
  );

  function refreshPenny() {
    const t = Date.now(); setPennyToken(t); setPennyRefreshAt(new Date(t)); pennySwR.mutate();
  }
  function refreshBluechip() {
    const t = Date.now(); setBcToken(t); setBcRefreshAt(new Date(t)); bcSwR.mutate();
  }

  const pennyRows  = (pennySwR.data ?? []).slice(0, 10);
  const bcRows     = (bcSwR.data ?? []).slice(0, 10);

  return (
    <div className="bg-wb-surface border border-wb-border rounded-xl overflow-hidden shadow-card">
      {/* Header with tabs */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-wb-border">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setTab("penny")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors",
              tab === "penny"
                ? "bg-wb-orange/10 text-wb-orange border border-wb-orange/20"
                : "text-wb-dim hover:text-wb-text hover:bg-wb-surface2"
            )}
          >
            <Zap className="w-3.5 h-3.5" />
            Penny Stocks
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded font-bold",
              tab === "penny" ? "bg-wb-orange/20 text-wb-orange" : "bg-wb-surface3 text-wb-dim"
            )}>≤ $5</span>
            {pennyRows.length > 0 && (
              <span className="text-[10px] bg-wb-surface3 text-wb-muted px-1.5 py-0.5 rounded">
                {pennyRows.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("bluechip")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors",
              tab === "bluechip"
                ? "bg-wb-blue/10 text-wb-blue border border-wb-blue/20"
                : "text-wb-dim hover:text-wb-text hover:bg-wb-surface2"
            )}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Blue Chips
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded font-bold",
              tab === "bluechip" ? "bg-wb-blue/20 text-wb-blue" : "bg-wb-surface3 text-wb-dim"
            )}>&gt; $5</span>
            {bcRows.length > 0 && (
              <span className="text-[10px] bg-wb-surface3 text-wb-muted px-1.5 py-0.5 rounded">
                {bcRows.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Allocation info bar */}
      <div className="flex items-center gap-4 px-4 py-2 bg-wb-surface2/30 border-b border-wb-border text-[11px] text-wb-muted">
        <span>
          <span className="text-wb-orange font-semibold">70%</span> buying power → Penny stocks
        </span>
        <span className="text-wb-dim">·</span>
        <span>
          <span className="text-wb-blue font-semibold">30%</span> buying power → Blue chips
        </span>
        <span className="text-wb-dim">·</span>
        <span>Confidence ≥ 60% triggers auto-trade</span>
      </div>

      {tab === "penny" && (
        <ScanTable
          rows={pennyRows}
          isLoading={pennySwR.isLoading}
          isValidating={pennySwR.isValidating}
          onRefresh={refreshPenny}
          lastRefreshAt={pennyRefreshAt}
          priceFormat={(p) => `$${p.toFixed(4)}`}
          surgeMax={6}
          emptyMsg="Top 10 penny stocks by AI score"
        />
      )}

      {tab === "bluechip" && (
        <ScanTable
          rows={bcRows}
          isLoading={bcSwR.isLoading}
          isValidating={bcSwR.isValidating}
          onRefresh={refreshBluechip}
          lastRefreshAt={bcRefreshAt}
          priceFormat={(p) => `$${p.toFixed(2)}`}
          surgeMax={3}
          emptyMsg="Top 10 blue chip stocks by AI score"
        />
      )}
    </div>
  );
}
