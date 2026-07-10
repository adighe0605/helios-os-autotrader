import { NextResponse } from "next/server";
import { getSnapshots, snapshotToQuote, isAlpacaConnected } from "@/lib/alpaca-server";

const SYMBOLS = ["AAPL", "MSFT", "NVDA", "TSLA", "META", "AMZN", "GOOGL", "AMD", "NFLX", "AVGO"];

export async function GET() {
  if (!isAlpacaConnected()) {
    return NextResponse.json({ gainers: [], losers: [] });
  }
  try {
    const snaps = await getSnapshots(SYMBOLS);
    const quotes = SYMBOLS
      .filter((s) => snaps[s])
      .map((s) => snapshotToQuote(s, snaps[s]!))
      .sort((a, b) => b.change_pct - a.change_pct);
    return NextResponse.json({
      gainers: quotes.slice(0, 5),
      losers: quotes.slice(-5).reverse(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
