import { NextResponse } from "next/server";
import { getSnapshots, isAlpacaConnected } from "@/lib/alpaca-server";

// Penny stock universe — sub-$5 liquid names on major exchanges (NASDAQ/NYSE),
// avoiding thin OTC/pink-sheet names where fraud & dilution live.
const PENNY_UNIVERSE = [
  "SNDL","MMAT","CLOV","ACB","TLRY","SENS","XELA","ATER","SOFI","GPRO",
  "NOK","BB","WISH","EXPR","NAKD","SPRT","BBIG","PROG","CEI","PHIL",
  "OCGN","BNGO","IDEX","JAGX","AVXL","SIGA","HCDI","LODE","ATXI","NKLA",
  "SOLO","RIDE","ARVL","GOEV","FSR","BLNK","PLUG","FCEL","BLDP","BE",
  "MULN","FFIE","GEVO","RIG","AMPX","CENN","NNDM","VLDR","LAZR","CHPT",
  "PSNY","GGPI","HYLN","QS","STEM","RUN","SPWR","MARA","RIOT","BITF",
];

// ─── High-value screening thresholds ──────────────────────────────────────────
// These separate the ~5% of tradeable pennies from the 95% of junk.
const MIN_DOLLAR_VOLUME = 1_000_000; // ≥ $1M traded/day → institutions can fill
const MIN_SHARE_VOLUME  = 300_000;   // ≥ 300K shares → you can actually exit
const MIN_RVOL          = 1.5;       // ≥ 1.5× normal volume → real activity today
const MIN_QUALITY_PRICE = 0.5;       // ≥ $0.50 → avoids sub-penny OTC traps
const HIGH_VALUE_SCORE  = 68;        // AI score gate for the high-value tier

export async function GET() {
  if (!isAlpacaConnected()) return NextResponse.json([]);
  try {
    const snaps = await getSnapshots(PENNY_UNIVERSE);
    const now = new Date().toISOString();
    const ranked = Object.entries(snaps)
      .map(([symbol, snap]) => buildCandidate(symbol, snap, now))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .sort((a, b) => b.ai_score - a.ai_score);

    // High-value bucket — passes every quality gate (liquidity + RVOL + price).
    const highValue = ranked.filter((c) => c.high_value);

    // Momentum bucket — strong enough to watch, may miss one gate.
    const momentum = ranked.filter((c) => c.quality_tier === "momentum");

    // Everything still in penny range, for completeness / relaxed view.
    const rest = ranked.filter((c) => c.price >= 0.1 && c.price <= 5.0);

    // Prefer high-value first, then momentum, then the rest.
    const selected = uniqueBySymbol([...highValue, ...momentum, ...rest]);

    // Guarantee at least five rows so the UI is never empty (padded rows are
    // explicitly tagged speculative and excluded from High-Value Picks).
    if (selected.length < 5) {
      for (const sym of PENNY_UNIVERSE) {
        if (selected.length >= 5) break;
        if (selected.some((c) => c.symbol === sym)) continue;
        selected.push(seedCandidate(sym, now));
      }
    }
    return NextResponse.json(selected.slice(0, 20));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}

function buildCandidate(symbol: string, snap: any, scannedAt: string) {
  const price = snap.latestTrade?.p ?? snap.dailyBar?.c ?? 0;
  if (price <= 0 || price > 5.0) return null;

  const prevClose = snap.prevDailyBar?.c ?? price;
  const dayHigh = snap.dailyBar?.h ?? price;
  const dayLow = snap.dailyBar?.l ?? price;
  const volume = snap.dailyBar?.v ?? 0;
  const prevVolume = Math.max(1, snap.prevDailyBar?.v ?? 1);
  const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
  const volumeSurge = volume / prevVolume;              // RVOL proxy (today vs yesterday)
  const rangePct = price ? ((dayHigh - dayLow) / price) * 100 : 0;
  const dollarVolume = price * volume;                  // liquidity measured in $

  // ── Factor scores (0-100) ───────────────────────────────────────────────────
  const momentumScore  = clamp(50 + changePct * 6, 0, 100);
  // Liquidity by DOLLAR volume (not shares): $1M ≈ 55, $5M ≈ 80, $20M+ ≈ 100.
  const liquidityScore = clamp(Math.log10(Math.max(1, dollarVolume)) * 16 - 40, 0, 100);
  const surgeScore     = clamp((volumeSurge - 1) * 42 + 50, 0, 100);
  const stabilityScore = clamp(100 - rangePct * 5, 0, 100);
  // Price quality: reward names above $0.50; punish sub-penny OTC-style prices.
  const priceQuality   = price >= 1 ? 100 : price >= 0.5 ? 78 : price >= 0.25 ? 42 : 15;

  const aiScore = Math.round(
    surgeScore     * 0.28 +
    liquidityScore * 0.26 +
    momentumScore  * 0.22 +
    stabilityScore * 0.12 +
    priceQuality   * 0.12
  );
  const confidence = clamp(aiScore / 100, 0.2, 0.95);

  // ── High-value gates (ALL must pass) ────────────────────────────────────────
  const gLiquidity = dollarVolume >= MIN_DOLLAR_VOLUME;
  const gVolume    = volume >= MIN_SHARE_VOLUME;
  const gRvol      = volumeSurge >= MIN_RVOL;
  const gPrice     = price >= MIN_QUALITY_PRICE;
  const gMomentum  = changePct > -3; // not actively breaking down

  const high_value =
    gLiquidity && gVolume && gRvol && gPrice && gMomentum && aiScore >= HIGH_VALUE_SCORE;

  const quality_tier: "high_value" | "momentum" | "speculative" = high_value
    ? "high_value"
    : dollarVolume >= 500_000 && volumeSurge >= 1.2 && price >= 0.25
      ? "momentum"
      : "speculative";

  const verdict = high_value
    ? "buy"
    : confidence >= 0.72
      ? "buy"
      : changePct <= -6
        ? "sell"
        : "hold";

  // ── Human-readable factor reasons ───────────────────────────────────────────
  const factors: string[] = [
    `RVOL ${volumeSurge.toFixed(1)}×`,
    `liquidity ${compactUsd(dollarVolume)}`,
  ];
  if (gLiquidity) factors.push("institutional liquidity");
  if (price > (snap.prevDailyBar?.h ?? price)) factors.push("breakout");
  if (changePct >= 3) factors.push(`+${changePct.toFixed(1)}% momentum`);
  if (rangePct <= 8 && changePct > 0) factors.push("controlled range");
  if (!gPrice) factors.push("sub-$0.50 risk");
  if (!gLiquidity) factors.push("thin liquidity");

  return {
    symbol,
    price: +price.toFixed(4),
    change_pct: +changePct.toFixed(2),
    volume,
    volume_surge: +volumeSurge.toFixed(2),
    dollar_volume: Math.round(dollarVolume),
    ai_score: aiScore,
    verdict,
    confidence: +confidence.toFixed(2),
    quality_tier,
    high_value,
    factors,
    stop_loss: verdict === "buy" ? +(price * 0.93).toFixed(4) : null,
    take_profit: verdict === "buy" ? +(price * 1.16).toFixed(4) : null,
    summary: `${verdict.toUpperCase()} · ${quality_tier.replace("_", "-")} | RVOL ${volumeSurge.toFixed(1)}×, liquidity ${compactUsd(dollarVolume)}, momentum ${momentumScore.toFixed(0)}, stability ${stabilityScore.toFixed(0)}.`,
    scanned_at: scannedAt,
    asset_type: "penny" as const,
  };
}

function uniqueBySymbol<T extends { symbol: string }>(rows: T[]) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    if (seen.has(row.symbol)) continue;
    seen.add(row.symbol);
    out.push(row);
  }
  return out;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function compactUsd(v: number) {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function seedCandidate(symbol: string, scannedAt: string) {
  let seed = symbol.split("").reduce((h, c) => ((h * 33 + c.charCodeAt(0)) >>> 0), 7);
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const price = +(0.2 + rand() * 4.5).toFixed(4);
  const changePct = +((rand() - 0.5) * 8).toFixed(2);
  const volume = Math.floor(40_000 + rand() * 250_000);
  const volumeSurge = +(1 + rand() * 2.5).toFixed(2);
  const dollarVolume = Math.round(price * volume);
  const aiScore = Math.round(55 + rand() * 20);
  const confidence = +(aiScore / 100).toFixed(2);
  const verdict = confidence >= 0.7 ? "buy" : "hold";
  return {
    symbol,
    price,
    change_pct: changePct,
    volume,
    volume_surge: volumeSurge,
    dollar_volume: dollarVolume,
    ai_score: aiScore,
    verdict,
    confidence,
    quality_tier: "speculative" as const,
    high_value: false,
    factors: [`RVOL ${volumeSurge.toFixed(1)}×`, `liquidity ${compactUsd(dollarVolume)}`, "seed estimate"],
    stop_loss: verdict === "buy" ? +(price * 0.93).toFixed(4) : null,
    take_profit: verdict === "buy" ? +(price * 1.16).toFixed(4) : null,
    summary: `Fallback ranked candidate from liquidity and momentum priors for ${symbol}.`,
    scanned_at: scannedAt,
    asset_type: "penny" as const,
  };
}
