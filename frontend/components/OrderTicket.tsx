"use client";

import { useState } from "react";

import { api } from "@/lib/api";
import { cn, fmt } from "@/lib/format";

export function OrderTicket({ symbol, defaultPrice }: { symbol: string; defaultPrice: number }) {
  const [side, setSide]           = useState<"buy" | "sell">("buy");
  const [qty, setQty]             = useState(100);
  const [orderType, setOrderType] = useState<"market" | "limit" | "stop">("market");
  const [limitPrice, setLimitPrice] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg]             = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setMsg(null);
    try {
      const order = await api.placeOrder({
        symbol, side, qty,
        order_type: orderType,
        limit_price: orderType === "limit" ? (limitPrice || null) : null,
        stop_price:  orderType === "stop"  ? (limitPrice || null) : null,
      });
      setMsg(`✓ ${order.side.toUpperCase()} ${order.qty} ${order.symbol} — ${order.status}`);
    } catch (e) {
      setMsg(`✗ ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  const px = (limitPrice || defaultPrice) || 0;
  const estimated = px * qty;

  return (
    <div className="bg-wb-surface border border-wb-border rounded-xl overflow-hidden shadow-card">
      {/* Header */}
      <div className="px-4 py-3 border-b border-wb-border flex items-center justify-between">
        <span className="text-[13px] font-semibold text-wb-text">Place Order</span>
        <span className="badge badge-muted">Paper</span>
      </div>

      {/* Buy / Sell toggle */}
      <div className="flex gap-2 p-3 border-b border-wb-border bg-wb-surface2/40">
        <button
          onClick={() => setSide("buy")}
          className={cn(
            "flex-1 h-10 rounded-lg text-[13px] font-bold transition-all duration-150 cursor-pointer",
            side === "buy"
              ? "bg-wb-green text-black shadow-glow-green"
              : "text-wb-muted hover:text-wb-green hover:bg-wb-green/10 border border-wb-border"
          )}
        >
          BUY
        </button>
        <button
          onClick={() => setSide("sell")}
          className={cn(
            "flex-1 h-10 rounded-lg text-[13px] font-bold transition-all duration-150 cursor-pointer",
            side === "sell"
              ? "bg-wb-red text-white shadow-glow-red"
              : "text-wb-muted hover:text-wb-red hover:bg-wb-red/10 border border-wb-border"
          )}
        >
          SELL
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Order type */}
        <div className="flex gap-1 bg-wb-surface2 border border-wb-border rounded-lg p-0.5">
          {(["market", "limit", "stop"] as const).map((t) => (
            <button key={t} onClick={() => setOrderType(t)}
              className={cn(
                "flex-1 h-7 rounded-md text-[12px] font-medium transition-all duration-150 cursor-pointer capitalize",
                orderType === t
                  ? "bg-wb-orange text-black shadow-sm"
                  : "text-wb-muted hover:text-wb-text"
              )}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Quantity */}
        <div>
          <label className="block section-label mb-1.5">Shares</label>
          <input type="number" min={1} value={qty}
            onChange={(e) => setQty(Math.max(1, +e.target.value))}
            inputMode="numeric"
            className="wb-input" />
        </div>

        {/* Limit/stop price */}
        {orderType !== "market" && (
          <div>
            <label className="block section-label mb-1.5">
              {orderType === "limit" ? "Limit Price" : "Stop Price"}
            </label>
            <input type="number" step="0.0001" value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value ? +e.target.value : "")}
              inputMode="decimal"
              className="wb-input" />
          </div>
        )}

        {/* Market price hint */}
        {orderType === "market" && defaultPrice > 0 && (
          <div className="flex items-center justify-between text-[12px] bg-wb-surface2 border border-wb-border rounded-lg px-3 py-2.5">
            <span className="text-wb-muted">Market Price</span>
            <span className="num text-wb-text font-semibold">{fmt.usd(defaultPrice)}</span>
          </div>
        )}

        {/* Estimated total */}
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-wb-muted">Est. Total</span>
          <span className="num font-bold text-wb-text">{estimated > 0 ? fmt.usd(estimated) : "—"}</span>
        </div>

        {/* Submit */}
        <button
          onClick={submit}
          disabled={submitting}
          className={cn(
            "w-full h-11 rounded-lg text-[14px] font-bold transition-all duration-150 cursor-pointer disabled:opacity-50 active:scale-[0.98]",
            side === "buy"
              ? "bg-wb-green text-black hover:brightness-110"
              : "bg-wb-red text-white hover:brightness-110"
          )}
        >
          {submitting ? "Submitting…" : `${side === "buy" ? "Buy" : "Sell"} ${symbol}`}
        </button>

        {msg && (
          <div className={cn(
            "text-[12px] px-3 py-2.5 rounded-lg border",
            msg.startsWith("✓")
              ? "bg-wb-green/5 border-wb-green/20 text-wb-green"
              : "bg-wb-red/5 border-wb-red/20 text-wb-red"
          )}>
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}

