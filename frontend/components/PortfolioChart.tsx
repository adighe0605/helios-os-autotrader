"use client";
// v4 tooltip-contrast-fix 2026-07-11
import { useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt } from "@/lib/format";
import { cn } from "@/lib/format";

type Point = { t: string; v: number };

const DURATIONS = [
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "All", days: Infinity },
] as const;

type DurationLabel = (typeof DURATIONS)[number]["label"];

function filterByDuration(data: Point[], days: number): Point[] {
  if (!isFinite(days) || data.length === 0) return data;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return data.filter((p) => new Date(p.t) >= cutoff);
}

export function PortfolioChart({ data, height = 200 }: { data: Point[]; height?: number }) {
  const [duration, setDuration] = useState<DurationLabel>("1M");

  const selectedDays = DURATIONS.find((d) => d.label === duration)?.days ?? 30;
  const visible = filterByDuration(data, selectedDays);

  const first = visible[0]?.v ?? 0;
  const last  = visible.at(-1)?.v ?? 0;
  const pos   = last >= first;
  const color = pos ? "#22C55E" : "#EF4444";
  const pct   = first ? ((last / first) - 1) * 100 : 0;

  return (
    <div className="bg-wb-surface border border-wb-border rounded-xl overflow-hidden shadow-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-wb-border">
        {/* Title + value */}
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-semibold text-wb-text">Portfolio Value</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[15px] font-bold num text-wb-text">{fmt.usd(last)}</span>
            <span className={cn("badge num font-semibold text-[11px]", pos ? "badge-green" : "badge-red")}>
              {pos ? "+" : ""}{fmt.pct(pct)}
            </span>
          </div>
        </div>

        {/* Duration pills */}
        <div className="flex items-center gap-0.5 bg-wb-bg rounded-lg p-0.5">
          {DURATIONS.map(({ label }) => (
            <button
              key={label}
              onClick={() => setDuration(label)}
              className={cn(
                "px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all duration-150 cursor-pointer",
                duration === label
                  ? "bg-wb-blue text-white shadow-sm"
                  : "text-wb-muted hover:text-wb-text hover:bg-wb-surface"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={visible} margin={{ top: 8, left: 0, right: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gPortfolio21" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={color} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="t"
              tick={{ fill: "#6B7280", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) =>
                new Date(v as string).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1, strokeDasharray: "4 4" }}
              contentStyle={{
                background: "#18181B",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 10,
                fontSize: 12,
                padding: "8px 12px",
              }}
              labelStyle={{ color: "#E4E4E7", fontWeight: 600, marginBottom: 2 }}
              itemStyle={{ color: "#A1A1AA" }}
              labelFormatter={(v) =>
                new Date(v as string).toLocaleDateString("en-US", {
                  weekday: "short", month: "short", day: "numeric",
                })
              }
              formatter={(v: number) => [fmt.usd(v), "Value"]}
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke={color}
              strokeWidth={1.5}
              fill="url(#gPortfolio21)"
              dot={false}
              animationDuration={400}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

