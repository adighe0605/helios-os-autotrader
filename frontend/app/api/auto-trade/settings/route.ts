import { NextRequest, NextResponse } from "next/server";
import { getAutoTradeState, updateAutoTradeSettings } from "@/lib/auto-trade-runtime";

type AutoTradeSettingsPatch = {
  min_confidence?: number;
  max_price?: number;
  min_volume?: number;
  max_position_pct?: number;
  max_concurrent_positions?: number;
  penny_allocation_pct?: number;
  other_allocation_pct?: number;
};

export async function PATCH(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as AutoTradeSettingsPatch;
  updateAutoTradeSettings(body);
  return NextResponse.json(getAutoTradeState());
}
