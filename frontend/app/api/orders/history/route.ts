import { NextRequest, NextResponse } from "next/server";

import { isAlpacaConnected, tradingFetch } from "@/lib/alpaca-server";

type AlpacaFillActivity = {
  id: string;
  order_id?: string | null;
  symbol?: string;
  side?: "buy" | "sell" | "sell_short" | "buy_to_cover";
  qty?: string;
  price?: string;
  transaction_time?: string;
};

type PositionState = {
  qty: number;
  avgCost: number;
};

function clampDays(value: string | null) {
  const parsed = Number.parseInt(value ?? "30", 10);
  if ([7, 30, 60, 90, 365].includes(parsed)) return parsed;
  return 30;
}

function applyFill(position: PositionState | undefined, side: "buy" | "sell", qty: number, price: number) {
  const current = position ?? { qty: 0, avgCost: 0 };
  const signedQty = side === "buy" ? qty : -qty;
  let realizedPnl = 0;

  if (current.qty === 0 || Math.sign(current.qty) === Math.sign(signedQty)) {
    const nextQty = current.qty + signedQty;
    const nextAvgCost = nextQty === 0
      ? 0
      : ((Math.abs(current.qty) * current.avgCost) + (qty * price)) / Math.abs(nextQty);
    return { next: { qty: nextQty, avgCost: nextAvgCost }, realizedPnl: null as number | null };
  }

  const closingQty = Math.min(Math.abs(current.qty), qty);
  if (current.qty > 0 && side === "sell") realizedPnl = (price - current.avgCost) * closingQty;
  if (current.qty < 0 && side === "buy") realizedPnl = (current.avgCost - price) * closingQty;

  const nextQty = current.qty + signedQty;
  if (nextQty === 0) {
    return { next: { qty: 0, avgCost: 0 }, realizedPnl };
  }

  if (Math.sign(nextQty) !== Math.sign(current.qty)) {
    return { next: { qty: nextQty, avgCost: price }, realizedPnl };
  }

  return { next: { qty: nextQty, avgCost: current.avgCost }, realizedPnl };
}

function normalizeSide(side: "buy" | "sell" | "sell_short" | "buy_to_cover") {
  if (side === "buy" || side === "buy_to_cover") return "buy";
  return "sell";
}

export async function GET(req: NextRequest) {
  if (!isAlpacaConnected()) {
    return NextResponse.json({ error: "Alpaca paper account is not connected." }, { status: 503 });
  }

  const days = clampDays(req.nextUrl.searchParams.get("days"));
  // Compute the start of the requested window (beginning of that day in UTC)
  const afterDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  afterDate.setUTCHours(0, 0, 0, 0);
  const after = afterDate.toISOString();

  try {
    const fills: AlpacaFillActivity[] = [];
    let pageToken: string | null = null;

    // Use direction=asc so we walk forward from `after` — this avoids the
    // Alpaca bug where mixing `after` + `page_token` + `direction=desc` can
    // cause the cursor to stop honouring the date window after the first page.
    // Up to 20 pages × 100 = 2000 fills, enough for a full year of active trading.
    for (let page = 0; page < 20; page += 1) {
      const queryParts: string[] = [
        "direction=asc",
        "page_size=100",
        `after=${encodeURIComponent(after)}`,
      ];
      if (pageToken) queryParts.push(`page_token=${encodeURIComponent(pageToken)}`);
      const query = queryParts.join("&");

      const batch = await tradingFetch<AlpacaFillActivity[]>(`/v2/account/activities/FILL?${query}`);
      fills.push(...batch);
      if (batch.length < 100) break;
      pageToken = batch[batch.length - 1]?.id ?? null;
      if (!pageToken) break;
    }

    const ordered = [...fills]
      .filter((fill) => fill.symbol && fill.side && fill.qty && fill.price && fill.transaction_time)
      .sort((a, b) => Date.parse(a.transaction_time!) - Date.parse(b.transaction_time!));

    const executedTrades = ordered.map((fill) => {
      const qty = Number.parseFloat(fill.qty!);
      const price = Number.parseFloat(fill.price!);
      return {
        id: fill.id,
        order_id: fill.order_id ?? null,
        symbol: fill.symbol!,
        side: fill.side!,
        qty,
        gross: qty * price,
        price,
        executed_at: fill.transaction_time!,
      };
    });

    const positions = new Map<string, PositionState>();
    let wins = 0;
    let losses = 0;
    let realizedPnl = 0;
    let turnover = 0;

    const trades = executedTrades.map((trade) => {
      const applied = applyFill(positions.get(trade.symbol), normalizeSide(trade.side), trade.qty, trade.price);
      const grossValue = trade.gross;
      const symbol = trade.symbol;
      positions.set(symbol, applied.next);

      if (applied.realizedPnl !== null) {
        realizedPnl += applied.realizedPnl;
        if (applied.realizedPnl > 0) wins += 1;
        if (applied.realizedPnl < 0) losses += 1;
      }
      turnover += grossValue;

      return {
        id: trade.id,
        order_id: trade.order_id,
        symbol,
        side: trade.side,
        qty: trade.qty,
        price: Number(trade.price.toFixed(6)),
        gross_value: grossValue,
        realized_pnl: applied.realizedPnl,
        running_position_qty: applied.next.qty,
        avg_cost_after: applied.next.qty === 0 ? null : applied.next.avgCost,
        mode: process.env.ALPACA_BASE_URL?.includes("paper") ? "paper" : "live",
        executed_at: trade.executed_at,
      };
    }).reverse();

    return NextResponse.json({
      range_days: days,
      summary: {
        total_trades: trades.length,
        realized_pnl: Number(realizedPnl.toFixed(2)),
        wins,
        losses,
        turnover: Number(turnover.toFixed(2)),
      },
      trades,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
}
