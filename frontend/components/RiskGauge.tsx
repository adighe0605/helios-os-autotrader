"use client";

import { cn } from "@/lib/format";

export function RiskGauge({
  label, value, max, suffix = "%",
}: {
  label: string; value: number; max: number; suffix?: string;
}) {
  const pct       = Math.max(0, Math.min(1, value / max));
  const tone      = pct < 0.4 ? "pos" : pct < 0.75 ? "warn" : "neg";
  const barColor  = tone === "pos" ? "bg-wb-green" : tone === "warn" ? "bg-wb-orange" : "bg-wb-red";
  const textColor = tone === "pos" ? "text-wb-green" : tone === "warn" ? "text-wb-orange" : "text-wb-red";

  return (
    <div className="bg-wb-surface2 border border-wb-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="section-label">{label}</span>
        <span className={cn("badge num font-semibold", 
          tone === "pos" ? "badge-green" : tone === "warn" ? "badge-orange" : "badge-red")}>
          {value.toFixed(1)}{suffix}
        </span>
      </div>
      <div className="h-1.5 bg-wb-surface3 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[11px] text-wb-dim">0{suffix}</span>
        <span className="text-[11px] text-wb-dim">{max}{suffix}</span>
      </div>
    </div>
  );
}

