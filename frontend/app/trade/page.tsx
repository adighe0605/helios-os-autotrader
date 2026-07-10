"use client";

import { useState } from "react";
import useSWR from "swr";

import { api } from "@/lib/api";
import { fmt } from "@/lib/format";
import { OrderTicket } from "@/components/OrderTicket";
import { PriceChart } from "@/components/PriceChart";
import { Watchlist } from "@/components/Watchlist";
import { cn } from "@/lib/format";

export default function TradePage() {
  const [symbol, setSymbol] = useState("SNDL");
  const { data: quote } = useSWR(`quote:${symbol}`, () => api.quote(symbol), { refreshInterval: 10_000 });

  return (
    <div className="space-y-4 max-w-[1400px]">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-bold text-wb-text tracking-tight">Order Entry</h1>
          <p className="text-[12px] text-wb-muted mt-0.5">Place and manage trades</p>
        </div>
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          className="w-32 px-3 h-10 bg-wb-surface border border-wb-border text-wb-text font-mono uppercase
                     text-[14px] font-bold focus:outline-none focus:ring-1 focus:ring-wb-orange/40
                     focus:border-wb-orange/60 rounded-lg transition-all duration-150"
          placeholder="SNDL"
          inputMode="text"
          autoCapitalize="characters"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <PriceChart symbol={symbol} />

          {/* Quote strip */}
          <div className="bg-wb-surface border border-wb-border rounded-xl overflow-hidden shadow-card">
            <div className="grid grid-cols-2 sm:grid-cols-5 divide-wb-border divide-y sm:divide-y-0 sm:divide-x">
              {[
                { label: "Last",   value: quote ? fmt.usd(quote.price) : "—",        cls: "text-wb-text" },
                { label: "Change", value: quote ? fmt.pct(quote.change_pct) : "—",    cls: quote ? (quote.change_pct >= 0 ? "pos-text" : "neg-text") : "" },
                { label: "Volume", value: quote ? fmt.compact(quote.volume) : "—",   cls: "text-wb-text" },
                { label: "Bid",    value: quote?.price ? fmt.usd(quote.price * 0.999) : "—", cls: "text-wb-text" },
                { label: "Ask",    value: quote?.price ? fmt.usd(quote.price * 1.001) : "—", cls: "text-wb-text" },
              ].map(({ label, value, cls }) => (
                <div key={label} className="px-4 py-3">
                  <div className="section-label mb-1.5">{label}</div>
                  <div className={cn("text-[14px] font-semibold num", cls)}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <OrderTicket symbol={symbol} defaultPrice={quote?.price ?? 0} />
          <Watchlist />
        </div>
      </div>
    </div>
  );
}

