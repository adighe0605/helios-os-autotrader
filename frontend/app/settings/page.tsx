"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Power, Save, Shield } from "lucide-react";

import { api } from "@/lib/api";
import { cn } from "@/lib/format";
import { RiskGauge } from "@/components/RiskGauge";
import type { RiskLimits } from "@/lib/types";

export default function SettingsPage() {
  const [limits, setLimits] = useState<RiskLimits | null>(null);
  const [mode, setMode] = useState<"paper" | "live">("paper");
  const [showLiveConfirm, setShowLiveConfirm] = useState(false);
  const [aggressiveness, setAggressiveness] = useState(50);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.riskLimits().then(setLimits); }, []);

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
    <div className="space-y-3 max-w-4xl">
      <div className="flex items-center border-b border-wb-border pb-2">
        <h1 className="text-[13px] font-semibold text-wb-text">Settings</h1>
      </div>

      {/* Trading mode */}
      <section className="bg-wb-surface border border-wb-border overflow-hidden">
        <div className="px-4 py-2.5 border-b border-wb-border bg-wb-surface2 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-wb-text">Trading Mode</span>
          <div className="flex gap-px bg-wb-surface3 border border-wb-border overflow-hidden">
            {(["paper", "live"] as const).map((m) => (
              <button key={m}
                onClick={() => m === "live" ? setShowLiveConfirm(true) : setMode("paper")}
                className={cn(
                  "px-3 py-1.5 text-[11px] font-bold transition uppercase",
                  mode === m
                    ? m === "live" ? "bg-wb-orange text-black" : "bg-wb-green text-black"
                    : "text-wb-dim hover:text-wb-text"
                )}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="px-4 py-3">
          <p className="text-[12px] text-wb-muted">
            Paper mode simulates fills against live quotes. Live mode submits real orders to Alpaca.
          </p>
          {showLiveConfirm && (
            <div className="mt-3 p-3 border border-wb-orange/30 bg-wb-orange-dim">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-4 text-wb-orange shrink-0 mt-0.5" />
                <div className="text-[12px]">
                  <div className="font-semibold text-wb-orange mb-1">Live trading submits real orders.</div>
                  <p className="text-wb-muted mb-3">
                    Requires <code className="text-wb-text">TRADING_MODE=live</code> in backend <code className="text-wb-text">.env</code> and live Alpaca API keys.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => { setMode("live"); setShowLiveConfirm(false); }}
                      className="px-3 py-1.5 text-[12px] bg-wb-orange text-black font-bold">
                      I understand — enable live
                    </button>
                    <button onClick={() => setShowLiveConfirm(false)} className="btn-ghost text-[12px] py-1.5">Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Kill switch */}
      <section className="bg-wb-surface border border-wb-border overflow-hidden">
        <div className="px-4 py-2.5 border-b border-wb-border bg-wb-surface2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="size-3.5 text-wb-orange" />
            <span className="text-[11px] font-semibold text-wb-text">Kill Switch</span>
          </div>
          <button onClick={toggleKillSwitch}
            className={cn(
              "flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 border transition",
              limits?.kill_switch_armed
                ? "bg-wb-red-dim text-wb-red border-wb-red/25 hover:bg-wb-red/20"
                : "bg-wb-surface3 text-wb-muted border-wb-border hover:text-wb-text"
            )}>
            <Power className="size-3.5" />
            {limits?.kill_switch_armed ? "Disarm" : "Arm"}
          </button>
        </div>
        <p className="px-4 py-3 text-[12px] text-wb-muted">
          Cancels all open orders and blocks new entries until disarmed.
        </p>
      </section>

      {/* Risk limits */}
      <section className="bg-wb-surface border border-wb-border overflow-hidden">
        <div className="px-4 py-2.5 border-b border-wb-border bg-wb-surface2">
          <span className="text-[11px] font-semibold text-wb-text">Risk Limits</span>
        </div>
        <div className="p-4">
          {limits ? (
            <div className="grid sm:grid-cols-2 gap-3">
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
          ) : <div className="text-wb-dim text-[12px]">Loading…</div>}

          {limits && (
            <div className="mt-4 grid sm:grid-cols-3 gap-2">
              <RiskGauge label="Daily Loss" value={0.4} max={limits.max_daily_loss_pct} />
              <RiskGauge label="Position Concentration" value={6.2} max={limits.max_position_pct} />
              <RiskGauge label="Trades Today" value={4} max={limits.max_trades_per_day} suffix="" />
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button onClick={save} disabled={saving || !limits}
              className="flex items-center gap-1.5 px-4 py-2 bg-wb-orange text-black text-[12px] font-bold disabled:opacity-50 hover:brightness-110 transition">
              <Save className="size-3.5" /> {saving ? "Saving…" : "Save Limits"}
            </button>
          </div>
        </div>
      </section>

      {/* AI aggressiveness */}
      <section className="bg-wb-surface border border-wb-border overflow-hidden">
        <div className="px-4 py-2.5 border-b border-wb-border bg-wb-surface2">
          <span className="text-[11px] font-semibold text-wb-text">AI Aggressiveness</span>
        </div>
        <div className="px-4 py-4">
          <p className="text-[12px] text-wb-muted mb-3">
            Lower values bias the committee toward HOLD; higher values lower the confidence threshold for action.
          </p>
          <input type="range" min={0} max={100} value={aggressiveness}
            onChange={(e) => setAggressiveness(+e.target.value)}
            className="w-full accent-[#F0A400]" />
          <div className="flex justify-between text-[11px] text-wb-dim num mt-1">
            <span>Conservative</span><span className="text-wb-orange font-semibold">{aggressiveness}</span><span>Aggressive</span>
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
      <span className="block text-[11px] text-wb-muted mb-1">{label}</span>
      <input type="number" value={value} min={min} max={max} step={step}
        onChange={(e) => onChange(+e.target.value)}
        className="wb-input" />
    </label>
  );
}

