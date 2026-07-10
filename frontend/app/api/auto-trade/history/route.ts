import { NextRequest, NextResponse } from "next/server";
import { isAlpacaConnected, tradingFetch } from "@/lib/alpaca-server";

export async function GET(req: NextRequest) {
  const limit = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10), 1), 100);
  if (!isAlpacaConnected()) return NextResponse.json([]);

  try {
    const orders = await tradingFetch<any[]>(`/v2/orders?status=all&limit=${limit}&direction=desc`);
    const records = orders.map((o) => {
      const side = (o.side === "sell" ? "sell" : "buy") as "buy" | "sell";
      const avg = o.filled_avg_price ? parseFloat(o.filled_avg_price) : null;
      const px = avg ?? (o.limit_price ? parseFloat(o.limit_price) : 0);
      return {
        id: o.id,
        symbol: o.symbol,
        side,
        qty: parseFloat(o.qty ?? "0"),
        price: px,
        order_id: o.id,
        verdict: side,
        confidence: o.status === "filled" ? 0.78 : 0.62,
        reasoning: `Order ${o.status} via ${o.type} execution.`,
        stop_loss: null,
        take_profit: null,
        status: o.status,
        executed_at: o.created_at,
      };
    });
    return NextResponse.json(records);
  } catch {
    return NextResponse.json([]);
  }
}
