import { NextRequest, NextResponse } from "next/server";
import { dataFetch, getSnapshots, isAlpacaConnected, tradingFetch } from "@/lib/alpaca-server";

type Verdict = "buy" | "sell" | "hold";
type RiskLevel = "Low" | "Medium" | "High" | "Extreme";
type AgentKey =
  | "technical-analysis"
  | "market-intelligence"
  | "options-flow"
  | "news-intelligence"
  | "social-sentiment"
  | "macro"
  | "pattern-recognition"
  | "quant";

type AgentAssessment = {
  key: AgentKey;
  score: number;
  confidence: number;
  dataQuality: number;
  freshnessMinutes: number | null;
  verdict: Verdict;
  reasoning: string;
  supportingData: string[];
  isRealData: boolean;
  dataSource: string;
};

type AlpacaBar = { o: number; h: number; l: number; c: number; v: number; t: string };
type NewsItem = { headline?: string; summary?: string; created_at?: string; updated_at?: string };
type YahooChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
};
type RedditSearchResponse = {
  data?: {
    children?: Array<{
      data?: { title?: string; created_utc?: number; score?: number; num_comments?: number };
    }>;
  };
};
type CboeOption = { option?: string; open_interest?: number; volume?: number; iv?: number };
type CboeOptionsResponse = {
  data?: {
    options?: CboeOption[];
  };
};
type StockTwitsResponse = {
  messages?: Array<{
    created_at?: string;
    entities?: { sentiment?: { basic?: string } | null };
    body?: string;
  }>;
};

const DEFAULT_WEIGHTS: Record<AgentKey, number> = {
  "technical-analysis": 25,
  "market-intelligence": 20,
  "options-flow": 15,
  "news-intelligence": 10,
  "social-sentiment": 10,
  macro: 10,
  "pattern-recognition": 5,
  quant: 5,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function avg(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function scoreToVerdict(score: number): Verdict {
  if (score >= 67) return "buy";
  if (score <= 45) return "sell";
  return "hold";
}

function ema(values: number[], period: number) {
  if (!values.length) return 0;
  const k = 2 / (period + 1);
  let out = values[0]!;
  for (let i = 1; i < values.length; i += 1) out = values[i]! * k + out * (1 - k);
  return out;
}

function minutesSince(iso: string | undefined) {
  if (!iso) return null;
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, ms / 60_000);
}

function loadWeights() {
  const raw = process.env.DECISION_AGENT_WEIGHTS_JSON;
  if (!raw) return DEFAULT_WEIGHTS;
  try {
    const parsed = JSON.parse(raw) as Partial<Record<AgentKey, number>>;
    const merged = { ...DEFAULT_WEIGHTS };
    (Object.keys(DEFAULT_WEIGHTS) as AgentKey[]).forEach((k) => {
      const v = parsed[k];
      if (typeof v === "number" && v > 0) merged[k] = v;
    });
    return merged;
  } catch {
    return DEFAULT_WEIGHTS;
  }
}

function recommendationLabel(score: number) {
  if (score >= 95) return "⭐⭐⭐⭐⭐ Strong Buy";
  if (score >= 80) return "⭐⭐⭐⭐ Buy";
  if (score >= 60) return "⭐⭐⭐ Hold / Watch";
  if (score >= 40) return "⭐⭐ Sell";
  return "⭐ Strong Sell";
}

function riskLabel(riskScore: number): RiskLevel {
  if (riskScore >= 75) return "Low";
  if (riskScore >= 55) return "Medium";
  if (riskScore >= 35) return "High";
  return "Extreme";
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "user-agent": "helios-trader/1.0",
        accept: "application/json,text/plain,*/*",
        "accept-language": "en-US,en;q=0.9",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

// Returns latest close and % change from prior close for a Yahoo chart payload.
function chartChangePct(chart: YahooChartResponse | null): { last: number | null; changePct: number | null } {
  const result = chart?.chart?.result?.[0];
  const closes = (result?.indicators?.quote?.[0]?.close ?? []).filter(
    (c): c is number => typeof c === "number" && Number.isFinite(c)
  );
  if (closes.length < 2) return { last: closes[closes.length - 1] ?? null, changePct: null };
  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 2];
  const changePct = prev !== 0 ? ((last - prev) / prev) * 100 : null;
  return { last, changePct };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const sym = String(body?.symbol ?? "").trim().toUpperCase();
  if (!sym || !/^[A-Z.]{1,10}$/.test(sym)) {
    return NextResponse.json({ error: "A valid ticker symbol is required." }, { status: 400 });
  }
  if (!isAlpacaConnected()) {
    return NextResponse.json({ error: "Decision Agent requires Alpaca connectivity." }, { status: 503 });
  }

  const [snapshotsResult, barsResult, newsResult, accountResult, positionsResult] = await Promise.allSettled([
    getSnapshots([sym, "SPY", "QQQ", "VIXY", "TLT", "UUP", "GLD", "USO"]),
    dataFetch<{ bars?: AlpacaBar[] }>(`/v2/stocks/${sym}/bars?timeframe=1Day&limit=120&feed=iex&sort=asc`),
    dataFetch<{ news?: NewsItem[] }>(`/v1beta1/news?symbols=${encodeURIComponent(sym)}&limit=20`),
    tradingFetch<{ equity?: string; cash?: string; buying_power?: string }>("/v2/account"),
    tradingFetch<Array<{ market_value?: string }>>("/v2/positions"),
  ]);
  const [
    optionsExternal,
    vixChart,
    tnxChart,
    dxyChart,
    oilChart,
    goldChart,
    stocktwitsExternal,
    redditExternal,
    chartExternal,
  ] = await Promise.all([
    fetchJson<CboeOptionsResponse>(`https://cdn.cboe.com/api/global/delayed_quotes/options/${encodeURIComponent(sym)}.json`),
    fetchJson<YahooChartResponse>("https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?range=5d&interval=1d"),
    fetchJson<YahooChartResponse>("https://query1.finance.yahoo.com/v8/finance/chart/%5ETNX?range=5d&interval=1d"),
    fetchJson<YahooChartResponse>("https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?range=5d&interval=1d"),
    fetchJson<YahooChartResponse>("https://query1.finance.yahoo.com/v8/finance/chart/CL%3DF?range=5d&interval=1d"),
    fetchJson<YahooChartResponse>("https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=5d&interval=1d"),
    fetchJson<StockTwitsResponse>(`https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(sym)}.json`),
    fetchJson<RedditSearchResponse>(`https://www.reddit.com/search.json?q=${encodeURIComponent(sym)}&sort=new&t=week&limit=40`),
    fetchJson<YahooChartResponse>(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=6mo&interval=1d`),
  ]);

  if (snapshotsResult.status !== "fulfilled") {
    return NextResponse.json({ error: "Failed to load market snapshots for decisioning." }, { status: 502 });
  }

  const snapshots = snapshotsResult.value ?? {};
  const snap = snapshots[sym];
  let bars = barsResult.status === "fulfilled" ? (barsResult.value?.bars ?? []) : [];
  let barsSource = "alpaca-bars";
  if (bars.length < 30) {
    const chart = chartExternal?.chart?.result?.[0];
    const quote = chart?.indicators?.quote?.[0];
    const ts = chart?.timestamp ?? [];
    const highs = quote?.high ?? [];
    const lows = quote?.low ?? [];
    const closes = quote?.close ?? [];
    const vols = quote?.volume ?? [];
    const yahooBars = ts.map((t, idx) => ({
      t: new Date(t * 1000).toISOString(),
      o: quote?.open?.[idx] ?? closes[idx] ?? 0,
      h: highs[idx] ?? closes[idx] ?? 0,
      l: lows[idx] ?? closes[idx] ?? 0,
      c: closes[idx] ?? 0,
      v: vols[idx] ?? 0,
    })).filter((b) => Number.isFinite(b.c) && b.c > 0);
    if (yahooBars.length >= 30) {
      bars = yahooBars;
      barsSource = "yahoo-chart";
    }
  }
  const news = newsResult.status === "fulfilled" ? (newsResult.value?.news ?? []) : [];
  const account = accountResult.status === "fulfilled" ? accountResult.value : null;
  const positions = positionsResult.status === "fulfilled" ? positionsResult.value : [];

  const lastBarClose = bars.length ? bars[bars.length - 1]?.c ?? null : null;
  const price = snap?.latestTrade?.p ?? snap?.dailyBar?.c ?? lastBarClose ?? null;
  const prevClose = snap?.prevDailyBar?.c ?? null;
  const dayChangePct = price && prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
  const dailyVolume = snap?.dailyBar?.v ?? (bars.length ? bars[bars.length - 1]?.v ?? 0 : 0);
  const latestTradeMinutes = minutesSince(snap?.latestTrade?.t);

  const closes = bars.map((b) => b.c);
  const highs = bars.map((b) => b.h);
  const lows = bars.map((b) => b.l);
  const volumes = bars.map((b) => b.v);
  const sma20 = closes.length >= 20 ? avg(closes.slice(-20)) : null;
  const sma50 = closes.length >= 50 ? avg(closes.slice(-50)) : null;
  const ema12 = closes.length >= 12 ? ema(closes.slice(-50), 12) : null;
  const ema26 = closes.length >= 26 ? ema(closes.slice(-80), 26) : null;
  const macd = ema12 !== null && ema26 !== null ? ema12 - ema26 : null;
  const signalLine = closes.length >= 35 ? ema(closes.slice(-35), 9) : null;
  const macdBull = macd !== null && signalLine !== null ? macd > signalLine : false;
  const vwap = closes.length && volumes.length ? closes.reduce((sum, c, idx) => sum + c * (volumes[idx] ?? 0), 0) / Math.max(1, volumes.reduce((a, b) => a + b, 0)) : null;

  let rsi = 50;
  if (closes.length >= 15) {
    const diffs = closes.slice(-15).map((c, i, arr) => (i === 0 ? 0 : c - (arr[i - 1] ?? c))).slice(1);
    const gains = avg(diffs.map((d) => (d > 0 ? d : 0)));
    const losses = avg(diffs.map((d) => (d < 0 ? Math.abs(d) : 0)));
    rsi = losses === 0 ? 100 : 100 - 100 / (1 + gains / losses);
  }

  const atr = highs.length >= 15
    ? avg(highs.slice(-14).map((h, i) => {
      const l = lows.slice(-14)[i] ?? h;
      return h - l;
    }))
    : null;
  const atrPct = atr && price ? (atr / price) * 100 : null;
  const avgVol20 = volumes.length >= 20 ? avg(volumes.slice(-20)) : null;
  const relVolume = avgVol20 ? dailyVolume / Math.max(1, avgVol20) : null;
  const recentHigh20 = highs.length >= 20 ? Math.max(...highs.slice(-20)) : null;
  const recentLow20 = lows.length >= 20 ? Math.min(...lows.slice(-20)) : null;
  const breakout = price !== null && recentHigh20 !== null ? price > recentHigh20 * 0.995 : false;
  const trendStrength = sma20 && sma50 ? clamp(((sma20 - sma50) / Math.max(1, sma50)) * 500 + 50, 0, 100) : 50;
  const liquidityScore = price !== null && dailyVolume ? clamp((price * dailyVolume) / 2_000_000, 0, 100) : 20;

  const bullishNewsWords = ["beat", "upgrade", "raised", "buyback", "growth", "surge", "outperform"];
  const bearishNewsWords = ["downgrade", "investigation", "miss", "lawsuit", "cuts", "weak", "decline"];
  const newsSignals = news.map((n) => `${n.headline ?? ""} ${n.summary ?? ""}`.toLowerCase());
  const newsBullCount = newsSignals.filter((t) => bullishNewsWords.some((w) => t.includes(w))).length;
  const newsBearCount = newsSignals.filter((t) => bearishNewsWords.some((w) => t.includes(w))).length;
  const newsFreshnessMinutes = news.length ? minutesSince(news[0]?.updated_at ?? news[0]?.created_at) : null;
  const earningsSoon = newsSignals.some((t) => t.includes("earnings") && (t.includes("tomorrow") || t.includes("next week")));

  const proxyChange = (ticker: string) => {
    const s = snapshots[ticker];
    const p = s?.latestTrade?.p ?? s?.dailyBar?.c;
    const pc = s?.prevDailyBar?.c;
    if (!p || !pc) return null;
    return ((p - pc) / pc) * 100;
  };
  const vixProxy = proxyChange("VIXY");
  const treasuryProxy = proxyChange("TLT");
  const dollarProxy = proxyChange("UUP");
  const macroRiskRaw = [
    vixProxy !== null ? clamp(50 + vixProxy * 10, 0, 100) : 50,
    treasuryProxy !== null ? clamp(50 - treasuryProxy * 8, 0, 100) : 50,
    dollarProxy !== null ? clamp(50 + dollarProxy * 6, 0, 100) : 50,
  ];

  // Options flow from CBOE delayed options chain (real free source).
  // CBOE option symbols look like ROOT+YYMMDD+[C|P]+8-digit-strike (e.g. TSLA240119C00250000).
  const cboeOptions = optionsExternal?.data?.options ?? [];
  const optionType = (optionSymbol: string | undefined): "C" | "P" | null => {
    const m = /\d{6}([CP])\d{8}$/.exec(optionSymbol ?? "");
    return m ? (m[1] as "C" | "P") : null;
  };
  const cboeCalls = cboeOptions.filter((o) => optionType(o.option) === "C");
  const cboePuts = cboeOptions.filter((o) => optionType(o.option) === "P");
  const callOi = cboeCalls.reduce((sum, c) => sum + (c.open_interest ?? 0), 0);
  const putOi = cboePuts.reduce((sum, p) => sum + (p.open_interest ?? 0), 0);
  const callVol = cboeCalls.reduce((sum, c) => sum + (c.volume ?? 0), 0);
  const putVol = cboePuts.reduce((sum, p) => sum + (p.volume ?? 0), 0);
  const putCallOi = callOi > 0 ? putOi / callOi : null;
  const putCallVol = callVol > 0 ? putVol / callVol : null;
  const avgIv = avg(cboeOptions.map((o) => o.iv ?? 0).filter((x) => x > 0));
  const optionsFreshMinutes = cboeOptions.length > 0 ? 15 : null;

  // Social sentiment from StockTwits (primary) with Reddit fallback.
  const stMessages = stocktwitsExternal?.messages ?? [];
  const stBull = stMessages.filter((m) => m.entities?.sentiment?.basic === "Bullish").length;
  const stBear = stMessages.filter((m) => m.entities?.sentiment?.basic === "Bearish").length;
  const stLatest = stMessages[0]?.created_at ? new Date(stMessages[0].created_at).getTime() : null;

  const redditPosts = redditExternal?.data?.children ?? [];
  const redditTexts = redditPosts.map((p) => (p.data?.title ?? "").toLowerCase()).filter(Boolean);
  const positiveWords = ["bull", "buy", "breakout", "squeeze", "up", "beat", "long"];
  const negativeWords = ["bear", "sell", "dump", "down", "miss", "short", "risk"];
  const redditBull = redditTexts.filter((t) => positiveWords.some((w) => t.includes(w))).length;
  const redditBear = redditTexts.filter((t) => negativeWords.some((w) => t.includes(w))).length;
  const redditScore = redditPosts.reduce((sum, p) => sum + (p.data?.score ?? 0), 0);
  const redditLatestUtc = redditPosts[0]?.data?.created_utc ?? null;

  const usingStockTwits = stMessages.length > 0;
  const socialBull = usingStockTwits ? stBull : redditBull;
  const socialBear = usingStockTwits ? stBear : redditBear;
  const socialSampleSize = usingStockTwits ? stMessages.length : redditPosts.length;
  const socialSource = usingStockTwits ? "stocktwits-stream" : redditPosts.length > 0 ? "reddit-search" : "missing-social-feed";
  const socialLatestMs = usingStockTwits ? stLatest : redditLatestUtc ? redditLatestUtc * 1000 : null;
  const socialFreshMinutes = socialLatestMs ? Math.max(0, (Date.now() - socialLatestMs) / 60000) : null;

  // Macro from live Yahoo chart moves (real market data per instrument).
  const vixPct = chartChangePct(vixChart).changePct;
  const tnxPct = chartChangePct(tnxChart).changePct;
  const dxyPct = chartChangePct(dxyChart).changePct;
  const oilPct = chartChangePct(oilChart).changePct;
  const goldPct = chartChangePct(goldChart).changePct;
  const macroQuotesCount = [vixPct, tnxPct, dxyPct, oilPct, goldPct].filter((n) => n !== null).length;
  const macroExternalRiskRaw = [
    vixPct !== null ? clamp(50 + vixPct * 8, 0, 100) : null,
    tnxPct !== null ? clamp(50 + tnxPct * 6, 0, 100) : null,
    dxyPct !== null ? clamp(50 + dxyPct * 5, 0, 100) : null,
    oilPct !== null ? clamp(50 + Math.abs(oilPct) * 3, 0, 100) : null,
    goldPct !== null ? clamp(50 - goldPct * 3, 0, 100) : null,
  ].filter((n): n is number => n !== null);

  const returns = closes.slice(1).map((c, i) => ((c - closes[i]!) / Math.max(0.01, closes[i]!)) * 100);
  const meanRet = returns.length ? avg(returns) : 0;
  const stdRet = returns.length ? Math.sqrt(avg(returns.map((r) => (r - meanRet) ** 2))) : 0;
  const sharpeApprox = stdRet > 0 ? (meanRet / stdRet) * Math.sqrt(252) : 0;
  const winRate = returns.length ? (returns.filter((r) => r > 0).length / returns.length) * 100 : 50;
  const expectedValue = returns.length ? avg(returns) : 0;
  const kelly = clamp((winRate / 100) - ((100 - winRate) / 100) / Math.max(0.5, 1 + Math.abs(meanRet * 3)), 0, 1);

  const qualityFromCoverage = (parts: boolean[]) => Math.round((parts.filter(Boolean).length / parts.length) * 100);

  const technicalScore = clamp(
    (rsi > 45 && rsi < 70 ? 20 : 10)
    + (sma20 !== null && price !== null && price > sma20 ? 18 : 8)
    + (sma50 !== null && price !== null && price > sma50 ? 14 : 8)
    + (vwap !== null && price !== null && price > vwap ? 12 : 6)
    + (macdBull ? 16 : 8)
    + (atrPct !== null ? clamp(18 - atrPct * 1.2, 4, 18) : 8),
    0,
    100
  );
  const technicalQuality = qualityFromCoverage([sma20 !== null, sma50 !== null, vwap !== null, macd !== null, atrPct !== null, closes.length >= 30]);
  const technical: AgentAssessment = {
    key: "technical-analysis",
    score: Math.round(technicalScore),
    confidence: clamp(Math.round(technicalScore * 0.82 + technicalQuality * 0.18), 1, 99),
    dataQuality: technicalQuality,
    freshnessMinutes: latestTradeMinutes,
    verdict: scoreToVerdict(technicalScore),
    reasoning: `RSI ${rsi.toFixed(1)}, ${macdBull ? "MACD bullish" : "MACD weak"}, price ${price && sma20 && price > sma20 ? "above" : "below"} key averages.`,
    supportingData: [
      `RSI ${rsi.toFixed(1)}`,
      `SMA20 ${sma20 ? sma20.toFixed(2) : "n/a"}`,
      `VWAP ${vwap ? vwap.toFixed(2) : "n/a"}`,
      `ATR% ${atrPct ? atrPct.toFixed(2) : "n/a"}`,
    ],
    isRealData: technicalQuality >= 45,
    dataSource: technicalQuality >= 45 ? `${barsSource}+snapshot` : "insufficient-market-data",
  };

  const marketScore = clamp(
    (relVolume !== null ? clamp(relVolume * 22, 0, 30) : 8)
    + (breakout ? 18 : 8)
    + clamp(trendStrength * 0.25, 0, 25)
    + clamp(liquidityScore * 0.22, 0, 22)
    + (dayChangePct > 0 ? 8 : 4),
    0,
    100
  );
  const marketQuality = qualityFromCoverage([relVolume !== null, recentHigh20 !== null, dailyVolume > 0, price !== null, bars.length >= 30]);
  const market: AgentAssessment = {
    key: "market-intelligence",
    score: Math.round(marketScore),
    confidence: clamp(Math.round(marketScore * 0.75 + marketQuality * 0.25), 1, 99),
    dataQuality: marketQuality,
    freshnessMinutes: latestTradeMinutes,
    verdict: scoreToVerdict(marketScore),
    reasoning: `${breakout ? "Breakout confirmed" : "No confirmed breakout"} with relative volume ${relVolume ? relVolume.toFixed(2) : "n/a"}x and liquidity score ${liquidityScore.toFixed(0)}.`,
    supportingData: [
      `Relative volume ${relVolume ? relVolume.toFixed(2) : "n/a"}x`,
      `Trend strength ${trendStrength.toFixed(1)}`,
      `Liquidity ${liquidityScore.toFixed(1)}`,
      `Day move ${dayChangePct.toFixed(2)}%`,
    ],
    isRealData: marketQuality >= 45,
    dataSource: marketQuality >= 45 ? `${barsSource}+snapshot` : "insufficient-market-data",
  };

  const optionsScore = clamp(
    (putCallOi !== null ? clamp((1.6 - putCallOi) * 28, 0, 32) : 8)
    + (putCallVol !== null ? clamp((1.6 - putCallVol) * 22, 0, 26) : 6)
    + (avgIv > 0 ? clamp(26 - avgIv * 12, 6, 22) : 8)
    + (callVol + putVol > 0 ? clamp(Math.log10(callVol + putVol + 1) * 8, 4, 20) : 6),
    0,
    100
  );
  const optionsQuality = qualityFromCoverage([callOi + putOi > 0, callVol + putVol > 0, avgIv > 0]);
  const optionsFlow: AgentAssessment = {
    key: "options-flow",
    score: Math.round(optionsScore),
    confidence: clamp(Math.round(optionsScore * 0.7 + optionsQuality * 0.3), 1, 95),
    dataQuality: optionsQuality,
    freshnessMinutes: optionsFreshMinutes,
    verdict: scoreToVerdict(optionsScore),
    reasoning: "Options flow is derived from live CBOE delayed options data (open interest, volume, implied volatility).",
    supportingData: [
      `Put/Call OI ${putCallOi !== null ? putCallOi.toFixed(2) : "n/a"}`,
      `Put/Call volume ${putCallVol !== null ? putCallVol.toFixed(2) : "n/a"}`,
      `Total options volume ${(callVol + putVol).toLocaleString("en-US")}`,
      `Avg IV ${avgIv > 0 ? avgIv.toFixed(2) : "n/a"}`,
    ],
    isRealData: optionsQuality >= 34,
    dataSource: optionsQuality >= 34 ? "cboe-options-chain" : "missing-options-chain",
  };

  const newsScore = clamp(50 + (newsBullCount - newsBearCount) * 8 - (earningsSoon ? 10 : 0), 0, 100);
  const newsQuality = qualityFromCoverage([news.length > 0, newsFreshnessMinutes !== null]);
  const newsIntelligence: AgentAssessment = {
    key: "news-intelligence",
    score: Math.round(newsScore),
    confidence: clamp(Math.round(newsScore * 0.55 + newsQuality * 0.45), 1, 95),
    dataQuality: newsQuality,
    freshnessMinutes: newsFreshnessMinutes,
    verdict: scoreToVerdict(newsScore),
    reasoning: `News tone ${newsBullCount > newsBearCount ? "leans bullish" : newsBullCount < newsBearCount ? "leans bearish" : "is balanced"} across ${news.length} recent stories.`,
    supportingData: [
      `Bullish mentions ${newsBullCount}`,
      `Bearish mentions ${newsBearCount}`,
      `Earnings catalyst ${earningsSoon ? "detected" : "not detected"}`,
    ],
    isRealData: news.length > 0,
    dataSource: news.length > 0 ? "alpaca-news" : "missing-news-feed",
  };

  const socialScore = socialSampleSize
    ? clamp(
      50
      + clamp((socialBull - socialBear) * 4, -24, 24)
      + clamp(Math.log10(socialSampleSize + 1) * 8, 0, 14)
      + clamp(Math.log10(Math.max(redditScore, 0) + 1) * 3, 0, 10),
      0,
      100
    )
    : 50;
  const socialQuality = qualityFromCoverage([socialSampleSize >= 5, socialSampleSize >= 20, socialFreshMinutes !== null]);
  const socialSentiment: AgentAssessment = {
    key: "social-sentiment",
    score: Math.round(socialScore),
    confidence: clamp(Math.round(socialScore * 0.65 + socialQuality * 0.35), 1, 92),
    dataQuality: socialQuality,
    freshnessMinutes: socialFreshMinutes,
    verdict: scoreToVerdict(socialScore),
    reasoning: socialSampleSize > 0
      ? `Social sentiment is computed from ${usingStockTwits ? "StockTwits" : "Reddit"} discussion momentum and tone.`
      : "No social feed data was available for this symbol.",
    supportingData: [
      `${usingStockTwits ? "StockTwits messages" : "Reddit posts"} ${socialSampleSize}`,
      `Bullish vs bearish ${socialBull}:${socialBear}`,
      usingStockTwits ? `Source StockTwits` : `Net post score ${redditScore}`,
    ],
    isRealData: socialSampleSize > 0,
    dataSource: socialSource,
  };

  const macroScore = macroExternalRiskRaw.length > 0
    ? clamp(100 - avg(macroExternalRiskRaw), 0, 100)
    : clamp(100 - avg(macroRiskRaw), 0, 100);
  const macroQuality = macroExternalRiskRaw.length > 0
    ? qualityFromCoverage([vixPct !== null, tnxPct !== null, dxyPct !== null, oilPct !== null, goldPct !== null])
    : qualityFromCoverage([vixProxy !== null, treasuryProxy !== null, dollarProxy !== null]);
  const macro: AgentAssessment = {
    key: "macro",
    score: Math.round(macroScore),
    confidence: clamp(Math.round(macroScore * 0.7 + macroQuality * 0.3), 1, 95),
    dataQuality: macroQuality,
    freshnessMinutes: macroQuotesCount > 0 ? 0 : latestTradeMinutes,
    verdict: scoreToVerdict(macroScore),
    reasoning: macroExternalRiskRaw.length > 0
      ? "Macro regime is calculated from live VIX, Treasury, DXY, oil, and gold market moves."
      : "Macro regime is inferred from volatility, rates, and dollar proxies.",
    supportingData: [
      `VIX change ${vixPct !== null ? `${vixPct.toFixed(2)}%` : vixProxy !== null ? `${vixProxy.toFixed(2)}% (proxy)` : "n/a"}`,
      `Treasury change ${tnxPct !== null ? `${tnxPct.toFixed(2)}%` : treasuryProxy !== null ? `${treasuryProxy.toFixed(2)}% (proxy)` : "n/a"}`,
      `Dollar change ${dxyPct !== null ? `${dxyPct.toFixed(2)}%` : dollarProxy !== null ? `${dollarProxy.toFixed(2)}% (proxy)` : "n/a"}`,
      `Oil ${oilPct !== null ? `${oilPct.toFixed(2)}%` : "n/a"} | Gold ${goldPct !== null ? `${goldPct.toFixed(2)}%` : "n/a"}`,
    ],
    isRealData: macroExternalRiskRaw.length > 0,
    dataSource: macroExternalRiskRaw.length > 0 ? "yahoo-chart-macro" : "etf-proxy-snapshots",
  };

  const patternScore = clamp(
    (breakout ? 35 : 15)
    + (sma20 && sma50 && sma20 > sma50 ? 20 : 10)
    + (closes.length >= 60 && recentHigh20 && recentLow20 ? clamp(((price ?? 0) - recentLow20) / Math.max(1, recentHigh20 - recentLow20) * 30, 0, 30) : 10),
    0,
    100
  );
  const patternQuality = qualityFromCoverage([closes.length >= 60, recentHigh20 !== null, recentLow20 !== null]);
  const pattern: AgentAssessment = {
    key: "pattern-recognition",
    score: Math.round(patternScore),
    confidence: clamp(Math.round(patternScore * 0.7 + patternQuality * 0.3), 1, 95),
    dataQuality: patternQuality,
    freshnessMinutes: latestTradeMinutes,
    verdict: scoreToVerdict(patternScore),
    reasoning: `${breakout ? "Breakout setup" : "Range behavior"} with trend structure ${sma20 && sma50 && sma20 > sma50 ? "bullish" : "mixed"}.`,
    supportingData: [
      `Breakout ${breakout ? "yes" : "no"}`,
      `SMA20 vs SMA50 ${sma20 && sma50 ? (sma20 > sma50 ? "bullish" : "bearish") : "n/a"}`,
    ],
    isRealData: patternQuality >= 40,
    dataSource: patternQuality >= 40 ? `${barsSource}+snapshot` : "insufficient-market-data",
  };

  const quantScore = clamp(
    45
    + clamp(sharpeApprox * 9, -20, 25)
    + clamp(expectedValue * 35, -20, 20)
    + clamp((winRate - 50) * 0.8, -20, 20)
    + clamp(kelly * 25, 0, 20),
    0,
    100
  );
  const quantQuality = qualityFromCoverage([returns.length >= 40, stdRet > 0]);
  const quant: AgentAssessment = {
    key: "quant",
    score: Math.round(quantScore),
    confidence: clamp(Math.round(quantScore * 0.7 + quantQuality * 0.3), 1, 95),
    dataQuality: quantQuality,
    freshnessMinutes: latestTradeMinutes,
    verdict: scoreToVerdict(quantScore),
    reasoning: "Quant assessment uses historical returns, Sharpe proxy, expected value, Kelly fraction, and win rate.",
    supportingData: [
      `Sharpe proxy ${sharpeApprox.toFixed(2)}`,
      `Expected value ${expectedValue.toFixed(3)}%`,
      `Win rate ${winRate.toFixed(1)}%`,
      `Kelly ${kelly.toFixed(2)}`,
    ],
    isRealData: quantQuality >= 40,
    dataSource: quantQuality >= 40 ? `${barsSource}-derived` : "insufficient-market-data",
  };

  const primaryAgents: AgentAssessment[] = [technical, market, optionsFlow, newsIntelligence, socialSentiment, macro, pattern, quant];
  const weights = loadWeights();
  const totalWeight = primaryAgents.reduce((sum, a) => sum + (weights[a.key] ?? 0), 0) || 1;

  const weightedScore = primaryAgents.reduce((sum, agent) => sum + agent.score * ((weights[agent.key] ?? 0) / totalWeight), 0);

  const voteWeights = primaryAgents.reduce(
    (acc, agent) => {
      const w = weights[agent.key] ?? 0;
      acc[agent.verdict] += w;
      return acc;
    },
    { buy: 0, sell: 0, hold: 0 }
  );
  const votesSorted = Object.entries(voteWeights).sort((a, b) => b[1] - a[1]);
  const agreementRatio = (votesSorted[0]?.[1] ?? 0) / Math.max(1, totalWeight);
  const secondRatio = (votesSorted[1]?.[1] ?? 0) / Math.max(1, totalWeight);
  const agreementSpread = clamp(agreementRatio - secondRatio, 0, 1);
  const agreementFactor = 0.65 + agreementSpread * 0.35;
  const agreementLabel = agreementSpread > 0.35 ? "High" : agreementSpread > 0.18 ? "Medium" : "Low";
  const weightedConfidence = primaryAgents.reduce((sum, agent) => {
    const w = (weights[agent.key] ?? 0) / totalWeight;
    const freshnessFactor = agent.freshnessMinutes === null ? 0.6 : clamp(1 - agent.freshnessMinutes / 180, 0.4, 1);
    const qualityFactor = clamp(agent.dataQuality / 100, 0.2, 1);
    return sum + agent.confidence * freshnessFactor * qualityFactor * w;
  }, 0);
  const finalConfidence = Math.round(clamp(weightedConfidence * agreementFactor, 1, 99));

  const equity = account?.equity ? Number(account.equity) : null;
  const cash = account?.cash ? Number(account.cash) : null;
  const grossExposure = positions.reduce((sum, p) => sum + Math.abs(Number(p.market_value ?? 0)), 0);
  const exposurePct = equity && equity > 0 ? (grossExposure / equity) * 100 : null;
  const volatilityRisk = atrPct !== null ? clamp(atrPct * 8, 0, 45) : 20;
  const macroRisk = clamp(100 - macroScore, 0, 45);
  const concentrationRisk = exposurePct !== null ? clamp(exposurePct * 0.5, 0, 45) : 25;
  const riskScore = Math.round(clamp(100 - (volatilityRisk + macroRisk + concentrationRisk) / 1.35, 0, 100));
  const risk = riskLabel(riskScore);

  let riskVetoReason: string | null = null;
  if (risk === "Extreme") riskVetoReason = "Risk Agent veto: extreme market/portfolio risk.";
  if (exposurePct !== null && exposurePct >= 92) riskVetoReason = "Risk Agent veto: portfolio exposure exceeds 92%.";

  let finalScore = Math.round(clamp(weightedScore, 0, 100));
  let verdict = scoreToVerdict(finalScore);
  let recommendation = recommendationLabel(finalScore);
  if (riskVetoReason) {
    verdict = "hold";
    recommendation = "TRADE REJECTED (RISK VETO)";
    finalScore = Math.min(finalScore, 59);
  }

  const bullishSignals = primaryAgents.filter((a) => a.verdict === "buy").map((a) => `${a.key}: ${a.reasoning}`);
  const bearishSignals = primaryAgents.filter((a) => a.verdict === "sell").map((a) => `${a.key}: ${a.reasoning}`);
  const conflictingSignals: string[] = [];
  if (technical.verdict === "buy" && newsIntelligence.verdict === "sell") conflictingSignals.push("Technical bullish while News Intelligence is bearish.");
  if (optionsFlow.verdict === "buy" && macro.verdict === "sell") conflictingSignals.push("Options Flow bullish while Macro is bearish.");
  if (market.verdict === "buy" && earningsSoon) conflictingSignals.push("Momentum and breakout are bullish, but earnings catalyst risk is near-term.");
  if (market.verdict === "buy" && liquidityScore < 40) conflictingSignals.push("Bullish setup detected with weak liquidity.");
  if (technical.verdict !== quant.verdict) conflictingSignals.push("Technical and Quant agents disagree on directional edge.");

  const positionSize = riskVetoReason
    ? "0% (No Trade)"
    : finalConfidence > 90 && risk === "Low"
      ? "10%"
      : finalConfidence >= 80 && (risk === "Low" || risk === "Medium")
        ? "5%"
        : finalConfidence >= 65 && risk === "High"
          ? "2%"
          : finalConfidence < 60
            ? "0% (No Trade)"
            : "2%";

  const stopLoss = price ? +(price * (risk === "Low" ? 0.94 : risk === "Medium" ? 0.93 : 0.91)).toFixed(4) : null;
  const takeProfit = price ? +(price * (risk === "Low" ? 1.12 : risk === "Medium" ? 1.1 : 1.08)).toFixed(4) : null;
  const riskReward = stopLoss && takeProfit && price ? +(((takeProfit - price) / (price - stopLoss)).toFixed(2)) : null;

  const sectionScores: Record<string, number> = {
    "market-intelligence": market.score,
    "technical-analysis": technical.score,
    "news-intelligence": newsIntelligence.score,
    "social-sentiment": socialSentiment.score,
    "options-flow": optionsFlow.score,
    "pattern-recognition": pattern.score,
    earnings: clamp(Math.round(newsScore - (earningsSoon ? 15 : 0)), 0, 100),
    macro: macro.score,
    strategy: finalScore,
    "risk-management": riskScore,
    "portfolio-manager": clamp(Math.round((cash !== null && equity ? (cash / Math.max(equity, 1)) * 100 : 35) + (exposurePct !== null ? clamp(100 - exposurePct, 0, 70) : 30)), 0, 100),
    execution: clamp(Math.round((liquidityScore * 0.65) + (relVolume ? clamp(relVolume * 12, 0, 35) : 8)), 0, 100),
    learning: clamp(Math.round(50 + (quantQuality - 50) * 0.4), 0, 100),
    explainability: clamp(70 + (conflictingSignals.length ? 10 : 18), 0, 100),
    "ai-debate": Math.round(clamp(agreementFactor * 100, 0, 100)),
    "command-center": Math.round(avg(primaryAgents.map((a) => a.dataQuality))),
    quant: quant.score,
  };
  const sectionDataStatus: Record<string, boolean> = {
    "market-intelligence": market.isRealData,
    "technical-analysis": technical.isRealData,
    "news-intelligence": newsIntelligence.isRealData,
    "social-sentiment": socialSentiment.isRealData,
    "options-flow": optionsFlow.isRealData,
    "pattern-recognition": pattern.isRealData,
    earnings: newsIntelligence.isRealData,
    macro: macro.isRealData,
    strategy: primaryAgents.every((a) => a.isRealData),
    "risk-management": technical.isRealData && market.isRealData && accountResult.status === "fulfilled" && positionsResult.status === "fulfilled",
    "portfolio-manager": accountResult.status === "fulfilled" && positionsResult.status === "fulfilled",
    execution: market.isRealData,
    learning: quant.isRealData,
    explainability: primaryAgents.every((a) => a.isRealData),
    "ai-debate": primaryAgents.every((a) => a.isRealData),
    "command-center": true,
    quant: quant.isRealData,
  };

  const supportingEvidence = primaryAgents.flatMap((a) => a.supportingData.map((d) => `${a.key}: ${d}`)).slice(0, 12);
  const nextReview = risk === "Low" ? "30 minutes" : risk === "Medium" ? "15 minutes" : "5 minutes";
  const reasoning = riskVetoReason
    ? `${recommendation}. Weighted score ${finalScore}/100 with confidence ${finalConfidence}%, but trade is vetoed by risk controls (${riskVetoReason.replace("Risk Agent veto: ", "")}).`
    : `The recommendation is ${verdict.toUpperCase()} with a score of ${finalScore}/100 and confidence ${finalConfidence}%. Technical and market structure are ${technical.verdict === "buy" || market.verdict === "buy" ? "supportive" : "mixed"}, while macro and news risk are ${macro.verdict === "sell" || newsIntelligence.verdict === "sell" ? "elevated" : "contained"}.`;
  const summary = `${recommendation} • Score ${finalScore}/100 • Confidence ${finalConfidence}% • Risk ${risk}`;

  return NextResponse.json({
    symbol: sym,
    recommendation,
    score: finalScore,
    confidence: +(finalConfidence / 100).toFixed(2),
    confidence_score: finalConfidence,
    verdict,
    positionSize,
    risk,
    agreement: agreementLabel,
    bullishSignals,
    bearishSignals,
    conflictingSignals,
    supportingEvidence,
    reasoning,
    nextReview,
    risk_vetoed: !!riskVetoReason,
    risk_veto_reason: riskVetoReason,
    risk_reward: riskReward,
    stop_loss: stopLoss,
    take_profit: takeProfit,
    summary,
    section_scores: sectionScores,
    section_data_status: sectionDataStatus,
    agent_contributions: primaryAgents.map((agent) => {
      const weight = (weights[agent.key] ?? 0) / totalWeight;
      return {
        agent: agent.key,
        weight: +((weight * 100).toFixed(2)),
        score: Math.round(agent.score),
        confidence: Math.round(agent.confidence),
        data_quality: Math.round(agent.dataQuality),
        freshness_minutes: agent.freshnessMinutes === null ? null : Math.round(agent.freshnessMinutes),
        verdict: agent.verdict,
        weighted_score: +(agent.score * weight).toFixed(2),
        supporting_data: agent.supportingData,
        is_real_data: agent.isRealData,
        data_source: agent.dataSource,
      };
    }),
    signals: primaryAgents.map((agent) => ({
      agent: agent.key,
      verdict: agent.verdict,
      confidence: +(agent.confidence / 100).toFixed(2),
      reasoning: agent.reasoning,
      indicators: {
        score: Math.round(agent.score),
        data_quality: Math.round(agent.dataQuality),
        freshness_minutes: agent.freshnessMinutes,
        is_real_data: agent.isRealData,
        data_source: agent.dataSource,
      },
    })),
  });
}
