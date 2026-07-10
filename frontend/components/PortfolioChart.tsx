"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt } from "@/lib/format";
import { cn } from "@/lib/format";

type Point = { t: string; v: number };

export function PortfolioChart({ data, height = 200 }: { data: Point[]; height?: number }) {
  const first = data[0]?.v ?? 0;
  const last  = data.at(-1)?.v ?? 0;
  const pos   = last >= first;
  const color = pos ? "#22C55E" : "#EF4444";
  const pct   = first ? ((last / first) - 1) * 100 : 0;

  return (
    <div className="bg-wb-surface border border-wb-border rounded-xl overflow-hidden shadow-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-wb-border">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-semibold text-wb-text">Portfolio Value</span>
          <span className="badge badge-muted">90-day</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[16px] font-bold num text-wb-text">{fmt.usd(last)}</span>
          <span className={cn("badge num font-semibold", pos ? "badge-green" : "badge-red")}>
            {fmt.pct(pct)}
          </span>
        </div>
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, left: 0, right: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gPortfolio21" x1="0" y1="0" x2="0" y2="1">
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
              formatter={(v: number) => [fmt.usd(v), "Value"]}
            />
            <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
              fill="url(#gPortfolio21)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

