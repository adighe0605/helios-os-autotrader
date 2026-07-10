"use client";

import { cn } from "@/lib/format";

export function RiskGauge({ label, value, max, suffix = "%" }: { label: string; value: number; max: number; suffix?: string }) {
  const pct  = Math.max(0, Math.min(1, value / max));
  const tone = pct < 0.4 ? "pos" : pct < 0.75 ? "warn" : "neg";
  const barColor = tone === "pos" ? "bg-wb-green" : tone === "warn" ? "bg-wb-orange" : "bg-wb-red";
  const textColor = tone === "pos" ? "text-wb-green" : tone === "warn" ? "text-wb-orange" : "text-wb-red";

  return (
    <div className="bg-wb-surface border border-wb-border p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase text-wb-dim tracking-wider">{label}</span>
        <span className={cn("text-[11px] num font-semibold", textColor)}>
          {value.toFixed(2)}{suffix} / {max}{suffix}
        </span>
      </div>
      <div className="h-[3px] bg-wb-surface3 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

