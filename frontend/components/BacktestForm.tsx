"use client";

import { useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { api } from "@/lib/api";
import { cn, fmt } from "@/lib/format";
import type { BacktestResult } from "@/lib/types";

const STRATS = [
  { value: "sma_cross",      label: "SMA Crossover" },
  { value: "momentum",       label: "Momentum (RSI + 50-DMA)" },
  { value: "mean_reversion", label: "Mean Reversion (Bollinger)" },
  { value: "rsi",            label: "RSI 30/70" },
];

export function BacktestForm() {
  const [symbol, setSymbol] = useState("SNDL");
  const [strategy, setStrategy] = useState("sma_cross");
  const [start, setStart] = useState("2023-01-01");
  const [end, setEnd] = useState("2024-12-31");
  const [capital, setCapital] = useState(100_000);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const r = await api.backtest({ symbol, strategy, start, end, initial_capital: capital });
      setResult(r);
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-3">
      {/* Input form */}
      <div className="bg-wb-surface border border-wb-border overflow-hidden">
        <div className="px-4 py-2.5 border-b border-wb-border bg-wb-surface2">
          <span className="text-[11px] font-semibold text-wb-text">Parameters</span>
        </div>
        <div className="p-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Field label="Symbol">
              <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="wb-input font-mono uppercase" />
            </Field>
            <Field label="Strategy">
              <select value={strategy} onChange={(e) => setStrategy(e.target.value)} className="wb-input bg-wb-surface2">
                {STRATS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Start">
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="wb-input" />
            </Field>
            <Field label="End">
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="wb-input" />
            </Field>
            <Field label="Capital">
              <input type="number" value={capital} onChange={(e) => setCapital(+e.target.value)} className="wb-input" />
            </Field>
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={run} disabled={loading}
              className="px-4 py-2.5 min-h-[40px] bg-wb-orange text-black text-[12px] font-bold disabled:opacity-50 hover:brightness-110 transition">
              {loading ? "Running…" : "Run Backtest"}
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div className="space-y-3">
          {/* Stats row */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {[
              { label: "Final Value",  value: fmt.usd(result.final_value),           tone: "" },
              { label: "Total Return", value: fmt.pct(result.total_return_pct),      tone: result.total_return_pct >= 0 ? "pos-text" : "neg-text" },
              { label: "Sharpe",       value: result.sharpe.toFixed(2),              tone: "" },
              { label: "Max Drawdown", value: fmt.pct(result.max_drawdown_pct),      tone: "neg-text" },
            ].map(({ label, value, tone }) => (
              <div key={label} className="bg-wb-surface border border-wb-border p-3">
                <div className="text-[10px] uppercase text-wb-dim tracking-wider mb-1">{label}</div>
                <div className={cn("text-[14px] font-bold num", tone)}>{value}</div>
              </div>
            ))}
          </div>

          {/* Equity curve */}
          <div className="bg-wb-surface border border-wb-border overflow-hidden">
            <div className="px-4 py-2.5 border-b border-wb-border bg-wb-surface2">
              <span className="text-[11px] font-semibold text-wb-text">Equity Curve</span>
            </div>
            <div className="w-full h-[180px] sm:h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={result.equity_curve} margin={{ top: 8, left: 0, right: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gBT" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#F0A400" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#F0A400" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" hide />
                  <YAxis hide domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{ background: "#1E2329", border: "1px solid #2B2F36", borderRadius: 2, fontSize: 11, padding: "6px 10px" }}
                    formatter={(v: number) => [fmt.usd(v), "Equity"]}
                  />
                  <Area type="monotone" dataKey="equity" stroke="#F0A400" strokeWidth={1.5}
                    fill="url(#gBT)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] text-wb-muted mb-1">{label}</span>
      {children}
    </label>
  );
}
