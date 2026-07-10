import { NextRequest, NextResponse } from "next/server";

type AutoTradeSettings = {
  min_confidence?: number;
  max_price?: number;
  min_volume?: number;
  max_position_pct?: number;
  max_concurrent_positions?: number;
};

const defaults = () => ({
  enabled: process.env.AUTONOMOUS_MODE === "true",
  min_confidence: parseFloat(process.env.AUTO_MIN_CONFIDENCE ?? "0.70"),
  max_price: parseFloat(process.env.PENNY_MAX_PRICE ?? "5.0"),
  min_volume: parseInt(process.env.PENNY_MIN_VOLUME ?? "300000", 10),
  max_position_pct: parseFloat(process.env.AUTO_MAX_POSITION_PCT ?? "3.0"),
  max_concurrent_positions: parseInt(process.env.AUTO_MAX_CONCURRENT_POSITIONS ?? "5", 10),
  market_open: false,
  last_scan_at: null as string | null,
  scan_count: 0,
  trades_today: 0,
});

export async function PATCH(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as AutoTradeSettings;
  const base = defaults();
  return NextResponse.json({
    ...base,
    min_confidence: body.min_confidence ?? base.min_confidence,
    max_price: body.max_price ?? base.max_price,
    min_volume: body.min_volume ?? base.min_volume,
    max_position_pct: body.max_position_pct ?? base.max_position_pct,
    max_concurrent_positions: body.max_concurrent_positions ?? base.max_concurrent_positions,
  });
}
