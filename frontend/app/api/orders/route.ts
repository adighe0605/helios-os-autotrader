import { NextRequest, NextResponse } from "next/server";
import { tradingFetch, isAlpacaConnected } from "@/lib/alpaca-server";

export async function GET(req: NextRequest) {
  if (!isAlpacaConnected()) return NextResponse.json([]);
  const status = req.nextUrl.searchParams.get("status") ?? "all";
  const statusMap: Record<string, string> = { all: "all", open: "open", closed: "closed" };
  try {
    const orders = await tradingFetch<any[]>(
      `/v2/orders?status=${statusMap[status] ?? "all"}&limit=50&direction=desc`
    );
    return NextResponse.json(
      orders.map((o, i) => ({
        id: i + 1,
        broker_order_id: o.id,
        symbol: o.symbol,
        side: o.side,
        qty: parseFloat(o.qty),
        order_type: o.type,
        status: o.status,
        filled_qty: parseFloat(o.filled_qty ?? "0"),
        filled_avg_price: o.filled_avg_price ? parseFloat(o.filled_avg_price) : null,
        mode: process.env.ALPACA_BASE_URL?.includes("paper") ? "paper" : "live",
        created_at: o.created_at,
        reasoning: o.legs ? "Bracket order" : "Market order",
        confidence: null,
      }))
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAlpacaConnected())
    return NextResponse.json({ error: "Alpaca not connected" }, { status: 503 });
  try {
    const body = await req.json();
    const orderReq: Record<string, any> = {
      symbol: body.symbol,
      qty: String(body.qty),
      side: body.side,
      type: body.order_type ?? "market",
      time_in_force: "day",
    };
    if (body.limit_price) orderReq.limit_price = String(body.limit_price);
    if (body.stop_price) orderReq.stop_price = String(body.stop_price);
    if (body.take_profit && body.stop_loss) {
      orderReq.order_class = "bracket";
      orderReq.take_profit = { limit_price: String(body.take_profit) };
      orderReq.stop_loss = { stop_price: String(body.stop_loss) };
    }
    const order = await tradingFetch<any>("/v2/orders", {
      method: "POST",
      body: JSON.stringify(orderReq),
    });
    return NextResponse.json({
      id: 1, broker_order_id: order.id, symbol: order.symbol,
      side: order.side, qty: parseFloat(order.qty),
      order_type: order.type, status: order.status,
      filled_qty: parseFloat(order.filled_qty ?? "0"),
      filled_avg_price: order.filled_avg_price ? parseFloat(order.filled_avg_price) : null,
      mode: process.env.ALPACA_BASE_URL?.includes("paper") ? "paper" : "live",
      created_at: order.created_at,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
