import { NextRequest, NextResponse } from "next/server";
import { isAlpacaConnected, tradingFetch } from "@/lib/alpaca-server";

export async function POST(req: NextRequest) {
  const arm = req.nextUrl.searchParams.get("arm") === "true";
  if (!arm) {
    return NextResponse.json({ armed: false, canceled_orders: 0 });
  }

  if (!isAlpacaConnected()) {
    return NextResponse.json({ armed: true, canceled_orders: 0 });
  }

  try {
    await tradingFetch("/v2/orders", { method: "DELETE" });
    return NextResponse.json({ armed: true, canceled_orders: 1 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
