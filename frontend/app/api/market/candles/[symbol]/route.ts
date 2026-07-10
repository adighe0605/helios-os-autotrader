import { NextRequest, NextResponse } from "next/server";
import { dataFetch, isAlpacaConnected } from "@/lib/alpaca-server";

const TF_MAP: Record<string, string> = {
  "1m": "1Min", "5m": "5Min", "15m": "15Min",
  "1h": "1Hour", "1d": "1Day", "1w": "1Week",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const sym = symbol.toUpperCase();
  const tf = req.nextUrl.searchParams.get("tf") ?? "1d";
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "200"), 1000);
  const timeframe = TF_MAP[tf] ?? "1Day";

  if (!isAlpacaConnected()) {
    return NextResponse.json(mockCandles(sym, limit));
  }
  try {
    const data = await dataFetch<{ bars: any[] }>(
      `/v2/stocks/${encodeURIComponent(sym)}/bars?timeframe=${timeframe}&limit=${limit}&feed=iex&sort=asc`
    );
    const bars = data?.bars ?? [];
    if (bars.length === 0) {
      return NextResponse.json(mockCandles(sym, limit));
    }
    return NextResponse.json(
      bars.map((b) => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v }))
    );
  } catch (e: any) {
    return NextResponse.json(mockCandles(sym, limit));
  }
}

function mockCandles(symbol: string, limit: number) {
  let seed = symbol.split("").reduce((h, c) => ((h * 31 + c.charCodeAt(0)) >>> 0), 0);
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  let price = 50 + rand() * 400;
  const now = Date.now();
  return Array.from({ length: limit }, (_, i) => {
    const shock = (rand() - 0.5) * 0.04;
    const c = Math.max(1, price * (1 + shock));
    const o = price; const h = Math.max(o, c) * (1 + rand() * 0.01);
    const l = Math.min(o, c) * (1 - rand() * 0.01);
    price = c;
    return { t: new Date(now - (limit - i) * 86_400_000).toISOString(), o: +o.toFixed(2), h: +h.toFixed(2), l: +l.toFixed(2), c: +c.toFixed(2), v: Math.floor(500_000 + rand() * 20_000_000) };
  });
}
