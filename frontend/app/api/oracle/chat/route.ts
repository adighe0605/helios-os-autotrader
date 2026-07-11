import { NextRequest, NextResponse } from "next/server";
import { isAlpacaConnected, tradingFetch, alpacaHeaders } from "@/lib/alpaca-server";

// ── Alpaca data shapes ─────────────────────────────────────────────────────────
type AlpacaAccount = {
  portfolio_value: string;
  equity: string;
  cash: string;
  buying_power: string;
  last_equity: string;
};
type AlpacaPosition = {
  symbol: string;
  qty: string;
  avg_entry_price: string;
  current_price: string;
  market_value: string;
  unrealized_pl: string;
  unrealized_plpc: string;
};
type AlpacaFill = {
  id: string;
  symbol?: string;
  side?: string;
  qty?: string;
  price?: string;
  transaction_time?: string;
};
type AlpacaOrder = {
  symbol: string;
  side: string;
  qty: string;
  status: string;
  filled_avg_price?: string;
  created_at: string;
};

// ── Analytics tools ────────────────────────────────────────────────────────────

async function getAccount(): Promise<AlpacaAccount> {
  return tradingFetch<AlpacaAccount>("/v2/account");
}

type MarketClock = { is_open: boolean; next_open: string; next_close: string };

async function getMarketClock(): Promise<MarketClock | null> {
  try {
    return await tradingFetch<MarketClock>("/v2/clock");
  } catch {
    return null;
  }
}

/**
 * Session-aware Day P&L. Alpaca's `last_equity` only rolls forward at market
 * OPEN, so between sessions `equity - last_equity` reflects the LAST completed
 * session, not "today". While the market is closed, today's Day P&L is $0.00.
 */
function computeDayPnl(acc: AlpacaAccount, clock: MarketClock | null) {
  const equity = parseFloat(acc.equity);
  const lastEquity = parseFloat(acc.last_equity);
  const sessionPnl = equity - lastEquity;
  const sessionPct = lastEquity > 0 ? (sessionPnl / lastEquity) * 100 : 0;
  const marketOpen = clock?.is_open ?? false;
  return {
    equity,
    lastEquity,
    marketOpen,
    dayPnl: marketOpen ? sessionPnl : 0,
    dayPct: marketOpen ? sessionPct : 0,
    sessionPnl,
    sessionPct,
  };
}

async function getPositions(): Promise<AlpacaPosition[]> {
  return tradingFetch<AlpacaPosition[]>("/v2/positions");
}

async function getRecentFills(days = 30): Promise<AlpacaFill[]> {
  const after = new Date(Date.now() - days * 86400000);
  after.setUTCHours(0, 0, 0, 0);
  const fills: AlpacaFill[] = [];
  let pageToken: string | null = null;
  for (let page = 0; page < 10; page++) {
    const queryParts: string[] = [
      "direction=asc",
      "page_size=100",
      `after=${encodeURIComponent(after.toISOString())}`,
    ];
    if (pageToken) queryParts.push(`page_token=${encodeURIComponent(pageToken)}`);
    const batch = await tradingFetch<AlpacaFill[]>(`/v2/account/activities/FILL?${queryParts.join("&")}`);
    fills.push(...batch);
    if (batch.length < 100) break;
    pageToken = batch[batch.length - 1]?.id ?? null;
    if (!pageToken) break;
  }
  return fills;
}

async function getRecentOrders(days = 30): Promise<AlpacaOrder[]> {
  const after = new Date(Date.now() - days * 86400000).toISOString();
  return tradingFetch<AlpacaOrder[]>(
    `/v2/orders?status=all&limit=100&direction=asc&after=${encodeURIComponent(after)}`
  );
}

async function getPortfolioHistory() {
  try {
    const DATA_BASE = process.env.ALPACA_BASE_URL ?? "https://paper-api.alpaca.markets";
    const r = await fetch(
      `${DATA_BASE}/v2/account/portfolio/history?period=1M&timeframe=1D&extended_hours=false`,
      { headers: alpacaHeaders(), cache: "no-store" }
    );
    if (!r.ok) return null;
    return r.json() as Promise<{ equity: number[]; timestamp: number[]; profit_loss: number[] }>;
  } catch {
    return null;
  }
}

// ── NLP router ────────────────────────────────────────────────────────────────

function matchesAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

function fmt(n: number, decimals = 2): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}
function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

export async function POST(req: NextRequest) {
  if (!isAlpacaConnected()) {
    return NextResponse.json({
      response:
        "⚠️ **Alpaca is not connected.**\n\nOracle AI needs your Alpaca API keys configured in Vercel environment variables (`ALPACA_API_KEY_ID` and `ALPACA_API_SECRET_KEY`) to answer questions about your live portfolio and trades.",
    });
  }

  let body: { prompt: string; history?: { role: string; content: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ response: "Invalid request." }, { status: 400 });
  }

  const { prompt } = body;
  const p = prompt.toLowerCase();

  try {
    // ── 0. EXPLAIN P&L / WHY questions ─────────────────────────────────────
    if (matchesAny(p, ["why", "how did i make", "how did i gain", "how did i earn", "explain", "where did", "what caused", "if zero trades", "0 trades", "no trades"])) {
      const [acc, positions, fills, clock] = await Promise.all([
        getAccount(),
        getPositions(),
        getRecentFills(1),
        getMarketClock(),
      ]);
      const { equity, lastEquity, dayPnl, dayPct, marketOpen, sessionPnl, sessionPct } = computeDayPnl(acc, clock);
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayFills = fills.filter((f) => f.transaction_time && new Date(f.transaction_time) >= todayStart);

      const posLines = positions.map((pos) => {
        const unreal = parseFloat(pos.unrealized_pl);
        const unrPct = parseFloat(pos.unrealized_plpc) * 100;
        return `• **${pos.symbol}**: ${pos.qty} shares → Unrealized \`${fmt(unreal)}\` (${fmtPct(unrPct)})`;
      }).join("\n");

      return NextResponse.json({
        response:
          `### 📊 Why Do I Have P&L With No Trades?\n\n` +
          `**Source:** Alpaca Account API + Positions API + Market Clock\n\n` +
          (marketOpen
            ? `**Day P&L: \`${fmt(dayPnl)}\` (${fmtPct(dayPct)}) — this is 100% unrealized, not from new trades.**\n\n`
            : `**Day P&L: \`${fmt(0)}\` — the market is currently closed, so today's session hasn't started.**\n\n` +
              `Your last completed session finished at \`${fmt(sessionPnl)}\` (${fmtPct(sessionPct)}). That figure is frozen until the next open.\n\n`) +
          `#### How this works:\n` +
          `Day P&L measures the change in your **total portfolio value** since the previous market close, and only accrues while the market is **open**. Even with **${todayFills.length} new fills today**, your existing open positions change in value as prices move during the session.\n\n` +
          `Think of it like owning a house — if property prices rise today, you are "up" even though you made no transactions.\n\n` +
          (positions.length > 0
            ? `#### Your ${positions.length} Open Position${positions.length > 1 ? "s" : ""} driving session P&L:\n${posLines}\n\n`
            : "") +
          `#### The math:\n` +
          `• Previous close equity: \`$${lastEquity.toLocaleString("en-US", { minimumFractionDigits: 2 })}\`\n` +
          `• Current equity: \`$${equity.toLocaleString("en-US", { minimumFractionDigits: 2 })}\`\n` +
          `• Market status: \`${marketOpen ? "Open" : "Closed"}\`\n\n` +
          `This P&L becomes **realized** only when you close (sell) the position.`,
      });
    }

    // ── 1. TODAY'S PERFORMANCE ──────────────────────────────────────────────
    if (matchesAny(p, ["today", "how did i do", "make today", "do today", "daily", "day pnl", "day p&l"])) {
      const [acc, positions, fills, clock] = await Promise.all([
        getAccount(),
        getPositions(),
        getRecentFills(1),
        getMarketClock(),
      ]);

      const { equity, dayPnl, dayPct, marketOpen, sessionPnl, sessionPct } = computeDayPnl(acc, clock);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayFills = fills.filter(
        (f) => f.transaction_time && new Date(f.transaction_time) >= todayStart
      );

      const buys = todayFills.filter((f) => f.side === "buy").length;
      const sells = todayFills.filter((f) => f.side === "sell" || f.side === "sell_short").length;

      // Explain the difference between unrealized mark-to-market and actual fills
      const pnlSource = !marketOpen
        ? `\n\n🌙 **Market is closed.** Today's session hasn't started, so Day P&L is \`$0.00\`. Your last completed session finished at \`${fmt(sessionPnl)}\` (${fmtPct(sessionPct)}). Day P&L will start moving again at the next open.`
        : todayFills.length === 0 && positions.length > 0
          ? `\n\n💡 **Why do I have P&L with 0 trades?**\nDay P&L comes from **mark-to-market movement** on your ${positions.length} open position${positions.length > 1 ? "s" : ""}. Even with no new trades today, your held shares gained/lost value as the market moved. This is unrealized P&L — it becomes realized only when you sell.`
          : "";

      const sentiment = !marketOpen
        ? `⚪ Market closed — Day P&L resets to $0.00 until the next session opens.`
        : dayPnl >= 0
          ? `🟢 Your portfolio is up today — driven by price movement on existing holdings.`
          : `🔴 Your portfolio is down today — existing holdings moved against you.`;

      return NextResponse.json({
        response:
          `### 📈 Today's Performance\n\n` +
          `**Source:** Alpaca Account API + Market Clock (live paper account)\n\n` +
          `• **Day P&L:** \`${fmt(dayPnl)}\` (${fmtPct(dayPct)})\n` +
          `• **Market Status:** \`${marketOpen ? "Open" : "Closed"}\`\n` +
          `• **Portfolio Value:** \`$${equity.toLocaleString("en-US", { minimumFractionDigits: 2 })}\`\n` +
          `• **Cash Available:** \`$${parseFloat(acc.cash).toLocaleString("en-US", { minimumFractionDigits: 2 })}\`\n` +
          `• **Fills Today:** \`${todayFills.length}\` (${buys} buys · ${sells} sells)\n` +
          `• **Open Positions:** \`${positions.length}\` (generating unrealized P&L)\n\n` +
          sentiment +
          pnlSource,
      });
    }

    // ── 2. OPEN POSITIONS ───────────────────────────────────────────────────
    if (matchesAny(p, ["open", "position", "holding", "deployed", "currently own", "what do i own"])) {
      const [acc, positions] = await Promise.all([getAccount(), getPositions()]);

      if (positions.length === 0) {
        return NextResponse.json({
          response:
            `### 💼 Open Positions\n\n` +
            `**Source:** Alpaca Positions API\n\n` +
            `You have **no open positions** right now. All capital is sitting in cash.\n\n` +
            `• **Cash Available:** \`$${parseFloat(acc.cash).toLocaleString("en-US", { minimumFractionDigits: 2 })}\`\n` +
            `• **Buying Power:** \`$${parseFloat(acc.buying_power).toLocaleString("en-US", { minimumFractionDigits: 2 })}\``,
        });
      }

      const totalMarket = positions.reduce((s, p) => s + parseFloat(p.market_value), 0);
      const totalUnreal = positions.reduce((s, p) => s + parseFloat(p.unrealized_pl), 0);

      const posLines = positions
        .sort((a, b) => Math.abs(parseFloat(b.market_value)) - Math.abs(parseFloat(a.market_value)))
        .map((p) => {
          const unreal = parseFloat(p.unrealized_pl);
          const unrPct = parseFloat(p.unrealized_plpc) * 100;
          const mv = parseFloat(p.market_value);
          const pct = ((mv / totalMarket) * 100).toFixed(1);
          return `• **${p.symbol}**: ${p.qty} shares @ avg \`$${parseFloat(p.avg_entry_price).toFixed(2)}\` → now \`$${parseFloat(p.current_price).toFixed(2)}\` | Unrealized: \`${fmt(unreal)}\` (${fmtPct(unrPct)}) | ${pct}% of portfolio`;
        })
        .join("\n");

      return NextResponse.json({
        response:
          `### 💼 Open Positions (${positions.length})\n\n` +
          `**Source:** Alpaca Positions API\n\n` +
          `${posLines}\n\n` +
          `**Total Deployed:** \`$${totalMarket.toLocaleString("en-US", { minimumFractionDigits: 2 })}\`  |  **Total Unrealized P&L:** \`${fmt(totalUnreal)}\``,
      });
    }

    // ── 3. WIN RATE / TRADE STATS ───────────────────────────────────────────
    if (matchesAny(p, ["win rate", "winrate", "win %", "win%", "how many trades", "trade count", "trades did i make", "how many wins"])) {
      const fills = await getRecentFills(30);

      // Build round-trip P&L per symbol
      const positions = new Map<string, { qty: number; avgCost: number }>();
      let wins = 0;
      let losses = 0;
      let realizedPnl = 0;

      for (const fill of fills) {
        const qty = parseFloat(fill.qty ?? "0");
        const price = parseFloat(fill.price ?? "0");
        const isBuy = fill.side === "buy" || fill.side === "buy_to_cover";
        const sym = fill.symbol ?? "";
        const pos = positions.get(sym) ?? { qty: 0, avgCost: 0 };

        if (isBuy) {
          const nextQty = pos.qty + qty;
          const nextAvg = nextQty === 0 ? 0 : (pos.qty * pos.avgCost + qty * price) / nextQty;
          positions.set(sym, { qty: nextQty, avgCost: nextAvg });
        } else {
          const closingQty = Math.min(pos.qty, qty);
          if (closingQty > 0) {
            const pnl = (price - pos.avgCost) * closingQty;
            realizedPnl += pnl;
            if (pnl > 0) wins++;
            else losses++;
          }
          positions.set(sym, { qty: pos.qty - qty, avgCost: pos.avgCost });
        }
      }

      const total = wins + losses;
      const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";

      return NextResponse.json({
        response:
          `### 🏆 Win Rate & Trade Stats (Last 30 Days)\n\n` +
          `**Source:** Alpaca Account Activity (FILL events)\n\n` +
          `• **Win Rate:** \`${winRate}%\`\n` +
          `• **Winning Closed Trades:** \`${wins}\`\n` +
          `• **Losing Closed Trades:** \`${losses}\`\n` +
          `• **Total Fills:** \`${fills.length}\`\n` +
          `• **Realized P&L (30d):** \`${fmt(realizedPnl)}\`\n\n` +
          `Win rate is calculated from closed round-trip transactions over the last 30 days.`,
      });
    }

    // ── 4. MONTHLY PERFORMANCE ──────────────────────────────────────────────
    if (matchesAny(p, ["month", "monthly", "this month", "30 day", "last month", "how have i done"])) {
      const [acc, hist] = await Promise.all([getAccount(), getPortfolioHistory()]);

      let monthlyPnl = 0;
      let monthlyPct = 0;

      if (hist && hist.equity && hist.equity.length >= 2) {
        const start = hist.equity[0];
        const end = hist.equity[hist.equity.length - 1];
        monthlyPnl = end - start;
        monthlyPct = start > 0 ? (monthlyPnl / start) * 100 : 0;
      } else {
        const equity = parseFloat(acc.equity);
        const lastEquity = parseFloat(acc.last_equity);
        monthlyPnl = equity - lastEquity;
      }

      const fills = await getRecentFills(30);
      const turnover = fills.reduce((s, f) => s + parseFloat(f.qty ?? "0") * parseFloat(f.price ?? "0"), 0);

      return NextResponse.json({
        response:
          `### 📊 Monthly Performance\n\n` +
          `**Source:** Alpaca Portfolio History API + Account Activity\n\n` +
          `• **Monthly P&L:** \`${fmt(monthlyPnl)}\`${monthlyPct !== 0 ? ` (${fmtPct(monthlyPct)})` : ""}\n` +
          `• **Current Equity:** \`$${parseFloat(acc.equity).toLocaleString("en-US", { minimumFractionDigits: 2 })}\`\n` +
          `• **Fills This Month:** \`${fills.length}\`\n` +
          `• **Turnover Volume:** \`$${turnover.toLocaleString("en-US", { maximumFractionDigits: 0 })}\`\n\n` +
          (monthlyPnl >= 0
            ? `🟢 Positive month! Keep managing risk and stay consistent.`
            : `🔴 Negative month. Review your losing trades and adjust strategy sizing.`),
      });
    }

    // ── 5. RISK / EXPOSURE ──────────────────────────────────────────────────
    if (matchesAny(p, ["risk", "exposure", "drawdown", "how risky", "overexposed", "limits", "how much risk"])) {
      const [acc, positions] = await Promise.all([getAccount(), getPositions()]);
      const equity = parseFloat(acc.equity);
      const cash = parseFloat(acc.cash);
      const buyingPower = parseFloat(acc.buying_power);
      const totalDeployed = positions.reduce((s, p) => s + parseFloat(p.market_value), 0);
      const exposurePct = equity > 0 ? (totalDeployed / equity) * 100 : 0;
      const cashPct = equity > 0 ? (cash / equity) * 100 : 0;

      const largest = positions.sort((a, b) => parseFloat(b.market_value) - parseFloat(a.market_value))[0];
      const largestPct = largest && equity > 0 ? (parseFloat(largest.market_value) / equity * 100).toFixed(1) : "0";

      return NextResponse.json({
        response:
          `### 🛡️ Risk & Exposure Analysis\n\n` +
          `**Source:** Alpaca Account + Positions API\n\n` +
          `• **Total Equity:** \`$${equity.toLocaleString("en-US", { minimumFractionDigits: 2 })}\`\n` +
          `• **Capital Deployed:** \`$${totalDeployed.toLocaleString("en-US", { minimumFractionDigits: 2 })}\` (${exposurePct.toFixed(1)}% of equity)\n` +
          `• **Cash Reserve:** \`$${cash.toLocaleString("en-US", { minimumFractionDigits: 2 })}\` (${cashPct.toFixed(1)}% of equity)\n` +
          `• **Buying Power:** \`$${buyingPower.toLocaleString("en-US", { minimumFractionDigits: 2 })}\`\n` +
          (largest ? `• **Largest Position:** \`${largest.symbol}\` at ${largestPct}% of portfolio\n` : "") +
          `• **Open Positions:** \`${positions.length}\`\n\n` +
          (exposurePct > 80
            ? `⚠️ You are **highly exposed** (${exposurePct.toFixed(1)}%). Consider reducing position sizes or taking some profits.`
            : exposurePct > 50
            ? `🟡 Moderate exposure (${exposurePct.toFixed(1)}%). Healthy but watch for concentrated positions.`
            : `🟢 Conservative exposure (${exposurePct.toFixed(1)}%). Plenty of dry powder available.`),
      });
    }

    // ── 6. FORECAST ─────────────────────────────────────────────────────────
    if (matchesAny(p, ["forecast", "predict", "project", "next month", "30 days", "6 months", "december", "how much could i make", "how much can i make"])) {
      const [acc, hist] = await Promise.all([getAccount(), getPortfolioHistory()]);
      const equity = parseFloat(acc.equity);

      let avgDailyReturn = 0.0005; // 0.05% default
      if (hist && hist.equity && hist.equity.length >= 5) {
        const returns: number[] = [];
        for (let i = 1; i < hist.equity.length; i++) {
          if (hist.equity[i - 1] > 0) {
            returns.push((hist.equity[i] - hist.equity[i - 1]) / hist.equity[i - 1]);
          }
        }
        if (returns.length > 0) {
          avgDailyReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
        }
      }

      const tradingDaysPerMonth = 21;
      const exp = avgDailyReturn * tradingDaysPerMonth;
      const cons = exp * 0.5;
      const opti = exp * 1.8;

      const p30 = { c: equity * cons, e: equity * exp, o: equity * opti };
      const p6m = { c: equity * cons * 6, e: equity * exp * 6, o: equity * opti * 6 };

      return NextResponse.json({
        response:
          `### 🔮 Performance Forecast\n\n` +
          `**Source:** Alpaca Portfolio History + Helios Projection Engine\n\n` +
          `Based on your average daily return of \`${(avgDailyReturn * 100).toFixed(3)}%\` from recent portfolio history:\n\n` +
          `#### 📅 30-Day Outlook\n` +
          `• **Conservative:** \`${fmt(p30.c)}\`\n` +
          `• **Expected:** \`${fmt(p30.e)}\`\n` +
          `• **Optimistic:** \`${fmt(p30.o)}\`\n\n` +
          `#### 🗓️ 6-Month Outlook\n` +
          `• **Conservative:** \`${fmt(p6m.c)}\`\n` +
          `• **Expected:** \`${fmt(p6m.e)}\`\n` +
          `• **Optimistic:** \`${fmt(p6m.o)}\`\n\n` +
          `*⚠️ Projections are based on past performance and are not a guarantee of future results. Trading involves significant capital risk.*`,
      });
    }

    // ── 7. ACCOUNT / BALANCE / BUYING POWER ─────────────────────────────────
    if (matchesAny(p, ["balance", "cash", "buying power", "account", "equity", "how much money", "portfolio value"])) {
      const acc = await getAccount();
      return NextResponse.json({
        response:
          `### 💰 Account Summary\n\n` +
          `**Source:** Alpaca Account API\n\n` +
          `• **Portfolio Value:** \`$${parseFloat(acc.portfolio_value).toLocaleString("en-US", { minimumFractionDigits: 2 })}\`\n` +
          `• **Equity:** \`$${parseFloat(acc.equity).toLocaleString("en-US", { minimumFractionDigits: 2 })}\`\n` +
          `• **Cash:** \`$${parseFloat(acc.cash).toLocaleString("en-US", { minimumFractionDigits: 2 })}\`\n` +
          `• **Buying Power:** \`$${parseFloat(acc.buying_power).toLocaleString("en-US", { minimumFractionDigits: 2 })}\``,
      });
    }

    // ── 8. ROI ───────────────────────────────────────────────────────────────
    if (matchesAny(p, ["roi", "return on investment", "total return", "overall return", "all time", "total profit", "total pnl", "total p&l"])) {
      const acc = await getAccount();
      const equity = parseFloat(acc.equity);
      const initial = 100000; // standard paper account start
      const totalGain = equity - initial;
      const roiPct = (totalGain / initial) * 100;
      return NextResponse.json({
        response:
          `### 📈 Return on Investment\n\n` +
          `**Source:** Alpaca Account API\n\n` +
          `• **Starting Capital:** \`$${initial.toLocaleString()}\`\n` +
          `• **Current Equity:** \`$${equity.toLocaleString("en-US", { minimumFractionDigits: 2 })}\`\n` +
          `• **Total Gain/Loss:** \`${fmt(totalGain)}\`\n` +
          `• **ROI:** \`${fmtPct(roiPct)}\`\n\n` +
          (roiPct >= 0 ? `🟢 Your account is profitable overall.` : `🔴 Your account is below starting capital.`),
      });
    }

    // ── 9. RECENT TRADES ─────────────────────────────────────────────────────
    if (matchesAny(p, ["recent trade", "trade history", "last trade", "what trades", "show trade", "trade list"])) {
      const fills = await getRecentFills(7);
      if (fills.length === 0) {
        return NextResponse.json({
          response: `### 📋 Recent Trades\n\n**Source:** Alpaca FILL Activity\n\nNo trades found in the last 7 days.`,
        });
      }
      const lines = fills
        .slice(-10)
        .reverse()
        .map((f) => {
          const dt = f.transaction_time ? new Date(f.transaction_time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
          return `• \`${dt}\` — **${f.symbol}** ${(f.side ?? "").toUpperCase()} ${f.qty} @ $${parseFloat(f.price ?? "0").toFixed(4)}`;
        })
        .join("\n");
      return NextResponse.json({
        response:
          `### 📋 Last ${Math.min(fills.length, 10)} Fills (7 Days)\n\n` +
          `**Source:** Alpaca Account Activity API\n\n` +
          `${lines}\n\n` +
          `*Showing most recent ${Math.min(fills.length, 10)} of ${fills.length} total fills.*`,
      });
    }

    // ── K1. RSI ───────────────────────────────────────────────────────────────
    if (matchesAny(p, ["rsi", "relative strength index", "overbought", "oversold"])) {
      return NextResponse.json({ response:
        `### 📊 RSI — Relative Strength Index\n\n` +
        `**Source:** Industry Trading Knowledge\n\n` +
        `RSI is a **momentum oscillator** that measures the speed and magnitude of recent price changes on a scale of 0–100.\n\n` +
        `#### Key Levels\n` +
        `| Level | Signal |\n|-------|--------|\n` +
        `| **> 70** | Overbought — potential reversal or pullback |\n` +
        `| **30–70** | Neutral zone — trend is intact |\n` +
        `| **< 30** | Oversold — potential bounce or recovery |\n\n` +
        `#### How Helios Uses RSI\n` +
        `• **PennyMomentumAgent** uses RSI(14) on daily candles — avoids entering penny stocks above RSI 75 to prevent buying into exhaustion\n` +
        `• **IntradayAgent** uses RSI(7) on 5-minute candles for intraday confirmation\n` +
        `• A divergence between price making new highs and RSI declining is a bearish exit signal\n\n` +
        `*Formula: RSI = 100 − [100 ÷ (1 + (Avg Gain / Avg Loss))]*` });
    }

    // ── K2. VWAP ─────────────────────────────────────────────────────────────
    if (matchesAny(p, ["vwap", "volume weighted", "intraday anchor"])) {
      return NextResponse.json({ response:
        `### 📈 VWAP — Volume Weighted Average Price\n\n` +
        `**Source:** Industry Trading Knowledge\n\n` +
        `VWAP is the **average price weighted by volume** throughout the trading day. It resets at 9:30 AM ET every session.\n\n` +
        `#### Why It Matters\n` +
        `• Institutional traders (hedge funds, mutual funds) use VWAP as their **benchmark** — they buy below it, sell above it\n` +
        `• Price above VWAP = **bullish intraday bias**\n` +
        `• Price below VWAP = **bearish intraday bias**\n` +
        `• A reclaim of VWAP after a dip is a strong long signal\n\n` +
        `#### How Helios Uses VWAP\n` +
        `• **IntradayAgent** checks if the stock is trading **above VWAP** at entry — a required condition for intraday longs\n` +
        `• If a profitable position drops below VWAP during the day, it triggers an early exit review\n` +
        `• Combined with ORB (Opening Range Breakout) for highest-confidence setups\n\n` +
        `*VWAP is the most widely used intraday institutional benchmark.*` });
    }

    // ── K3. MACD ─────────────────────────────────────────────────────────────
    if (matchesAny(p, ["macd", "moving average convergence", "signal line", "histogram"])) {
      return NextResponse.json({ response:
        `### 📊 MACD — Moving Average Convergence Divergence\n\n` +
        `**Source:** Industry Trading Knowledge\n\n` +
        `MACD measures the relationship between two EMAs and generates momentum signals.\n\n` +
        `#### Components\n` +
        `• **MACD Line** = EMA(12) − EMA(26)\n` +
        `• **Signal Line** = EMA(9) of MACD Line\n` +
        `• **Histogram** = MACD Line − Signal Line\n\n` +
        `#### Signals\n` +
        `| Signal | Meaning |\n|--------|----------|\n` +
        `| MACD crosses **above** Signal | Bullish — potential buy |\n` +
        `| MACD crosses **below** Signal | Bearish — potential sell |\n` +
        `| Histogram expanding | Momentum increasing |\n` +
        `| Histogram shrinking | Momentum fading |\n\n` +
        `#### How Helios Uses MACD\n` +
        `• **MomentumAgent** uses MACD bullish crossover as a blue chip entry trigger\n` +
        `• **MeanReversionAgent** uses MACD histogram compression to identify coiled stocks\n` +
        `• MACD bearish cross on an open position triggers a re-evaluation for early exit` });
    }

    // ── K4. BOLLINGER BANDS ───────────────────────────────────────────────────
    if (matchesAny(p, ["bollinger", "bands", "standard deviation band", "squeeze"])) {
      return NextResponse.json({ response:
        `### 📊 Bollinger Bands\n\n` +
        `**Source:** Industry Trading Knowledge\n\n` +
        `Bollinger Bands consist of a **20-period SMA** with upper/lower bands at ±2 standard deviations.\n\n` +
        `#### Key Concepts\n` +
        `• **Band Squeeze** — bands narrow, volatility compressed → breakout imminent\n` +
        `• **Band Walk** — price hugs upper band in a strong uptrend (bullish)\n` +
        `• **Mean Reversion** — price snaps back to middle band (20 SMA) after extremes\n` +
        `• **Upper Band Touch** — not always overbought in a trend; only bearish with RSI divergence\n\n` +
        `#### How Helios Uses Bollinger Bands\n` +
        `• **MeanReversionAgent** scans for stocks at the lower band with RSI < 35 for bounce plays\n` +
        `• **PennyMomentumAgent** uses a Bollinger squeeze scan to find penny stocks about to break out\n` +
        `• Target on mean-reversion trades is typically the **middle band (20 SMA)**` });
    }

    // ── K5. MOVING AVERAGES ───────────────────────────────────────────────────
    if (matchesAny(p, ["moving average", "ema", "sma", "200 day", "50 day", "golden cross", "death cross", "ma ribbon"])) {
      return NextResponse.json({ response:
        `### 📈 Moving Averages — EMA & SMA\n\n` +
        `**Source:** Industry Trading Knowledge\n\n` +
        `Moving averages smooth price data to identify trend direction.\n\n` +
        `| Type | Formula | Best For |\n|------|---------|----------|\n` +
        `| **SMA** | Simple average of N closes | Trend identification |\n` +
        `| **EMA** | Weighted — recent prices count more | Faster signal, less lag |\n\n` +
        `#### Key Levels\n` +
        `• **EMA 9/21** — short-term momentum (used for intraday)\n` +
        `• **EMA 50** — intermediate trend; loss of 50 EMA = bearish\n` +
        `• **SMA 200** — long-term health benchmark\n` +
        `• **Golden Cross** — 50 SMA crosses above 200 SMA = strong bullish signal\n` +
        `• **Death Cross** — 50 SMA crosses below 200 SMA = bearish\n\n` +
        `#### How Helios Uses MAs\n` +
        `• **MomentumAgent** requires price > EMA(50) on daily for blue chip entries\n` +
        `• **PennyMomentumAgent** uses EMA(9) > EMA(21) crossover as entry trigger\n` +
        `• **IntradayAgent** uses EMA(9) on 5m chart for intraday trend confirmation` });
    }

    // ── K6. PENNY STOCKS ─────────────────────────────────────────────────────
    if (matchesAny(p, ["penny stock", "penny", "low float", "small cap", "micro cap", "catalyst", "dilution", "pump and dump", "float"])) {
      return NextResponse.json({ response:
        `### 💡 Penny Stock Trading — How It Works\n\n` +
        `**Source:** Industry Trading Knowledge\n\n` +
        `Penny stocks are generally shares priced **under $5** (some define it as under $1). They offer explosive upside but carry significant risk.\n\n` +
        `#### Why Penny Stocks Move\n` +
        `• **Catalyst** — news, FDA approval, earnings surprise, contract announcement → can spike 50-200% in one session\n` +
        `• **Low Float** — fewer shares available = easier for volume to push the price higher\n` +
        `• **Short Squeeze** — high short interest + catalyst = shorts forced to buy, price explodes\n\n` +
        `#### Key Metrics to Watch\n` +
        `| Metric | Ideal Range |\n|--------|------------|\n` +
        `| Float | < 20M shares (lower = more volatile) |\n` +
        `| Volume | > 3× average daily volume |\n` +
        `| Price | $0.50 – $5.00 |\n` +
        `| Catalyst | Fresh news today |\n` +
        `| Short Interest | > 10% for squeeze potential |\n\n` +
        `#### Risks\n` +
        `• **Dilution** — companies issue new shares, tanking the price\n` +
        `• **Pump & Dump** — coordinated buying followed by insider selling\n` +
        `• **Wide spreads** — illiquid stocks have large bid/ask gaps\n\n` +
        `#### How Helios Trades Penny Stocks\n` +
        `• **70% of capital** allocated to penny stock setups\n` +
        `• **PennyMomentumAgent** scans for high-volume, catalyst-driven movers daily\n` +
        `• Hard stop at **-8%**, target at **+12-15%**\n` +
        `• Position sizing is **smaller** per trade to limit downside (1-2% of portfolio per penny)` });
    }

    // ── K7. MOMENTUM TRADING ──────────────────────────────────────────────────
    if (matchesAny(p, ["momentum", "momentum trading", "trend following", "breakout", "continuation", "bull flag", "cup and handle"])) {
      return NextResponse.json({ response:
        `### 🚀 Momentum Trading Strategy\n\n` +
        `**Source:** Industry Trading Knowledge\n\n` +
        `Momentum trading buys stocks that are **already moving up** and rides the trend — *"buy high, sell higher."*\n\n` +
        `#### Core Logic\n` +
        `Stocks that outperform for 3-12 months tend to **continue outperforming** in the near term (this is backed by decades of academic research — Jegadeesh & Titman, 1993).\n\n` +
        `#### Classic Momentum Setups\n` +
        `| Pattern | Description |\n|---------|-------------|\n` +
        `| **Bull Flag** | Sharp spike up → brief consolidation → continuation higher |\n` +
        `| **Cup & Handle** | Rounded base → breakout from handle = major move |\n` +
        `| **ORB (Opening Range Breakout)** | First 15m range sets bounds — break above = long |\n` +
        `| **Gap & Go** | Stock gaps up on news → holds gap → buy the first pullback |\n\n` +
        `#### Key Rules\n` +
        `• Only enter **with** the trend — never fight momentum\n` +
        `• Volume must confirm the move (low volume breakouts often fail)\n` +
        `• Use a **tight stop** just below the breakout level\n` +
        `• **Let winners run** — trail your stop as price moves in your favor\n\n` +
        `#### How Helios Uses Momentum\n` +
        `• Both **MomentumAgent** (blue chips) and **PennyMomentumAgent** are momentum-based\n` +
        `• Each entry requires **dual confirmation**: daily chart + 5m intraday chart alignment\n` +
        `• Trailing stop ratchet at +3% and +5% to protect gains` });
    }

    // ── K8. MEAN REVERSION ────────────────────────────────────────────────────
    if (matchesAny(p, ["mean reversion", "revert", "bounce", "oversold bounce", "snap back", "contrarian"])) {
      return NextResponse.json({ response:
        `### 🔄 Mean Reversion Strategy\n\n` +
        `**Source:** Industry Trading Knowledge\n\n` +
        `Mean reversion is based on the principle that stock prices **tend to return to their average** over time. What goes too far down tends to bounce back.\n\n` +
        `#### Setup Criteria\n` +
        `• Price is **significantly below** its 20-day SMA (2+ standard deviations)\n` +
        `• RSI drops below 30 (oversold)\n` +
        `• No fundamental reason for the drop (earnings, fraud, sector collapse)\n` +
        `• Volume drying up (selling exhaustion)\n\n` +
        `#### Trade Structure\n` +
        `• **Entry:** At or near lower Bollinger Band with RSI divergence\n` +
        `• **Target:** Return to 20 SMA (middle Bollinger Band)\n` +
        `• **Stop:** Below the recent swing low\n` +
        `• **Risk:Reward:** Typically 1:2 or better\n\n` +
        `#### How Helios Uses Mean Reversion\n` +
        `• **MeanReversionAgent** scans the watchlist daily for stocks at extreme lows\n` +
        `• Works best in **range-bound / sideways markets**\n` +
        `• Avoided on stocks in fundamental downtrends (falling revenue, guidance cuts)\n` +
        `• Complements momentum strategy — if momentum fails, mean reversion can catch the bounce` });
    }

    // ── K9. RISK MANAGEMENT CONCEPTS ─────────────────────────────────────────
    if (matchesAny(p, ["stop loss", "trailing stop", "position sizing", "kelly criterion", "1% rule", "2% rule", "max loss", "risk management", "risk per trade", "drawdown limit"])) {
      return NextResponse.json({ response:
        `### 🛡️ Risk Management — Industry Best Practices\n\n` +
        `**Source:** Industry Trading Knowledge\n\n` +
        `Risk management is **the single most important factor** separating profitable traders from blown accounts.\n\n` +
        `#### The 1-2% Rule\n` +
        `Never risk more than **1-2% of total account equity** on a single trade. On a $100,000 account:\n` +
        `• Max risk per trade = **$1,000 – $2,000**\n` +
        `• If stop is 5% below entry, max position = $1,000 ÷ 5% = **$20,000**\n\n` +
        `#### Position Sizing Formula\n` +
        `\`\`\`\nShares = (Account × Risk%) ÷ (Entry Price − Stop Price)\n\`\`\`\n\n` +
        `#### Stop Loss Types\n` +
        `| Type | How It Works |\n|------|-------------|\n` +
        `| **Hard Stop** | Fixed price — exit if breached |\n` +
        `| **Trailing Stop** | Follows price up — locks in gains |\n` +
        `| **Time Stop** | Exit if no movement after N hours |\n` +
        `| **ATR Stop** | Stop set at 1.5–2× Average True Range from entry |\n\n` +
        `#### How Helios Manages Risk\n` +
        `• Hard stop at **-8%** for penny stocks, **-5%** for blue chips\n` +
        `• At **+3% gain**: stop moves to breakeven (zero risk trade)\n` +
        `• At **+5% gain**: trailing stop at 50% of max gain achieved\n` +
        `• Max **3 simultaneous positions** to avoid over-concentration\n` +
        `• All positions **flattened at 3:40 PM ET** to avoid overnight risk` });
    }

    // ── K10. PDT RULE & MARKET MECHANICS ──────────────────────────────────────
    if (matchesAny(p, ["pdt", "pattern day trader", "day trading rule", "25000", "$25,000", "market hours", "pre market", "after hours", "t+1", "t+2", "settlement"])) {
      return NextResponse.json({ response:
        `### ⚖️ Market Mechanics & PDT Rule\n\n` +
        `**Source:** Industry Trading Knowledge\n\n` +
        `#### Pattern Day Trader (PDT) Rule\n` +
        `The PDT rule (FINRA Rule 4210) requires you to maintain **$25,000 minimum equity** to make more than 3 day trades in a rolling 5-business-day window.\n\n` +
        `• A **day trade** = buying AND selling the same stock in the same session\n` +
        `• Under $25K? You get **3 day trades per 5 days**\n` +
        `• This applies to **margin accounts only** — cash accounts are exempt but face settlement delays\n\n` +
        `#### Market Hours (ET)\n` +
        `| Session | Hours | Notes |\n|---------|-------|-------|\n` +
        `| Pre-Market | 4:00 – 9:30 AM | Low liquidity, wide spreads |\n` +
        `| Regular Session | 9:30 AM – 4:00 PM | Highest volume & liquidity |\n` +
        `| After-Hours | 4:00 – 8:00 PM | Earnings reactions, news |\n\n` +
        `#### Settlement\n` +
        `• Stocks settle **T+1** (trade date + 1 business day) since May 2024\n` +
        `• Cash accounts: must wait for settlement before reusing proceeds\n` +
        `• Margin accounts: can trade immediately with buying power\n\n` +
        `#### How Helios Handles This\n` +
        `• Paper account is **not subject to PDT** — unlimited day trades for practice\n` +
        `• Bot is designed for accounts with **$25K+** before going live\n` +
        `• Positions are exited before **3:40 PM** to avoid overnight gaps` });
    }

    // ── K11. ORDER TYPES ──────────────────────────────────────────────────────
    if (matchesAny(p, ["market order", "limit order", "stop order", "stop limit", "order type", "slippage", "fill price", "good till cancel", "gtc", "day order"])) {
      return NextResponse.json({ response:
        `### 📋 Order Types Explained\n\n` +
        `**Source:** Industry Trading Knowledge\n\n` +
        `| Order Type | Execution | Use Case |\n|------------|-----------|----------|\n` +
        `| **Market Order** | Immediately at best available price | Fast entry/exit — accepts slippage |\n` +
        `| **Limit Order** | Only at your price or better | Precise entry — may not fill |\n` +
        `| **Stop (Stop-Market)** | Triggers market order when price hits stop | Stop loss execution |\n` +
        `| **Stop-Limit** | Triggers limit order when price hits stop | Avoids slippage but may not fill |\n` +
        `| **Trailing Stop** | Stop moves up with price by a % or $ amount | Lock in profits |\n\n` +
        `#### Slippage\n` +
        `Slippage = difference between expected and actual fill price. Worst on:\n` +
        `• **Market orders** on illiquid penny stocks\n` +
        `• **Fast-moving** breakout stocks\n` +
        `• **Pre/after-market** sessions\n\n` +
        `#### How Helios Places Orders\n` +
        `• **Entries**: Market orders for speed (momentum requires fast execution)\n` +
        `• **Stops**: Monitored by the bot logic, not resting stop orders (avoids stop-hunting)\n` +
        `• **Exits**: Market orders at EOD or on signal reversal\n` +
        `• All orders are **day orders** — cancelled if not filled by market close` });
    }

    // ── K12. HOW THE BOT DECIDES ──────────────────────────────────────────────
    if (matchesAny(p, ["how does the bot", "how does helios", "how do you decide", "which stock", "criteria", "bot logic", "agent logic", "selection criteria", "why this stock", "how do you pick", "trading criteria"])) {
      return NextResponse.json({ response:
        `### 🤖 How Helios Decides What to Trade\n\n` +
        `**Source:** Helios Bot Strategy + Agent Knowledge\n\n` +
        `Every trading day, Helios runs a **5-agent pipeline** to decide entries and manage positions:\n\n` +
        `#### Step 1 — Universe Scan (9:31 AM)\n` +
        `• **Penny (70% capital)**: PennyMomentumAgent scans ~50 penny stocks for: price $0.50–$5, volume > 3× avg, RSI 45–70, EMA(9) > EMA(21), positive catalyst\n` +
        `• **Blue Chip (30% capital)**: MomentumAgent scans S&P 500 large caps for: price > EMA(50), MACD bullish crossover, RS rank > 70\n\n` +
        `#### Step 2 — Dual Agent Confirmation\n` +
        `Both penny and blue chip picks must be confirmed by **IntradayAgent** on 5-minute candles:\n` +
        `• Price above VWAP ✓\n` +
        `• 5m RSI > 50 ✓\n` +
        `• No bearish divergence ✓\n\n` +
        `#### Step 3 — Blended Confidence Score\n` +
        `Entry only if blended score ≥ **70%** from both agents\n\n` +
        `#### Step 4 — Active Position Management\n` +
        `• Trailing stop ratchet: +3% → breakeven, +5% → trail at 50% of max gain\n` +
        `• 5m re-score: if bearish while profitable → early exit\n\n` +
        `#### Step 5 — EOD Flatten (3:40 PM)\n` +
        `All positions closed to avoid overnight gap risk` });
    }

    // ── K13. BLUE CHIP vs PENNY ───────────────────────────────────────────────
    if (matchesAny(p, ["blue chip", "bluechip", "large cap", "difference between", "penny vs", "vs penny", "why both", "mix of stocks", "70 30", "70/30", "allocation"])) {
      return NextResponse.json({ response:
        `### ⚖️ Blue Chip vs Penny Stock — Helios Strategy Mix\n\n` +
        `**Source:** Industry Trading Knowledge + Helios Strategy\n\n` +
        `Helios runs a **70% Penny / 30% Blue Chip** split by capital allocation.\n\n` +
        `| Factor | Penny Stocks | Blue Chip |\n|--------|-------------|----------|\n` +
        `| **Price Range** | $0.50 – $5 | $50 – $500+ |\n` +
        `| **Volatility** | Very high (10-50% daily moves) | Moderate (1-5% daily) |\n` +
        `| **Liquidity** | Low to moderate | Very high |\n` +
        `| **Upside Potential** | 15-50%+ per trade | 3-8% per trade |\n` +
        `| **Risk Per Trade** | Higher | Lower |\n` +
        `| **Holding Period** | Intraday only | Intraday |\n` +
        `| **Agents** | PennyMomentumAgent | MomentumAgent |\n\n` +
        `#### Why This Mix?\n` +
        `• Penny stocks provide **explosive upside** — one great penny trade can make the whole week\n` +
        `• Blue chips provide **stability and consistency** — reduces drawdown on bad penny days\n` +
        `• Together they create a **diversified intraday strategy** that isn't dependent on a single market regime\n\n` +
        `#### Both Require IntradayAgent Confirmation\n` +
        `Neither penny nor blue chip entries fire without 5m intraday signal agreement — this filter eliminates ~40% of false signals.` });
    }

    // ── K14. SHORT SELLING ────────────────────────────────────────────────────
    if (matchesAny(p, ["short", "short sell", "short selling", "shorting", "borrow", "short squeeze", "short interest"])) {
      return NextResponse.json({ response:
        `### 📉 Short Selling Explained\n\n` +
        `**Source:** Industry Trading Knowledge\n\n` +
        `Short selling is **profiting from falling prices** — you borrow shares, sell them, then buy back cheaper.\n\n` +
        `#### How It Works\n` +
        `1. Borrow shares from broker\n` +
        `2. Sell at current price (e.g. $50)\n` +
        `3. Price drops to $40 → buy back\n` +
        `4. Return shares to broker, keep $10/share profit\n\n` +
        `#### Short Squeeze\n` +
        `When a heavily shorted stock **rises sharply**, shorts are forced to buy to cover losses, pushing the price even higher. This feedback loop creates explosive moves.\n\n` +
        `• Classic examples: GME (2021), AMC, BBBY\n` +
        `• Penny stocks with >20% short interest are prime squeeze candidates\n` +
        `• **Short interest ratio (Days to Cover)** = shares short ÷ avg daily volume\n\n` +
        `#### Helios & Short Selling\n` +
        `• **Current bot is long-only** — does not short stocks\n` +
        `• **SentimentAgent** monitors short interest data as a **long-side catalyst indicator**\n` +
        `• High short interest + positive news = potential long entry for a squeeze play` });
    }

    // ── K15. SENTIMENT ANALYSIS ───────────────────────────────────────────────
    if (matchesAny(p, ["sentiment", "sentiment analysis", "news analysis", "social media", "reddit", "twitter", "wallstreetbets", "wsb", "fear greed", "market mood"])) {
      return NextResponse.json({ response:
        `### 💬 Sentiment Analysis in Trading\n\n` +
        `**Source:** Industry Trading Knowledge + Helios SentimentAgent\n\n` +
        `Sentiment analysis reads **news, social media, and market data** to gauge crowd psychology.\n\n` +
        `#### Why It Matters\n` +
        `Markets are driven by human emotion — fear and greed cause prices to overshoot fundamentals. Quantifying sentiment gives an **edge in timing.**\n\n` +
        `#### Sources Helios Monitors\n` +
        `• **Financial news** — earnings, FDA decisions, contract wins, macro events\n` +
        `• **Short interest data** — high short = potential squeeze setup\n` +
        `• **Market breadth** — VIX, advance/decline ratio, sector rotation\n\n` +
        `#### Fear & Greed Indicators\n` +
        `| Signal | Interpretation |\n|--------|---------------|\n` +
        `| VIX > 30 | High fear — market volatile, reduce size |\n` +
        `| VIX < 15 | Low fear — complacency, watch for reversal |\n` +
        `| Sector rotation into defensives | Risk-off — scale back aggressive positions |\n` +
        `| High volume on up days | Institutional accumulation — bullish |\n\n` +
        `#### How SentimentAgent Works\n` +
        `• Assigns a **sentiment score (0–100)** to each candidate stock\n` +
        `• Negative news = automatic disqualifier even if technical setup is clean\n` +
        `• High positive sentiment boosts the **blended confidence score** for entry approval` });
    }

    // ── DEFAULT: HELP ─────────────────────────────────────────────────────────
    const acc = await getAccount();
    return NextResponse.json({
      response:
        `### 👋 Oracle AI — Trading Analyst\n\n` +
        `**Source:** Alpaca Account API + Industry Trading Knowledge\n\n` +
        `Your account equity is currently \`$${parseFloat(acc.equity).toLocaleString("en-US", { minimumFractionDigits: 2 })}\`.\n\n` +
        `#### Live Account Questions\n` +
        `• *"How did I do today?"* · *"What positions are open?"* · *"What is my win rate?"*\n` +
        `• *"How much risk am I taking?"* · *"Show me my recent trades"* · *"What is my total ROI?"*\n\n` +
        `#### Strategy & Knowledge Questions\n` +
        `• *"How does the bot decide what to trade?"*\n` +
        `• *"What is RSI / VWAP / MACD / Bollinger Bands?"*\n` +
        `• *"What is momentum trading / mean reversion?"*\n` +
        `• *"Explain penny stocks / blue chips / short selling"*\n` +
        `• *"How do trailing stops work?"*\n` +
        `• *"What is the PDT rule?"*\n\n` +
        `What would you like to know?`,
    });
  } catch (err: any) {
    console.error("Oracle AI error:", err);
    return NextResponse.json({
      response:
        `⚠️ **Oracle AI encountered an error retrieving your data.**\n\n` +
        `*Details:* ${err.message ?? "Alpaca API unavailable"}\n\n` +
        `Please verify your Alpaca credentials are configured correctly in the environment variables.`,
    });
  }
}
