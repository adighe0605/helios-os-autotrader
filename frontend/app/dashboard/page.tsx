"use client";

import useSWR from "swr";
import { DollarSign, Percent, ShieldCheck, Wallet } from "lucide-react";

import { api } from "@/lib/api";
import { fmt } from "@/lib/format";
import { AIInsights } from "@/components/AIInsights";
import { AutoTradePanel } from "@/components/AutoTradePanel";
import { PennyScanner } from "@/components/PennyScanner";
import { PortfolioChart } from "@/components/PortfolioChart";
import { PositionsTable } from "@/components/PositionsTable";
import { StatCard } from "@/components/StatCard";

export default function DashboardPage() {
  const { data: portfolio } = useSWR("portfolio", () => api.portfolio(), { refreshInterval: 10_000 });
  const { data: positions } = useSWR("positions", () => api.positions(), { refreshInterval: 10_000 });

  const curve = Array.from({ length: 90 }, (_, i) => {
    const base = (portfolio?.portfolio_value ?? 100_000) / (1 + (portfolio?.total_pnl_pct ?? 0) / 100);
    const wave = Math.sin(i / 8) * 0.02 + (i / 90) * ((portfolio?.total_pnl_pct ?? 0) / 100);
    return { t: new Date(Date.now() - (90 - i) * 86_400_000).toISOString().slice(0, 10), v: +(base * (1 + wave)).toFixed(2) };
  });

  return (
    <div className="space-y-4 max-w-[1400px]">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-wb-text tracking-tight">Dashboard</h1>
          <p className="text-[12px] text-wb-muted mt-0.5">Live portfolio overview</p>
        </div>
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
        />
        <StatCard
          label="Day P&L"
          value={portfolio ? fmt.usd(portfolio.day_pnl) : "—"}
          delta={portfolio?.day_pnl_pct}
          accent={(portfolio?.day_pnl ?? 0) >= 0 ? "pos" : "neg"}
          icon={DollarSign}
        />
        <StatCard
          label="Total P&L"
          value={portfolio ? fmt.usd(portfolio.total_pnl) : "—"}
          delta={portfolio?.total_pnl_pct}
          accent={(portfolio?.total_pnl ?? 0) >= 0 ? "pos" : "neg"}
          icon={Percent}
        />
        <StatCard
          label="Buying Power"
          value={portfolio ? fmt.usd(portfolio.buying_power) : "—"}
          icon={ShieldCheck}
          accent="default"
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
          <AIInsights
            headline="Volume surge activity in small-caps"
            body="Penny momentum signals are firing across several names with volume surges 3-5× baseline. The debate committee is filtering high-confidence setups meeting breakout + catalyst criteria. Monitor closely — penny volatility is elevated."
          />
        </div>
      </div>
    </div>
  );
}

