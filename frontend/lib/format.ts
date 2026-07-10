export const fmt = {
  usd: (n: number, dp = 2) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: dp, minimumFractionDigits: dp }),
  pct: (n: number, dp = 2) => `${n >= 0 ? "+" : ""}${n.toFixed(dp)}%`,
  num: (n: number, dp = 2) => n.toLocaleString("en-US", { maximumFractionDigits: dp, minimumFractionDigits: dp }),
  compact: (n: number) =>
    Math.abs(n) >= 1e9 ? `${(n / 1e9).toFixed(1)}B`
    : Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(1)}M`
    : Math.abs(n) >= 1e3 ? `${(n / 1e3).toFixed(1)}K`
    : `${n}`,
  date: (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  time: (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
};
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
