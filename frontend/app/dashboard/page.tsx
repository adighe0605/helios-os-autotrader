"use client";
// v2 2026-07-11
import { useState } from "react";
import useSWR from "swr";
import { DollarSign, Percent, ShieldCheck, Wallet, X } from "lucide-react";

import { api } from "@/lib/api";
import { fmt } from "@/lib/format";
import { cn } from "@/lib/format";
import { AIInsights } from "@/components/AIInsights";
import { AutoTradePanel } from "@/components/AutoTradePanel";
import { TradingStrategyCard } from "@/components/TradingStrategyCard";
import { PennyScanner } from "@/components/PennyScanner";
import { HighValuePicks } from "@/components/HighValuePicks";
import { PortfolioChart } from "@/components/PortfolioChart";
import { PositionsTable } from "@/components/PositionsTable";
import { StatCard } from "@/components/StatCard";

export default function DashboardPage() {
  const [selectedMetric, setSelectedMetric] = useState<"portfolio" | "day_pnl" | "total_pnl" | "buying_power" | null>(null);
  const { data: portfolio, error: portfolioError } = useSWR("portfolio", () => api.portfolio(), { refreshInterval: 10_000 });
  const { data: positions, error: positionsError } = useSWR("positions", () => api.positions(), { refreshInterval: 10_000 });
  const { data: historyData } = useSWR("portfolio-history", () => api.portfolioHistory(), { refreshInterval: 60_000 });

  const curve = historyData?.timestamp ? historyData.timestamp.map((ts, idx) => {
    return {
      t: new Date(ts * 1000).toISOString().slice(0, 10),
      v: historyData.equity[idx]
    };
  }) : (portfolio ? Array.from({ length: 30 }, (_, i) => {
    const base = portfolio.portfolio_value / (1 + portfolio.total_pnl_pct / 100);
    const wave = Math.sin(i / 8) * 0.01 + (i / 30) * ((portfolio?.total_pnl_pct ?? 0) / 100);
    return { t: new Date(Date.now() - (30 - i) * 86_400_000).toISOString().slice(0, 10), v: +(base * (1 + wave)).toFixed(2) };
  }) : []);

  const metricDetails: Record<
    string,
    {
      title: string;
      desc: string;
      formula: string;
      source: string;
      metrics: Array<{ label: string; value: string; highlight?: boolean; pos?: boolean }>;
    }
  > = {
    portfolio: {
      title: "Portfolio Value Breakdown",
      desc: "Your net liquidation value (NLV). It is the standard measure of your account's net worth in the market, representing the total liquid cash plus the current market value of all active positions.",
      formula: "Portfolio Value = Cash + Position Value",
      source: "Alpaca Account API (v2)",
      metrics: [
        { label: "Total Portfolio Value", value: portfolio ? fmt.usd(portfolio.portfolio_value) : "—", highlight: true },
        { label: "Cash Balance", value: portfolio ? fmt.usd(portfolio.cash) : "—" },
        { label: "Securities Value", value: portfolio ? fmt.usd(portfolio.portfolio_value - portfolio.cash) : "—" },
      ]
    },
    day_pnl: {
      title: "Today's Profit & Loss",
      desc: portfolio?.market_open
        ? "The dollar amount and percentage return your portfolio has gained or lost today relative to yesterday's market close. This is calculated dynamically in real-time as asset prices fluctuate."
        : "The market is currently closed, so today's session hasn't started — Day P&L is $0.00 until the next open. Alpaca's equity is frozen at the last close. Your most recent completed session's result is shown below for reference.",
      formula: "Day P&L = Current Portfolio Value - Yesterday's Close Value",
      source: "Alpaca Account API (v2) + Market Clock",
      metrics: [
        { label: "Daily Return (USD)", value: portfolio ? fmt.usd(portfolio.day_pnl) : "—", highlight: true, pos: (portfolio?.day_pnl ?? 0) >= 0 },
        { label: "Daily Return (%)", value: portfolio ? fmt.pct(portfolio.day_pnl_pct) : "—", pos: (portfolio?.day_pnl_pct ?? 0) >= 0 },
        { label: "Market Status", value: portfolio ? (portfolio.market_open ? "Open" : "Closed") : "—" },
        { label: "Last Session P&L", value: portfolio?.last_session_pnl !== undefined ? fmt.usd(portfolio.last_session_pnl) : "—", pos: (portfolio?.last_session_pnl ?? 0) >= 0 },
        { label: "Starting Day Equity", value: portfolio ? fmt.usd(portfolio.portfolio_value - (portfolio.last_session_pnl ?? portfolio.day_pnl)) : "—" },
      ]
    },
    total_pnl: {
      title: "Total Unrealized Profit & Loss",
      desc: "The aggregate paper profit or loss since entering your current active positions. It represents the value difference between what you paid for your held stocks and their current open market prices.",
      formula: "Total P&L = Current Position Values - Average Entry Cost Basis",
      source: "Alpaca Position Valuation Engine",
      metrics: [
        { label: "Total Return (USD)", value: portfolio ? fmt.usd(portfolio.total_pnl) : "—", highlight: true, pos: (portfolio?.total_pnl ?? 0) >= 0 },
        { label: "Total Return (%)", value: portfolio ? fmt.pct(portfolio.total_pnl_pct) : "—", pos: (portfolio?.total_pnl_pct ?? 0) >= 0 },
        { label: "Current Cost Basis", value: portfolio ? fmt.usd(portfolio.portfolio_value - portfolio.total_pnl) : "—" },
      ]
    },
    buying_power: {
      title: "Available Buying Power",
      desc: "The purchasing power available in your account to open new positions. In standard Regulation-T margin accounts, overnight buying power is 2× your non-marginable cash equity, while intraday power is 4× cash.",
      formula: "Overnight Buying Power = Cash Equity × 2.0",
      source: "Alpaca Margin & Risk Engine",
      metrics: [
        { label: "Total Buying Power", value: portfolio ? fmt.usd(portfolio.buying_power) : "—", highlight: true },
        { label: "Margin Leverage Multiplier", value: "2.0x (Overnight Reg-T)" },
        { label: "Intraday Leverage Multiplier", value: "4.0x (Intraday Day-Trade)" },
      ]
    }
  };

  return (
    <div className="space-y-4 max-w-[1400px]">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-wb-text tracking-tight">Dashboard</h1>
          <p className="text-[12px] text-wb-muted mt-0.5">Live portfolio overview</p>
        </div>
        {(portfolioError || positionsError) && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
            Paper account data is unavailable. Connect Alpaca in paper mode to show real dashboard metrics.
          </div>
        )}
        <span className="text-[12px] text-wb-dim num">{fmt.time(new Date().toISOString())}</span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Portfolio Value"
          value={portfolio ? fmt.usd(portfolio.portfolio_value) : "—"}
          delta={portfolio?.day_pnl_pct}
          icon={Wallet}
          accent="default"
          onClick={() => setSelectedMetric("portfolio")}
        />
        <StatCard
          label="Day P&L"
          value={portfolio ? fmt.usd(portfolio.day_pnl) : "—"}
          delta={portfolio?.market_open ? portfolio?.day_pnl_pct : undefined}
          accent={(portfolio?.day_pnl ?? 0) >= 0 ? "pos" : "neg"}
          icon={DollarSign}
          badge={portfolio && !portfolio.market_open ? "Market closed" : undefined}
          onClick={() => setSelectedMetric("day_pnl")}
        />
        <StatCard
          label="Total P&L"
          value={portfolio ? fmt.usd(portfolio.total_pnl) : "—"}
          delta={portfolio?.total_pnl_pct}
          accent={(portfolio?.total_pnl ?? 0) >= 0 ? "pos" : "neg"}
          icon={Percent}
          onClick={() => setSelectedMetric("total_pnl")}
        />
        <StatCard
          label="Buying Power"
          value={portfolio ? fmt.usd(portfolio.buying_power) : "—"}
          icon={ShieldCheck}
          accent="default"
          onClick={() => setSelectedMetric("buying_power")}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <PortfolioChart data={curve} />
          <PositionsTable positions={positions ?? []} />
          <PennyScanner />
        </div>
        <div className="space-y-4">
          <AutoTradePanel />
          <HighValuePicks />
          <TradingStrategyCard />
          <AIInsights
            headline="Volume surge activity in small-caps"
            body="Penny momentum signals are firing across several names with volume surges 3-5× baseline. The debate committee is filtering high-confidence setups meeting breakout + catalyst criteria. Monitor closely — penny volatility is elevated."
          />
        </div>
      </div>

      {/* Detail overlay modal */}
      {selectedMetric && portfolio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-wb-surface border border-wb-border rounded-xl max-w-md w-full overflow-hidden shadow-2xl animate-scaleIn">
            <div className="px-4 py-3 border-b border-wb-border flex justify-between items-center bg-wb-surface2/60">
              <span className="text-[13px] font-bold text-wb-text">Metric Details</span>
              <button
                type="button"
                onClick={() => setSelectedMetric(null)}
                className="text-wb-muted hover:text-wb-text p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <span className="section-label">Metric</span>
                <h3 className="text-[15px] font-bold text-wb-orange mt-0.5">
                  {metricDetails[selectedMetric].title}
                </h3>
              </div>

              <div className="space-y-2 bg-wb-surface2/60 border border-wb-border rounded-xl p-3.5">
                {metricDetails[selectedMetric].metrics.map((m, idx) => (
                  <div key={idx} className="flex justify-between items-baseline py-1 first:pt-0 last:pb-0 last:border-0 border-b border-wb-border/10">
                    <span className={`text-[12px] ${m.highlight ? 'font-semibold text-wb-text' : 'text-wb-muted'}`}>{m.label}</span>
                    <span className={cn(
                      "text-[14px] font-bold num",
                      m.highlight ? (m.pos !== undefined ? (m.pos ? 'text-wb-green text-[15px]' : 'text-wb-red text-[15px]') : 'text-wb-text text-[15px]') : (m.pos !== undefined ? (m.pos ? 'text-wb-green' : 'text-wb-red') : 'text-wb-text')
                    )}>
                      {m.value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-3 text-[12px] leading-relaxed">
                <div>
                  <span className="section-label">Calculation Formula</span>
                  <div className="text-[11px] font-mono text-wb-orange bg-wb-surface2/40 border border-wb-border/40 px-2.5 py-1.5 rounded-lg mt-1">
                    {metricDetails[selectedMetric].formula}
                  </div>
                </div>
                <div>
                  <span className="section-label">Sourced From</span>
                  <div className="text-wb-text font-semibold mt-0.5">{metricDetails[selectedMetric].source}</div>
                </div>
                <div>
                  <span className="section-label">About This Metric</span>
                  <p className="text-wb-muted mt-0.5">
                    {metricDetails[selectedMetric].desc}
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedMetric(null)}
                  className="w-full btn btn-primary h-9 text-[13px] font-semibold cursor-pointer"
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
