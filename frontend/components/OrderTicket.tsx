"use client";

import { useState } from "react";

import { api } from "@/lib/api";
import { cn, fmt } from "@/lib/format";

export function OrderTicket({ symbol, defaultPrice }: { symbol: string; defaultPrice: number }) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [qty, setQty] = useState(100);
  const [orderType, setOrderType] = useState<"market" | "limit" | "stop">("market");
  const [limitPrice, setLimitPrice] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setMsg(null);
    try {
      const order = await api.placeOrder({
        symbol, side, qty,
        order_type: orderType,
        limit_price: orderType === "limit" ? (limitPrice || null) : null,
        stop_price: orderType === "stop" ? (limitPrice || null) : null,
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
    <div className="bg-wb-surface border border-wb-border overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-wb-border bg-wb-surface2 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-wb-text">Place Order</span>
        <span className="text-[10px] text-wb-dim">Paper · Simulated</span>
      </div>

      {/* Buy / Sell toggle */}
      <div className="flex border-b border-wb-border">
        <button
          onClick={() => setSide("buy")}
          className={cn(
            "flex-1 py-2.5 text-[13px] font-bold transition",
            side === "buy"
              ? "bg-wb-green text-black"
              : "text-wb-muted hover:text-wb-green hover:bg-wb-green-dim"
          )}
        >
          BUY
        </button>
        <button
          onClick={() => setSide("sell")}
          className={cn(
            "flex-1 py-2.5 text-[13px] font-bold transition border-l border-wb-border",
            side === "sell"
              ? "bg-wb-red text-white"
              : "text-wb-muted hover:text-wb-red hover:bg-wb-red-dim"
          )}
        >
          SELL
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Order type */}
        <div className="flex gap-px bg-wb-surface3 border border-wb-border rounded-sm overflow-hidden">
          {(["market", "limit", "stop"] as const).map((t) => (
            <button key={t} onClick={() => setOrderType(t)}
              className={cn(
                "flex-1 py-1.5 text-[11px] font-medium transition capitalize",
                orderType === t ? "bg-wb-orange text-black" : "text-wb-muted hover:text-wb-text"
              )}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-[10px] uppercase text-wb-dim mb-1 tracking-wider">Shares</label>
          <input type="number" min={1} value={qty}
            onChange={(e) => setQty(Math.max(1, +e.target.value))}
            className="wb-input" />
        </div>

        {/* Price */}
        {orderType !== "market" && (
          <div>
            <label className="block text-[10px] uppercase text-wb-dim mb-1 tracking-wider">
              {orderType === "limit" ? "Limit Price" : "Stop Price"}
            </label>
            <input type="number" step="0.0001" value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value ? +e.target.value : "")}
              className="wb-input" />
          </div>
        )}

        {/* Market price hint */}
        {orderType === "market" && defaultPrice > 0 && (
          <div className="flex items-center justify-between text-[11px] border border-wb-border bg-wb-surface2 px-3 py-2">
            <span className="text-wb-muted">Market Price</span>
            <span className="num text-wb-text font-medium">{fmt.usd(defaultPrice)}</span>
          </div>
        )}

        {/* Estimated value */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-wb-muted">Est. Amount</span>
          <span className="num font-semibold text-wb-text">{estimated > 0 ? fmt.usd(estimated) : "—"}</span>
        </div>

        {/* Submit */}
        <button
          onClick={submit}
          disabled={submitting}
          className={cn(
            "w-full py-2.5 text-[13px] font-bold rounded-sm transition disabled:opacity-50",
            side === "buy"
              ? "bg-wb-green text-black hover:brightness-110"
              : "bg-wb-red text-white hover:brightness-110"
          )}
        >
          {submitting ? "Submitting…" : `${side === "buy" ? "Buy" : "Sell"} ${symbol}`}
        </button>

        {msg && (
          <div className={cn(
            "text-[11px] px-3 py-2 border",
            msg.startsWith("✓")
              ? "bg-wb-green-dim border-wb-green/30 text-wb-green"
              : "bg-wb-red-dim border-wb-red/30 text-wb-red"
          )}>
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}

