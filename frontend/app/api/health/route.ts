import { NextResponse } from "next/server";
import { isAlpacaConnected, alpacaMode } from "@/lib/alpaca-server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    mode: process.env.TRADING_MODE ?? "paper",
    env: process.env.ENVIRONMENT ?? "production",
    alpaca_connected: isAlpacaConnected(),
    alpaca_mode: isAlpacaConnected() ? alpacaMode() : "disconnected",
    data_source: isAlpacaConnected() ? "alpaca" : "mock",
    scheduler_running: true,
    scheduled_jobs: ["autonomous_trade_cycle", "scan_watchlist", "daily_recap"],
  });
}
