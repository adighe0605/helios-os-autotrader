import { NextResponse } from "next/server";

const DEFAULTS = {
  max_daily_loss_pct: parseFloat(process.env.RISK_MAX_DAILY_LOSS_PCT ?? "2"),
  max_position_pct: parseFloat(process.env.RISK_MAX_POSITION_PCT ?? "10"),
  max_drawdown_pct: 15,
  max_trades_per_day: parseInt(process.env.RISK_MAX_TRADES_PER_DAY ?? "25"),
  cooldown_after_loss_min: 15,
  kill_switch_armed: false,
};

export async function GET() {
  return NextResponse.json(DEFAULTS);
}

export async function PATCH() {
  // Settings updates are handled via Vercel env vars in production
  return NextResponse.json(DEFAULTS);
}
