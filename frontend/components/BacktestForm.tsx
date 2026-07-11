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
  const [symbol,   setSymbol]   = useState("SNDL");
  const [strategy, setStrategy] = useState("sma_cross");
  const [start,    setStart]    = useState("2023-01-01");
  const [end,      setEnd]      = useState("2024-12-31");
  const [capital,  setCapital]  = useState(100_000);
  const [result,   setResult]   = useState<BacktestResult | null>(null);
  const [loading,  setLoading]  = useState(false);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const r = await api.backtest({ symbol, strategy, start, end, initial_capital: capital });
      setResult(r);
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      {/* Parameters card */}
      <div className="bg-wb-surface border border-wb-border rounded-xl overflow-hidden shadow-card">
        <div className="px-4 py-3 border-b border-wb-border">
          <span className="text-[13px] font-semibold text-wb-text">Parameters</span>
        </div>
        <div className="p-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Field label="Symbol">
              <input value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="wb-input font-mono uppercase"
                autoCapitalize="characters"
              />
            </Field>
            <Field label="Strategy">
              <select value={strategy} onChange={(e) => setStrategy(e.target.value)}
                className="wb-input bg-wb-surface2 cursor-pointer">
                {STRATS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Start Date">
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
                className="wb-input" />
            </Field>
            <Field label="End Date">
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
                className="wb-input" />
            </Field>
            <Field label="Initial Capital">
              <input type="number" value={capital} onChange={(e) => setCapital(+e.target.value)}
                inputMode="numeric"
                className="wb-input" />
            </Field>
          </div>
          <div className="mt-5 flex justify-end">
            <button onClick={run} disabled={loading}
              className="btn btn-primary disabled:opacity-50">
              {loading ? "Running…" : "Run Backtest"}
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div className="space-y-4 animate-fadeIn">
          {/* Result stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Final Value",  value: fmt.usd(result.final_value),         pos: result.total_return_pct >= 0 },
              { label: "Total Return", value: fmt.pct(result.total_return_pct),    pos: result.total_return_pct >= 0 },
              { label: "Sharpe Ratio", value: result.sharpe.toFixed(2),            pos: result.sharpe >= 1 },
              { label: "Max Drawdown", value: fmt.pct(result.max_drawdown_pct),    pos: false },
            ].map(({ label, value, pos }) => (
              <div key={label}
                className="bg-wb-surface border border-wb-border rounded-xl p-4 shadow-card">
                <div className="section-label mb-2">{label}</div>
                <div className={cn("text-[18px] font-bold num",
                  pos ? "pos-text" : label === "Max Drawdown" ? "neg-text" : "text-wb-text")}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Equity curve */}
          <div className="bg-wb-surface border border-wb-border rounded-xl overflow-hidden shadow-card">
            <div className="px-4 py-3 border-b border-wb-border">
              <span className="text-[13px] font-semibold text-wb-text">Equity Curve</span>
            </div>
            <div className="w-full h-[200px] sm:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={result.equity_curve} margin={{ top: 10, left: 0, right: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gBT21" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#F59E0B" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" hide />
                  <YAxis hide domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{
                      background: "#18181B",
                      border: "1px solid rgba(255,255,255,0.10)",
                      borderRadius: 10,
                      fontSize: 12,
                      padding: "8px 12px",
                    }}
                    labelStyle={{ color: "#E4E4E7", fontWeight: 600, marginBottom: 2 }}
                    itemStyle={{ color: "#A1A1AA" }}
                    formatter={(v: number) => [fmt.usd(v), "Equity"]}
                  />
                  <Area type="monotone" dataKey="equity" stroke="#F59E0B" strokeWidth={2}
                    fill="url(#gBT21)" dot={false} />
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
      <span className="block text-[12px] text-wb-muted mb-1.5">{label}</span>
      {children}
    </label>
  );
}
