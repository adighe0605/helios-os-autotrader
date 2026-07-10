"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { api } from "@/lib/api";
import { cn, fmt } from "@/lib/format";

type Tf = "1d" | "1w" | "1m" | "3m" | "1y";
const TF_TO_LIMIT: Record<Tf, number> = { "1d": 78, "1w": 100, "1m": 30, "3m": 90, "1y": 252 };

export function PriceChart({ symbol }: { symbol: string }) {
  const [tf, setTf] = useState<Tf>("3m");
  const [data, setData] = useState<{ t: string; c: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.candles(symbol, "1d", TF_TO_LIMIT[tf]).then((rows) => {
      if (!alive) return;
      setData(rows.map((r) => ({ t: r.t, c: r.c })));
    }).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [symbol, tf]);

  const last  = data.at(-1)?.c ?? 0;
  const first = data[0]?.c ?? last;
  const pct   = first ? ((last / first) - 1) * 100 : 0;
  const pos   = pct >= 0;
  const color = pos ? "#00C076" : "#F6465D";

  return (
    <div className="bg-wb-surface border border-wb-border overflow-hidden">
      {/* Title row */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-wb-border bg-wb-surface2">
        <div className="flex items-baseline gap-3">
          <span className="font-bold text-wb-text">{symbol}</span>
          <span className="text-lg font-bold num text-wb-text">{fmt.usd(last)}</span>
          <span className={cn("text-sm num font-semibold", pos ? "pos-text" : "neg-text")}>
            {fmt.pct(pct)}
          </span>
          {loading && <span className="text-[10px] text-wb-dim">…</span>}
        </div>
        {/* Timeframe buttons — WeBull style */}
        <div className="flex gap-px bg-wb-surface3 border border-wb-border rounded-sm overflow-hidden">
          {(["1d", "1w", "1m", "3m", "1y"] as Tf[]).map((k) => (
            <button key={k} onClick={() => setTf(k)}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium transition",
                tf === k
                  ? "bg-wb-orange text-black"
                  : "text-wb-muted hover:text-wb-text hover:bg-wb-surface3"
              )}>
              {k.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, left: 0, right: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`gPriceWb-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" hide />
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1, strokeDasharray: "3 3" }}
              contentStyle={{
                background: "#1E2329",
                border: "1px solid #2B2F36",
                borderRadius: 2,
                fontSize: 11,
                padding: "6px 10px",
              }}
              labelFormatter={(v) => new Date(v as string).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              formatter={(v: number) => [fmt.usd(v), symbol]}
            />
            <Area type="monotone" dataKey="c"
              stroke={color} strokeWidth={1.5}
              fill={`url(#gPriceWb-${symbol})`}
              dot={false} activeDot={{ r: 3, fill: color }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

