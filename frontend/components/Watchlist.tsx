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
    <div className="bg-wb-surface border border-wb-border rounded-xl overflow-hidden shadow-card">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-wb-border">
        <div className="w-7 h-7 rounded-lg bg-wb-orange/10 flex items-center justify-center">
          <Star className="w-3.5 h-3.5 text-wb-orange" />
        </div>
        <span className="text-[13px] font-semibold text-wb-text">Watchlist</span>
        <span className="ml-auto badge badge-muted">{items.length}</span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-3 px-4 py-2 border-b border-wb-border">
        <span className="section-label">Symbol</span>
        <span className="section-label text-right">Last</span>
        <span className="section-label text-right">Chg%</span>
      </div>

      {items.map((q) => {
        const pos     = q.change_pct >= 0;
        const isPenny = q.price > 0 && q.price < 5;
        return (
          <div key={q.symbol}
            className="grid grid-cols-3 items-center px-4 py-2.5 border-b border-wb-border last:border-0
                       hover:bg-wb-surface2/60 transition-colors duration-150 cursor-pointer">
            <div className="flex items-center gap-2">
              {isPenny && (
                <span className="w-1.5 h-1.5 rounded-full bg-wb-orange shrink-0" />
              )}
              <span className={cn("font-semibold text-[13px]",
                isPenny ? "text-wb-orange" : "text-wb-text")}>
                {q.symbol}
              </span>
            </div>
            <div className="text-right num text-[13px] text-wb-text font-medium">
              {q.price ? fmt.usd(q.price) : "—"}
            </div>
            <div className="flex justify-end">
              {q.price ? (
                <span className={cn("badge num text-[11px]", pos ? "badge-green" : "badge-red")}>
                  {fmt.pct(q.change_pct)}
                </span>
              ) : <span className="text-wb-dim text-[12px]">—</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

