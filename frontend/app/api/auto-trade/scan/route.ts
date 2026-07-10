import { NextResponse } from "next/server";
import { getSnapshots, isAlpacaConnected } from "@/lib/alpaca-server";

// Penny stock universe — sub-$5 liquid names
const PENNY_UNIVERSE = [
  "SNDL","MMAT","CLOV","ACB","TLRY","SENS","XELA","ATER","SOFI","GPRO",
  "NOK","BB","WISH","EXPR","NAKD","SPRT","BBIG","PROG","CEI","PHIL",
  "OCGN","BNGO","IDEX","JAGX","AVXL","SIGA","HCDI","LODE","ATXI","NKLA",
  "SOLO","RIDE","ARVL","GOEV","FSR","BLNK","PLUG","FCEL","BLDP","BE",
];

export async function GET() {
  if (!isAlpacaConnected()) return NextResponse.json([]);
  try {
    const snaps = await getSnapshots(PENNY_UNIVERSE);
    const now = new Date().toISOString();
    const candidates = Object.entries(snaps)
      .filter(([, snap]) => {
        const price = snap.latestTrade?.p ?? snap.dailyBar?.c ?? 99;
        const volume = snap.dailyBar?.v ?? 0;
        const prevVolume = snap.prevDailyBar?.v ?? 1;
        return price <= 5.0 && price >= 0.10 && volume >= 100_000 && (volume / prevVolume) >= 1.2;
      })
      .map(([symbol, snap]) => {
        const price = snap.latestTrade?.p ?? snap.dailyBar?.c ?? 0;
        const prevClose = snap.prevDailyBar?.c ?? price;
        const change_pct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
        const volume = snap.dailyBar?.v ?? 0;
        const prevVolume = snap.prevDailyBar?.v ?? 1;
        const volume_surge = prevVolume > 0 ? volume / prevVolume : 1;
        const confidence = Math.min(0.95, Math.max(0.25, 0.45 + volume_surge * 0.08 + Math.abs(change_pct) * 0.02));
        const verdict = confidence >= 0.68 ? "buy" : change_pct <= -4 ? "sell" : "hold";
        const ai_score = Math.round(confidence * 100);
        return {
          symbol,
          price: +price.toFixed(4),
          change_pct: +change_pct.toFixed(2),
          volume,
          volume_surge: +volume_surge.toFixed(2),
          ai_score,
          verdict,
          confidence: +confidence.toFixed(2),
          stop_loss: verdict === "buy" ? +(price * 0.93).toFixed(4) : null,
          take_profit: verdict === "buy" ? +(price * 1.14).toFixed(4) : null,
          summary: `${verdict.toUpperCase()} signal with ${ai_score}% AI score from surge ${volume_surge.toFixed(1)}x and ${change_pct.toFixed(2)}% move.`,
          scanned_at: now,
        };
      })
      .sort((a, b) => b.ai_score - a.ai_score)
      .slice(0, 20);
    return NextResponse.json(candidates);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
