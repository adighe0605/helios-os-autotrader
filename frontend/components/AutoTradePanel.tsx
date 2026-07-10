"use client";

import { useState } from "react";
import useSWR from "swr";
import { Bot, Power, PowerOff, Settings, Clock, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { cn, fmt } from "@/lib/format";
import type { AutoTradeRecord, AutoTradeStatus } from "@/lib/types";

function TradeRow({ rec }: { rec: AutoTradeRecord }) {
  const isBuy = rec.side === "buy";
  return (
    <div className="flex items-center justify-between py-3 px-4 border-b border-wb-border last:border-0
                    hover:bg-wb-surface2/60 transition-colors duration-150">
      <div className="flex items-center gap-2.5">
        <span className={cn("badge font-bold", isBuy ? "badge-green" : "badge-red")}>
          {rec.side.toUpperCase()}
        </span>
        <div>
          <span className={cn("text-[13px] font-semibold", isBuy ? "text-wb-green" : "text-wb-red")}>
            {rec.symbol}
          </span>
          <span className="text-[11px] text-wb-dim ml-1.5">×{rec.qty}</span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-[13px] num text-wb-text">${rec.price.toFixed(4)}</div>
        <div className="text-[11px] text-wb-dim">{Math.round(rec.confidence * 100)}% conf</div>
      </div>
    </div>
  );
}

export function AutoTradePanel() {
  const [saving, setSaving]           = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [confInput, setConfInput]     = useState("");
  const [maxPriceInput, setMaxPriceInput] = useState("");
  const [maxConcInput, setMaxConcInput]   = useState("");
  const [pennySplitInput, setPennySplitInput] = useState("");
  const [otherSplitInput, setOtherSplitInput] = useState("");

  const { data: status, mutate: mutateStatus } = useSWR<AutoTradeStatus>(
    "auto-trade-status",
    () => api.autoTradeStatus(),
    { refreshInterval: 5_000 },
  );
  const { data: history } = useSWR<AutoTradeRecord[]>(
    "auto-trade-history",
    () => api.autoTradeHistory(20),
    { refreshInterval: 10_000 },
  );

  const enabled    = status?.enabled    ?? false;
  const marketOpen = status?.market_open ?? false;
  const botActive  = enabled && marketOpen;

  async function toggleEnabled() {
    setSaving(true);
    try {
      if (enabled) await api.autoTradeDisable();
      else         await api.autoTradeEnable();
      await mutateStatus();
    } finally { setSaving(false); }
  }

  async function saveSettings() {
    setSaving(true);
    try {
      const body: Record<string, number> = {};
      if (confInput)     body.min_confidence          = parseFloat(confInput) / 100;
      if (maxPriceInput) body.max_price                = parseFloat(maxPriceInput);
      if (maxConcInput)  body.max_concurrent_positions = parseInt(maxConcInput);
      if (pennySplitInput) body.penny_allocation_pct = parseFloat(pennySplitInput);
      if (otherSplitInput) body.other_allocation_pct = parseFloat(otherSplitInput);
      if (Object.keys(body).length) { await api.autoTradeSettings(body); await mutateStatus(); }
      setShowSettings(false);
      setConfInput(""); setMaxPriceInput(""); setMaxConcInput("");
      setPennySplitInput(""); setOtherSplitInput("");
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-wb-surface border border-wb-border rounded-xl overflow-hidden shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-wb-border">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
            botActive ? "bg-wb-green/10" : "bg-wb-surface2"
          )}>
            <Bot className={cn("w-3.5 h-3.5", botActive ? "text-wb-green" : "text-wb-dim")} />
          </div>
          <span className="text-[13px] font-semibold text-wb-text">Auto-Trade Bot</span>
          {/* Status pill */}
          <span className={cn("badge",
            botActive  ? "badge-green" :
            enabled    ? "badge-orange" :
            "badge-muted"
          )}>
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0",
              botActive ? "bg-wb-green animate-pulseGlow" :
              enabled   ? "bg-wb-orange animate-pulseGlow" :
              "bg-wb-dim"
            )} />
            {botActive ? "ACTIVE" : enabled ? "WAITING" : "OFF"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="btn-icon"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={toggleEnabled}
            disabled={saving}
            className={cn(
              "btn btn-sm font-semibold transition-all",
              enabled
                ? "bg-wb-red/10 text-wb-red border border-wb-red/20 hover:bg-wb-red/20"
                : "bg-wb-green/10 text-wb-green border border-wb-green/20 hover:bg-wb-green/20"
            )}
          >
            {enabled ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
            {enabled ? "Stop" : "Start"}
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-wb-border border-b border-wb-border">
        {[
          { label: "Market",     value: marketOpen ? "Open" : "Closed", highlight: marketOpen },
          { label: "Today",      value: `${status?.trades_today ?? 0} trades` },
          { label: "Min Conf",   value: `${Math.round((status?.min_confidence ?? 0.7) * 100)}%` },
          { label: "Allocation", value: `${Math.round(status?.penny_allocation_pct ?? 70)}% Penny / ${Math.round(status?.other_allocation_pct ?? 30)}% Blue` },
        ].map(({ label, value, highlight }) => (
          <div key={label} className="px-3 py-3 text-center">
            <div className="section-label mb-1">{label}</div>
            <div className={cn("text-[13px] font-semibold num",
              highlight === true   ? "text-wb-green" :
              highlight === false && label === "Market" ? "text-wb-dim" :
              "text-wb-text"
            )}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Warning banner */}
      {enabled && !marketOpen && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-wb-orange/5 border-b border-wb-border text-[12px] text-wb-orange">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Bot enabled — will execute when market opens
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div className="border-b border-wb-border bg-wb-surface2/50 p-4 space-y-3 animate-fadeIn">
          <div className="section-label">Update Settings</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: "Min Confidence (%)", placeholder: String(Math.round((status?.min_confidence ?? 0.7) * 100)), state: confInput, set: setConfInput, props: { type: "number", min: 50, max: 100, step: 1 } },
              { label: "Max Penny Price ($)",  placeholder: String(status?.max_price ?? 5),                          state: maxPriceInput, set: setMaxPriceInput, props: { type: "number", min: 0.1, max: 10, step: 0.5 } },
              { label: "Max Positions",        placeholder: String(status?.max_concurrent_positions ?? 5),           state: maxConcInput, set: setMaxConcInput, props: { type: "number", min: 1, max: 20, step: 1 } },
              { label: "Penny Alloc (%)",      placeholder: String(Math.round(status?.penny_allocation_pct ?? 70)),  state: pennySplitInput, set: setPennySplitInput, props: { type: "number", min: 0, max: 100, step: 1 } },
              { label: "Blue Chip Alloc (%)",  placeholder: String(Math.round(status?.other_allocation_pct ?? 30)),  state: otherSplitInput, set: setOtherSplitInput, props: { type: "number", min: 0, max: 100, step: 1 } },
            ].map(({ label, placeholder, state, set, props }) => (
              <div key={label}>
                <label className="block text-[11px] text-wb-muted mb-1.5">{label}</label>
                <input {...props} value={state} placeholder={placeholder}
                  onChange={e => set(e.target.value)}
                  inputMode="numeric"
                  className="wb-input-sm" />
              </div>
            ))}
          </div>
          <p className="text-[11px] text-wb-dim">
            Split is auto-normalized to 100% total. Set either side or both.
          </p>
          <div className="flex gap-2">
            <button onClick={saveSettings} disabled={saving}
              className="btn btn-primary btn-sm">
              Save Changes
            </button>
            <button onClick={() => setShowSettings(false)}
              className="btn btn-ghost btn-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Trade log */}
      <div>
        <div className="px-4 py-2.5 border-b border-wb-border">
          <span className="section-label">Recent Auto-Trades</span>
        </div>
        {(history ?? []).length === 0 ? (
          <div className="py-10 text-center">
            <div className="text-wb-dim text-[13px]">No autonomous trades yet</div>
            <div className="text-wb-dim/60 text-[12px] mt-1">Enable bot during market hours to start</div>
          </div>
        ) : (
          (history ?? []).slice(0, 8).map(r => <TradeRow key={r.id} rec={r} />)
        )}
      </div>

      {/* Footer */}
      {status?.last_scan_at && (
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-t border-wb-border text-[11px] text-wb-dim">
          <Clock className="w-3 h-3 shrink-0" />
          Last scan {fmt.time(status.last_scan_at)} · {status.scan_count} total
        </div>
      )}
    </div>
  );
}
