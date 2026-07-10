"use client";

import { useState } from "react";
import useSWR from "swr";

import { api } from "@/lib/api";
import { fmt } from "@/lib/format";
import { OrderTicket } from "@/components/OrderTicket";
import { PriceChart } from "@/components/PriceChart";
import { Watchlist } from "@/components/Watchlist";

export default function TradePage() {
  const [symbol, setSymbol] = useState("SNDL");
  const { data: quote } = useSWR(`quote:${symbol}`, () => api.quote(symbol), { refreshInterval: 10_000 });

  return (
    <div className="space-y-3">
      {/* WeBull-style header with symbol search */}
      <div className="flex items-center justify-between border-b border-wb-border pb-2">
        <h1 className="text-[13px] font-semibold text-wb-text">Order Entry</h1>
        <div className="flex items-center gap-2">
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="w-36 px-3 py-1.5 bg-wb-surface2 border border-wb-border text-wb-text font-mono uppercase text-sm focus:outline-none focus:border-wb-orange transition-colors"
            placeholder="SNDL"
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-2">
        <div className="lg:col-span-2 space-y-2">
          <PriceChart symbol={symbol} />
          {/* Quote strip — WeBull style */}
          <div className="bg-wb-surface border border-wb-border grid grid-cols-2 sm:grid-cols-5 divide-x divide-wb-border">
            {[
              { label: "Last",   value: quote ? fmt.usd(quote.price) : "—", cls: "" },
              { label: "Change", value: quote ? fmt.pct(quote.change_pct) : "—",
                cls: quote ? (quote.change_pct >= 0 ? "pos-text" : "neg-text") : "" },
              { label: "Volume", value: quote ? fmt.compact(quote.volume) : "—", cls: "" },
              { label: "Bid",    value: quote?.price ? fmt.usd(quote.price * 0.999) : "—", cls: "" },
              { label: "Ask",    value: quote?.price ? fmt.usd(quote.price * 1.001) : "—", cls: "" },
            ].map(({ label, value, cls }) => (
              <div key={label} className="px-4 py-2.5">
                <div className="text-[10px] uppercase text-wb-dim tracking-wider mb-1">{label}</div>
                <div className={`text-[13px] font-semibold num text-wb-text ${cls}`}>{value}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <OrderTicket symbol={symbol} defaultPrice={quote?.price ?? 0} />
          <Watchlist />
        </div>
      </div>
    </div>
  );
}

