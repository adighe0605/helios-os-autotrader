"use client";

import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn, fmt } from "@/lib/format";

type Props = {
  label: string;
  value: string;
  delta?: number;
  deltaPrefix?: string;
  icon?: LucideIcon;
  accent?: "default" | "pos" | "neg" | "warn";
};

const accentBar: Record<string, string> = {
  default: "bg-wb-orange",
  pos:     "bg-wb-green",
  neg:     "bg-wb-red",
  warn:    "bg-wb-orange",
};

export function StatCard({ label, value, delta, deltaPrefix, icon: Icon, accent = "default" }: Props) {
  const pos = (delta ?? 0) >= 0;
  return (
    <div className="relative bg-wb-surface border border-wb-border overflow-hidden">
      {/* Left accent bar */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px]", accentBar[accent])} />

      <div className="px-4 py-3 pl-5">
        <div className="eyebrow mb-1.5">{label}</div>
        <div className="text-[18px] font-bold num text-wb-text tracking-tight">{value}</div>
        {delta !== undefined && (
          <div className={cn("mt-1 flex items-center gap-0.5 text-xs num font-medium",
            pos ? "pos-text" : "neg-text")}>
            {pos ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {deltaPrefix ?? ""}{fmt.pct(delta)}
          </div>
        )}
      </div>

      {Icon && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <Icon className={cn("size-5", accent === "pos" ? "text-wb-green" : accent === "neg" ? "text-wb-red" : "text-wb-orange")}
            strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}

