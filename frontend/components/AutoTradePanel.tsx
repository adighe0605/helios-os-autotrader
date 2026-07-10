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
        <span className="text-[11px] text-wb-dim">×{rec.qty}</span>
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
            className="p-1.5 hover:bg-wb-surface3 rounded-sm transition-colors text-wb-dim hover:text-wb-muted">
            <Settings size={12} />
          </button>
          <button onClick={toggleEnabled} disabled={saving}
            className={cn(
              "flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 border transition disabled:opacity-50",
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
      <div className="grid grid-cols-4 divide-x divide-wb-border border-b border-wb-border">
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
          Bot enabled — will execute when market opens.
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div className="border-b border-wb-border bg-wb-surface2 p-3 space-y-3">
          <div className="text-[10px] uppercase text-wb-dim tracking-wider">Update Settings</div>
          <div className="grid grid-cols-3 gap-2">
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
          Last scan: {fmt.time(status.last_scan_at)} · {status.scan_count} total
        </div>
      )}
    </div>
  );
}


function StatusDot({ active }: { active: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      {active && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      )}
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${active ? "bg-emerald-400" : "bg-white/20"}`} />
    </span>
  );
}

function RecordRow({ rec }: { rec: AutoTradeRecord }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-bold uppercase px-1 py-0.5 rounded
          ${rec.side === "buy"
            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
            : "bg-red-500/15 text-red-400 border border-red-500/30"}`}>
          {rec.side}
        </span>
        <span className="font-mono text-xs font-semibold">{rec.symbol}</span>
        <span className="text-xs text-white/40">×{rec.qty}</span>
      </div>
      <div className="text-right">
        <p className="text-xs tabular-nums">${rec.price.toFixed(4)}</p>
        <p className="text-[10px] text-white/40">{Math.round(rec.confidence * 100)}% conf</p>
      </div>
    </div>
  );
}

export function AutoTradePanel() {
  const { mutate } = useSWRConfig();
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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

  const [confInput, setConfInput] = useState<string>("");
  const [maxPriceInput, setMaxPriceInput] = useState<string>("");
  const [maxConcInput, setMaxConcInput] = useState<string>("");

  async function toggleEnabled() {
    if (!status) return;
    setSaving(true);
    try {
      if (status.enabled) {
        await api.autoTradeDisable();
      } else {
        await api.autoTradeEnable();
      }
      await mutateStatus();
    } finally {
      setSaving(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    try {
      const body: Record<string, number> = {};
      if (confInput) body.min_confidence = parseFloat(confInput) / 100;
      if (maxPriceInput) body.max_price = parseFloat(maxPriceInput);
      if (maxConcInput) body.max_concurrent_positions = parseInt(maxConcInput);
      if (Object.keys(body).length > 0) {
        await api.autoTradeSettings(body);
        await mutateStatus();
      }
      setShowSettings(false);
      setConfInput(""); setMaxPriceInput(""); setMaxConcInput("");
    } finally {
      setSaving(false);
    }
  }

  const enabled = status?.enabled ?? false;
  const marketOpen = status?.market_open ?? false;

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={16} className={enabled ? "text-emerald-400" : "text-white/40"} />
          <span className="text-sm font-semibold">Autonomous Bot</span>
          <StatusDot active={enabled && marketOpen} />
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1.5 rounded hover:bg-white/10 transition-colors text-white/40 hover:text-white/70"
            title="Settings"
          >
            <Settings size={13} />
          </button>
          <button
            onClick={toggleEnabled}
            disabled={saving}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded font-medium transition-colors
              ${enabled
                ? "bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25"
                : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
              } disabled:opacity-50`}
          >
            {enabled ? <PowerOff size={12} /> : <Power size={12} />}
            {enabled ? "Disable" : "Enable"}
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-white/5 p-2">
          <p className="text-[10px] text-white/40 mb-0.5">Market</p>
          <p className={`text-xs font-semibold ${marketOpen ? "text-emerald-400" : "text-white/40"}`}>
            {marketOpen ? "Open" : "Closed"}
          </p>
        </div>
        <div className="rounded-lg bg-white/5 p-2">
          <p className="text-[10px] text-white/40 mb-0.5">Today</p>
          <p className="text-xs font-semibold">{status?.trades_today ?? 0} trades</p>
        </div>
        <div className="rounded-lg bg-white/5 p-2">
          <p className="text-[10px] text-white/40 mb-0.5">Min Conf</p>
          <p className="text-xs font-semibold">{Math.round((status?.min_confidence ?? 0.7) * 100)}%</p>
        </div>
      </div>

      {/* Penny filter info */}
      <div className="flex flex-wrap gap-2 text-[10px]">
        <span className="bg-white/5 rounded px-2 py-1 text-white/50">
          Max price: <span className="text-white/80">${status?.max_price?.toFixed(2) ?? "5.00"}</span>
        </span>
        <span className="bg-white/5 rounded px-2 py-1 text-white/50">
          Max positions: <span className="text-white/80">{status?.max_concurrent_positions ?? 5}</span>
        </span>
        <span className="bg-white/5 rounded px-2 py-1 text-white/50">
          Pos size: <span className="text-white/80">{status?.max_position_pct?.toFixed(1) ?? "3.0"}% equity</span>
        </span>
      </div>

      {/* Warning when enabled but market closed */}
      {enabled && !marketOpen && (
        <div className="flex items-center gap-2 text-[10px] text-yellow-400 bg-yellow-500/10 rounded p-2 border border-yellow-500/20">
          <AlertTriangle size={12} />
          Bot is enabled but market is currently closed. Will auto-execute when market opens.
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div className="space-y-3 p-3 bg-white/5 rounded-lg border border-white/10">
          <p className="text-xs font-semibold text-white/70">Update Settings</p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-white/50 block mb-1">Min Confidence (%)</label>
              <input
                type="number" min="50" max="100" step="1"
                placeholder={String(Math.round((status?.min_confidence ?? 0.7) * 100))}
                value={confInput}
                onChange={e => setConfInput(e.target.value)}
                className="w-full text-xs bg-white/10 border border-white/20 rounded px-2 py-1 text-white placeholder:text-white/30 focus:outline-none focus:border-white/40"
              />
            </div>
            <div>
              <label className="text-[10px] text-white/50 block mb-1">Max Price ($)</label>
              <input
                type="number" min="0.10" max="10" step="0.50"
                placeholder={String(status?.max_price ?? 5.0)}
                value={maxPriceInput}
                onChange={e => setMaxPriceInput(e.target.value)}
                className="w-full text-xs bg-white/10 border border-white/20 rounded px-2 py-1 text-white placeholder:text-white/30 focus:outline-none focus:border-white/40"
              />
            </div>
            <div>
              <label className="text-[10px] text-white/50 block mb-1">Max Positions</label>
              <input
                type="number" min="1" max="20" step="1"
                placeholder={String(status?.max_concurrent_positions ?? 5)}
                value={maxConcInput}
                onChange={e => setMaxConcInput(e.target.value)}
                className="w-full text-xs bg-white/10 border border-white/20 rounded px-2 py-1 text-white placeholder:text-white/30 focus:outline-none focus:border-white/40"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="text-xs bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 px-3 py-1 rounded transition-colors disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => { setShowSettings(false); setConfInput(""); setMaxPriceInput(""); setMaxConcInput(""); }}
              className="text-xs text-white/40 hover:text-white/70 px-2 py-1 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Recent auto-trades */}
      <div>
        <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider mb-2">
          Recent Auto-Trades
        </p>
        {(history ?? []).length === 0 ? (
          <p className="text-xs text-white/30 text-center py-3">
            No autonomous trades yet.
          </p>
        ) : (
          <div>
            {(history ?? []).slice(0, 8).map(r => <RecordRow key={r.id} rec={r} />)}
          </div>
        )}
      </div>

      {/* Last scan */}
      {status?.last_scan_at && (
        <p className="text-[10px] text-white/30 flex items-center gap-1">
          <Clock size={10} />
          Last scan: {fmt.time(status.last_scan_at)} · {status.scan_count} total scans
        </p>
      )}
    </div>
  );
}
