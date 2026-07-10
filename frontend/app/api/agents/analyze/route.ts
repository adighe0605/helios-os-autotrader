import { NextRequest, NextResponse } from "next/server";
import { getSnapshots, dataFetch, isAlpacaConnected } from "@/lib/alpaca-server";

export async function POST(req: NextRequest) {
  const { symbol } = await req.json();
  const sym = (symbol as string).toUpperCase();

  // Get market data
  const [snapData, barsData] = await Promise.allSettled([
    isAlpacaConnected() ? getSnapshots([sym]) : Promise.resolve(null),
    isAlpacaConnected()
      ? dataFetch<{ bars: any[] }>(`/v2/stocks/${sym}/bars?timeframe=1Day&limit=50&feed=iex&sort=asc`)
      : Promise.resolve(null),
  ]);

  const snap = snapData.status === "fulfilled" ? snapData.value?.[sym] : null;
  const bars: any[] = barsData.status === "fulfilled" ? (barsData.value as any)?.bars ?? [] : [];

  const price = snap?.latestTrade?.p ?? snap?.dailyBar?.c ?? 0;
  const prevClose = snap?.prevDailyBar?.c ?? price;
  const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
  const volume = snap?.dailyBar?.v ?? 0;

  // Technical signals from bars
  const closes = bars.map((b) => b.c);
  const sma20 = closes.length >= 20 ? closes.slice(-20).reduce((a, b) => a + b, 0) / 20 : price;
  const sma5 = closes.length >= 5 ? closes.slice(-5).reduce((a, b) => a + b, 0) / 5 : price;

  // Simple RSI calc
  let rsi = 50;
  if (closes.length >= 14) {
    const diffs = closes.slice(-15).map((c, i, arr) => i > 0 ? c - arr[i - 1] : 0).slice(1);
    const gains = diffs.filter((d) => d > 0).reduce((a, b) => a + b, 0) / 14;
    const losses = diffs.filter((d) => d < 0).map((d) => Math.abs(d)).reduce((a, b) => a + b, 0) / 14;
    rsi = losses === 0 ? 100 : 100 - (100 / (1 + gains / losses));
  }

  const aboveSma20 = price > sma20;
  const aboveSma5 = price > sma5;
  const rsiOk = rsi > 30 && rsi < 70;
  const positiveMomentum = changePct > 0;

  // Confidence score
  let confidence = 0.5;
  if (aboveSma20) confidence += 0.1;
  if (aboveSma5) confidence += 0.08;
  if (rsiOk) confidence += 0.1;
  if (positiveMomentum) confidence += 0.08;
  if (changePct > 3) confidence += 0.07;
  if (volume > 500_000) confidence += 0.07;
  confidence = Math.min(0.95, Math.max(0.1, confidence));

  const verdict = confidence >= 0.65 ? "buy" : confidence <= 0.38 ? "sell" : "hold";

  return NextResponse.json({
    symbol: sym,
    verdict,
    confidence: +confidence.toFixed(2),
    reasoning: `Price ${price > 0 ? `$${price.toFixed(2)}` : "unknown"}. RSI ${rsi.toFixed(0)}. ${aboveSma20 ? "Above" : "Below"} 20-day SMA. Day change ${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%.`,
    risk_reward: 2.4,
    stop_loss: price ? +(price * 0.92).toFixed(4) : null,
    take_profit: price ? +(price * 1.15).toFixed(4) : null,
    summary: `${verdict.toUpperCase()} signal with ${(confidence * 100).toFixed(0)}% confidence based on momentum, RSI, and moving averages.`,
    signals: [
      { agent: "momentum", verdict: positiveMomentum ? "buy" : "hold", confidence: +(0.5 + changePct / 20).toFixed(2), reasoning: `Day change: ${changePct.toFixed(2)}%`, indicators: { change_pct: +changePct.toFixed(2) } },
      { agent: "mean_reversion", verdict: aboveSma20 ? "buy" : "sell", confidence: 0.6, reasoning: `Price ${aboveSma20 ? "above" : "below"} 20-SMA ($${sma20.toFixed(2)})`, indicators: { sma20: +sma20.toFixed(2) } },
      { agent: "technical", verdict: rsiOk ? "hold" : rsi < 30 ? "buy" : "sell", confidence: 0.65, reasoning: `RSI: ${rsi.toFixed(0)}`, indicators: { rsi: +rsi.toFixed(1) } },
      { agent: "risk", verdict: "hold", confidence: 0.6, reasoning: `Volume: ${(volume / 1e6).toFixed(1)}M`, indicators: { volume } },
    ],
  });
}
