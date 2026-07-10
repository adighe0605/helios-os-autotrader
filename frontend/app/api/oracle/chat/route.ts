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
    // ── 1. TODAY'S PERFORMANCE ──────────────────────────────────────────────
    if (matchesAny(p, ["today", "how did i do", "make today", "do today", "daily", "day pnl", "day p&l"])) {
      const [acc, positions, fills] = await Promise.all([
        getAccount(),
        getPositions(),
        getRecentFills(1),
      ]);

      const equity = parseFloat(acc.equity);
      const lastEquity = parseFloat(acc.last_equity);
      const dayPnl = equity - lastEquity;
      const dayPct = lastEquity > 0 ? (dayPnl / lastEquity) * 100 : 0;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayFills = fills.filter(
        (f) => f.transaction_time && new Date(f.transaction_time) >= todayStart
      );

      const buys = todayFills.filter((f) => f.side === "buy").length;
      const sells = todayFills.filter((f) => f.side === "sell" || f.side === "sell_short").length;

      return NextResponse.json({
        response:
          `### 📈 Today's Performance\n\n` +
          `**Source:** Alpaca Account API (live paper account)\n\n` +
          `• **Day P&L:** \`${fmt(dayPnl)}\` (${fmtPct(dayPct)})\n` +
          `• **Portfolio Value:** \`$${equity.toLocaleString("en-US", { minimumFractionDigits: 2 })}\`\n` +
          `• **Cash Available:** \`$${parseFloat(acc.cash).toLocaleString("en-US", { minimumFractionDigits: 2 })}\`\n` +
          `• **Fills Today:** \`${todayFills.length}\` (${buys} buys · ${sells} sells)\n` +
          `• **Open Positions:** \`${positions.length}\`\n\n` +
          (dayPnl >= 0
            ? `🟢 You are up on the day. Great trading session!`
            : `🔴 You are down on the day. Markets move both ways — manage risk carefully.`),
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

    // ── DEFAULT: HELP ─────────────────────────────────────────────────────────
    const acc = await getAccount();
    return NextResponse.json({
      response:
        `### 👋 Oracle AI — Trading Analyst\n\n` +
        `**Source:** Alpaca Account API\n\n` +
        `Your account equity is currently \`$${parseFloat(acc.equity).toLocaleString("en-US", { minimumFractionDigits: 2 })}\`.\n\n` +
        `I can answer questions like:\n` +
        `• *"How did I do today?"*\n` +
        `• *"What positions are open?"*\n` +
        `• *"What is my win rate?"*\n` +
        `• *"How much risk am I taking?"*\n` +
        `• *"How much can I make next month?"*\n` +
        `• *"Show me my recent trades"*\n` +
        `• *"What is my total ROI?"*\n` +
        `• *"What's my account balance?"*\n\n` +
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
