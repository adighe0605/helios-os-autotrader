"use client";

import useSWR from "swr";

import { api } from "@/lib/api";
import { cn, fmt } from "@/lib/format";

const FILTERS = [7, 30, 60, 90, 365] as const;

export function TradeHistoryPanel({
  days,
  onDaysChange,
}: {
  days: number;
  onDaysChange: (days: number) => void;
}) {
  const { data, error, isLoading } = useSWR(`trade-history:${days}`, () => api.tradeHistory(days), {
    refreshInterval: 60_000,
  });

  return (
    <div className="bg-wb-surface border border-wb-border rounded-xl overflow-hidden shadow-card">
      <div className="px-4 py-3 border-b border-wb-border space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[13px] font-semibold text-wb-text">Trade History</div>
            <div className="text-[12px] text-wb-muted mt-0.5">Actual Alpaca fill history with realized profit/loss.</div>
          </div>
          <span className="badge badge-orange">{days}d</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => onDaysChange(filter)}
              className={cn(
                "h-8 px-3 rounded-lg border text-[12px] font-semibold transition-colors",
                days === filter
                  ? "bg-wb-orange/10 border-wb-orange/40 text-wb-orange"
                  : "bg-wb-surface2/40 border-wb-border text-wb-muted hover:text-wb-text hover:bg-wb-surface2"
              )}
            >
              {filter}d
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="px-4 py-4 text-[12px] text-red-200 bg-wb-red/10 border-b border-wb-red/20">
          Unable to load Alpaca trade history.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 p-4 border-b border-wb-border bg-wb-surface2/30">
        <SummaryCard label="Trades" value={data ? fmt.num(data.summary.total_trades, 0) : "—"} />
        <SummaryCard
          label="Realized P&L"
          value={data ? fmt.usd(data.summary.realized_pnl) : "—"}
          tone={data ? (data.summary.realized_pnl >= 0 ? "pos" : "neg") : "default"}
        />
        <SummaryCard label="Wins / Losses" value={data ? `${data.summary.wins} / ${data.summary.losses}` : "—"} />
        <SummaryCard label="Turnover" value={data ? fmt.usd(data.summary.turnover, 0) : "—"} />
      </div>

      {isLoading && !data ? (
        <div className="py-12 text-center text-[13px] text-wb-dim">Loading Alpaca trade history…</div>
      ) : data && data.trades.length > 0 ? (
        <>
          <div className="md:hidden divide-y divide-wb-border">
            {data.trades.map((trade) => {
              const pnl = trade.realized_pnl;
              return (
                <div key={trade.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[13px] font-semibold text-wb-text">{trade.symbol}</div>
                      <div className="text-[11px] text-wb-dim">{fmt.date(trade.executed_at)} · {fmt.time(trade.executed_at)}</div>
                    </div>
                    <span className={cn("badge", isBuySide(trade.side) ? "badge-green" : "badge-red")}>{trade.side.replace(/_/g, " ").toUpperCase()}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
                    <Row label="Qty" value={fmt.num(trade.qty, 0)} />
                    <Row label="Price" value={fmt.usd(trade.price, 4)} />
                    <Row label="Value" value={fmt.usd(trade.gross_value)} />
                    <Row label="Position" value={fmt.num(trade.running_position_qty, 0)} />
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-wb-dim">Realized P&L</span>
                    <span className={cn("num font-semibold", pnl === null ? "text-wb-dim" : pnl >= 0 ? "pos-text" : "neg-text")}>
                      {pnl === null ? "Open leg" : fmt.usd(pnl)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-wb-border">
                  {["Date", "Symbol", "Side", "Qty", "Price", "Value", "Realized P&L", "Position"].map((header) => (
                    <th
                      key={header}
                      className={cn("py-2.5 px-3 section-label", header === "Date" || header === "Symbol" || header === "Side" ? "text-left" : "text-right")}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.trades.map((trade) => {
                  const pnl = trade.realized_pnl;
                  return (
                    <tr key={trade.id} className="wb-row">
                      <td className="py-3 px-3 text-[12px] text-wb-muted">
                        <div>{fmt.date(trade.executed_at)}</div>
                        <div className="text-[11px] text-wb-dim">{fmt.time(trade.executed_at)}</div>
                      </td>
                      <td className="py-3 px-3 text-[13px] font-semibold text-wb-text">{trade.symbol}</td>
                      <td className="py-3 px-3">
                        <span className={cn("badge", isBuySide(trade.side) ? "badge-green" : "badge-red")}>{trade.side.replace(/_/g, " ").toUpperCase()}</span>
                      </td>
                      <td className="py-3 px-3 text-right num text-[13px] text-wb-text">{fmt.num(trade.qty, 0)}</td>
                      <td className="py-3 px-3 text-right num text-[12px] text-wb-muted">{fmt.usd(trade.price, 4)}</td>
                      <td className="py-3 px-3 text-right num text-[13px] text-wb-text">{fmt.usd(trade.gross_value)}</td>
                      <td className={cn("py-3 px-3 text-right num text-[13px] font-semibold", pnl === null ? "text-wb-dim" : pnl >= 0 ? "pos-text" : "neg-text")}>
                        {pnl === null ? "Open leg" : fmt.usd(pnl)}
                      </td>
                      <td className="py-3 px-3 text-right num text-[13px] text-wb-text">{fmt.num(trade.running_position_qty, 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="py-12 text-center">
          <div className="text-wb-dim text-[13px]">No fills in the selected range</div>
          <div className="text-wb-dim/60 text-[12px] mt-1">Change the filter to inspect a longer Alpaca trading window.</div>
        </div>
      )}
    </div>
  );
}

function isBuySide(side: string) {
  return side === "buy" || side === "buy_to_cover";
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "pos" | "neg";
}) {
  return (
    <div className="rounded-lg border border-wb-border bg-wb-surface px-3 py-2">
      <div className="section-label mb-1">{label}</div>
      <div className={cn("text-[13px] font-semibold num", tone === "pos" ? "pos-text" : tone === "neg" ? "neg-text" : "text-wb-text")}>
        {value}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-wb-dim">{label}</span>
      <span className="num text-wb-text">{value}</span>
    </div>
  );
}
