import { NextResponse } from "next/server";
import { isAlpacaConnected, alpacaMode } from "@/lib/alpaca-server";

export async function GET() {
  return NextResponse.json({
    enabled: process.env.AUTONOMOUS_MODE === "true",
    min_confidence: parseFloat(process.env.AUTO_MIN_CONFIDENCE ?? "0.70"),
    max_price: parseFloat(process.env.PENNY_MAX_PRICE ?? "5.0"),
    min_volume: parseInt(process.env.PENNY_MIN_VOLUME ?? "300000"),
    max_position_pct: parseFloat(process.env.AUTO_MAX_POSITION_PCT ?? "3.0"),
    max_concurrent_positions: parseInt(process.env.AUTO_MAX_CONCURRENT_POSITIONS ?? "5"),
    market_open: isMarketOpen(),
    last_scan_at: null,
    scan_count: 0,
    trades_today: 0,
    alpaca_mode: isAlpacaConnected() ? alpacaMode() : "disconnected",
  });
}

function isMarketOpen(): boolean {
  const now = new Date();
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = et.getDay(); // 0=Sun, 6=Sat
  const hour = et.getHours();
  const min = et.getMinutes();
  const totalMin = hour * 60 + min;
  return day >= 1 && day <= 5 && totalMin >= 9 * 60 + 30 && totalMin < 16 * 60;
}
