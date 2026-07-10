import { NextResponse } from "next/server";
import { tradingFetch, isAlpacaConnected } from "@/lib/alpaca-server";

export async function POST() {
  if (!isAlpacaConnected()) return NextResponse.json({ canceled: 0 });
  try {
    await tradingFetch("/v2/orders", { method: "DELETE" });
    return NextResponse.json({ canceled: 1 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
