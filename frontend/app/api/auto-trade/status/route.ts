import { NextRequest, NextResponse } from "next/server";
import { isAlpacaConnected, alpacaMode } from "@/lib/alpaca-server";
import { getAutoTradeState } from "@/lib/auto-trade-runtime";

const AUTO_TRADE_COOKIE = "helios_auto_trade_enabled";

export async function GET(req: NextRequest) {
  const state = getAutoTradeState();
  const cookieEnabled = req.cookies.get(AUTO_TRADE_COOKIE)?.value;
  const enabled = cookieEnabled === "1" ? true : cookieEnabled === "0" ? false : state.enabled;
  return NextResponse.json({
    ...state,
    enabled,
    alpaca_mode: isAlpacaConnected() ? alpacaMode() : "disconnected",
  });
}
