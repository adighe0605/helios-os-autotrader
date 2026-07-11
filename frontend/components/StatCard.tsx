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
  onClick?: () => void;
  badge?: string;
};

const accentGradient: Record<string, string> = {
  default: "from-wb-orange/60 to-transparent",
  pos:     "from-wb-green/60 to-transparent",
  neg:     "from-wb-red/60 to-transparent",
  warn:    "from-wb-orange/60 to-transparent",
};

const iconBg: Record<string, string> = {
  default: "bg-wb-orange/10 text-wb-orange",
  pos:     "bg-wb-green/10 text-wb-green",
  neg:     "bg-wb-red/10 text-wb-red",
  warn:    "bg-wb-orange/10 text-wb-orange",
};

export function StatCard({ label, value, delta, deltaPrefix, icon: Icon, accent = "default", onClick, badge }: Props) {
  const pos = (delta ?? 0) >= 0;

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative bg-wb-surface border border-wb-border rounded-xl overflow-hidden shadow-card transition-all duration-200",
        onClick
          ? "cursor-pointer hover:shadow-card-hover hover:border-wb-orange/40 active:scale-[0.98] select-none"
          : "cursor-default"
      )}
    >
      {/* Gradient top accent line */}
      <div className={cn("absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r", accentGradient[accent])} />

      <div className="px-4 pt-4 pb-3.5">
        {/* Label row */}
        <div className="flex items-center justify-between mb-2">
          <span className="section-label">{label}</span>
          {Icon && (
            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", iconBg[accent])}>
              <Icon className="w-3.5 h-3.5" strokeWidth={2} />
            </div>
          )}
        </div>

        {/* Value */}
        <div className="text-[22px] font-bold num text-wb-text tracking-tight leading-none">
          {value}
        </div>

        {/* Delta pill */}
        {delta !== undefined && (
          <div className="mt-2">
            <span className={cn(
              "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-semibold num",
              pos
                ? "bg-wb-green/10 text-wb-green"
                : "bg-wb-red/10 text-wb-red"
            )}>
              {pos ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {deltaPrefix ?? ""}{fmt.pct(delta)}
            </span>
          </div>
        )}

        {/* Status badge (e.g. "Market closed") */}
        {badge && (
          <div className="mt-2">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-wb-surface3 text-wb-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-wb-dim" />
              {badge}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

