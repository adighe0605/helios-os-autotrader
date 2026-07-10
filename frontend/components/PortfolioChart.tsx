"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt } from "@/lib/format";

type Point = { t: string; v: number };

export function PortfolioChart({ data, height = 200 }: { data: Point[]; height?: number }) {
  const first = data[0]?.v ?? 0;
  const last  = data.at(-1)?.v ?? 0;
  const pos   = last >= first;
  const color = pos ? "#00C076" : "#F6465D";
  const pct   = first ? ((last / first) - 1) * 100 : 0;

  return (
    <div className="bg-wb-surface border border-wb-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-wb-border bg-wb-surface2">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold text-wb-text">Portfolio Value</span>
          <span className="text-[10px] text-wb-dim">90-day</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-base font-bold num text-wb-text">{fmt.usd(last)}</span>
          <span className={`text-xs num font-semibold ${pos ? "pos-text" : "neg-text"}`}>
            {fmt.pct(pct)}
          </span>
        </div>
      </div>
      <div className="px-0 pt-1 pb-0" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, left: 0, right: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gPortfolioWb" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" hide />
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1, strokeDasharray: "3 3" }}
              contentStyle={{
                background: "#1E2329",
                border: "1px solid #2B2F36",
                borderRadius: 2,
                fontSize: 11,
                padding: "6px 10px",
              }}
              labelFormatter={(v) => new Date(v as string).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              formatter={(v: number) => [fmt.usd(v), "Value"]}
            />
            <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
              fill="url(#gPortfolioWb)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

