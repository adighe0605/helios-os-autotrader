import { NextResponse } from "next/server";
import { tradingFetch, isAlpacaConnected, alpacaMode } from "@/lib/alpaca-server";

export async function GET() {
  if (!isAlpacaConnected()) {
    return NextResponse.json({ error: "Alpaca paper account is not connected." }, { status: 503 });
  }
  if (alpacaMode() !== "paper") {
    return NextResponse.json({ error: "Dashboard positions are restricted to Alpaca paper mode." }, { status: 409 });
  }
  try {
    const positions = await tradingFetch<any[]>("/v2/positions");
    return NextResponse.json(
      positions.map((p) => ({
        symbol: p.symbol,
        qty: parseFloat(p.qty),
        avg_entry_price: parseFloat(p.avg_entry_price),
        current_price: parseFloat(p.current_price ?? "0"),
        market_value: parseFloat(p.market_value ?? "0"),
        unrealized_pnl: parseFloat(p.unrealized_pl ?? "0"),
        unrealized_pnl_pct: parseFloat(p.unrealized_plpc ?? "0") * 100,
      }))
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
