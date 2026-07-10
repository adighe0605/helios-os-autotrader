import { NextResponse } from "next/server";
import { tradingFetch, isAlpacaConnected, alpacaMode } from "@/lib/alpaca-server";

export async function GET() {
  if (!isAlpacaConnected()) {
    return NextResponse.json({
      cash: 100_000, equity: 100_000, buying_power: 200_000,
      portfolio_value: 100_000, day_pnl: 0, day_pnl_pct: 0,
      total_pnl: 0, total_pnl_pct: 0, mode: "mock",
    });
  }
  try {
    const a = await tradingFetch<Record<string, string>>("/v2/account");
    const equity = parseFloat(a.equity);
    const lastEquity = parseFloat(a.last_equity || a.equity);
    const dayPnl = equity - lastEquity;
    return NextResponse.json({
      cash: parseFloat(a.cash),
      equity,
      buying_power: parseFloat(a.buying_power),
      portfolio_value: parseFloat(a.portfolio_value),
      day_pnl: dayPnl,
      day_pnl_pct: lastEquity ? (dayPnl / lastEquity) * 100 : 0,
      total_pnl: parseFloat(a.unrealized_pl ?? "0"),
      total_pnl_pct: parseFloat(a.unrealized_plpc ?? "0") * 100,
      mode: alpacaMode(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
