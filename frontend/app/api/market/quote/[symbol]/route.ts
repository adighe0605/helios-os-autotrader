import { NextRequest, NextResponse } from "next/server";
import { getSnapshots, snapshotToQuote, isAlpacaConnected } from "@/lib/alpaca-server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const sym = symbol.toUpperCase();
  if (!isAlpacaConnected()) {
    // deterministic mock fallback
    const seed = sym.split("").reduce((h, c) => ((h * 31 + c.charCodeAt(0)) >>> 0), 0);
    const price = 50 + (seed % 400);
    return NextResponse.json({
      symbol: sym, price, change: 0, change_pct: 0,
      volume: 1_000_000 + (seed % 10_000_000), ts: new Date().toISOString(),
    });
  }
  try {
    const snaps = await getSnapshots([sym]);
    const snap = snaps[sym];
    if (!snap) return NextResponse.json({ error: "Symbol not found" }, { status: 404 });
    return NextResponse.json(snapshotToQuote(sym, snap));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
