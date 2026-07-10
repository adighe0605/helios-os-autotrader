import { NextResponse } from "next/server";
import { setAutoTradeEnabled } from "@/lib/auto-trade-runtime";

const AUTO_TRADE_COOKIE = "helios_auto_trade_enabled";

export async function POST() {
  const state = setAutoTradeEnabled(true);
  const res = NextResponse.json({
    ok: true,
    enabled: state.enabled,
    message: "Bot started. It will execute when market is open.",
  });
  res.cookies.set(AUTO_TRADE_COOKIE, "1", {
    httpOnly: false,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
