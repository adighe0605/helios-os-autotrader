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
        const vol_surge = prevVolume > 0 ? volume / prevVolume : 1;
        return {
          symbol, price: +price.toFixed(4),
          change_pct: +change_pct.toFixed(2),
          volume, vol_surge: +vol_surge.toFixed(2),
          score: +(vol_surge * 0.5 + Math.abs(change_pct) * 0.3).toFixed(2),
          catalyst: null,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
    return NextResponse.json(candidates);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
