"use client";

import { useState } from "react";
import useSWR from "swr";
import { Bot, Power, PowerOff, Settings, Clock, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { cn, fmt } from "@/lib/format";
import type { AutoTradeRecord, AutoTradeStatus } from "@/lib/types";

function StatusChip({ active }: { active: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 border",
      active
        ? "bg-wb-green-dim text-wb-green border-wb-green/25"
        : "bg-wb-surface3 text-wb-dim border-wb-border"
    )}>
      <span className={cn("size-1.5 rounded-full", active ? "bg-wb-green animate-pulseGlow" : "bg-wb-dim")} />
      {active ? "ACTIVE" : "OFF"}
    </span>
  );
}

function TradeRow({ rec }: { rec: AutoTradeRecord }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-wb-border last:border-0 hover:bg-wb-surface2 transition-colors px-4">
      <div className="flex items-center gap-2">
        <span className={cn(
          "text-[10px] font-bold px-1.5 py-0.5 border",
          rec.side === "buy"
            ? "bg-wb-green-dim text-wb-green border-wb-green/25"
            : "bg-wb-red-dim text-wb-red border-wb-red/25"
        )}>
          {rec.side.toUpperCase()}
        </span>
        <span className={cn("text-[12px] font-semibold", rec.side === "buy" ? "text-wb-green" : "text-wb-red")}>
          {rec.symbol}
        </span>
        <span className="text-[11px] text-wb-dim">Ã—{rec.qty}</span>
      </div>
      <div className="text-right">
        <div className="text-[12px] num text-wb-text">${rec.price.toFixed(4)}</div>
        <div className="text-[10px] text-wb-dim">{Math.round(rec.confidence * 100)}% conf</div>
      </div>
    </div>
  );
}

export function AutoTradePanel() {
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [confInput, setConfInput] = useState("");
  const [maxPriceInput, setMaxPriceInput] = useState("");
  const [maxConcInput, setMaxConcInput] = useState("");

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

  const enabled = status?.enabled ?? false;
  const marketOpen = status?.market_open ?? false;

  async function toggleEnabled() {
    setSaving(true);
    try {
      if (enabled) await api.autoTradeDisable();
      else await api.autoTradeEnable();
      await mutateStatus();
    } finally { setSaving(false); }
  }

  async function saveSettings() {
    setSaving(true);
    try {
      const body: Record<string, number> = {};
      if (confInput) body.min_confidence = parseFloat(confInput) / 100;
      if (maxPriceInput) body.max_price = parseFloat(maxPriceInput);
      if (maxConcInput) body.max_concurrent_positions = parseInt(maxConcInput);
      if (Object.keys(body).length) { await api.autoTradeSettings(body); await mutateStatus(); }
      setShowSettings(false);
      setConfInput(""); setMaxPriceInput(""); setMaxConcInput("");
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-wb-surface border border-wb-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-wb-border bg-wb-surface2">
        <div className="flex items-center gap-2">
          <Bot className={cn("size-4", enabled ? "text-wb-orange" : "text-wb-dim")} />
          <span className="text-[11px] font-semibold text-wb-text">Auto-Trade Bot</span>
          <StatusChip active={enabled && marketOpen} />
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowSettings(!showSettings)}
            className="p-2.5 hover:bg-wb-surface3 rounded-sm transition-colors text-wb-dim hover:text-wb-muted">
            <Settings size={12} />
          </button>
          <button onClick={toggleEnabled} disabled={saving}
            className={cn(
              "flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-2 min-h-[36px] border transition disabled:opacity-50",
              enabled
                ? "bg-wb-red-dim text-wb-red border-wb-red/25 hover:bg-wb-red/15"
                : "bg-wb-green-dim text-wb-green border-wb-green/25 hover:bg-wb-green/15"
            )}>
            {enabled ? <PowerOff size={11} /> : <Power size={11} />}
            {enabled ? "Stop" : "Start"}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-wb-border border-b border-wb-border">
        {[
          { label: "Market",   value: marketOpen ? "Open" : "Closed", pos: marketOpen },
          { label: "Today",    value: `${status?.trades_today ?? 0} trades` },
          { label: "Min Conf", value: `${Math.round((status?.min_confidence ?? 0.7) * 100)}%` },
          { label: "Max $",    value: `$${(status?.max_price ?? 5).toFixed(2)}` },
        ].map(({ label, value, pos }) => (
          <div key={label} className="px-3 py-2 text-center">
            <div className="text-[10px] text-wb-dim uppercase tracking-wider">{label}</div>
            <div className={cn("text-[12px] font-semibold mt-0.5",
              pos === true ? "text-wb-green" : pos === false && label === "Market" ? "text-wb-dim" : "text-wb-text")}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Warning */}
      {enabled && !marketOpen && (
        <div className="flex items-center gap-2 px-4 py-2 bg-wb-orange-dim border-b border-wb-border text-[11px] text-wb-orange">
          <AlertTriangle size={11} />
          Bot enabled â€” will execute when market opens.
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div className="border-b border-wb-border bg-wb-surface2 p-3 space-y-3">
          <div className="text-[10px] uppercase text-wb-dim tracking-wider">Update Settings</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { label: "Min Conf (%)", placeholder: String(Math.round((status?.min_confidence ?? 0.7) * 100)), state: confInput, set: setConfInput, props: { type: "number", min: 50, max: 100, step: 1 } },
              { label: "Max Price ($)", placeholder: String(status?.max_price ?? 5), state: maxPriceInput, set: setMaxPriceInput, props: { type: "number", min: 0.1, max: 10, step: 0.5 } },
              { label: "Max Positions", placeholder: String(status?.max_concurrent_positions ?? 5), state: maxConcInput, set: setMaxConcInput, props: { type: "number", min: 1, max: 20, step: 1 } },
            ].map(({ label, placeholder, state, set, props }) => (
              <div key={label}>
                <label className="block text-[10px] text-wb-dim mb-1">{label}</label>
                <input {...props} value={state} placeholder={placeholder}
                  onChange={e => set(e.target.value)}
                  className="wb-input text-[11px] py-1.5" />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={saveSettings} disabled={saving}
              className="text-[11px] bg-wb-orange text-black font-semibold px-3 py-1 hover:brightness-110 disabled:opacity-50 transition">
              Save
            </button>
            <button onClick={() => setShowSettings(false)}
              className="text-[11px] text-wb-muted hover:text-wb-text px-2 py-1 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Trade log */}
      <div>
        <div className="px-4 py-2 border-b border-wb-border bg-wb-surface2">
          <span className="text-[10px] uppercase text-wb-dim tracking-wider">Recent Auto-Trades</span>
        </div>
        {(history ?? []).length === 0 ? (
          <div className="py-6 text-center text-[11px] text-wb-dim">No autonomous trades yet.</div>
        ) : (
          (history ?? []).slice(0, 8).map(r => <TradeRow key={r.id} rec={r} />)
        )}
      </div>

      {/* Footer */}
      {status?.last_scan_at && (
        <div className="flex items-center gap-1.5 px-4 py-2 border-t border-wb-border bg-wb-surface2 text-[10px] text-wb-dim">
          <Clock size={10} />
          Last scan: {fmt.time(status.last_scan_at)} Â· {status.scan_count} total
        </div>
      )}
    </div>
  );
}
