"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Palette, PlayCircle, Power, Save, Shield } from "lucide-react";

import { api } from "@/lib/api";
import { cn } from "@/lib/format";
import { RiskGauge } from "@/components/RiskGauge";
import type { RiskLimits } from "@/lib/types";

type ThemeKey =
  | "theme-lifeos-default"
  | "theme-lifeos-paper"
  | "theme-lifeos-brutalist"
  | "theme-lifeos-synthwave"
  | "theme-lifeos-terminal"
  | "theme-lifeos-glass"
  | "theme-lifeos-kawaii"
  | "theme-lifeos-comic"
  | "theme-lifeos-midnight"
  | "theme-lifeos-frutiger"
  | "theme-lifeos-forest"
  | "theme-lifeos-newspaper"
  | "theme-lifeos-royal"
  | "theme-lifeos-sunset"
  | "theme-lifeos-cyberpunk";

const THEME_STORAGE_KEY = "helios-theme";
const DEFAULT_THEME: ThemeKey = "theme-lifeos-default";
const THEMES: Array<{ key: ThemeKey; name: string }> = [
  { key: "theme-lifeos-default", name: "LifeOS Default" },
  { key: "theme-lifeos-paper", name: "Paper" },
  { key: "theme-lifeos-brutalist", name: "Brutalist" },
  { key: "theme-lifeos-synthwave", name: "Synthwave" },
  { key: "theme-lifeos-terminal", name: "Terminal" },
  { key: "theme-lifeos-glass", name: "Glass" },
  { key: "theme-lifeos-kawaii", name: "Kawaii" },
  { key: "theme-lifeos-comic", name: "Comic" },
  { key: "theme-lifeos-midnight", name: "Midnight" },
  { key: "theme-lifeos-frutiger", name: "Frutiger" },
  { key: "theme-lifeos-forest", name: "Forest" },
  { key: "theme-lifeos-newspaper", name: "Newspaper" },
  { key: "theme-lifeos-royal", name: "Royal" },
  { key: "theme-lifeos-sunset", name: "Sunset" },
  { key: "theme-lifeos-cyberpunk", name: "Cyberpunk" },
];

export default function SettingsPage() {
  const [limits, setLimits] = useState<RiskLimits | null>(null);
  const [mode, setMode] = useState<"paper" | "live">("paper");
  const [showLiveConfirm, setShowLiveConfirm] = useState(false);
  const [aggressiveness, setAggressiveness] = useState(50);
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState<ThemeKey>(DEFAULT_THEME);

  useEffect(() => { api.riskLimits().then(setLimits); }, []);
  useEffect(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    const next = isThemeKey(saved) ? saved : DEFAULT_THEME;
    setTheme(next);
    applyTheme(next);
  }, []);

  function isThemeKey(value: string | null): value is ThemeKey {
    return !!value && THEMES.some((t) => t.key === value);
  }

  function applyTheme(next: ThemeKey) {
    const root = document.documentElement;
    THEMES.forEach((t) => root.classList.remove(t.key));
    root.classList.add(next);
  }

  function onThemeChange(next: ThemeKey) {
    setTheme(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
  }

  async function save() {
    if (!limits) return;
    setSaving(true);
    try { await api.updateRiskLimits(limits); } finally { setSaving(false); }
  }

  async function toggleKillSwitch() {
    if (!limits) return;
    const next = !limits.kill_switch_armed;
    const r = await api.killSwitch(next);
    setLimits({ ...limits, kill_switch_armed: r.armed });
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-[18px] font-bold text-wb-text tracking-tight">Settings</h1>
        <p className="text-[12px] text-wb-muted mt-0.5">Configure trading parameters and risk limits</p>
      </div>

      {/* Demo video */}
      <section className="bg-wb-surface border border-wb-border rounded-xl overflow-hidden shadow-card">
        <div className="px-4 py-3 border-b border-wb-border">
          <span className="text-[13px] font-semibold text-wb-text">Product Demo</span>
        </div>
        <div className="px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <p className="text-[13px] text-wb-muted">
            Watch the MP4 walkthrough for Dashboard, Trade, AI Agents, Backtest, and Settings.
          </p>
          <Link href="/demo" className="btn btn-primary whitespace-nowrap">
            <PlayCircle className="w-4 h-4" />
            Open Demo Video
          </Link>
        </div>
      </section>

      {/* Theme selection */}
      <section className="bg-wb-surface border border-wb-border rounded-xl overflow-hidden shadow-card">
        <div className="px-4 py-3 border-b border-wb-border flex items-center gap-2">
          <Palette className="w-4 h-4 text-wb-orange" />
          <span className="text-[13px] font-semibold text-wb-text">Themes (LifeOS)</span>
        </div>
        <div className="p-4">
          <label className="block text-[12px] text-wb-muted mb-1.5">Choose theme</label>
          <select
            value={theme}
            onChange={(e) => onThemeChange(e.target.value as ThemeKey)}
            className="wb-input"
          >
            {THEMES.map((t) => (
              <option key={t.key} value={t.key}>{t.name}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Trading mode */}
      <section className="bg-wb-surface border border-wb-border rounded-xl overflow-hidden shadow-card">
        <div className="px-4 py-3 border-b border-wb-border flex items-center justify-between">
          <span className="text-[13px] font-semibold text-wb-text">Trading Mode</span>
          <div className="flex gap-1 bg-wb-surface2 border border-wb-border rounded-lg p-0.5">
            {(["paper", "live"] as const).map((m) => (
              <button key={m}
                onClick={() => m === "live" ? setShowLiveConfirm(true) : setMode("paper")}
                className={cn(
                  "px-3 h-7 rounded-md text-[12px] font-bold uppercase transition-all duration-150 cursor-pointer",
                  mode === m
                    ? m === "live" ? "bg-wb-orange text-black shadow-sm" : "bg-wb-green text-black shadow-sm"
                    : "text-wb-dim hover:text-wb-muted"
                )}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="px-4 py-3.5">
          <p className="text-[13px] text-wb-muted">
            Paper mode simulates fills against live quotes. Live mode submits real orders to Alpaca.
          </p>
          {showLiveConfirm && (
            <div className="mt-3 p-4 border border-wb-orange/20 bg-wb-orange/5 rounded-lg animate-fadeIn">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-wb-orange shrink-0 mt-0.5" />
                <div>
                  <div className="text-[13px] font-semibold text-wb-orange mb-1">Live trading submits real orders.</div>
                  <p className="text-[12px] text-wb-muted mb-3">
                    Requires <code className="text-wb-text bg-wb-surface2 px-1 py-0.5 rounded text-[11px]">TRADING_MODE=live</code> in backend <code className="text-wb-text bg-wb-surface2 px-1 py-0.5 rounded text-[11px]">.env</code> and live Alpaca API keys.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => { setMode("live"); setShowLiveConfirm(false); }}
                      className="btn btn-primary btn-sm">
                      I understand — enable live
                    </button>
                    <button onClick={() => setShowLiveConfirm(false)} className="btn btn-ghost btn-sm">Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Kill switch */}
      <section className="bg-wb-surface border border-wb-border rounded-xl overflow-hidden shadow-card">
        <div className="px-4 py-3 border-b border-wb-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-wb-orange/10 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-wb-orange" />
            </div>
            <span className="text-[13px] font-semibold text-wb-text">Kill Switch</span>
          </div>
          <button onClick={toggleKillSwitch}
            className={cn(
              "btn btn-sm font-semibold",
              limits?.kill_switch_armed
                ? "bg-wb-red/10 text-wb-red border border-wb-red/20 hover:bg-wb-red/20"
                : "btn-ghost"
            )}>
            <Power className="w-3.5 h-3.5" />
            {limits?.kill_switch_armed ? "Disarm" : "Arm"}
          </button>
        </div>
        <p className="px-4 py-3.5 text-[13px] text-wb-muted">
          Cancels all open orders and blocks new entries until disarmed.
        </p>
      </section>

      {/* Risk limits */}
      <section className="bg-wb-surface border border-wb-border rounded-xl overflow-hidden shadow-card">
        <div className="px-4 py-3 border-b border-wb-border">
          <span className="text-[13px] font-semibold text-wb-text">Risk Limits</span>
        </div>
        <div className="p-4">
          {limits ? (
            <div className="grid sm:grid-cols-2 gap-4">
              <NumberField label="Max Daily Loss (%)" value={limits.max_daily_loss_pct}
                onChange={(v) => setLimits({ ...limits, max_daily_loss_pct: v })} min={0.1} max={20} step={0.1} />
              <NumberField label="Max Position Size (% of equity)" value={limits.max_position_pct}
                onChange={(v) => setLimits({ ...limits, max_position_pct: v })} min={1} max={100} step={1} />
              <NumberField label="Max Drawdown (%)" value={limits.max_drawdown_pct}
                onChange={(v) => setLimits({ ...limits, max_drawdown_pct: v })} min={1} max={50} step={0.5} />
              <NumberField label="Max Trades / Day" value={limits.max_trades_per_day}
                onChange={(v) => setLimits({ ...limits, max_trades_per_day: v })} min={1} max={500} step={1} />
              <NumberField label="Cooldown After Loss (min)" value={limits.cooldown_after_loss_min}
                onChange={(v) => setLimits({ ...limits, cooldown_after_loss_min: v })} min={0} max={240} step={1} />
            </div>
          ) : <div className="text-wb-dim text-[13px]">Loading…</div>}

          {limits && (
            <div className="mt-5 grid sm:grid-cols-3 gap-3">
              <RiskGauge label="Daily Loss" value={0.4} max={limits.max_daily_loss_pct} />
              <RiskGauge label="Position Concentration" value={6.2} max={limits.max_position_pct} />
              <RiskGauge label="Trades Today" value={4} max={limits.max_trades_per_day} suffix="" />
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <button onClick={save} disabled={saving || !limits}
              className="btn btn-primary disabled:opacity-50">
              <Save className="w-3.5 h-3.5" />
              {saving ? "Saving…" : "Save Limits"}
            </button>
          </div>
        </div>
      </section>

      {/* AI aggressiveness */}
      <section className="bg-wb-surface border border-wb-border rounded-xl overflow-hidden shadow-card">
        <div className="px-4 py-3 border-b border-wb-border">
          <span className="text-[13px] font-semibold text-wb-text">AI Aggressiveness</span>
        </div>
        <div className="px-4 py-4">
          <p className="text-[13px] text-wb-muted mb-4">
            Lower values bias the committee toward HOLD; higher values lower the confidence threshold for action.
          </p>
          <input type="range" min={0} max={100} value={aggressiveness}
            onChange={(e) => setAggressiveness(+e.target.value)}
            className="w-full accent-wb-orange h-1.5 cursor-pointer" />
          <div className="flex justify-between text-[12px] text-wb-dim num mt-2">
            <span>Conservative</span>
            <span className="warn-text font-semibold">{aggressiveness}</span>
            <span>Aggressive</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function NumberField({ label, value, onChange, min, max, step }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number;
}) {
  return (
    <label className="block">
      <span className="block text-[12px] text-wb-muted mb-1.5">{label}</span>
      <input type="number" value={value} min={min} max={max} step={step}
        onChange={(e) => onChange(+e.target.value)}
        inputMode="decimal"
        className="wb-input" />
    </label>
  );
}
