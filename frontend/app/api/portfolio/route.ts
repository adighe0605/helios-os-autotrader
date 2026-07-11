import { NextResponse } from "next/server";
import { tradingFetch, isAlpacaConnected, alpacaMode } from "@/lib/alpaca-server";

interface AlpacaClock {
  timestamp: string;
  is_open: boolean;
  next_open: string;
  next_close: string;
}

export async function GET() {
  if (!isAlpacaConnected()) {
    return NextResponse.json({ error: "Alpaca paper account is not connected." }, { status: 503 });
  }
  if (alpacaMode() !== "paper") {
    return NextResponse.json({ error: "Dashboard is restricted to Alpaca paper mode." }, { status: 409 });
  }
  try {
    const [a, clock] = await Promise.all([
      tradingFetch<Record<string, string>>("/v2/account"),
      tradingFetch<AlpacaClock>("/v2/clock").catch(() => null),
    ]);

    const equity = parseFloat(a.equity);
    const lastEquity = parseFloat(a.last_equity || a.equity);

    // Alpaca's `last_equity` is the equity as of the PREVIOUS trading day's 4 PM
    // close. It only rolls forward at the next market OPEN — not at midnight. So
    // between sessions (overnight, pre-market, weekends) `equity - last_equity`
    // reflects the LAST completed session, not "today". Showing that as "Day P&L"
    // on a fresh calendar day is misleading.
    //
    // Webull-style behavior: Day P&L only accrues once today's session is open.
    // While the market is closed, equity is frozen at the last close, so the
    // intraday change for the current (not-yet-started) session is $0.00.
    const marketOpen = clock?.is_open ?? false;
    const sessionPnl = equity - lastEquity;               // Alpaca close-to-close delta
    const sessionPnlPct = lastEquity ? (sessionPnl / lastEquity) * 100 : 0;

    const dayPnl = marketOpen ? sessionPnl : 0;
    const dayPnlPct = marketOpen ? sessionPnlPct : 0;

    return NextResponse.json({
      cash: parseFloat(a.cash),
      equity,
      buying_power: parseFloat(a.buying_power),
      portfolio_value: parseFloat(a.portfolio_value),
      day_pnl: dayPnl,
      day_pnl_pct: dayPnlPct,
      // Last completed session's result — kept for the detail view so the info
      // isn't lost while the market is closed.
      last_session_pnl: sessionPnl,
      last_session_pnl_pct: sessionPnlPct,
      market_open: marketOpen,
      next_open: clock?.next_open ?? null,
      total_pnl: parseFloat(a.unrealized_pl ?? "0"),
      total_pnl_pct: parseFloat(a.unrealized_plpc ?? "0") * 100,
      mode: alpacaMode(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
