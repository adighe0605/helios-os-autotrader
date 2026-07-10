"use client";

import useSWR from "swr";
import { Star } from "lucide-react";
import { api } from "@/lib/api";
import { cn, fmt } from "@/lib/format";
import type { Quote } from "@/lib/types";

const DEFAULT = ["SNDL", "MMAT", "CLOV", "NAKD", "AAPL", "NVDA", "TSLA", "AMD", "META"];

export function Watchlist({ symbols = DEFAULT }: { symbols?: string[] }) {
  const { data } = useSWR<Quote[]>("watchlist:" + symbols.join(","),
    () => Promise.all(symbols.map((s) => api.quote(s))),
    { refreshInterval: 15_000 });
  const items = data ?? symbols.map((s) => ({ symbol: s, price: 0, change: 0, change_pct: 0, volume: 0, ts: "" }));

  return (
    <div className="bg-wb-surface border border-wb-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-wb-border bg-wb-surface2">
        <Star className="size-3 text-wb-orange" />
        <span className="text-[11px] font-semibold text-wb-text">Watchlist</span>
        <span className="ml-auto text-[10px] text-wb-dim">{items.length}</span>
      </div>

      {/* Column labels */}
      <div className="grid grid-cols-3 px-3 py-1.5 border-b border-wb-border bg-wb-surface2">
        <span className="text-[10px] uppercase text-wb-dim">Symbol</span>
        <span className="text-[10px] uppercase text-wb-dim text-right">Last</span>
        <span className="text-[10px] uppercase text-wb-dim text-right">Chg%</span>
      </div>

      {items.map((q) => {
        const pos = q.change_pct >= 0;
        const isPenny = q.price > 0 && q.price < 5;
        return (
          <div key={q.symbol}
            className="grid grid-cols-3 items-center px-3 py-2 border-b border-wb-border last:border-0 hover:bg-wb-surface2 transition-colors cursor-pointer">
            <div className="flex items-center gap-2">
              {isPenny && <span className="w-1 h-3 rounded-full bg-wb-orange shrink-0" />}
              <span className={cn("font-semibold text-[12px]", isPenny ? "text-wb-orange" : "text-wb-text")}>
                {q.symbol}
              </span>
            </div>
            <div className="text-right num text-[12px] text-wb-text">
              {q.price ? fmt.usd(q.price) : "—"}
            </div>
            <div className={cn(
              "text-right num text-[12px] font-medium",
              pos ? "pos-text" : "neg-text"
            )}>
              {q.price ? fmt.pct(q.change_pct) : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}

