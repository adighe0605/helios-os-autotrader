"use client";

import type { Position } from "@/lib/types";
import { cn, fmt } from "@/lib/format";

export function PositionsTable({ positions }: { positions: Position[] }) {
  return (
    <div className="bg-wb-surface border border-wb-border overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-wb-border bg-wb-surface2">
        <span className="text-[11px] font-semibold text-wb-text">Positions</span>
        <span className="text-[11px] text-wb-muted">{positions.length} open</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-wb-border">
              {["Symbol", "Qty", "Avg Cost", "Last", "Mkt Value", "P&L", "P&L%"].map((h) => (
                <th key={h} className={cn(
                  "py-2 px-3 font-medium text-wb-dim uppercase tracking-wider text-[10px]",
                  h === "Symbol" ? "text-left" : "text-right"
                )}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const pos = p.unrealized_pnl >= 0;
              return (
                <tr key={p.symbol} className="border-b border-wb-border last:border-0 hover:bg-wb-surface2 transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "size-6 rounded-sm flex items-center justify-center text-[9px] font-bold shrink-0",
                        pos ? "bg-wb-green-dim text-wb-green" : "bg-wb-red-dim text-wb-red"
                      )}>
                        {p.symbol.slice(0, 2)}
                      </div>
                      <span className="font-semibold text-wb-text">{p.symbol}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right num text-wb-text">{fmt.num(p.qty, 0)}</td>
                  <td className="py-2.5 px-3 text-right num text-wb-muted">{fmt.usd(p.avg_entry_price)}</td>
                  <td className="py-2.5 px-3 text-right num text-wb-text">{fmt.usd(p.current_price)}</td>
                  <td className="py-2.5 px-3 text-right num text-wb-text">{fmt.usd(p.market_value)}</td>
                  <td className={cn("py-2.5 px-3 text-right num font-semibold", pos ? "pos-text" : "neg-text")}>
                    {fmt.usd(p.unrealized_pnl)}
                  </td>
                  <td className={cn("py-2.5 px-3 text-right num", pos ? "pos-text" : "neg-text")}>
                    {fmt.pct(p.unrealized_pnl_pct)}
                  </td>
                </tr>
              );
            })}
            {positions.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-wb-dim text-xs">
                  No open positions
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

