import { NextResponse } from "next/server";
import { getSnapshots, snapshotToQuote, isAlpacaConnected } from "@/lib/alpaca-server";

const TICKER_SYMBOLS = [
  "AAPL", "NVDA", "TSLA", "AMD", "META",
  "AMZN", "MSFT", "GOOGL", "SPY", "QQQ",
  "SNDL", "MMAT", "CLOV",
];

const MOCK: Record<string, { p: number; c: number }> = {
  AAPL:  { p: 212.49, c:  1.24 },
  NVDA:  { p: 137.82, c:  2.87 },
  TSLA:  { p: 248.10, c: -0.53 },
  AMD:   { p: 162.34, c:  1.92 },
  META:  { p: 517.20, c:  0.70 },
  AMZN:  { p: 190.55, c:  0.31 },
  MSFT:  { p: 441.00, c:  0.88 },
  GOOGL: { p: 178.40, c:  0.65 },
  SPY:   { p: 554.20, c:  0.84 },
  QQQ:   { p: 472.60, c:  1.12 },
  SNDL:  { p:   1.24, c:  8.45 },
  MMAT:  { p:   0.93, c: 15.20 },
  CLOV:  { p:   1.87, c:  4.10 },
};

export async function GET() {
  if (!isAlpacaConnected()) {
    return NextResponse.json(
      TICKER_SYMBOLS.map((s) => ({
        symbol: s,
        price: MOCK[s]?.p ?? 0,
        change_pct: MOCK[s]?.c ?? 0,
      }))
    );
  }
  try {
    const snaps = await getSnapshots(TICKER_SYMBOLS);
    const quotes = TICKER_SYMBOLS
      .filter((s) => snaps[s])
      .map((s) => {
        const q = snapshotToQuote(s, snaps[s]!);
        return { symbol: q.symbol, price: q.price, change_pct: q.change_pct };
      });
    return NextResponse.json(quotes);
  } catch {
    return NextResponse.json(
      TICKER_SYMBOLS.map((s) => ({
        symbol: s,
        price: MOCK[s]?.p ?? 0,
        change_pct: MOCK[s]?.c ?? 0,
      }))
    );
  }
}
