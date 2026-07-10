import { NextRequest, NextResponse } from "next/server";
import { isAlpacaConnected, alpacaMode } from "@/lib/alpaca-server";
import { getAutoTradeState } from "@/lib/auto-trade-runtime";

const AUTO_TRADE_COOKIE = "helios_auto_trade_enabled";

export async function GET(req: NextRequest) {
  const state = getAutoTradeState();
  const cookieEnabled = req.cookies.get(AUTO_TRADE_COOKIE)?.value;
  // Default ON — only disable if cookie explicitly set to "0"
  const enabled = cookieEnabled === "0" ? false : true;
  return NextResponse.json({
    ...state,
    enabled,
    alpaca_mode: isAlpacaConnected() ? alpacaMode() : "disconnected",
  });
}
