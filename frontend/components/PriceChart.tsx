"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { api } from "@/lib/api";
import { cn, fmt } from "@/lib/format";

type Tf = "1d" | "1w" | "1m" | "3m" | "1y";
const TF_TO_LIMIT: Record<Tf, number> = { "1d": 78, "1w": 100, "1m": 30, "3m": 90, "1y": 252 };

export function PriceChart({ symbol }: { symbol: string }) {
  const [tf, setTf]     = useState<Tf>("3m");
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
  const color = pos ? "#22C55E" : "#EF4444";

  return (
    <div className="bg-wb-surface border border-wb-border rounded-xl overflow-hidden shadow-card">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-wb-border">
        <div className="flex items-baseline gap-2.5 flex-1 min-w-0">
          <span className="text-[15px] font-bold text-wb-text">{symbol}</span>
          {last > 0 && (
            <span className="text-[16px] font-bold num text-wb-text">{fmt.usd(last)}</span>
          )}
          <span className={cn("badge num font-semibold", pos ? "badge-green" : "badge-red")}>
            {fmt.pct(pct)}
          </span>
          {loading && <span className="text-[11px] text-wb-dim animate-pulse">Loading…</span>}
        </div>

        {/* Timeframe segmented control */}
        <div className="flex gap-0.5 bg-wb-surface2 border border-wb-border rounded-lg p-0.5 shrink-0">
          {(["1d", "1w", "1m", "3m", "1y"] as Tf[]).map((k) => (
            <button key={k} onClick={() => setTf(k)}
              className={cn(
                "px-2.5 h-7 rounded-md text-[12px] font-medium transition-all duration-150 cursor-pointer min-w-[32px]",
                tf === k
                  ? "bg-wb-orange text-black shadow-sm"
                  : "text-wb-muted hover:text-wb-text"
              )}>
              {k.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="w-full h-[200px] sm:h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, left: 0, right: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`gPrice21-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={color} stopOpacity={0.2} />
                <stop offset="100%" stopColor={color} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" hide />
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1, strokeDasharray: "4 4" }}
              contentStyle={{
                background: "#18181B",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10,
                fontSize: 12,
                padding: "8px 12px",
              }}
              labelFormatter={(v) => new Date(v as string).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              formatter={(v: number) => [fmt.usd(v), symbol]}
            />
            <Area type="monotone" dataKey="c"
              stroke={color} strokeWidth={2}
              fill={`url(#gPrice21-${symbol})`}
              dot={false} activeDot={{ r: 4, fill: color, stroke: "rgba(0,0,0,0.4)", strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

