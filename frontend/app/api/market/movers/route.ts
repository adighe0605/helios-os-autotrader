import { NextResponse } from "next/server";
import { getSnapshots, snapshotToQuote, isAlpacaConnected } from "@/lib/alpaca-server";

const SYMBOLS = ["AAPL", "MSFT", "NVDA", "TSLA", "META", "AMZN", "GOOGL", "AMD", "NFLX", "AVGO"];

export async function GET() {
  if (!isAlpacaConnected()) {
    return NextResponse.json(mockMovers());
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
  } catch {
    return NextResponse.json(mockMovers());
  }
}

function mockMovers() {
  const gainers = [
    { symbol: "NVDA", price: 137.82, change: 3.86, change_pct: 2.87, volume: 31_200_000, ts: new Date().toISOString() },
    { symbol: "AMD", price: 162.34, change: 3.06, change_pct: 1.92, volume: 24_100_000, ts: new Date().toISOString() },
    { symbol: "TSLA", price: 248.10, change: 2.14, change_pct: 0.87, volume: 19_300_000, ts: new Date().toISOString() },
    { symbol: "META", price: 517.20, change: 3.81, change_pct: 0.74, volume: 11_200_000, ts: new Date().toISOString() },
    { symbol: "AMZN", price: 190.55, change: 0.58, change_pct: 0.31, volume: 15_400_000, ts: new Date().toISOString() },
  ];
  const losers = [
    { symbol: "PFE", price: 27.50, change: -0.81, change_pct: -2.86, volume: 9_800_000, ts: new Date().toISOString() },
    { symbol: "WBA", price: 10.92, change: -0.21, change_pct: -1.89, volume: 7_100_000, ts: new Date().toISOString() },
    { symbol: "F", price: 11.31, change: -0.18, change_pct: -1.57, volume: 16_400_000, ts: new Date().toISOString() },
    { symbol: "INTC", price: 31.91, change: -0.34, change_pct: -1.05, volume: 18_200_000, ts: new Date().toISOString() },
    { symbol: "BA", price: 184.40, change: -1.62, change_pct: -0.87, volume: 5_200_000, ts: new Date().toISOString() },
  ];
  return { gainers, losers };
}
