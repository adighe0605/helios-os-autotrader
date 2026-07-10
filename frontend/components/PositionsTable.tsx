"use client";

import type { Position } from "@/lib/types";
import { cn, fmt } from "@/lib/format";

function SymbolAvatar({ symbol, pos }: { symbol: string; pos: boolean }) {
  return (
    <div className={cn(
      "w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0",
      pos ? "bg-wb-green/10 text-wb-green" : "bg-wb-red/10 text-wb-red"
    )}>
      {symbol.slice(0, 2)}
    </div>
  );
}

export function PositionsTable({ positions }: { positions: Position[] }) {
  return (
    <div className="bg-wb-surface border border-wb-border rounded-xl overflow-hidden shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-wb-border">
        <span className="text-[13px] font-semibold text-wb-text">Open Positions</span>
        <span className={cn(
          "badge",
          positions.length > 0 ? "badge-orange" : "badge-muted"
        )}>
          {positions.length} open
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-wb-border">
              {["Symbol", "Qty", "Avg Cost", "Last", "Mkt Value", "P&L", "P&L%"].map((h) => (
                <th key={h} className={cn(
                  "py-2.5 px-3 section-label",
                  h === "Symbol" ? "text-left" : "text-right"
                )}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const gain = p.unrealized_pnl >= 0;
              return (
                <tr key={p.symbol} className="wb-row">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2.5">
                      <SymbolAvatar symbol={p.symbol} pos={gain} />
                      <div>
                        <div className="text-[13px] font-semibold text-wb-text">{p.symbol}</div>
                        <div className={cn("text-[11px] font-medium", gain ? "pos-text" : "neg-text")}>
                          {gain ? "▲" : "▼"} {Math.abs(p.unrealized_pnl_pct).toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right num text-[13px] text-wb-text">{fmt.num(p.qty, 0)}</td>
                  <td className="py-3 px-3 text-right num text-[12px] text-wb-muted">{fmt.usd(p.avg_entry_price)}</td>
                  <td className="py-3 px-3 text-right num text-[13px] text-wb-text">{fmt.usd(p.current_price)}</td>
                  <td className="py-3 px-3 text-right num text-[13px] text-wb-text">{fmt.usd(p.market_value)}</td>
                  <td className={cn("py-3 px-3 text-right num text-[13px] font-semibold", gain ? "pos-text" : "neg-text")}>
                    {fmt.usd(p.unrealized_pnl)}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className={cn("badge num", gain ? "badge-green" : "badge-red")}>
                      {gain ? "+" : ""}{p.unrealized_pnl_pct.toFixed(2)}%
                    </span>
                  </td>
                </tr>
              );
            })}
            {positions.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center">
                  <div className="text-wb-dim text-[13px]">No open positions</div>
                  <div className="text-wb-dim/60 text-[12px] mt-1">Trades will appear here once executed</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

